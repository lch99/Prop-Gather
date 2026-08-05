import { purgeApplications, RETENTION_DAYS } from './purgeApplications.js'

const { checked, purged } = await purgeApplications()
// eslint-disable-next-line no-console
console.log(`[purge] checked ${checked} decided application(s) past the ${RETENTION_DAYS}-day retention window, purged ${purged} document(s)`)
