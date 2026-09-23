import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, RESIDENT, verifiedResident } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/chat/channels', () => {
  it('lists the fixed channel set for a member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/chat/channels')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(['general', 'defects', 'announcements', 'facilities', 'renovation'])
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/chat/channels')
    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/projects/p1/chat/channels')
    expect(res.status).toBe(401)
  })
})

describe('GET/POST /api/projects/:projectId/chat/:channel/messages', () => {
  it('starts empty for a channel with no seeded history', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/chat/general/messages')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('sends and then lists a message with author info attached', async () => {
    const send = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'Hello neighbours' })
    expect(send.status).toBe(201)
    expect(send.body).toMatchObject({ sender: 'Alex Lim', unit: 'B-21-03', tier: 'Owner', verified: true, text: 'Hello neighbours' })

    const list = await authed(app, residentToken).get('/api/projects/p1/chat/general/messages')
    expect(list.body).toHaveLength(1)
    expect(list.body[0].text).toBe('Hello neighbours')
  })

  it('preserves send order across multiple messages', async () => {
    await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'first' })
    await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'second' })
    const list = await authed(app, residentToken).get('/api/projects/p1/chat/general/messages')
    expect(list.body.map(m => m.text)).toEqual(['first', 'second'])
  })

  it('rejects an unknown channel', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/chat/not-a-channel/messages').send({ text: 'hi' })
    expect(res.status).toBe(400)
  })

  it('rejects an empty message', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: '' })
    expect(res.status).toBe(400)
  })

  it('rejects a non-member sending a message', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p2/chat/general/messages').send({ text: 'hi' })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/projects/:projectId/chat/:channel/messages/:messageId', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).delete('/api/projects/p1/chat/general/messages/msg_nope')
    expect(res.status).toBe(401)
  })

  it('404s for an unknown message', async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p1/chat/general/messages/msg_nope')
    expect(res.status).toBe(404)
  })

  it('lets the sender delete their own message', async () => {
    const sent = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'delete me' })
    const res = await authed(app, residentToken).delete(`/api/projects/p1/chat/general/messages/${sent.body.id}`)
    expect(res.status).toBe(200)

    const list = await authed(app, residentToken).get('/api/projects/p1/chat/general/messages')
    expect(list.body.some(m => m.id === sent.body.id)).toBe(false)
  })

  it("rejects deleting someone else's message", async () => {
    const sent = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'not yours' })
    const other = await verifiedResident(app, 'p1')
    const res = await authed(app, other.token).delete(`/api/projects/p1/chat/general/messages/${sent.body.id}`)
    expect(res.status).toBe(403)
  })

  it("lets an admin delete any resident's message", async () => {
    const sent = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'admin will delete' })
    const adminToken = await login(app, 'admin@propgather.com', 'admin123')
    const res = await authed(app, adminToken).delete(`/api/projects/p1/chat/general/messages/${sent.body.id}`)
    expect(res.status).toBe(200)
  })
})

describe('paging through a channel', () => {
  const send = (text, channel = 'general') =>
    authed(app, residentToken).post(`/api/projects/p1/chat/${channel}/messages`).send({ text })
  const page = (query) => authed(app, residentToken).get(`/api/projects/p1/chat/general/messages${query}`)

  it('returns the newest page, oldest first, and pages back with ?before=', async () => {
    for (const text of ['one', 'two', 'three']) {
      const res = await send(text)
      expect(res.status).toBe(201)
    }

    const newest = await page('?limit=2')
    expect(newest.status).toBe(200)
    expect(newest.body.map(m => m.text)).toEqual(['two', 'three'])

    const earlier = await page(`?limit=2&before=${newest.body[0].id}`)
    expect(earlier.status).toBe(200)
    expect(earlier.body.map(m => m.text)).toEqual(['one'])
  })

  it('400s for a cursor that is not a message', async () => {
    const res = await page('?before=msg_does_not_exist')
    expect(res.status).toBe(400)
  })

  it('400s for a cursor from a different channel', async () => {
    const elsewhere = await send('in facilities', 'facilities')
    const res = await page(`?before=${elsewhere.body.id}`)
    expect(res.status).toBe(400)
  })
})
