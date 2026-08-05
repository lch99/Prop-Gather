import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigrations } from './migrate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let db

export function getDb() {
  if (db) return db

  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data.sqlite3')
  const isMemory = dbPath === ':memory:'
  db = new Database(dbPath)

  if (!isMemory) db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

export function resetDb() {
  db = null
}
