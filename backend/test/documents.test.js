import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, RESIDENT } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/documents', () => {
  it('lists seeded documents for a member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/documents')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(4)
    expect(res.body.map(d => d.id)).toContain('doc1')
  })

  it('returns an empty list for a project with no documents', async () => {
    const other = await login(app, 'wong.kl@example.com', 'password123') // p3
    const res = await authed(app, other).get('/api/projects/p3/documents')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/documents')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown project', async () => {
    const res = await authed(app, residentToken).get('/api/projects/does-not-exist/documents')
    expect(res.status).toBe(404)
  })
})
