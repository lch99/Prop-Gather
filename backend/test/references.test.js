import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, RESIDENT, ADMIN } from './helpers.js'

let app
let residentToken
let adminToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
  adminToken = await login(app, ADMIN.email, ADMIN.password)
})

describe('GET /api/projects/:projectId/references', () => {
  it('lists seeded references for a member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/references')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(4)
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/references')
    expect(res.status).toBe(403)
  })
})

describe('POST /api/projects/:projectId/references', () => {
  it('lets an admin publish a reference', async () => {
    const res = await authed(app, adminToken).post('/api/projects/p1/references').send({
      type: 'Project Reference', title: 'New Brochure', description: 'desc', date: '2026-07-01'
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ type: 'Project Reference', title: 'New Brochure', progress: null, uploadedBy: 'Platform Admin' })
  })

  it('stores progress only for Building Progress type', async () => {
    const res = await authed(app, adminToken).post('/api/projects/p1/references').send({
      type: 'Building Progress', title: 'Update', description: 'desc', date: '2026-07-01', progress: 55
    })
    expect(res.status).toBe(201)
    expect(res.body.progress).toBe(55)
  })

  it('ignores progress for a non-Building-Progress type', async () => {
    const res = await authed(app, adminToken).post('/api/projects/p1/references').send({
      type: 'Project Reference', title: 'Update', description: 'desc', date: '2026-07-01', progress: 55
    })
    expect(res.status).toBe(201)
    expect(res.body.progress).toBeNull()
  })

  it('rejects a non-admin (resident) publishing a reference', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/references').send({
      type: 'Project Reference', title: 'X', description: 'D', date: '2026-07-01'
    })
    expect(res.status).toBe(403)
  })

  it('rejects an unknown type', async () => {
    const res = await authed(app, adminToken).post('/api/projects/p1/references').send({
      type: 'Not A Type', title: 'X', description: 'D', date: '2026-07-01'
    })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed date', async () => {
    const res = await authed(app, adminToken).post('/api/projects/p1/references').send({
      type: 'Project Reference', title: 'X', description: 'D', date: '01/07/2026'
    })
    expect(res.status).toBe(400)
  })

  it('rejects a progress value out of 0-100 range', async () => {
    const res = await authed(app, adminToken).post('/api/projects/p1/references').send({
      type: 'Building Progress', title: 'X', description: 'D', date: '2026-07-01', progress: 150
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/projects/:projectId/references/:refId', () => {
  it('lets an admin delete a reference', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/references/ref-p1-1')
    expect(res.status).toBe(200)
    const list = await authed(app, residentToken).get('/api/projects/p1/references')
    expect(list.body.some(r => r.id === 'ref-p1-1')).toBe(false)
  })

  it('rejects a non-admin deleting a reference', async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p1/references/ref-p1-1')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown reference', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/references/ref-nope')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/projects/reference-summary', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/projects/reference-summary')
    expect(res.status).toBe(401)
  })

  it('is admin-only', async () => {
    const res = await authed(app, residentToken).get('/api/projects/reference-summary')
    expect(res.status).toBe(403)
  })

  it('agrees with the full list it replaces, and picks the newest progress update', async () => {
    const older = await authed(app, adminToken).post('/api/projects/p1/references')
      .send({ type: 'Building Progress', title: 'Older progress', date: '2000-01-01', progress: 10 })
    const newest = await authed(app, adminToken).post('/api/projects/p1/references')
      .send({ type: 'Building Progress', title: 'Newest progress', date: '2999-12-31', progress: 80 })
    expect(older.status).toBe(201)
    expect(newest.status).toBe(201)

    const res = await authed(app, adminToken).get('/api/projects/reference-summary')
    expect(res.status).toBe(200)

    const full = await authed(app, adminToken).get('/api/projects/p1/references')
    const p1 = res.body.find(s => s.projectId === 'p1')
    expect(p1.references).toBe(full.body.length)
    expect(p1.progressUpdates).toBe(full.body.filter(r => r.type === 'Building Progress').length)
    expect(p1.latestProgress).toMatchObject({ id: newest.body.id, title: 'Newest progress', progress: 80 })
  })

  it('is not shadowed by GET /api/projects/:id', async () => {
    const res = await authed(app, adminToken).get('/api/projects/reference-summary')
    expect(Array.isArray(res.body)).toBe(true)
  })
})
