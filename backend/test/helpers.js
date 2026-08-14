import request from 'supertest'
import { createApp } from '../src/app.js'
import { resetDb } from '../src/db/index.js'
import { seed } from '../src/db/seed.js'
import { _resetRateLimits } from '../src/middleware/rateLimit.js'

let counter = 0

// Fresh in-memory DB + seed data + a new express app instance. Call in beforeEach
// so every test starts from an identical, isolated slate. Also clears the login
// rate limiter's module-level state, which otherwise persists across tests in
// the same file (many tests here log in as ADMIN repeatedly).
export function freshApp() {
  resetDb()
  seed()
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
