import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { getDb } from '../src/db/index.js'
import { purgeApplications, RETENTION_DAYS } from '../src/jobs/purgeApplications.js'
import { freshApp, authed, login, sampleDocumentFile } from './helpers.js'
import { s3Mock } from './setup.js'

let app
beforeEach(async () => { app = await freshApp() })

async function decidedApplication(email, decision, { daysAgo = 0 } = {}) {
  const reg = await request(app).post('/api/auth/register').send({ name: 'Applicant', email, password: 'password123' })
  const token = reg.body.token
  const documentFile = sampleDocumentFile()

  const created = await authed(app, token).post('/api/applications').send({
    projectId: 'p2', unit: `U-${Math.random().toString(36).slice(2)}`, tier: 'Owner', document: 'SPA', documentFile, consent: true
  })

  const adminToken = await login(app, 'admin@propgather.com', 'admin123')
  await authed(app, adminToken).post(`/api/applications/${created.body.id}/decision`).send({ decision })

  if (daysAgo > 0) {
    const backdated = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
    await getDb().run('UPDATE applications SET decided_at = ? WHERE id = ?', [backdated, created.body.id])
  }

  return { id: created.body.id, documentFile }
}

describe('purgeApplications', () => {
  it('leaves recently-decided applications untouched', async () => {
    const { id } = await decidedApplication('recent@example.com', 'approve', { daysAgo: 1 })
    const result = await purgeApplications()
    expect(result.purged).toBe(0)

    const row = await getDb().get('SELECT * FROM applications WHERE id = ?', [id])
    expect(row.document_file).toBeTruthy()
    expect(row.document_purged_at).toBeNull()
  })

  it('purges an approved application past the retention window', async () => {
    const { id, documentFile } = await decidedApplication('old-approved@example.com', 'approve', { daysAgo: RETENTION_DAYS + 1 })
    const result = await purgeApplications()
    expect(result.purged).toBe(1)

    const row = await getDb().get('SELECT * FROM applications WHERE id = ?', [id])
    expect(row.document_file).toBeNull()
    expect(row.document_purged_at).toBeTruthy()
    // the rest of the record — the "non-reversible record that a document was verified" — survives
    expect(row.status).toBe('Approved')
    expect(row.name).toBeTruthy()

    expect(s3Mock.deleteObject).toHaveBeenCalledWith(documentFile.key)
  })

  it('purges a rejected application past the retention window', async () => {
    const { id } = await decidedApplication('old-rejected@example.com', 'reject', { daysAgo: RETENTION_DAYS + 1 })
    const result = await purgeApplications()
    expect(result.purged).toBe(1)

    const row = await getDb().get('SELECT * FROM applications WHERE id = ?', [id])
    expect(row.document_file).toBeNull()
    expect(row.status).toBe('Rejected')
  })

  it('never purges a still-pending application', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Pending Applicant', email: 'pending@example.com', password: 'password123' })
    const created = await authed(app, reg.body.token).post('/api/applications').send({
      projectId: 'p2', unit: 'P-1', tier: 'Owner', document: 'SPA', documentFile: sampleDocumentFile(), consent: true
    })
    // Backdate submitted_at far in the past — pending applications have no decided_at and must never be purged.
    await getDb().run('UPDATE applications SET submitted_at = ? WHERE id = ?',
      [new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), created.body.id])

    const result = await purgeApplications()
    expect(result.purged).toBe(0)
    const row = await getDb().get('SELECT * FROM applications WHERE id = ?', [created.body.id])
    expect(row.document_file).toBeTruthy()
  })

  it('is idempotent — a second run finds nothing left to purge', async () => {
    await decidedApplication('twice@example.com', 'approve', { daysAgo: RETENTION_DAYS + 5 })
    await purgeApplications()
    const second = await purgeApplications()
    expect(second.purged).toBe(0)
  })

  it('records an audit log entry for each purge', async () => {
    const { id } = await decidedApplication('audited-purge@example.com', 'approve', { daysAgo: RETENTION_DAYS + 1 })
    await purgeApplications()

    const adminToken = await login(app, 'admin@propgather.com', 'admin123')
    const res = await authed(app, adminToken).get('/api/audit-log?action=application.document_purged')
    expect(res.status).toBe(200)
    expect(res.body.some(e => e.targetId === id)).toBe(true)
  })
})
