import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, loginWithId, ADMIN, sampleDocumentFile } from './helpers.js'

let app
beforeEach(async () => { app = await freshApp() })

async function registerUser(app, email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Applicant', email, password: 'password123' })
  return { token: res.body.token, userId: res.body.user.id }
}

describe('GET /api/audit-log', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/audit-log')
    expect(res.status).toBe(401)
  })

  it('rejects a non-admin', async () => {
    const { token } = await registerUser(app, 'notadmin-audit@example.com')
    const res = await authed(app, token).get('/api/audit-log')
    expect(res.status).toBe(403)
  })

  it('logs a submission and a decision, newest first', async () => {
    const { token, userId } = await registerUser(app, 'audit1@example.com')
    const created = await authed(app, token).post('/api/applications').send({
      projectId: 'p2', unit: '5-5', tier: 'Owner', document: 'SPA', documentFile: sampleDocumentFile(), consent: true
    })

    const admin = await loginWithId(app, ADMIN.email, ADMIN.password)
    await authed(app, admin.token).post(`/api/applications/${created.body.id}/decision`).send({ decision: 'approve' })

    const res = await authed(app, admin.token).get('/api/audit-log')
    expect(res.status).toBe(200)

    const submitted = res.body.find(e => e.action === 'application.submitted' && e.targetId === created.body.id)
    expect(submitted).toBeTruthy()
    expect(submitted.actorUserId).toBe(userId)

    const approved = res.body.find(e => e.action === 'application.approved' && e.targetId === created.body.id)
    expect(approved).toBeTruthy()
    expect(approved.actorUserId).toBe(admin.userId)
    expect(approved.actorName).toBe(admin.name)

    expect(res.body.indexOf(approved)).toBeLessThan(res.body.indexOf(submitted))
  })

  it('logs the admin queue being viewed', async () => {
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    await authed(app, adminToken).get('/api/applications')

    const res = await authed(app, adminToken).get('/api/audit-log?action=application.list_viewed')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body.every(e => e.action === 'application.list_viewed')).toBe(true)
  })

  it('logs a withdrawal', async () => {
    const { token, userId } = await registerUser(app, 'audit2@example.com')
    const created = await authed(app, token).post('/api/applications').send({
      projectId: 'p2', unit: '5-6', tier: 'Owner', document: 'SPA', documentFile: sampleDocumentFile(), consent: true
    })
    await authed(app, token).delete(`/api/applications/${created.body.id}`)

    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, adminToken).get('/api/audit-log?action=application.withdrawn')
    expect(res.status).toBe(200)
    const entry = res.body.find(e => e.targetId === created.body.id)
    expect(entry).toBeTruthy()
    expect(entry.actorUserId).toBe(userId)
    expect(entry.metadata.withdrawnBySelf).toBe(true)
  })

  it('filters by targetType', async () => {
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, adminToken).get('/api/audit-log?targetType=application')
    expect(res.status).toBe(200)
    expect(res.body.every(e => e.targetType === 'application')).toBe(true)
  })

  it('records a cross-border transfer record on submission (PDPA s.129 record-keeping)', async () => {
    const { token } = await registerUser(app, 'transferrecord@example.com')
    const created = await authed(app, token).post('/api/applications').send({
      projectId: 'p2', unit: '9-9', tier: 'Owner', document: 'SPA', documentFile: sampleDocumentFile(), consent: true
    })

    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, adminToken).get('/api/audit-log?action=application.cross_border_transfer')
    expect(res.status).toBe(200)
    const entry = res.body.find(e => e.targetId === created.body.id)
    expect(entry).toBeTruthy()
    expect(entry.metadata).toMatchObject({
      purpose: 'Identity verification document storage',
      legalBasis: 'Explicit consent (PDPA s.129(3))'
    })
    expect(entry.metadata.receiver).toBeTruthy()
    expect(entry.metadata.consentAcceptedAt).toBeTruthy()
  })
})
