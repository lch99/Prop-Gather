import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp } from './helpers.js'

let app
beforeEach(() => { app = freshApp() })

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
