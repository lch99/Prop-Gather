import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, verifiedResident, ADMIN, RESIDENT } from './helpers.js'

let app
let adminToken
let residentToken

beforeEach(async () => {
  app = await freshApp()
  adminToken = await login(app, ADMIN.email, ADMIN.password)
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('DELETE /api/projects/:projectId/petitions/:petitionId', () => {
  it('lets the creator delete their own petition', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/petitions').send({ title: 'Mine', description: 'd', target: 10 })
    const res = await authed(app, residentToken).delete(`/api/projects/p1/petitions/${created.body.id}`)
    expect(res.status).toBe(200)

    const list = await authed(app, residentToken).get('/api/projects/p1/petitions')
    expect(list.body.some(p => p.id === created.body.id)).toBe(false)
  })

  it('lets an admin delete any petition', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/petitions/pet1-1')
    expect(res.status).toBe(200)
  })

  it('removes the signatures along with the petition', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/petitions').send({ title: 'Mine', description: 'd', target: 10 })
    await authed(app, residentToken).post(`/api/projects/p1/petitions/${created.body.id}/sign`)

    const res = await authed(app, residentToken).delete(`/api/projects/p1/petitions/${created.body.id}`)
    expect(res.body.ok).toBe(true)

    // signing the now-deleted petition must 404, not resurrect an orphan row
    const sign = await authed(app, residentToken).post(`/api/projects/p1/petitions/${created.body.id}/sign`)
    expect(sign.status).toBe(404)
  })

  it("rejects a member deleting someone else's petition", async () => {
    const other = await verifiedResident(app, 'p1')
    const created = await authed(app, other.token).post('/api/projects/p1/petitions').send({ title: 'Theirs', description: 'd', target: 10 })
    const res = await authed(app, residentToken).delete(`/api/projects/p1/petitions/${created.body.id}`)
    expect(res.status).toBe(403)
  })

  it('404s for an unknown petition', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/petitions/pet_nope')
    expect(res.status).toBe(404)
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p2/petitions/pet2-1')
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/projects/:projectId/defects/:defectId', () => {
  it('moves a defect through its lifecycle', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send({ title: 'Leak', description: 'd', category: 'Plumbing' })
    expect(created.body.status).toBe('Open')

    const ack = await authed(app, adminToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ status: 'Acknowledged' })
    expect(ack.status).toBe(200)
    expect(ack.body.status).toBe('Acknowledged')

    const done = await authed(app, adminToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ status: 'Resolved' })
    expect(done.body.status).toBe('Resolved')
  })

  it('persists the new status to subsequent reads', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send({ title: 'Leak', description: 'd', category: 'Plumbing' })
    await authed(app, adminToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ status: 'Resolved' })

    const list = await authed(app, residentToken).get('/api/projects/p1/defects')
    expect(list.body.find(d => d.id === created.body.id).status).toBe('Resolved')
  })

  it('lets the reporter close their own defect', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send({ title: 'Leak', description: 'd', category: 'Plumbing' })
    const res = await authed(app, residentToken).patch(`/api/projects/p1/defects/${created.body.id}`).send({ status: 'Resolved' })
    expect(res.status).toBe(200)
  })

  it("rejects a member updating someone else's defect", async () => {
    const res = await authed(app, residentToken).patch('/api/projects/p1/defects/d1-1').send({ status: 'Resolved' })
    expect(res.status).toBe(403)
  })

  it('rejects an unknown status value', async () => {
    const res = await authed(app, adminToken).patch('/api/projects/p1/defects/d1-1').send({ status: 'Closed-ish' })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown defect', async () => {
    const res = await authed(app, adminToken).patch('/api/projects/p1/defects/def_nope').send({ status: 'Resolved' })
    expect(res.status).toBe(404)
  })

  it('records the transition in the audit log', async () => {
    await authed(app, adminToken).patch('/api/projects/p1/defects/d1-1').send({ status: 'Resolved' })
    const audit = await authed(app, adminToken).get('/api/audit-log')
    const entries = Array.isArray(audit.body) ? audit.body : audit.body.entries
    const entry = entries.find(e => e.action === 'defect.status_changed')
    expect(entry).toBeDefined()
    expect(entry.metadata).toMatchObject({ from: 'In Progress', to: 'Resolved' })
  })
})

