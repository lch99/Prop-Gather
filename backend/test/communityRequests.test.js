import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, ADMIN, RESIDENT } from './helpers.js'

let app
beforeEach(async () => { app = await freshApp() })

const VALID = {
  contactName: 'Siti Rahman',
  email: 'siti@example.com',
  name: 'Palm Grove Residences',
  city: 'Kuching',
  state: 'Sarawak'
}

const submit = (body = VALID) => request(app).post('/api/community-requests').send(body)

async function adminGet() {
  const token = await login(app, ADMIN.email, ADMIN.password)
  return authed(app, token).get('/api/community-requests')
}

describe('POST /api/community-requests', () => {
  it('accepts a public request with no authentication', async () => {
    const res = await submit()
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ ok: true })
  })

  it('accepts optional developer/note fields', async () => {
    const res = await submit({ ...VALID, developer: 'Acme Corp', note: 'Please add us' })
    expect(res.status).toBe(201)
  })

  for (const field of ['name', 'city', 'state', 'contactName', 'email']) {
    it(`rejects a missing ${field}`, async () => {
      const body = { ...VALID }
      delete body[field]
      expect((await submit(body)).status).toBe(400)
    })
  }

  it('rejects a malformed email', async () => {
    expect((await submit({ ...VALID, email: 'not-an-email' })).status).toBe(400)
  })

  // Regression: zod allowed max(200) on every string while `name` is
  // VARCHAR(120), so a long submitter name reached MySQL, tripped strict mode's
  // ER_DATA_TOO_LONG and surfaced as a 500 — the submitter saw a generic "we
  // couldn't send your request" for input the form had accepted.
  it('rejects an over-length submitter name with 400, not 500', async () => {
    expect((await submit({ ...VALID, contactName: 'A'.repeat(121) })).status).toBe(400)
  })

  it('accepts a community name up to the column width', async () => {
    expect((await submit({ ...VALID, name: 'A'.repeat(200) })).status).toBe(201)
    expect((await submit({ ...VALID, name: 'A'.repeat(201) })).status).toBe(400)
  })
})

describe('GET /api/community-requests', () => {
  it('rejects an unauthenticated request', async () => {
    expect((await request(app).get('/api/community-requests')).status).toBe(401)
  })

  it('rejects a non-admin', async () => {
    const token = await login(app, RESIDENT.email, RESIDENT.password)
    expect((await authed(app, token).get('/api/community-requests')).status).toBe(403)
  })

  it('returns the submission with its contact details, newest first', async () => {
    await submit()
    await submit({ ...VALID, name: 'Bayu Damansara', email: 'aziz@example.com', contactName: 'Aziz' })

    const res = await adminGet()
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({ name: 'Bayu Damansara', contactName: 'Aziz', email: 'aziz@example.com' })
    expect(res.body[1]).toMatchObject({
      name: 'Palm Grove Residences',
      contactName: 'Siti Rahman',
      email: 'siti@example.com',
      city: 'Kuching',
      state: 'Sarawak'
    })
  })

  it('joins developer and note into one message', async () => {
    await submit({ ...VALID, developer: 'Acme Corp', note: 'JMB formed last year' })
    const res = await adminGet()
    expect(res.body[0].message).toBe('Acme Corp — JMB formed last year')
  })
})

describe('DELETE /api/community-requests/:id', () => {
  it('rejects an unauthenticated request', async () => {
    await submit()
    const { body } = await adminGet()
    expect((await request(app).delete(`/api/community-requests/${body[0].id}`)).status).toBe(401)
  })

  it('rejects a non-admin', async () => {
    await submit()
    const { body } = await adminGet()
    const token = await login(app, RESIDENT.email, RESIDENT.password)
    expect((await authed(app, token).delete(`/api/community-requests/${body[0].id}`)).status).toBe(403)
  })

  it('404s an unknown id', async () => {
    const token = await login(app, ADMIN.email, ADMIN.password)
    expect((await authed(app, token).delete('/api/community-requests/creq_nope')).status).toBe(404)
  })

  it('removes the request and audits it without leaking the email', async () => {
    await submit()
    const token = await login(app, ADMIN.email, ADMIN.password)
    const { body } = await authed(app, token).get('/api/community-requests')

    expect((await authed(app, token).delete(`/api/community-requests/${body[0].id}`)).status).toBe(200)
    expect((await authed(app, token).get('/api/community-requests')).body).toHaveLength(0)

    const log = await authed(app, token).get('/api/audit-log')
    const entry = log.body.find(e => e.action === 'community_request.deleted')
    expect(entry).toBeTruthy()
    expect(entry.targetType).toBe('community_request')
    expect(JSON.stringify(entry.metadata)).not.toContain('siti@example.com')
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
