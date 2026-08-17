import { runMigrations } from './migrate.js'
import { closeDb } from './index.js'

await runMigrations()
await closeDb()
console.log('Migrations up to date.')
