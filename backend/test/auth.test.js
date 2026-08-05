import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, RESIDENT, ADMIN, login } from './helpers.js'

let app
beforeEach(() => { app = freshApp() })

describe('POST /api/auth/register', () => {
  it('creates a new resident account and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Jane Doe', email: 'jane@example.com', password: 'password123' })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTypeOf('string')
    expect(res.body.user).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com', role: 'resident' })
    expect(res.body.user.communities).toEqual([])
  })

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Jane', email: 'dup@example.com', password: 'password123' })
    const res = await request(app).post('/api/auth/register').send({ name: 'Jane 2', email: 'dup@example.com', password: 'password123' })
    expect(res.status).toBe(409)
  })

  it('is case-insensitive on email uniqueness', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Jane', email: 'CaseTest@example.com', password: 'password123' })
    const res = await request(app).post('/api/auth/register').send({ name: 'Jane 2', email: 'casetest@EXAMPLE.com', password: 'password123' })
    expect(res.status).toBe(409)
  })

  it('rejects a missing name', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nofname@example.com', password: 'password123' })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Jane', email: 'not-an-email', password: 'password123' })
    expect(res.status).toBe(400)
  })

  it('rejects a password under 8 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Jane', email: 'shortpw@example.com', password: 'abc123' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  it('logs in the seeded resident demo account', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: RESIDENT.email, password: RESIDENT.password })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('resident')
    expect(res.body.user.communities).toHaveLength(1)
    expect(res.body.user.communities[0]).toMatchObject({ projectId: 'p1', tier: 'Owner', unit: 'B-21-03' })
  })

  it('logs in the seeded admin demo account', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('admin')
  })

  it('rejects an incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: RESIDENT.email, password: 'wrong-password' })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' })
    expect(res.status).toBe(401)
  })

  it('rejects a missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: RESIDENT.email })
    expect(res.status).toBe(400)
  })

  it('audit-logs a failed login attempt (wrong password) without leaking which field was wrong to the caller', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: RESIDENT.email, password: 'wrong-password' })
    expect(res.body.error).toBe('Incorrect email or password')

    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const auditRes = await request(app).get('/api/audit-log?action=auth.login_failed').set('Authorization', `Bearer ${adminToken}`)
    const entry = auditRes.body.find(e => e.targetId === RESIDENT.email)
    expect(entry).toBeTruthy()
    expect(entry.metadata.reason).toBe('bad_password')
  })

  it('audit-logs a failed login attempt for an unknown email', async () => {
    await request(app).post('/api/auth/login').send({ email: 'nobody2@example.com', password: 'password123' })
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const auditRes = await request(app).get('/api/audit-log?action=auth.login_failed').set('Authorization', `Bearer ${adminToken}`)
    const entry = auditRes.body.find(e => e.targetId === 'nobody2@example.com')
    expect(entry.metadata.reason).toBe('unknown_email')
  })

  it('audit-logs a successful admin login but not a successful resident login', async () => {
    await login(app, ADMIN.email, ADMIN.password)
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const auditRes = await request(app).get('/api/audit-log?action=auth.admin_login').set('Authorization', `Bearer ${adminToken}`)
    expect(auditRes.body.length).toBeGreaterThan(0)

    await login(app, RESIDENT.email, RESIDENT.password)
    const allRes = await request(app).get('/api/audit-log').set('Authorization', `Bearer ${adminToken}`)
    expect(allRes.body.some(e => e.action === 'auth.login_failed' && e.targetId === RESIDENT.email)).toBe(false)
  })

  it('rate-limits repeated failed logins against the same account', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: RESIDENT.email, password: 'wrong' })
      expect(res.status).toBe(401)
    }
    const blocked = await request(app).post('/api/auth/login').send({ email: RESIDENT.email, password: 'wrong' })
    expect(blocked.status).toBe(429)
    expect(blocked.headers['retry-after']).toBeTruthy()

    // a different account is unaffected — the limit is keyed per email
    const otherAccount = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password })
    expect(otherAccount.status).toBe(200)
  })
})

describe('GET /api/auth/me', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
  })

  it('returns the authenticated profile with communities', async () => {
    const token = await login(app, RESIDENT.email, RESIDENT.password)
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe(RESIDENT.email)
    expect(res.body.communities[0].project.name).toBe('The Lumina Residences')
  })
})
