import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp } from './helpers.js'

let app
beforeEach(() => { app = freshApp() })

describe('POST /api/community-requests', () => {
  it('accepts a public request with no authentication', async () => {
    const res = await request(app).post('/api/community-requests').send({
      name: 'Palm Grove Residences', city: 'Kuching', state: 'Sarawak'
    })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ ok: true })
  })

  it('accepts optional developer/note fields', async () => {
    const res = await request(app).post('/api/community-requests').send({
      name: 'Palm Grove Residences', city: 'Kuching', state: 'Sarawak', developer: 'Acme Corp', note: 'Please add us'
    })
    expect(res.status).toBe(201)
  })

  it('rejects a missing name', async () => {
    const res = await request(app).post('/api/community-requests').send({ city: 'Kuching', state: 'Sarawak' })
    expect(res.status).toBe(400)
  })

  it('rejects a missing city', async () => {
    const res = await request(app).post('/api/community-requests').send({ name: 'X', state: 'Sarawak' })
    expect(res.status).toBe(400)
  })

  it('rejects a missing state', async () => {
    const res = await request(app).post('/api/community-requests').send({ name: 'X', city: 'Kuching' })
    expect(res.status).toBe(400)
  })
})

describe('miscellaneous', () => {
  it('GET /api/health reports ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('404s an unknown api route', async () => {
    const res = await request(app).get('/api/not-a-real-route')
    expect(res.status).toBe(404)
  })

  it('responds 400 (not 500) to malformed JSON instead of crashing', async () => {
    const res = await request(app)
      .post('/api/community-requests')
      .set('Content-Type', 'application/json')
      .send('{not valid json')
    expect(res.status).toBe(400)
  })
})
