import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { migrationConnection } from './index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

// Creates the database if the configured user is allowed to and it doesn't
// exist yet — convenient for a fresh dev machine or test run. In production the
// database is normally created ahead of time by the deploy (see DEPLOYMENT.md),
// and the app user may not hold CREATE privileges, so a failure here is not
// fatal: the connection attempt that follows produces the real error.
async function ensureDatabase() {
  const database = process.env.MYSQL_DATABASE || 'propgather'
  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || ''
    })
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
  } catch {
    // Ignored on purpose — see above.
  } finally {
    if (conn) await conn.end()
  }
}

// Applies every *.sql file in migrations/ that isn't already recorded in the
// migrations table, in filename order.
//
// ⚠️ A migration is NOT atomic. MySQL implicitly commits before and after
// every DDL statement, so `ALTER TABLE`
// cannot be rolled back — a file that fails halfway leaves its earlier
// statements applied. The runner records a migration only after the whole file
// succeeds, so the next boot retries it from the top. That is why every
// statement in migrations/ is written to be safely re-runnable
// (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`, guarded ALTERs): re-running a
// partially applied file has to be a no-op for the statements that already
// landed, or the retry fails forever and the service won't start.
export async function runMigrations() {
  await ensureDatabase()

  const conn = await migrationConnection()
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name       VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at VARCHAR(40)  NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    const [rows] = await conn.query('SELECT name FROM migrations')
    const applied = new Set(rows.map((row) => row.name))

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      if (applied.has(file)) continue

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      await conn.query(sql)
      await conn.query('INSERT INTO migrations (name, applied_at) VALUES (?, ?)', [
        file,
        new Date().toISOString()
      ])
      if (process.env.NODE_ENV !== 'test') console.log(`[migrate] applied ${file}`)
    }
  } finally {
    await conn.end()
  }
}
