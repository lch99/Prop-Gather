import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, RESIDENT, verifiedResident } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/forum', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/projects/p1/forum')
    expect(res.status).toBe(401)
  })

  it('rejects a user who is not a verified member of the project', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/forum')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown project', async () => {
    const res = await authed(app, residentToken).get('/api/projects/does-not-exist/forum')
    expect(res.status).toBe(404)
  })

  it('lists threads pinned-first then newest-first', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(res.status).toBe(200)
    expect(res.body.map(t => t.id)).toEqual(['f1-2', 'f1-1']) // f1-2 is pinned
  })

  it('lets an admin read any project forum without membership', async () => {
    const adminToken = await login(app, 'admin@propgather.com', 'admin123')
    const res = await authed(app, adminToken).get('/api/projects/p2/forum')
    expect(res.status).toBe(200)
  })
})

describe('POST /api/projects/:projectId/forum', () => {
  it('creates a thread authored as the current member', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Hello', body: 'First post'
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      category: 'General Discussion', title: 'Hello', body: 'First post', upvotes: 0, replies: 0, pinned: false
    })
    expect(res.body.author).toMatchObject({ name: 'Alex Lim', unit: 'B-21-03', tier: 'Owner', verified: true })
  })

  it('creates a thread with an embedded poll', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'Facilities', title: 'Repaint lobby?', body: 'Thoughts?',
      poll: { question: 'Repaint the lobby?', options: ['Yes', 'No'] }
    })
    expect(res.status).toBe(201)
    expect(res.body.poll.question).toBe('Repaint the lobby?')
    expect(res.body.poll.options).toEqual([
      { id: expect.any(String), label: 'Yes', votes: 0 },
      { id: expect.any(String), label: 'No', votes: 0 }
    ])
  })

  it('rejects a thread from a non-member', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p2/forum').send({ category: 'General Discussion', title: 'Hi', body: 'Text' })
    expect(res.status).toBe(403)
  })

  it('rejects an unknown category', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({ category: 'Not A Category', title: 'Hi', body: 'Text' })
    expect(res.status).toBe(400)
  })

  it('rejects a missing title', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({ category: 'General Discussion', body: 'Text' })
    expect(res.status).toBe(400)
  })

  it('rejects an empty body', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({ category: 'General Discussion', title: 'Hi', body: '' })
    expect(res.status).toBe(400)
  })

  it('rejects a poll with only one option', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Hi', body: 'Text', poll: { question: 'Q?', options: ['Only one'] }
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/projects/:projectId/forum/:threadId/upvote', () => {
  it('increments the upvote count', async () => {
    const before = await authed(app, residentToken).get('/api/projects/p1/forum')
    const thread = before.body.find(t => t.id === 'f1-1')

    const res = await authed(app, residentToken).post(`/api/projects/p1/forum/${thread.id}/upvote`)
    expect(res.status).toBe(200)
    expect(res.body.upvotes).toBe(thread.upvotes + 1)
  })

  it('is idempotent for the same user', async () => {
    await authed(app, residentToken).post('/api/projects/p1/forum/f1-1/upvote')
    const res = await authed(app, residentToken).post('/api/projects/p1/forum/f1-1/upvote')
    const after = await authed(app, residentToken).get('/api/projects/p1/forum')
    const thread = after.body.find(t => t.id === 'f1-1')
    expect(res.status).toBe(200)
    expect(thread.upvotes).toBe(25) // seeded 24 + exactly one new vote from this user
  })

  it('lets two different members each add one vote', async () => {
    const other = await verifiedResident(app, 'p1')
    await authed(app, residentToken).post('/api/projects/p1/forum/f1-1/upvote')
    await authed(app, other.token).post('/api/projects/p1/forum/f1-1/upvote')
    const after = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(after.body.find(t => t.id === 'f1-1').upvotes).toBe(26)
  })

  it('404s for an unknown thread', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum/thr_nope/upvote')
    expect(res.status).toBe(404)
  })

  it('rejects upvoting from a non-member', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p2/forum/f2-1/upvote')
    expect(res.status).toBe(403)
  })
})

describe('POST /api/projects/:projectId/forum/:threadId/poll-vote', () => {
  async function createPollThread() {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'Facilities', title: 'Poll thread', body: 'Vote please',
      poll: { question: 'Q?', options: ['A', 'B'] }
    })
    return res.body
  }

  it('records a vote', async () => {
    const thread = await createPollThread()
    const optionId = thread.poll.options[0].id
    const res = await authed(app, residentToken).post(`/api/projects/p1/forum/${thread.id}/poll-vote`).send({ optionId })
    expect(res.status).toBe(200)
    expect(res.body.poll.options.find(o => o.id === optionId).votes).toBe(1)
  })

  it('ignores a second vote from the same user (first choice sticks)', async () => {
    const thread = await createPollThread()
    const [optA, optB] = thread.poll.options
    await authed(app, residentToken).post(`/api/projects/p1/forum/${thread.id}/poll-vote`).send({ optionId: optA.id })
    const res = await authed(app, residentToken).post(`/api/projects/p1/forum/${thread.id}/poll-vote`).send({ optionId: optB.id })
    expect(res.status).toBe(200)
    expect(res.body.poll.options.find(o => o.id === optA.id).votes).toBe(1)
    expect(res.body.poll.options.find(o => o.id === optB.id).votes).toBe(0)
  })

  it('rejects an unknown optionId', async () => {
    const thread = await createPollThread()
    const res = await authed(app, residentToken).post(`/api/projects/p1/forum/${thread.id}/poll-vote`).send({ optionId: 'bogus' })
    expect(res.status).toBe(400)
  })

  it('rejects voting on a thread with no poll', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum/f1-1/poll-vote').send({ optionId: 'anything' })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown thread', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum/thr_nope/poll-vote').send({ optionId: 'x' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/:projectId/forum/:threadId', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).delete('/api/projects/p1/forum/f1-1')
    expect(res.status).toBe(401)
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p2/forum/f2-1')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown thread', async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p1/forum/thr_nope')
    expect(res.status).toBe(404)
  })

  it("lets the author delete their own thread, removing it from the listing", async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Delete me', body: 'Text'
    })
    const res = await authed(app, residentToken).delete(`/api/projects/p1/forum/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })

    const list = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(list.body.some(t => t.id === created.body.id)).toBe(false)
  })

  it('cleanly deletes a thread that has an embedded poll (with votes)', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'Facilities', title: 'Poll to delete', body: 'Vote then delete',
      poll: { question: 'Q?', options: ['A', 'B'] }
    })
    await authed(app, residentToken).post(`/api/projects/p1/forum/${created.body.id}/poll-vote`).send({ optionId: created.body.poll.options[0].id })

    const res = await authed(app, residentToken).delete(`/api/projects/p1/forum/${created.body.id}`)
    expect(res.status).toBe(200)
  })

  it("rejects deleting someone else's thread", async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Not yours', body: 'Text'
    })
    const other = await verifiedResident(app, 'p1')
    const res = await authed(app, other.token).delete(`/api/projects/p1/forum/${created.body.id}`)
    expect(res.status).toBe(403)

    const list = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(list.body.some(t => t.id === created.body.id)).toBe(true)
  })

  it("lets an admin delete any resident's thread", async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Admin will delete', body: 'Text'
    })
    const adminToken = await login(app, 'admin@propgather.com', 'admin123')
    const res = await authed(app, adminToken).delete(`/api/projects/p1/forum/${created.body.id}`)
    expect(res.status).toBe(200)
  })
})
