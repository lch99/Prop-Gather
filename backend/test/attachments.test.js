import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, authed, login, loginWithId, verifiedResident, uploadAttachment, RESIDENT, ADMIN } from './helpers.js'
import { s3Mock } from './setup.js'

let app
let resident
let adminToken

beforeEach(async () => {
  app = await freshApp()
  resident = await loginWithId(app, RESIDENT.email, RESIDENT.password)
  adminToken = await login(app, ADMIN.email, ADMIN.password)
  s3Mock.deleteObject.mockClear()
})

const uploadUrl = (token, projectId, body) =>
  authed(app, token).post(`/api/projects/${projectId}/attachments/upload-url`).send(body)

const photo = { fileName: 'crack.jpg', fileType: 'image/jpeg', fileSize: 400000 }

describe('POST /api/projects/:projectId/attachments/upload-url', () => {
  it('hands a member a presigned PUT URL scoped to the community and to them', async () => {
    const res = await uploadUrl(resident.token, 'p1', photo)
    expect(res.status).toBe(200)
    expect(res.body.key.startsWith(`community-attachments/p1/${resident.userId}/`)).toBe(true)
    expect(res.body.uploadUrl).toContain('https://mock-s3.test/')
  })

  it('takes PDFs and Word documents as well as photos', async () => {
    const pdf = await uploadUrl(resident.token, 'p1', { fileName: 'minutes.pdf', fileType: 'application/pdf', fileSize: 2048 })
    const docx = await uploadUrl(resident.token, 'p1', {
      fileName: 'quote.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 2048
    })
    expect(pdf.status).toBe(200)
    expect(docx.status).toBe(200)
  })

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/projects/p1/attachments/upload-url').send(photo)
    expect(res.status).toBe(401)
  })

  it('rejects a non-member', async () => {
    const res = await uploadUrl(resident.token, 'p2', photo)
    expect(res.status).toBe(403)
  })

  it('lets an admin upload to any community', async () => {
    const res = await uploadUrl(adminToken, 'p2', photo)
    expect(res.status).toBe(200)
  })

  it('404s for an unknown community', async () => {
    const res = await uploadUrl(adminToken, 'does-not-exist', photo)
    expect(res.status).toBe(404)
  })

  it('400s on an unsupported file type', async () => {
    const res = await uploadUrl(resident.token, 'p1', { fileName: 'page.svg', fileType: 'image/svg+xml', fileSize: 2048 })
    expect(res.status).toBe(400)
  })

  it('400s on a file over 5 MB', async () => {
    const res = await uploadUrl(resident.token, 'p1', { ...photo, fileSize: 6 * 1024 * 1024 })
    expect(res.status).toBe(400)
  })
})

