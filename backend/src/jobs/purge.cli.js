import { purgeApplications, RETENTION_DAYS } from './purgeApplications.js'
import { closeDb } from '../db/index.js'

const { checked, purged } = await purgeApplications()
// eslint-disable-next-line no-console
console.log(`[purge] checked ${checked} decided application(s) past the ${RETENTION_DAYS}-day retention window, purged ${purged} document(s)`)

// Required, not tidiness: an open mysql2 pool keeps the event loop alive, so
// without this the process runs forever. This is wired to a nightly cron in
// DEPLOYMENT.md — a version that never exits would leave one stuck process per
// night until the box ran out.
await closeDb()
