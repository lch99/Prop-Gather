import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, loginWithId, ADMIN, outsider, sampleDocumentFile } from './helpers.js'
import { s3Mock } from './setup.js'

let app
beforeEach(() => { app = freshApp() })

async function registerUser(app, email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Applicant', email, password: 'password123' })
  return { token: res.body.token, userId: res.body.user.id }
}

const validApp = (overrides = {}) => ({
  projectId: 'p2', unit: '1-1', tier: 'Owner', document: 'SPA', documentFile: sampleDocumentFile(), consent: true, ...overrides
})

describe('POST /api/applications/upload-url', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/applications/upload-url').send({ fileName: 'proof.pdf', fileType: 'application/pdf', fileSize: 1024 })
    expect(res.status).toBe(401)
  })

  it('returns a presigned upload URL and S3 key for an authenticated user', async () => {
    const { token } = await registerUser(app, 'uploadurl1@example.com')
    const res = await authed(app, token).post('/api/applications/upload-url').send({ fileName: 'proof.pdf', fileType: 'application/pdf', fileSize: 1024 })
    expect(res.status).toBe(200)
    expect(res.body.key).toContain('verification-docs/')
    expect(res.body.uploadUrl).toContain('https://mock-s3.test/')
  })

  it('rejects an unsupported file type', async () => {
    const { token } = await registerUser(app, 'uploadurl2@example.com')
    const res = await authed(app, token).post('/api/applications/upload-url').send({ fileName: 'proof.exe', fileType: 'application/x-msdownload', fileSize: 1024 })
    expect(res.status).toBe(400)
  })

  it('rejects a file over the 5 MB limit', async () => {
    const { token } = await registerUser(app, 'uploadurl3@example.com')
    const res = await authed(app, token).post('/api/applications/upload-url').send({ fileName: 'proof.pdf', fileType: 'application/pdf', fileSize: 6 * 1024 * 1024 })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/applications', () => {
  it('rejects an unauthenticated submission', async () => {
    const res = await request(app).post('/api/applications').send(validApp())
    expect(res.status).toBe(401)
  })

  it('creates a pending application for the authenticated user, referencing the uploaded S3 object', async () => {
    const { token, userId } = await registerUser(app, 'apply1@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp({ unit: '1-10-05' }))
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ projectId: 'p2', unit: '1-10-05', tier: 'Owner', status: 'Pending', userId })
    expect(res.body.documentFile).toMatchObject({ name: 'proof.pdf', type: 'application/pdf', size: 1024 })
    expect(res.body.documentFile.dataUrl).toContain('https://mock-s3.test/')
    expect(res.body.documentFile.dataUrl).toContain('presigned=download')
  })

  it('rejects a submission whose S3 key was never actually uploaded', async () => {
    const { token } = await registerUser(app, 'neverputit@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp({ documentFile: { ...sampleDocumentFile(), key: 'missing-key' } }))
    expect(res.status).toBe(400)
  })

  it.each([
    ['projectId', {}],
    ['unit', { projectId: 'p2' }],
    ['tier', { projectId: 'p2', unit: '1-1' }],
    ['document', { projectId: 'p2', unit: '1-1', tier: 'Owner' }],
    ['documentFile', { projectId: 'p2', unit: '1-1', tier: 'Owner', document: 'SPA' }]
  ])('rejects a submission missing %s', async (_field, partial) => {
    const { token } = await registerUser(app, `missing-${_field}@example.com`)
    const res = await authed(app, token).post('/api/applications').send(partial)
    expect(res.status).toBe(400)
  })

  it('rejects an invalid tier', async () => {
    const { token } = await registerUser(app, 'badtier@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp({ tier: 'Tenant' }))
    expect(res.status).toBe(400)
  })

  it('rejects an unknown projectId', async () => {
    const { token } = await registerUser(app, 'badproject@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp({ projectId: 'does-not-exist' }))
    expect(res.status).toBe(400)
  })

  it('rejects a second pending application for the same project', async () => {
    const { token } = await registerUser(app, 'dupapp@example.com')
    await authed(app, token).post('/api/applications').send(validApp())
    const res = await authed(app, token).post('/api/applications').send(validApp())
    expect(res.status).toBe(409)
  })

  it('rejects applying to a project the user is already a verified member of', async () => {
    const token = await login(app, 'resident@propgather.com', 'resident123')
    const res = await authed(app, token).post('/api/applications').send(validApp({ projectId: 'p1', unit: 'B-21-03' }))
    expect(res.status).toBe(409)
  })

  it('rejects a document file over the 5 MB limit', async () => {
    const { token } = await registerUser(app, 'toobig@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp({
      documentFile: { ...sampleDocumentFile(), size: 6 * 1024 * 1024 }
    }))
    expect(res.status).toBe(400)
  })

  it('rejects a document file missing its S3 key', async () => {
    const { token } = await registerUser(app, 'nodata@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp({
      documentFile: { name: 'proof.pdf', type: 'application/pdf', size: 100, key: '' }
    }))
    expect(res.status).toBe(400)
  })

  it('rejects a submission without consent', async () => {
    const { token } = await registerUser(app, 'noconsent@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp({ consent: false }))
    expect(res.status).toBe(400)
  })

  it('records the consent timestamp on submission', async () => {
    const { token } = await registerUser(app, 'consent1@example.com')
    const res = await authed(app, token).post('/api/applications').send(validApp())
    expect(res.status).toBe(201)
    expect(res.body.consentAcceptedAt).toBeTruthy()
  })
})

