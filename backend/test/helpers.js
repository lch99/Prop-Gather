import request from 'supertest'
import { createApp } from '../src/app.js'
import { getDb } from '../src/db/index.js'
import { runMigrations } from '../src/db/migrate.js'
import { seed } from '../src/db/seed.js'
import { _resetRateLimits } from '../src/middleware/rateLimit.js'

let counter = 0
let migrated = false
let tableNames = null

async function tables() {
  if (tableNames) return tableNames
  const rows = await getDb().all(
    `SELECT TABLE_NAME AS t FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> 'migrations'`
  )
  tableNames = rows.map(r => r.t)
  return tableNames
}

// Fresh database state + seed data + a new express app instance. Call in
// beforeEach so every test starts from an identical slate. Also clears the login
// rate limiter's module-level state, which otherwise persists across tests in
// the same file (many tests here log in as ADMIN repeatedly).
//
// There is no in-memory database to throw away — tests run against a real MySQL
// schema (MYSQL_DATABASE in vitest.config.js, `propgather_test` by default) so
// they exercise the dialect actually deployed. Isolation therefore means
// emptying the tables:
//
//   * DELETE, not TRUNCATE — these tables hold at most a few hundred rows, and
//     TRUNCATE is DDL, so it implicitly commits and is slower here.
//   * FOREIGN_KEY_CHECKS is toggled on ONE pinned connection. The setting is
//     session-scoped, so doing it through the pool could disable checks on one
//     connection and delete on another that still has them on.
//
// vitest.config.js sets fileParallelism:false because every test file shares
// this one database — running two files at once would have them wiping each
// other's rows mid-test.
export async function freshApp() {
  if (!migrated) {
    await runMigrations()
    migrated = true
  }

  const conn = await getDb().raw.getConnection()
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const t of await tables()) await conn.query(`DELETE FROM \`${t}\``)
    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
  } finally {
    conn.release()
  }

  await seed()
  _resetRateLimits()
  return createApp()
}

export async function login(app, email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.token
}

export async function loginWithId(app, email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { token: res.body.token, userId: res.body.user.id, name: res.body.user.name }
}

export function authed(app, token) {
  return {
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    patch: (url) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`)
  }
}

export const RESIDENT = { email: 'resident@propgather.com', password: 'resident123', projectId: 'p1' }
export const ADMIN = { email: 'admin@propgather.com', password: 'admin123' }

// The real flow is: POST /api/applications/upload-url -> PUT bytes to S3 -> submit
// the returned key here. Tests skip the middle step since S3 is mocked (see
// test/setup.js) — any key other than the 'missing-key' sentinel is treated as
// already uploaded.
export const sampleDocumentFile = (name = 'proof.pdf') => ({
  name,
  type: 'application/pdf',
  size: 1024,
  key: `verification-docs/test-user/${name}-${Math.random().toString(36).slice(2)}`
})

// Registers a brand-new user and gets them verified as a resident of `projectId`
// via the real register -> apply -> admin-approve flow. Returns { token, userId, unit, tier }.
export async function verifiedResident(app, projectId, { tier = 'Owner', unit } = {}) {
  counter += 1
  const email = `test.user.${counter}@example.com`
  const finalUnit = unit || `T-${counter}`

  const reg = await request(app).post('/api/auth/register').send({ name: `Test User ${counter}`, email, password: 'password123' })
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg.body)}`)
  const token = reg.body.token
  const userId = reg.body.user.id

  const appRes = await authed(app, token).post('/api/applications').send({ projectId, unit: finalUnit, tier, document: 'utility bill', documentFile: sampleDocumentFile(), consent: true })
  if (appRes.status !== 201) throw new Error(`application failed: ${JSON.stringify(appRes.body)}`)

  const adminToken = await login(app, ADMIN.email, ADMIN.password)
  const decideRes = await authed(app, adminToken).post(`/api/applications/${appRes.body.id}/decision`).send({ decision: 'approve' })
  if (decideRes.status !== 200) throw new Error(`approve failed: ${JSON.stringify(decideRes.body)}`)

  return { token, userId, unit: finalUnit, tier, email }
}

// Registers a brand-new user with no community membership anywhere.
export async function outsider(app) {
  counter += 1
  const email = `outsider.${counter}@example.com`
  const reg = await request(app).post('/api/auth/register').send({ name: `Outsider ${counter}`, email, password: 'password123' })
  return { token: reg.body.token, userId: reg.body.user.id, email }
}
