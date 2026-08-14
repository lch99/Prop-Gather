import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, verifiedResident, ADMIN, RESIDENT } from './helpers.js'

let app
let adminToken
let residentToken

beforeEach(async () => {
  app = freshApp()
  adminToken = await login(app, ADMIN.email, ADMIN.password)
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

const NRIC = '901231-14-5678'

describe('PATCH /api/projects/:projectId/forum/:threadId — one-time edit', () => {
  const newThread = { category: 'Facilities', title: 'Orignal titel', body: 'Body with a typo' }

  it('lets the author fix their post once', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send(newThread)
    expect(created.body.editedAt).toBeNull()

    const res = await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`)
      .send({ title: 'Original title', body: 'Body without a typo' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Original title')
    expect(res.body.body).toBe('Body without a typo')
    expect(res.body.editedAt).toBeTruthy()
  })

  it('refuses a second edit', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send(newThread)
    await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'First fix', body: 'b' })

    const res = await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'Second fix', body: 'b' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/only be edited once/i)
  })

  it('keeps the first edit intact after a rejected second attempt', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send(newThread)
    await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'First fix', body: 'kept' })
    await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'Second fix', body: 'discarded' })

    const list = await authed(app, residentToken).get('/api/projects/p1/forum')
    const thread = list.body.find(t => t.id === created.body.id)
    expect(thread.title).toBe('First fix')
    expect(thread.body).toBe('kept')
  })

  it('surfaces editedAt to other readers, so an edit is never silent', async () => {
    const author = await verifiedResident(app, 'p1')
    const created = await authed(app, author.token).post('/api/projects/p1/forum').send(newThread)
    await authed(app, author.token).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'Fixed', body: 'b' })

    const asOther = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(asOther.body.find(t => t.id === created.body.id).editedAt).toBeTruthy()
  })

  it("rejects another member editing someone else's post", async () => {
    const author = await verifiedResident(app, 'p1')
    const created = await authed(app, author.token).post('/api/projects/p1/forum').send(newThread)

    const res = await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'Hijacked', body: 'b' })
    expect(res.status).toBe(403)
  })

  // An admin quietly rewriting a resident's words is worse than removing the
  // post: a deletion is obvious, an edit isn't. Admins keep DELETE.
  it('rejects an admin editing a resident post', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send(newThread)
    const res = await authed(app, adminToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'Moderated', body: 'b' })
    expect(res.status).toBe(403)
  })

  it('blocks an edit that introduces sensitive content', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send(newThread)
    const res = await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`)
      .send({ title: 'Fixed', body: `my ic is ${NRIC}` })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/NRIC/i)
  })

  it('does not consume the edit allowance when the edit is rejected', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send(newThread)
    await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'x', body: `ic ${NRIC}` })

    const retry = await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'Clean fix', body: 'clean' })
    expect(retry.status).toBe(200)
  })

  it('leaves upvotes and the poll untouched', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum')
      .send({ ...newThread, poll: { question: 'Q?', options: ['A', 'B'] } })
    await authed(app, residentToken).post(`/api/projects/p1/forum/${created.body.id}/upvote`)

    const res = await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: 'Fixed', body: 'b' })
    expect(res.body.upvotes).toBe(1)
    expect(res.body.poll.options).toHaveLength(2)
  })

  it('validates the edited body like a new post', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/forum').send(newThread)
    const res = await authed(app, residentToken).patch(`/api/projects/p1/forum/${created.body.id}`).send({ title: '', body: '' })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown thread', async () => {
    const res = await authed(app, residentToken).patch('/api/projects/p1/forum/thr_nope').send({ title: 't', body: 'b' })
    expect(res.status).toBe(404)
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).patch('/api/projects/p2/forum/f2-1').send({ title: 't', body: 'b' })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/projects/:projectId/chat/:channel/messages/:messageId — one-time edit', () => {
  it('lets the sender fix their message once', async () => {
    const sent = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'teh lift is broekn' })
    expect(sent.body.editedAt).toBeNull()

    const res = await authed(app, residentToken).patch(`/api/projects/p1/chat/general/messages/${sent.body.id}`).send({ text: 'the lift is broken' })
    expect(res.status).toBe(200)
    expect(res.body.text).toBe('the lift is broken')
    expect(res.body.editedAt).toBeTruthy()
  })

  it('refuses a second edit', async () => {
    const sent = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'typo' })
    await authed(app, residentToken).patch(`/api/projects/p1/chat/general/messages/${sent.body.id}`).send({ text: 'fixed' })

    const res = await authed(app, residentToken).patch(`/api/projects/p1/chat/general/messages/${sent.body.id}`).send({ text: 'again' })
    expect(res.status).toBe(409)
  })

  it("rejects editing someone else's message", async () => {
    const other = await verifiedResident(app, 'p1')
    const sent = await authed(app, other.token).post('/api/projects/p1/chat/general/messages').send({ text: 'theirs' })

    const res = await authed(app, residentToken).patch(`/api/projects/p1/chat/general/messages/${sent.body.id}`).send({ text: 'hijacked' })
    expect(res.status).toBe(403)
  })

  it('rejects an admin editing a resident message', async () => {
    const sent = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'mine' })
    const res = await authed(app, adminToken).patch(`/api/projects/p1/chat/general/messages/${sent.body.id}`).send({ text: 'moderated' })
    expect(res.status).toBe(403)
  })

  it('blocks an edit that introduces sensitive content', async () => {
    const sent = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: 'hello' })
    const res = await authed(app, residentToken).patch(`/api/projects/p1/chat/general/messages/${sent.body.id}`).send({ text: `ic ${NRIC}` })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown message', async () => {
    const res = await authed(app, residentToken).patch('/api/projects/p1/chat/general/messages/msg_nope').send({ text: 'x' })
    expect(res.status).toBe(404)
  })

  it('rejects an unknown channel', async () => {
    const res = await authed(app, residentToken).patch('/api/projects/p1/chat/nope/messages/m1').send({ text: 'x' })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/projects/:projectId/petitions/:petitionId — one-time edit', () => {
  const draft = { title: 'Fix teh lift', description: 'It keeps breaking', target: 50 }

  it('lets the creator fix an unsigned petition once', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/petitions').send(draft)
    expect(created.body.editable).toBe(true)

    const res = await authed(app, residentToken).patch(`/api/projects/p1/petitions/${created.body.id}`)
      .send({ title: 'Fix the lift', description: 'It keeps breaking' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Fix the lift')
    expect(res.body.editedAt).toBeTruthy()
    expect(res.body.editable).toBe(false)
  })

  it('refuses a second edit', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/petitions').send(draft)
    await authed(app, residentToken).patch(`/api/projects/p1/petitions/${created.body.id}`).send({ title: 'First', description: 'd' })

    const res = await authed(app, residentToken).patch(`/api/projects/p1/petitions/${created.body.id}`).send({ title: 'Second', description: 'd' })
    expect(res.status).toBe(409)
  })

  // A signature endorses specific wording — changing the text afterwards would
  // re-attribute everyone's support to something they never read.
  it('refuses any edit once the petition has a signature', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/petitions').send(draft)
    const other = await verifiedResident(app, 'p1')
    await authed(app, other.token).post(`/api/projects/p1/petitions/${created.body.id}/sign`)

    const res = await authed(app, residentToken).patch(`/api/projects/p1/petitions/${created.body.id}`).send({ title: 'Changed', description: 'd' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/signatures/i)
  })

  it('reports editable=false once signed, so the UI can hide the control', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/petitions').send(draft)
    await authed(app, residentToken).post(`/api/projects/p1/petitions/${created.body.id}/sign`)

    const list = await authed(app, residentToken).get('/api/projects/p1/petitions')
    expect(list.body.find(p => p.id === created.body.id).editable).toBe(false)
  })

  it("rejects editing someone else's petition", async () => {
    const other = await verifiedResident(app, 'p1')
    const created = await authed(app, other.token).post('/api/projects/p1/petitions').send(draft)

    const res = await authed(app, residentToken).patch(`/api/projects/p1/petitions/${created.body.id}`).send({ title: 'x', description: 'd' })
    expect(res.status).toBe(403)
  })

  it('blocks an edit that introduces sensitive content', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/petitions').send(draft)
    const res = await authed(app, residentToken).patch(`/api/projects/p1/petitions/${created.body.id}`).send({ title: 'x', description: `ic ${NRIC}` })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/projects/:projectId/defects/:defectId — status vs. content', () => {
  const report = { title: 'Leek in ceiling', description: 'Water dripping', category: 'Plumbing' }

  it('lets the reporter fix their wording once', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    expect(created.body.editedAt).toBeNull()

    const res = await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`)
      .send({ title: 'Leak in ceiling', description: 'Water dripping' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Leak in ceiling')
    expect(res.body.editedAt).toBeTruthy()
  })

  it('refuses a second content edit', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ title: 'Leak in ceiling' })

    const res = await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ title: 'Again' })
    expect(res.status).toBe(409)
  })

  // The whole point of separating the two: a report's wording is fixed after one
  // correction, but its status has to keep moving through the lifecycle.
  it('still allows unlimited status changes after the content edit is spent', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ title: 'Leak in ceiling' })

    for (const status of ['Acknowledged', 'In Progress', 'Resolved', 'Open', 'Resolved']) {
      const res = await authed(app, adminToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ status })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(status)
    }
  })

  it('does not consume the content edit when only the status changes', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    await authed(app, adminToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ status: 'Acknowledged' })

    const res = await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ title: 'Leak in ceiling' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Acknowledged') // status preserved through the content edit
  })

  it('rejects an admin rewriting the report text', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    const res = await authed(app, adminToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ description: 'Rewritten by management' })
    expect(res.status).toBe(403)
  })

  it('lets an admin change status and a resident edit text on the same defect', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    const statusRes = await authed(app, adminToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ status: 'In Progress' })
    expect(statusRes.status).toBe(200)

    const editRes = await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ description: 'Water dripping from the corner' })
    expect(editRes.status).toBe(200)
    expect(editRes.body.description).toBe('Water dripping from the corner')
    expect(editRes.body.status).toBe('In Progress')
  })

  it('blocks an edit that introduces sensitive content', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    const res = await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ description: `owner ic ${NRIC}` })
    expect(res.status).toBe(400)
  })

  it('rejects an empty patch with no fields at all', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send(report)
    const res = await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({})
    expect(res.status).toBe(400)
  })
})
