import { createApp } from './app.js'
import { allowedOrigins } from './middleware/cors.js'
import { runMigrations } from './db/migrate.js'
import { seed } from './db/seed.js'
import { purgeApplications } from './jobs/purgeApplications.js'

// Migrations run before the server accepts a connection. On MySQL they are a
// series of round trips rather than an in-process call, so this is an explicit
// await at startup instead of a side effect of the first query — a broken
// migration fails the boot, loudly, rather than 500ing one endpoint later.
await runMigrations()

// Demo data is opt-in, because a production database has to start empty.
// seed() inserts six fictional projects plus accounts whose passwords are
// published in this repo's README (admin@propgather.com / admin123 among
// them) — harmless locally, an unlocked front door on a server real residents
// can reach. Set SEED_DEMO_DATA=true for local development (see .env.example),
// or run `npm run seed` once against an existing database.
if (process.env.SEED_DEMO_DATA === 'true') {
  await seed()
}

const PORT = process.env.PORT || 4000
const app = createApp()

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PropGather backend listening on http://localhost:${PORT}`)
  // Logged because a CORS allowlist that doesn't include the deployed frontend
  // presents as "every page is empty" in the browser with nothing in this log to
  // explain it. Printing the effective list makes that a five-second diagnosis.
  // eslint-disable-next-line no-console
  console.log(`CORS: allowing ${allowedOrigins().join(', ')}${process.env.CORS_ORIGINS ? '' : ' (CORS_ORIGINS unset — dev defaults)'}`)
})

// Document retention: purge decided applications' documents past the 14-day
// window (see backend/src/jobs/purgeApplications.js). Runs on startup and then
// daily — set ENABLE_RETENTION_JOB=false to disable in-process scheduling and
// rely solely on `npm run purge` via an external cron instead.
if (process.env.ENABLE_RETENTION_JOB !== 'false') {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  const runPurge = () => purgeApplications().catch(err => {
    // eslint-disable-next-line no-console
    console.error('[purge] retention job failed', err)
  })
  runPurge()
  setInterval(runPurge, ONE_DAY_MS)
}
