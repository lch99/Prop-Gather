import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, login, authed, outsider, ADMIN } from './helpers.js'

let app
beforeEach(async () => { app = await freshApp() })

const newCommunity = (over = {}) => ({
  name: 'Harmony Park Residences',
  type: 'Condo',
  state: 'Selangor',
  city: 'Subang Jaya',
  address: 'Jalan SS15/4, Subang Jaya',
  ...over
})

describe('GET /api/projects', () => {
  it('lists all seeded projects without auth', async () => {
    const res = await request(app).get('/api/projects')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(6)
  })

  it('filters by state', async () => {
    const res = await request(app).get('/api/projects?state=Penang')
    expect(res.status).toBe(200)
    expect(res.body.every(p => p.state === 'Penang')).toBe(true)
    expect(res.body).toHaveLength(1)
  })

  it('filters by type', async () => {
    const res = await request(app).get('/api/projects').query({ type: 'Landed G&G' })
    expect(res.status).toBe(200)
    expect(res.body.every(p => p.type === 'Landed G&G')).toBe(true)
    expect(res.body).toHaveLength(2)
  })

  it('filters by free-text search across name/city/state', async () => {
    const res = await request(app).get('/api/projects?search=lumina')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe('p1')
  })

  it('returns an empty array when nothing matches', async () => {
    const res = await request(app).get('/api/projects?state=Sabah')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('GET /api/projects/:id', () => {
  it('returns project detail', async () => {
    const res = await request(app).get('/api/projects/p1')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 'p1', name: 'The Lumina Residences', blocks: ['A', 'B', 'C'] })
  })

  it('404s for an unknown project id', async () => {
    const res = await request(app).get('/api/projects/does-not-exist')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/projects', () => {
  let adminToken
  beforeEach(async () => { adminToken = await login(app, ADMIN.email, ADMIN.password) })

  it('lets an admin add a community, which then appears in the directory', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: 'Harmony Park Residences', type: 'Condo', city: 'Subang Jaya', state: 'Selangor'
    })
    expect(res.body.id).toBeTruthy()

    const list = await request(app).get('/api/projects')
    expect(list.body).toHaveLength(7)
    expect(list.body.some(p => p.id === res.body.id)).toBe(true)

    const detail = await request(app).get(`/api/projects/${res.body.id}`)
    expect(detail.status).toBe(200)
  })

  it('defaults the optional fields so only name/type/state/city/address are needed', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      ownerCount: 0, activityLevel: 'Low', units: 0, blocks: [], floorsPerBlock: 0, latestThread: null
    })
    expect(res.body.activeOfferBanner).toBeUndefined()
  })

  it('stores the optional details when supplied', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({
      ownerCount: 42, activityLevel: 'High', units: 300, blocks: ['A', 'B'], floorsPerBlock: 24
    }))
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ ownerCount: 42, activityLevel: 'High', units: 300, blocks: ['A', 'B'], floorsPerBlock: 24 })
  })

  it('accepts a property type outside the seeded ones', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ type: 'Serviced Apartment' }))
    expect(res.status).toBe(201)
    expect(res.body.type).toBe('Serviced Apartment')
  })

  it('records the creation in the audit log', async () => {
    const created = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const log = await authed(app, adminToken).get('/api/audit-log?targetType=project')
    expect(log.status).toBe(200)
    expect(log.body[0]).toMatchObject({
      action: 'project.created',
      targetType: 'project',
      targetId: created.body.id,
      actorRole: 'admin'
    })
  })

  it('the new community is usable — an approved resident can post in its forum', async () => {
    const created = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const { token } = await outsider(app)

    const applied = await authed(app, token).post('/api/applications').send({
      projectId: created.body.id, unit: 'A-1-1', tier: 'Owner',
      document: 'utility bill',
      documentFile: { name: 'proof.pdf', type: 'application/pdf', size: 1024, key: 'verification-docs/new/proof.pdf' },
      consent: true
    })
    expect(applied.status).toBe(201)

    const decided = await authed(app, adminToken).post(`/api/applications/${applied.body.id}/decision`).send({ decision: 'approve' })
    expect(decided.status).toBe(200)

    const posted = await authed(app, token).post(`/api/projects/${created.body.id}/forum`)
      .send({ title: 'Hello neighbours', body: 'First post in our new community.', category: 'General Discussion' })
    expect(posted.status).toBe(201)
  })

  it('409s on a community with the same name in the same city', async () => {
    await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ name: 'harmony park residences' }))
    expect(res.status).toBe(409)

    const list = await request(app).get('/api/projects')
    expect(list.body).toHaveLength(7)
  })

  it('allows the same name in a different city', async () => {
    await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ city: 'Ipoh', state: 'Perak' }))
    expect(res.status).toBe(201)
  })

  it('400s when required fields are missing', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send({ name: 'Nameless Court' })
    expect(res.status).toBe(400)
    expect(res.body.details.map(d => d.path)).toEqual(expect.arrayContaining(['type', 'state', 'city', 'address']))
  })

  it('400s on an unknown activity level', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ activityLevel: 'Extreme' }))
    expect(res.status).toBe(400)
  })

  it('401s without a token', async () => {
    const res = await request(app).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(401)
  })

  it('403s for a non-admin', async () => {
    const { token } = await outsider(app)
    const res = await authed(app, token).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(403)

    const list = await request(app).get('/api/projects')
    expect(list.body).toHaveLength(6)
  })
})
