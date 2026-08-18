// MySQL connection pool and the small query surface the rest of the app uses.
//
// Every query is asynchronous, so callers await and any function containing one
// is async:
//
//   await db.get(sql, [a, b])   ->  one row
//   await db.all(sql, [a])      ->  all rows
//   await db.run(sql, [a])      ->  { changes, insertId }
//
// Named parameters are `:name`, bound from an object (namedPlaceholders).
import mysql from 'mysql2/promise'

let pool

function config() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'propgather',
    // utf8mb4, not utf8: Malaysian names carry accents and residents post emoji.
    // MySQL's "utf8" is a 3-byte subset that silently mangles both.
    charset: 'utf8mb4',
    // Dates come back as strings rather than JS Date objects. Every timestamp in
    // this schema is an ISO-8601 string the app compares and serializes as text
    // (see util/serialize.js); letting the driver parse them into Date would
    // change what routes return and break the 14-day retention comparison.
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE) || 10,
    queueLimit: 0,
    namedPlaceholders: true
  }
}

// Wraps a pool or a single connection in the get/all/run surface above, so the
// same helper shape works inside a transaction (where queries must be pinned to
// one connection) as outside it.
function wrap(executor) {
  return {
    raw: executor,
    async all(sql, params = []) {
      const [rows] = await executor.execute(sql, params)
      return rows
    },
    async get(sql, params = []) {
      const [rows] = await executor.execute(sql, params)
      return rows[0]
    },
    async run(sql, params = []) {
      const [result] = await executor.execute(sql, params)
      return { changes: result.affectedRows, insertId: result.insertId }
    },
    // Same as all(), but sends the query directly instead of preparing it.
    // Use for SQL whose *shape* varies per call — an `IN (?, ?, …)` list built
    // from an array, most obviously. execute() caches a prepared statement per
    // distinct SQL string, so a variable-length IN list would mint a new one for
    // every list size and slowly fill that cache. Parameters are still escaped
    // by the driver; this is not string interpolation.
    async allDynamic(sql, params = []) {
      const [rows] = await executor.query(sql, params)
      return rows
    },
    // For statements mysql2's prepared-statement protocol rejects (DDL with
    // certain clauses, and anything needing multiple statements). Not for
    // user input — nothing here interpolates request data.
    async exec(sql) {
      const [result] = await executor.query(sql)
      return result
    }
  }
}

export function getDb() {
  if (!pool) pool = mysql.createPool(config())
  return wrap(pool)
}

// Runs `fn` inside a transaction, pinned to one connection. The callback gets a
// db-shaped object it MUST use for every query in the transaction — using the
// pool inside would grab a different connection and silently run outside it.
export async function withTransaction(fn) {
  if (!pool) pool = mysql.createPool(config())
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(wrap(conn))
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// Migration files are trusted, in-repo, and contain many statements each, so
// they get their own connection with multipleStatements enabled. The pool
// deliberately does NOT have it: multi-statement support turns any future SQL
// injection from a single-query problem into an arbitrary-script one.
//
// namedPlaceholders is forced off here. MySQL's variable-assignment operator
// (`SET @x := …`, which the guarded ALTERs in 0002-0004 rely on) is
// indistinguishable from a `:name` placeholder to the parser, so leaving it on
// makes every migration using one fail to even parse.
export async function migrationConnection() {
  return mysql.createConnection({
    ...config(),
    multipleStatements: true,
    namedPlaceholders: false
  })
}

export async function closeDb() {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}
