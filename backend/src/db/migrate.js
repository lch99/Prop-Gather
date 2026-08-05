import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

// Applies every *.sql file in migrations/ that isn't already recorded in the
// migrations table, in filename order, each inside its own transaction.
export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const applied = new Set(db.prepare('SELECT name FROM migrations').all().map((row) => row.name))

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
    })()
    if (process.env.NODE_ENV !== 'test') console.log(`[migrate] applied ${file}`)
  }
}
