import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, RESIDENT } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/petitions', () => {
  it('lists seeded petitions with signature counts', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/petitions')
    expect(res.status).toBe(200)
    const pet = res.body.find(p => p.id === 'pet1-1')
    expect(pet).toMatchObject({ signatures: 64, signedByMe: false, target: 100 })
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/petitions')
    expect(res.status).toBe(403)
  })
})

describe('POST /api/projects/:projectId/petitions', () => {
  it('creates a petition authored by the current user', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions').send({
      title: 'Fix the playground', description: 'It needs new sand', target: 50
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ title: 'Fix the playground', target: 50, signatures: 0, signedByMe: false, createdBy: 'Alex Lim' })
  })

  it('rejects a missing title', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions').send({ description: 'desc', target: 50 })
    expect(res.status).toBe(400)
  })

  it('rejects a non-positive target', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions').send({ title: 'T', description: 'D', target: 0 })
    expect(res.status).toBe(400)
  })

  it('rejects a non-numeric target', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions').send({ title: 'T', description: 'D', target: 'lots' })
    expect(res.status).toBe(400)
  })

  it('rejects a non-member creating a petition', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p2/petitions').send({ title: 'T', description: 'D', target: 10 })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/projects/:projectId/petitions/:petitionId/sign', () => {
  it('adds a signature and flips signedByMe', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions/pet1-1/sign')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ signatures: 65, signedByMe: true })
  })

  it('does not double-count a second signature from the same user', async () => {
    await authed(app, residentToken).post('/api/projects/p1/petitions/pet1-1/sign')
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions/pet1-1/sign')
    expect(res.status).toBe(200)
    expect(res.body.signatures).toBe(65)
  })

  it('404s for an unknown petition', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions/pet_nope/sign')
    expect(res.status).toBe(404)
  })

  it('rejects a non-member signing', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p2/petitions/pet2-1/sign')
    expect(res.status).toBe(403)
  })
})
