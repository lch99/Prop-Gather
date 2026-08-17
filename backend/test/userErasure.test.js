import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, loginWithId, verifiedResident, outsider, sampleDocumentFile, ADMIN, RESIDENT } from './helpers.js'
import { s3Mock } from './setup.js'

let app
let adminToken

beforeEach(async () => {
  app = await freshApp()
  adminToken = await login(app, ADMIN.email, ADMIN.password)
  s3Mock.deleteObject.mockClear()
})

describe('DELETE /api/auth/users/:id — PDPA erasure', () => {
  it('requires authentication', async () => {
    const res = await request(app).delete('/api/auth/users/u_resident')
    expect(res.status).toBe(401)
  })

  it('rejects a non-admin', async () => {
    const residentToken = await login(app, RESIDENT.email, RESIDENT.password)
    const res = await authed(app, residentToken).delete('/api/auth/users/u_tanw')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown user', async () => {
    const res = await authed(app, adminToken).delete('/api/auth/users/usr_nope')
    expect(res.status).toBe(404)
  })

  it('refuses to delete the acting admin\'s own account', async () => {
    const { userId } = await loginWithId(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, adminToken).delete(`/api/auth/users/${userId}`)
    expect(res.status).toBe(403)
  })

  it('erases a user with no content at all', async () => {
    const user = await outsider(app)
    const res = await authed(app, adminToken).delete(`/api/auth/users/${user.userId}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const relogin = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' })
    expect(relogin.status).toBe(401)
  })

  it('removes every trace of a user who participated everywhere', async () => {
    const user = await verifiedResident(app, 'p1')

    // content owned by the user
    const thread = await authed(app, user.token).post('/api/projects/p1/forum').send({
      category: 'Facilities', title: 'My thread', body: 'mine', poll: { question: 'Q?', options: ['A', 'B'] }
    })
    const msg = await authed(app, user.token).post('/api/projects/p1/chat/general/messages').send({ text: 'my message' })
    const petition = await authed(app, user.token).post('/api/projects/p1/petitions').send({ title: 'My petition', description: 'd', target: 10 })
    const defect = await authed(app, user.token).post('/api/projects/p1/defects').send({ title: 'My defect', description: 'd', category: 'Plumbing' })

    // participation in content owned by others
    await authed(app, user.token).post('/api/projects/p1/forum/f1-1/upvote')
    const polls = await authed(app, user.token).get('/api/projects/p1/polls')
    await authed(app, user.token).post(`/api/projects/p1/polls/${polls.body[0].id}/vote`).send({ optionId: polls.body[0].options[0].id })

    const res = await authed(app, adminToken).delete(`/api/auth/users/${user.userId}`)
    expect(res.status).toBe(200)
    expect(res.body.erased).toMatchObject({ threads: 1, petitions: 1, messages: 1, defects: 1, applications: 1 })

    // everything they authored is gone
    const residentToken = await login(app, RESIDENT.email, RESIDENT.password)
    const threads = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(threads.body.some(t => t.id === thread.body.id)).toBe(false)

    const messages = await authed(app, residentToken).get('/api/projects/p1/chat/general/messages')
    expect(messages.body.some(m => m.id === msg.body.id)).toBe(false)

    const petitions = await authed(app, residentToken).get('/api/projects/p1/petitions')
    expect(petitions.body.some(p => p.id === petition.body.id)).toBe(false)

    const defects = await authed(app, residentToken).get('/api/projects/p1/defects')
    expect(defects.body.some(d => d.id === defect.body.id)).toBe(false)

    // their vote no longer counts toward another user's thread
    const others = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(others.body.find(t => t.id === 'f1-1').upvotes).toBe(24) // back to the seeded count
  })

  it('leaves other residents\' content untouched', async () => {
    const victim = await verifiedResident(app, 'p1')
    const bystander = await verifiedResident(app, 'p1')

    const keep = await authed(app, bystander.token).post('/api/projects/p1/forum').send({
      category: 'Facilities', title: 'Bystander thread', body: 'keep me'
    })
    await authed(app, victim.token).post('/api/projects/p1/forum').send({
      category: 'Facilities', title: 'Victim thread', body: 'delete me'
    })

    await authed(app, adminToken).delete(`/api/auth/users/${victim.userId}`)

    const threads = await authed(app, bystander.token).get('/api/projects/p1/forum')
    expect(threads.body.some(t => t.id === keep.body.id)).toBe(true)
    expect(threads.body.some(t => t.title === 'Victim thread')).toBe(false)
  })

  it('purges the user\'s verification documents from S3', async () => {
    const user = await verifiedResident(app, 'p1')
    await authed(app, adminToken).delete(`/api/auth/users/${user.userId}`)
    expect(s3Mock.deleteObject).toHaveBeenCalledTimes(1)
  })

  it('revokes the erased user\'s community membership', async () => {
    const user = await verifiedResident(app, 'p1')
    await authed(app, adminToken).delete(`/api/auth/users/${user.userId}`)
    // the old token still verifies (JWT is stateless) but the user row is gone,
    // so optionalAuth can no longer resolve it — the request is anonymous.
    const res = await authed(app, user.token).get('/api/projects/p1/forum')
    expect(res.status).toBe(401)
  })

  it('keeps the audit trail but anonymises the erased user as an actor', async () => {
    const user = await verifiedResident(app, 'p1')
    const before = await authed(app, adminToken).get('/api/audit-log')
    const beforeCount = (Array.isArray(before.body) ? before.body : before.body.entries).length

    await authed(app, adminToken).delete(`/api/auth/users/${user.userId}`)

    const after = await authed(app, adminToken).get('/api/audit-log')
    const entries = Array.isArray(after.body) ? after.body : after.body.entries
    // nothing removed — the erasure itself adds one entry
    expect(entries.length).toBeGreaterThan(beforeCount)
    expect(entries.some(e => e.action === 'user.erased')).toBe(true)
  })

  it('keeps applications this user decided as an admin, minus the decided_by link', async () => {
    // A second admin decides an application, then is erased.
    const db = (await import('../src/db/index.js')).getDb()
    const { hashPassword } = await import('../src/util/auth.js')
    await db.run('INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)',
      ['usr_admin2', 'Second Admin', 'admin2@propgather.com', hashPassword('admin123'), 'admin', new Date().toISOString()])
    const admin2Token = await login(app, 'admin2@propgather.com', 'admin123')

    const applicant = await outsider(app)
    const appRes = await authed(app, applicant.token).post('/api/applications')
      .send({ projectId: 'p1', unit: 'Z-1', tier: 'Owner', document: 'bill', documentFile: sampleDocumentFile(), consent: true })
    await authed(app, admin2Token).post(`/api/applications/${appRes.body.id}/decision`).send({ decision: 'approve' })

    const res = await authed(app, adminToken).delete('/api/auth/users/usr_admin2')
    expect(res.status).toBe(200)

    const list = await authed(app, adminToken).get('/api/applications')
    const row = list.body.find(a => a.id === appRes.body.id)
    expect(row).toBeDefined()          // the applicant's record survives
    expect(row.decidedByName).toBeFalsy() // but the erased admin is no longer named
  })
})

describe('DELETE /api/applications/:id — admin erasure of a decided application', () => {
  it('still blocks a resident from deleting their own decided application', async () => {
    const user = await verifiedResident(app, 'p1')
    const mine = await authed(app, user.token).get('/api/applications/mine')
    const res = await authed(app, user.token).delete(`/api/applications/${mine.body[0].id}`)
    expect(res.status).toBe(409)
  })

  it('lets an admin erase an approved application', async () => {
    const user = await verifiedResident(app, 'p1')
    const list = await authed(app, adminToken).get('/api/applications')
    const approved = list.body.find(a => a.userId === user.userId)
    expect(approved.status).toBe('Approved')

    const res = await authed(app, adminToken).delete(`/api/applications/${approved.id}`)
    expect(res.status).toBe(200)

    const after = await authed(app, adminToken).get('/api/applications')
    expect(after.body.some(a => a.id === approved.id)).toBe(false)
  })

  it('records the erasure distinctly from a withdrawal in the audit log', async () => {
    const user = await verifiedResident(app, 'p1')
    const list = await authed(app, adminToken).get('/api/applications')
    const approved = list.body.find(a => a.userId === user.userId)

    await authed(app, adminToken).delete(`/api/applications/${approved.id}`)

    const audit = await authed(app, adminToken).get('/api/audit-log')
    const entries = Array.isArray(audit.body) ? audit.body : audit.body.entries
    const entry = entries.find(e => e.action === 'application.erased')
    expect(entry).toBeDefined()
    expect(entry.targetId).toBe(approved.id)
  })

  it('purges the S3 document when erasing a decided application', async () => {
    const user = await verifiedResident(app, 'p1')
    const list = await authed(app, adminToken).get('/api/applications')
    const approved = list.body.find(a => a.userId === user.userId)

    s3Mock.deleteObject.mockClear()
    await authed(app, adminToken).delete(`/api/applications/${approved.id}`)
    expect(s3Mock.deleteObject).toHaveBeenCalledTimes(1)
  })
})