describe('DELETE /api/projects/:projectId/defects/:defectId', () => {
  it('lets the reporter delete their own defect', async () => {
    const created = await authed(app, residentToken).post('/api/projects/p1/defects').send({ title: 'Leak', description: 'd', category: 'Plumbing' })
    const res = await authed(app, residentToken).delete(`/api/projects/p1/defects/${created.body.id}`)
    expect(res.status).toBe(200)

    const list = await authed(app, residentToken).get('/api/projects/p1/defects')
    expect(list.body.some(d => d.id === created.body.id)).toBe(false)
  })

  it('lets an admin delete any defect', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/defects/d1-1')
    expect(res.status).toBe(200)
  })

  it("rejects a member deleting someone else's defect", async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p1/defects/d1-1')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown defect', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/defects/def_nope')
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/:projectId/polls/:pollId', () => {
  it('lets an admin delete a poll and its votes', async () => {
    await authed(app, residentToken).post('/api/projects/p1/polls/poll1-1/vote').send({ optionId: 'poll1-1-a' })

    const res = await authed(app, adminToken).delete('/api/projects/p1/polls/poll1-1')
    expect(res.status).toBe(200)

    const list = await authed(app, residentToken).get('/api/projects/p1/polls')
    expect(list.body.some(p => p.id === 'poll1-1')).toBe(false)

    // voting on the deleted poll must 404 rather than hit an orphaned option
    const vote = await authed(app, residentToken).post('/api/projects/p1/polls/poll1-1/vote').send({ optionId: 'poll1-1-a' })
    expect(vote.status).toBe(404)
  })

  it('rejects a non-admin member', async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p1/polls/poll1-1')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown poll', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/polls/poll_nope')
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/:projectId/documents/:documentId', () => {
  it('lets an admin delete a document', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/documents/doc1')
    expect(res.status).toBe(200)

    const list = await authed(app, residentToken).get('/api/projects/p1/documents')
    expect(list.body.some(d => d.id === 'doc1')).toBe(false)
  })

  it('rejects a non-admin member', async () => {
    const res = await authed(app, residentToken).delete('/api/projects/p1/documents/doc1')
    expect(res.status).toBe(403)
  })

  it('404s for a document belonging to a different project', async () => {
    const res = await authed(app, adminToken).delete('/api/projects/p1/documents/doc7')
    expect(res.status).toBe(404)
  })
})

describe('/api/vendors — global directory management', () => {
  it('lets an admin list every vendor, unfiltered by project', async () => {
    const res = await authed(app, adminToken).get('/api/vendors')
    expect(res.status).toBe(200)
    // the project-scoped view filters by state/city; this one must not
    const scoped = await authed(app, residentToken).get('/api/projects/p1/vendors')
    expect(res.body.length).toBeGreaterThan(scoped.body.length)
  })

  it('rejects a non-admin listing the global directory', async () => {
    const res = await authed(app, residentToken).get('/api/vendors')
    expect(res.status).toBe(403)
  })

  it('lets an admin delete a vendor', async () => {
    const res = await authed(app, adminToken).delete('/api/vendors/v1')
    expect(res.status).toBe(200)

    const list = await authed(app, adminToken).get('/api/vendors')
    expect(list.body.some(v => v.id === 'v1')).toBe(false)
  })

  it('removes the vendor from every project view, since the directory is global', async () => {
    await authed(app, adminToken).delete('/api/vendors/v1')
    const scoped = await authed(app, residentToken).get('/api/projects/p1/vendors')
    expect(scoped.body.some(v => v.id === 'v1')).toBe(false)
  })

  it('rejects a non-admin deleting a vendor', async () => {
    const res = await authed(app, residentToken).delete('/api/vendors/v1')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown vendor', async () => {
    const res = await authed(app, adminToken).delete('/api/vendors/v_nope')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/community-requests', () => {
  it('lets an admin read back submitted requests', async () => {
    await request(app).post('/api/community-requests').send({ name: 'Taman Baru', city: 'Ipoh', state: 'Perak', developer: 'Dev Sdn Bhd', note: 'please add' })

    const res = await authed(app, adminToken).get('/api/community-requests')
    expect(res.status).toBe(200)
    const row = res.body.find(r => r.name === 'Taman Baru')
    expect(row).toBeDefined()
    expect(row.city).toBe('Ipoh')
    expect(row.message).toContain('Dev Sdn Bhd')
  })

  it('rejects a non-admin', async () => {
    const res = await authed(app, residentToken).get('/api/community-requests')
    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/community-requests')
    expect(res.status).toBe(401)
  })

  it('returns newest first', async () => {
    await request(app).post('/api/community-requests').send({ name: 'First', city: 'A', state: 'B' })
    await new Promise(r => setTimeout(r, 5))
    await request(app).post('/api/community-requests').send({ name: 'Second', city: 'A', state: 'B' })

    const res = await authed(app, adminToken).get('/api/community-requests')
    const names = res.body.map(r => r.name)
    expect(names.indexOf('Second')).toBeLessThan(names.indexOf('First'))
  })

  it('lets an admin delete a handled request', async () => {
    await request(app).post('/api/community-requests').send({ name: 'Taman Baru', city: 'Ipoh', state: 'Perak' })
    const list = await authed(app, adminToken).get('/api/community-requests')
    const target = list.body.find(r => r.name === 'Taman Baru')

    const res = await authed(app, adminToken).delete(`/api/community-requests/${target.id}`)
    expect(res.status).toBe(200)

    const after = await authed(app, adminToken).get('/api/community-requests')
    expect(after.body.some(r => r.id === target.id)).toBe(false)
  })

  it('rejects a non-admin deleting a request', async () => {
    await request(app).post('/api/community-requests').send({ name: 'Taman Baru', city: 'Ipoh', state: 'Perak' })
    const list = await authed(app, adminToken).get('/api/community-requests')
    const res = await authed(app, residentToken).delete(`/api/community-requests/${list.body[0].id}`)
    expect(res.status).toBe(403)
  })
})