describe('GET /api/applications/mine', () => {
  it("includes the applicant's own uploaded file", async () => {
    const { token } = await registerUser(app, 'mine1@example.com')
    await authed(app, token).post('/api/applications').send(validApp())
    const res = await authed(app, token).get('/api/applications/mine')
    expect(res.status).toBe(200)
    expect(res.body[0].documentFile.name).toBe('proof.pdf')
  })

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/applications/mine')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/applications (admin queue)', () => {
  it('rejects a non-admin', async () => {
    const { token } = await registerUser(app, 'notadmin@example.com')
    const res = await authed(app, token).get('/api/applications')
    expect(res.status).toBe(403)
  })

  it('lists applications for admin, including the uploaded file for review', async () => {
    const { token } = await registerUser(app, 'listed@example.com')
    await authed(app, token).post('/api/applications').send(validApp({ documentFile: sampleDocumentFile('spa-scan.pdf') }))

    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, adminToken).get('/api/applications')
    expect(res.status).toBe(200)
    const application = res.body.find(a => a.email === 'listed@example.com')
    expect(application).toBeTruthy()
    expect(application.documentFile).toMatchObject({ name: 'spa-scan.pdf', type: 'application/pdf' })
    expect(application.documentFile.dataUrl).toContain('https://mock-s3.test/')
  })

  it('filters the admin queue by status', async () => {
    const { token } = await registerUser(app, 'statusfilter@example.com')
    const created = await authed(app, token).post('/api/applications').send(validApp())
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    await authed(app, adminToken).post(`/api/applications/${created.body.id}/decision`).send({ decision: 'approve' })

    const pending = await authed(app, adminToken).get('/api/applications?status=Pending')
    expect(pending.body.some(a => a.id === created.body.id)).toBe(false)
    const approved = await authed(app, adminToken).get('/api/applications?status=Approved')
    expect(approved.body.some(a => a.id === created.body.id)).toBe(true)
  })
})

