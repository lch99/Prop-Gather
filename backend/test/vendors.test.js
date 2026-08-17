import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, RESIDENT } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/vendors', () => {
  it('returns vendors matching the project state or city district', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/vendors')
    expect(res.status).toBe(200)
    const ids = res.body.map(v => v.id).sort()
    expect(ids).toEqual(['v1', 'v5', 'v6'])
  })

  it('excludes vendors from unrelated states', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/vendors')
    expect(res.body.some(v => v.id === 'v3')).toBe(false) // Johor-only vendor
  })

  it('matches by district even when the vendor state differs', async () => {
    const other = await login(app, 'daniel.o@example.com', 'password123') // Casa Mutiara, KL
    const res = await authed(app, other).get('/api/projects/p5/vendors')
    const ids = res.body.map(v => v.id).sort()
    expect(ids).toEqual(['v2', 'v6'])
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/vendors')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown project', async () => {
    const res = await authed(app, residentToken).get('/api/projects/does-not-exist/vendors')
    expect(res.status).toBe(404)
  })
})
