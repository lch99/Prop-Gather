import { createApp } from './app.js'
import { seed } from './db/seed.js'
import { purgeApplications } from './jobs/purgeApplications.js'

seed()

const PORT = process.env.PORT || 4000
const app = createApp()

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PropGather backend listening on http://localhost:${PORT}`)
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