describe('attaching an uploaded file', () => {
  const post = (token, attachments, projectId = 'p1') => authed(app, token).post(`/api/projects/${projectId}/forum`)
    .send({ category: 'Facilities', title: 'Photos', body: 'See attached', attachments })

  it('stores the key and answers with a signed URL, never the key itself', async () => {
    const file = await uploadAttachment(app, resident.token, 'p1')
    const res = await post(resident.token, [file])
    expect(res.status).toBe(201)
    expect(res.body.attachments).toHaveLength(1)
    expect(res.body.attachments[0]).toMatchObject({ name: 'photo.jpg', type: 'image/jpeg' })
    expect(res.body.attachments[0].dataUrl).toContain(`https://mock-s3.test/${file.key}`)
    expect(res.body.attachments[0].key).toBeUndefined()

    // And the list reads it back the same way, not just the create response.
    const list = await authed(app, resident.token).get('/api/projects/p1/forum')
    expect(list.body.find(t => t.id === res.body.id).attachments).toEqual(res.body.attachments)
  })

  it('records the size storage reports rather than the size the request claimed', async () => {
    // The mock reports every object as 1024 bytes.
    const file = await uploadAttachment(app, resident.token, 'p1', { size: 4096 })
    const res = await post(resident.token, [file])
    expect(res.status).toBe(201)
    expect(res.body.attachments[0].size).toBe(1024)
  })

  it('signs URLs against the start of the hour, so repeat reads return the same URL', async () => {
    s3Mock.createDownloadUrl.mockClear()
    const file = await uploadAttachment(app, resident.token, 'p1')
    await post(resident.token, [file])

    const call = s3Mock.createDownloadUrl.mock.calls.find(([key]) => key === file.key)
    expect(call[1]).toBe(2 * 60 * 60)
    expect(call[2].signingDate.getTime() % (60 * 60 * 1000)).toBe(0)
  })

  it('rejects a file somebody else uploaded', async () => {
    const other = await verifiedResident(app, 'p1')
    const theirs = await uploadAttachment(app, other.token, 'p1')
    const res = await post(resident.token, [theirs])
    expect(res.status).toBe(400)
  })

  it('rejects a file uploaded for a different community', async () => {
    const elsewhere = await uploadAttachment(app, adminToken, 'p2')
    const res = await post(adminToken, [elsewhere], 'p1')
    expect(res.status).toBe(400)
  })

  it('refuses a verification-document key without touching storage', async () => {
    const key = 'verification-docs/u_resident/1700000000000-abcdefabcdef'
    const res = await post(resident.token, [{ name: 'deed.pdf', type: 'application/pdf', size: 1024, key }])
    expect(res.status).toBe(400)
    expect(s3Mock.headObject).not.toHaveBeenCalledWith(key)
  })

  it('400s when the upload never reached storage', async () => {
    const key = `community-attachments/p1/${resident.userId}/missing-key`
    const res = await post(resident.token, [{ name: 'a.jpg', type: 'image/jpeg', size: 1024, key }])
    expect(res.status).toBe(400)
  })

  it('rejects a file type the upload route would not have allowed', async () => {
    const file = await uploadAttachment(app, resident.token, 'p1')
    const res = await post(resident.token, [{ ...file, type: 'text/html' }])
    expect(res.status).toBe(400)
  })

  it('rejects the old inline data-URL shape', async () => {
    const res = await post(resident.token, [{ name: 'a.jpg', type: 'image/jpeg', size: 1024, dataUrl: 'data:image/jpeg;base64,AAAA' }])
    expect(res.status).toBe(400)
  })

  it('works the same way on chat messages, defect reports and references', async () => {
    const chatFile = await uploadAttachment(app, resident.token, 'p1')
    const chat = await authed(app, resident.token).post('/api/projects/p1/chat/general/messages')
      .send({ text: 'Photo of the lobby', attachments: [chatFile] })
    expect(chat.status).toBe(201)
    expect(chat.body.attachments[0].dataUrl).toContain(chatFile.key)

    const defectFile = await uploadAttachment(app, resident.token, 'p1')
    const defect = await authed(app, resident.token).post('/api/projects/p1/defects')
      .send({ title: 'Crack', category: 'Structural', description: 'Basement pillar', attachments: [defectFile] })
    expect(defect.status).toBe(201)
    expect(defect.body.attachments[0].dataUrl).toContain(defectFile.key)

    const refFile = await uploadAttachment(app, adminToken, 'p1', { name: 'plan.pdf', type: 'application/pdf' })
    const reference = await authed(app, adminToken).post('/api/projects/p1/references')
      .send({ type: 'Project Reference', title: 'Site plan', date: '2026-09-01', attachments: [refFile] })
    expect(reference.status).toBe(201)
    expect(reference.body.attachments[0].dataUrl).toContain(refFile.key)
  })
})

describe('deleting content deletes its files', () => {
  it('a forum post', async () => {
    const file = await uploadAttachment(app, resident.token, 'p1')
    const thread = await authed(app, resident.token).post('/api/projects/p1/forum')
      .send({ category: 'Facilities', title: 'T', body: 'B', attachments: [file] })
    await authed(app, resident.token).delete(`/api/projects/p1/forum/${thread.body.id}`)
    expect(s3Mock.deleteObject).toHaveBeenCalledWith(file.key)
  })

  it('a chat message', async () => {
    const file = await uploadAttachment(app, resident.token, 'p1')
    const message = await authed(app, resident.token).post('/api/projects/p1/chat/general/messages')
      .send({ text: 'hi', attachments: [file] })
    await authed(app, resident.token).delete(`/api/projects/p1/chat/general/messages/${message.body.id}`)
    expect(s3Mock.deleteObject).toHaveBeenCalledWith(file.key)
  })

  it('a defect report', async () => {
    const file = await uploadAttachment(app, resident.token, 'p1')
    const defect = await authed(app, resident.token).post('/api/projects/p1/defects')
      .send({ title: 'T', category: 'General', description: 'D', attachments: [file] })
    await authed(app, resident.token).delete(`/api/projects/p1/defects/${defect.body.id}`)
    expect(s3Mock.deleteObject).toHaveBeenCalledWith(file.key)
  })

  it('a reference', async () => {
    const file = await uploadAttachment(app, adminToken, 'p1', { name: 'plan.pdf', type: 'application/pdf' })
    const reference = await authed(app, adminToken).post('/api/projects/p1/references')
      .send({ type: 'Project Reference', title: 'Plan', date: '2026-09-01', attachments: [file] })
    await authed(app, adminToken).delete(`/api/projects/p1/references/${reference.body.id}`)
    expect(s3Mock.deleteObject).toHaveBeenCalledWith(file.key)
  })
})
