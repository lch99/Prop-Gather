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

  it('stores attachments and returns them', async () => {
    const photo = { name: 'crack.jpg', type: 'image/jpeg', size: 2048, dataUrl: 'data:image/jpeg;base64,AAAA' }
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'Cracked pillar', category: 'Structural', description: 'Visible crack in basement pillar',
      attachments: [photo]
    })
    expect(res.status).toBe(201)
    expect(res.body.attachments).toEqual([photo])

    // And they survive the round trip, rather than only echoing the request.
    const list = await authed(app, residentToken).get('/api/projects/p1/defects')
    expect(list.body.find(d => d.id === res.body.id).attachments).toEqual([photo])
  })

  it('defaults attachments to an empty array', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'No photo', category: 'General', description: 'Nothing attached'
    })
    expect(res.status).toBe(201)
    expect(res.body.attachments).toEqual([])
  })

  // Seeded rows predate the attachments column, so theirs is NULL — the route has
  // to read that as [] rather than letting JSON.parse(null) through.
  it('reports [] for rows created before the attachments column existed', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/defects')
    expect(res.status).toBe(200)
    for (const defect of res.body) expect(defect.attachments).toEqual([])
  })

  it('rejects more than 6 attachments', async () => {
    const photo = (i) => ({ name: `p${i}.jpg`, type: 'image/jpeg', size: 16, dataUrl: 'data:image/jpeg;base64,AAAA' })
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'Too many', category: 'General', description: 'D',
      attachments: Array.from({ length: 7 }, (_, i) => photo(i))
    })
    expect(res.status).toBe(400)
  })

  it('rejects attachments totalling more than 10 MB', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'Too big', category: 'General', description: 'D',
      attachments: [
        { name: 'a.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024, dataUrl: 'data:image/jpeg;base64,AAAA' },
        { name: 'b.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024, dataUrl: 'data:image/jpeg;base64,AAAA' }
      ]
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/10 MB/)
  })

  it('rejects a malformed attachment', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'Bad shape', category: 'General', description: 'D',
      attachments: [{ name: 'a.jpg' }]
    })
    expect(res.status).toBe(400)
  })
})
