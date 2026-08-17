import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, RESIDENT } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/defects', () => {
  it('lists seeded defects', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/defects')
    expect(res.status).toBe(200)
    expect(res.body.map(d => d.id).sort()).toEqual(['d1-1', 'd1-3'])
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/defects')
    expect(res.status).toBe(403)
  })
})

describe('POST /api/projects/:projectId/defects', () => {
  it('creates a defect reported by the current user, defaulting status to Open', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'Broken gate sensor', category: 'Security', description: 'Gate does not close automatically'
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      title: 'Broken gate sensor', category: 'Security', status: 'Open', reportedBy: 'Alex Lim', matchingUnits: 1,
      block: '-', floorRange: '-', unit: '-'
    })
  })

  it('accepts optional block/floorRange/unit', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'Leak', category: 'Waterproofing', description: 'Ceiling leak', block: 'A', floorRange: '5', unit: 'A-05-01'
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ block: 'A', floorRange: '5', unit: 'A-05-01' })
  })

  it('rejects a missing title', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({ category: 'Security', description: 'D' })
    expect(res.status).toBe(400)
  })

  it('rejects a missing category', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({ title: 'T', description: 'D' })
    expect(res.status).toBe(400)
  })

  it('rejects a missing description', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({ title: 'T', category: 'Security' })
    expect(res.status).toBe(400)
  })

  it('rejects a non-member reporting a defect', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p2/defects').send({ title: 'T', category: 'Security', description: 'D' })
    expect(res.status).toBe(403)
  })
})
