import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, RESIDENT } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/polls', () => {
  it('lists seeded polls with vote counts and votedByMe=false', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/polls')
    expect(res.status).toBe(200)
    const poll = res.body.find(p => p.id === 'poll1-1')
    expect(poll.votedByMe).toBe(false)
    expect(poll.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Yes, install CCTV', votes: 142 })
    ]))
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/polls')
    expect(res.status).toBe(403)
  })
})

describe('POST /api/projects/:projectId/polls/:pollId/vote', () => {
  it('records a vote and reflects it in votedByMe', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/polls/poll1-1/vote').send({ optionId: 'poll1-1-b' })
    expect(res.status).toBe(200)
    expect(res.body.votedByMe).toBe('poll1-1-b')
    expect(res.body.options.find(o => o.id === 'poll1-1-b').votes).toBe(39)
  })

  it('ignores a second vote for a different option (first choice sticks)', async () => {
    await authed(app, residentToken).post('/api/projects/p1/polls/poll1-1/vote').send({ optionId: 'poll1-1-b' })
    const res = await authed(app, residentToken).post('/api/projects/p1/polls/poll1-1/vote').send({ optionId: 'poll1-1-a' })
    expect(res.body.votedByMe).toBe('poll1-1-b')
    expect(res.body.options.find(o => o.id === 'poll1-1-a').votes).toBe(142)
  })

  // expiresAt is a display-only "Closes <date>" label in the UI (see PollView.jsx) —
  // the seeded demo polls are already past their expiry relative to "today", so voting
  // must still succeed or every seeded poll would be permanently unvotable.
  it('still accepts votes on a poll whose expiresAt is in the past', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/polls/poll1-1/vote').send({ optionId: 'poll1-1-a' })
    expect(res.status).toBe(200)
  })

  it('rejects an unknown optionId', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/polls/poll1-1/vote').send({ optionId: 'bogus' })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown poll', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/polls/poll_nope/vote').send({ optionId: 'x' })
    expect(res.status).toBe(404)
  })

  it('rejects a non-member voting', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p2/polls/poll2-1/vote').send({ optionId: 'poll2-1-a' })
    expect(res.status).toBe(403)
  })
})