describe('POST /api/applications/:id/decision', () => {
  async function pendingApplication(email, overrides = {}) {
    const { token, userId } = await registerUser(app, email)
    const res = await authed(app, token).post('/api/applications').send(validApp(overrides))
    return { token, userId, applicationId: res.body.id }
  }

  it('rejects a non-admin decision', async () => {
    const { token, applicationId } = await pendingApplication('dec1@example.com')
    const res = await authed(app, token).post(`/api/applications/${applicationId}/decision`).send({ decision: 'approve' })
    expect(res.status).toBe(403)
  })

  it('rejects an invalid decision value', async () => {
    const { applicationId } = await pendingApplication('dec2@example.com')
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, adminToken).post(`/api/applications/${applicationId}/decision`).send({ decision: 'maybe' })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown application', async () => {
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, adminToken).post('/api/applications/app_doesnotexist/decision').send({ decision: 'approve' })
    expect(res.status).toBe(404)
  })

  it('approves an application and grants verified membership', async () => {
    const { token, userId, applicationId } = await pendingApplication('dec3@example.com')
    const admin = await loginWithId(app, ADMIN.email, ADMIN.password)

    const res = await authed(app, admin.token).post(`/api/applications/${applicationId}/decision`).send({ decision: 'approve' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Approved')
    expect(res.body.documentFile).toBeTruthy() // file remains visible to admin post-decision
    expect(res.body.decidedBy).toBe(admin.userId)
    expect(res.body.decidedByName).toBe(admin.name)

    const me = await authed(app, token).get('/api/auth/me')
    expect(me.body.communities).toContainEqual(expect.objectContaining({ projectId: 'p2', tier: 'Owner', unit: '1-1' }))

    // and the user can now read the gated forum for that project
    const forumRes = await authed(app, token).get('/api/projects/p2/forum')
    expect(forumRes.status).toBe(200)
    void userId
  })

  it('rejects an application without creating membership', async () => {
    const { token, applicationId } = await pendingApplication('dec4@example.com')
    const adminToken = await login(app, ADMIN.email, ADMIN.password)

    const res = await authed(app, adminToken).post(`/api/applications/${applicationId}/decision`).send({ decision: 'reject' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Rejected')

    const forumRes = await authed(app, token).get('/api/projects/p2/forum')
    expect(forumRes.status).toBe(403)
  })

  it('rejects deciding an application twice', async () => {
    const { applicationId } = await pendingApplication('dec5@example.com')
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    await authed(app, adminToken).post(`/api/applications/${applicationId}/decision`).send({ decision: 'approve' })
    const res = await authed(app, adminToken).post(`/api/applications/${applicationId}/decision`).send({ decision: 'reject' })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/applications/:id (withdraw)', () => {
  it('lets the owner withdraw a pending application, deleting the uploaded file from S3', async () => {
    const { token } = await registerUser(app, 'withdraw1@example.com')
    const documentFile = sampleDocumentFile()
    const created = await authed(app, token).post('/api/applications').send(validApp({ documentFile }))
    const res = await authed(app, token).delete(`/api/applications/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(s3Mock.deleteObject).toHaveBeenCalledWith(documentFile.key)

    const mine = await authed(app, token).get('/api/applications/mine')
    expect(mine.body).toEqual([])
  })

  it("rejects withdrawing someone else's application", async () => {
    const { token } = await registerUser(app, 'owner-app@example.com')
    const created = await authed(app, token).post('/api/applications').send(validApp())

    const other = await outsider(app)
    const res = await authed(app, other.token).delete(`/api/applications/${created.body.id}`)
    expect(res.status).toBe(403)
  })

  it('rejects withdrawing an already-decided application', async () => {
    const { token } = await registerUser(app, 'decided-app@example.com')
    const created = await authed(app, token).post('/api/applications').send(validApp())
    const adminToken = await login(app, ADMIN.email, ADMIN.password)
    await authed(app, adminToken).post(`/api/applications/${created.body.id}/decision`).send({ decision: 'approve' })

    const res = await authed(app, token).delete(`/api/applications/${created.body.id}`)
    expect(res.status).toBe(409)
  })

  it('404s withdrawing an unknown application', async () => {
    const { token } = await registerUser(app, 'withdraw404@example.com')
    const res = await authed(app, token).delete('/api/applications/app_nope')
    expect(res.status).toBe(404)
  })
})
