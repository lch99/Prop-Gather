import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, loginWithId, ADMIN, sampleDocumentFile } from './helpers.js'
import { CHANNELS } from '../src/routes/chat.js'

let app
beforeEach(() => { app = freshApp() })

async function registerUser(email, name = 'Journey User') {
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'password123' })
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`)
  return { token: res.body.token, userId: res.body.user.id, name }
}

// End-to-end: a brand-new user registers, applies, gets approved, and then
// touches every single gated resource for that project in one continuous
// run — the thing per-route unit tests can't catch (state bleeding between
// routes, serialization mismatches, idempotency across a real request
// sequence) — plus a stranger who must be locked out of all of it.
describe('full user journey — register through every gated resource', () => {
  it('walks the whole community experience for a newly-verified Owner', async () => {
    const user = await registerUser('journey1@example.com', 'Journey Resident')

    // ---- apply + admin approval ----
    const applyRes = await authed(app, user.token).post('/api/applications').send({
      projectId: 'p2', unit: '3-7-12', tier: 'Owner', document: 'SPA', documentFile: sampleDocumentFile(), consent: true
    })
    expect(applyRes.status).toBe(201)

    const admin = await loginWithId(app, ADMIN.email, ADMIN.password)
    const decisionRes = await authed(app, admin.token).post(`/api/applications/${applyRes.body.id}/decision`).send({ decision: 'approve' })
    expect(decisionRes.status).toBe(200)
    expect(decisionRes.body.decidedBy).toBe(admin.userId)

    const me = await authed(app, user.token).get('/api/auth/me')
    expect(me.body.communities).toContainEqual(expect.objectContaining({ projectId: 'p2', tier: 'Owner', unit: '3-7-12' }))

    // ---- projects (public) ----
    const list = await request(app).get('/api/projects?state=Selangor')
    expect(list.status).toBe(200)
    expect(list.body.some(p => p.id === 'p2')).toBe(true)
    const single = await request(app).get('/api/projects/p2')
    expect(single.status).toBe(200)
    expect(single.body.name).toBe('Sentosa Heights')

    // ---- forum: create with poll + attachment, upvote/poll-vote idempotency ----
    const threadRes = await authed(app, user.token).post('/api/projects/p2/forum').send({
      category: 'General Discussion',
      title: 'Journey test thread',
      body: 'Body text for the journey test.',
      attachments: [{ name: 'photo.jpg', type: 'image/jpeg', size: 1024, dataUrl: 'data:image/jpeg;base64,AAA' }],
      poll: { question: 'Best time for AGM?', options: ['Weekday evening', 'Weekend morning'] }
    })
    expect(threadRes.status).toBe(201)
    expect(threadRes.body.author).toMatchObject({ name: 'Journey Resident', unit: '3-7-12', tier: 'Owner' })
    expect(threadRes.body.attachments).toHaveLength(1)
    expect(threadRes.body.poll.options).toHaveLength(2)
    const threadId = threadRes.body.id
    const optionId = threadRes.body.poll.options[0].id

    await authed(app, user.token).post(`/api/projects/p2/forum/${threadId}/upvote`)
    const afterSecondUpvote = await authed(app, user.token).post(`/api/projects/p2/forum/${threadId}/upvote`)
    expect(afterSecondUpvote.body.upvotes).toBe(1) // idempotent — one user, one upvote

    await authed(app, user.token).post(`/api/projects/p2/forum/${threadId}/poll-vote`).send({ optionId })
    const afterSecondPollVote = await authed(app, user.token).post(`/api/projects/p2/forum/${threadId}/poll-vote`).send({ optionId })
    expect(afterSecondPollVote.body.poll.options.find(o => o.id === optionId).votes).toBe(1)

    // ---- chat ----
    const channels = await authed(app, user.token).get('/api/projects/p2/chat/channels')
    expect(channels.body).toEqual(CHANNELS)
    const sendMsg = await authed(app, user.token).post('/api/projects/p2/chat/general/messages').send({ text: 'Hello from the journey test' })
    expect(sendMsg.status).toBe(201)
    expect(sendMsg.body.sender).toBe('Journey Resident')
    expect(sendMsg.body.unit).toBe('3-7-12')
    const messages = await authed(app, user.token).get('/api/projects/p2/chat/general/messages')
    expect(messages.body.some(m => m.text === 'Hello from the journey test')).toBe(true)
    const badChannel = await authed(app, user.token).post('/api/projects/p2/chat/not-a-channel/messages').send({ text: 'x' })
    expect(badChannel.status).toBe(400)

    // ---- vendors: every returned vendor actually matches this project's state/city ----
    const vendors = await authed(app, user.token).get('/api/projects/p2/vendors')
    expect(vendors.status).toBe(200)
    expect(vendors.body.length).toBeGreaterThan(0)
    for (const v of vendors.body) {
      expect(v.state === 'Selangor' || v.districts.includes('Shah Alam')).toBe(true)
    }

    // ---- petitions: seeded petition present, sign is idempotent ----
    const petitions = await authed(app, user.token).get('/api/projects/p2/petitions')
    const seededPetition = petitions.body.find(p => p.id === 'pet2-1')
    expect(seededPetition).toBeTruthy()
    const beforeSignatures = seededPetition.signatures
    await authed(app, user.token).post(`/api/projects/p2/petitions/${seededPetition.id}/sign`)
    const afterSecondSign = await authed(app, user.token).post(`/api/projects/p2/petitions/${seededPetition.id}/sign`)
    expect(afterSecondSign.body.signatures).toBe(beforeSignatures + 1)
    expect(afterSecondSign.body.signedByMe).toBe(true)

    const newPetition = await authed(app, user.token).post('/api/projects/p2/petitions').send({
      title: 'Add bicycle racks', description: 'Requesting covered bicycle racks near Block 1.', target: 50
    })
    expect(newPetition.status).toBe(201)
    expect(newPetition.body.createdBy).toBe('Journey Resident')

    // ---- polls: seeded poll present, vote is idempotent ----
    const polls = await authed(app, user.token).get('/api/projects/p2/polls')
    const seededPoll = polls.body.find(p => p.id === 'poll2-1')
    expect(seededPoll).toBeTruthy()
    const pollOption = seededPoll.options[0]
    const beforeVotes = pollOption.votes
    await authed(app, user.token).post(`/api/projects/p2/polls/${seededPoll.id}/vote`).send({ optionId: pollOption.id })
    const afterSecondPollVote2 = await authed(app, user.token).post(`/api/projects/p2/polls/${seededPoll.id}/vote`).send({ optionId: pollOption.id })
    expect(afterSecondPollVote2.body.options.find(o => o.id === pollOption.id).votes).toBe(beforeVotes + 1)
    expect(afterSecondPollVote2.body.votedByMe).toBe(pollOption.id)

    // ---- defects ----
    const defects = await authed(app, user.token).get('/api/projects/p2/defects')
    expect(defects.body.some(d => d.id === 'd2-1')).toBe(true)
    const newDefect = await authed(app, user.token).post('/api/projects/p2/defects').send({
      title: 'Lobby light flickering', description: 'The light near the mailboxes flickers constantly.', category: 'Electrical'
    })
    expect(newDefect.status).toBe(201)
    expect(newDefect.body.reportedBy).toBe('Journey Resident')
    expect(newDefect.body.status).toBe('Open')

    // ---- documents / references (read-only for residents) ----
    const documents = await authed(app, user.token).get('/api/projects/p2/documents')
    expect(documents.status).toBe(200)
    const references = await authed(app, user.token).get('/api/projects/p2/references')
    expect(references.body.map(r => r.id)).toEqual(expect.arrayContaining(['ref-p2-1', 'ref-p2-2']))
    const forbiddenRefPost = await authed(app, user.token).post('/api/projects/p2/references').send({ type: 'Project Reference', title: 'x', date: '2026-01-01' })
    expect(forbiddenRefPost.status).toBe(403) // residents can read but not publish references

    // ---- fees ----
    const fees = await authed(app, user.token).get('/api/projects/p2/fees')
    expect(fees.body).toMatchObject({ sinkingFund: 310500, monthlyFee: 220 })
    expect(fees.body.myPayments).toEqual([]) // new member — no payment history yet

    // ---- community requests (public) ----
    const communityRequest = await request(app).post('/api/community-requests').send({ name: 'New Place Residences', city: 'Ipoh', state: 'Perak' })
    expect(communityRequest.status).toBe(201)

    // ---- audit trail reflects this whole journey ----
    const auditRes = await authed(app, admin.token).get('/api/audit-log')
    expect(auditRes.body.some(e => e.action === 'application.submitted' && e.targetId === applyRes.body.id)).toBe(true)
    expect(auditRes.body.some(e => e.action === 'application.approved' && e.targetId === applyRes.body.id)).toBe(true)
  })

  it('locks an unverified stranger out of every gated resource on that same project', async () => {
    const stranger = await registerUser('stranger1@example.com', 'Stranger')

    const endpoints = [
      ['get', '/api/projects/p2/forum'],
      ['post', '/api/projects/p2/forum'],
      ['get', '/api/projects/p2/chat/channels'],
      ['get', '/api/projects/p2/chat/general/messages'],
      ['post', '/api/projects/p2/chat/general/messages'],
      ['get', '/api/projects/p2/vendors'],
      ['get', '/api/projects/p2/petitions'],
      ['post', '/api/projects/p2/petitions'],
      ['get', '/api/projects/p2/polls'],
      ['get', '/api/projects/p2/defects'],
      ['post', '/api/projects/p2/defects'],
      ['get', '/api/projects/p2/documents'],
      ['get', '/api/projects/p2/references'],
      ['get', '/api/projects/p2/fees']
    ]

    for (const [method, url] of endpoints) {
      const res = await authed(app, stranger.token)[method](url).send({})
      expect(res.status, `${method.toUpperCase()} ${url} should 403 for a non-member`).toBe(403)
    }
  })

  it('rejects every gated resource for a fully unauthenticated caller', async () => {
    const endpoints = [
      '/api/projects/p2/forum',
      '/api/projects/p2/chat/channels',
      '/api/projects/p2/vendors',
      '/api/projects/p2/petitions',
      '/api/projects/p2/polls',
      '/api/projects/p2/defects',
      '/api/projects/p2/documents',
      '/api/projects/p2/references',
      '/api/projects/p2/fees',
      '/api/applications',
      '/api/audit-log'
    ]
    for (const url of endpoints) {
      const res = await request(app).get(url)
      expect(res.status, `GET ${url} should 401 unauthenticated`).toBe(401)
    }
  })
})
