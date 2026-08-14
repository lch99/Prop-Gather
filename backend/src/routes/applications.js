import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { badRequest, notFound, conflict, forbidden } from '../util/errors.js'
import { toApplication } from '../util/serialize.js'
import { buildDocumentKey, createUploadUrl, createDownloadUrl, headObject, deleteObject, describeStorageDestination } from '../util/s3.js'
import { recordAudit } from '../util/audit.js'

// Applications joined with the deciding admin's name (for decidedByName) — used
// everywhere an application row is read so accountability is visible wherever
// the application itself is visible.
const SELECT_WITH_DECIDER = `
  SELECT applications.*, deciders.name AS decided_by_name
  FROM applications
  LEFT JOIN users deciders ON deciders.id = applications.decided_by
`

export const applicationsRouter = Router()

const MAX_DOCUMENT_MB = 5
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'
])

// The actual file bytes live in S3, never in this DB or process — `documentFile`
// here is just the S3 key + display metadata the client got back from /upload-url.
const documentFileSchema = z.object({
  name: z.string().trim().min(1, 'File name is required'),
  type: z.string().trim().min(1, 'File type is required'),
  size: z.number().positive().max(MAX_DOCUMENT_MB * 1024 * 1024, `File must be under ${MAX_DOCUMENT_MB} MB`),
  key: z.string().trim().min(1, 'File must be uploaded to storage before submitting')
})

const createSchema = z.object({
  projectId: z.string().min(1, 'Please select your property project.'),
  unit: z.string().trim().min(1, 'Please enter your unit / lot number.').max(60),
  tier: z.enum(['Owner', 'House Owner'], { errorMap: () => ({ message: 'Please choose whether you are a Property Owner or a House Owner.' }) }),
  document: z.string().trim().min(1, 'Please tell us which document you are uploading.'),
  documentFile: documentFileSchema,
  phone: z.string().trim().max(40).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please tick the consent box so we can review your document.' }) })
})

// Adds a short-lived presigned GET URL for the stored S3 key, under the `dataUrl`
// field name so the existing frontend AttachmentList (img src / download href)
// keeps working unchanged once it's wired up to point at this backend.
async function withDocumentUrl(row) {
  const app = toApplication(row)
  if (app.documentFile?.key) {
    app.documentFile = { ...app.documentFile, dataUrl: await createDownloadUrl(app.documentFile.key) }
  }
  return app
}

const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, 'fileName is required').max(200),
  fileType: z.string().trim().min(1, 'fileType is required'),
  fileSize: z.number().positive().max(MAX_DOCUMENT_MB * 1024 * 1024, `File must be under ${MAX_DOCUMENT_MB} MB`)
})

// Step 1 of the upload flow: client asks for a presigned S3 PUT URL, uploads the
// file bytes directly to S3 (never through this server), then submits the
// returned `key` as documentFile.key in POST /.
applicationsRouter.post('/upload-url', requireAuth, validate(uploadUrlSchema), async (req, res, next) => {
  const { fileType } = req.body
  if (!ALLOWED_DOCUMENT_TYPES.has(fileType)) return next(badRequest('That file type isn\'t supported. Please upload a photo (JPG or PNG) or a PDF.'))

  try {
    const key = buildDocumentKey(req.user.id)
    const uploadUrl = await createUploadUrl(key, fileType)
    res.json({ key, uploadUrl, expiresIn: 300 })
  } catch (err) {
    next(err)
  }
})

applicationsRouter.post('/', requireAuth, validate(createSchema), async (req, res, next) => {
  const { projectId, unit, tier, document, documentFile, phone } = req.body
  const db = getDb()

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
  if (!project) return next(badRequest('We couldn\'t find that community. Please pick your property project from the list again.'))

  const alreadyMember = db.prepare('SELECT 1 FROM community_memberships WHERE user_id = ? AND project_id = ?').get(req.user.id, projectId)
  if (alreadyMember) return next(conflict('You are already a verified member of this community'))

  const pending = db.prepare("SELECT 1 FROM applications WHERE user_id = ? AND project_id = ? AND status = 'Pending'").get(req.user.id, projectId)
  if (pending) return next(conflict('You already have a pending application for this community'))

  try {
    const head = await headObject(documentFile.key)
    if (!head) return next(badRequest('We couldn\'t find your uploaded file. Please attach it again.'))
    if (head.ContentLength > MAX_DOCUMENT_MB * 1024 * 1024) {
      await deleteObject(documentFile.key).catch(() => {})
      return next(badRequest(`That file is larger than ${MAX_DOCUMENT_MB} MB. Please upload a smaller file.`))
    }
  } catch (err) {
    return next(err)
  }

  const now = new Date().toISOString()
  const app = {
    id: id('app'),
    userId: req.user.id,
    projectId,
    name: req.user.name,
    email: req.user.email,
    phone: phone || null,
    unit,
    tier,
    document,
    documentFile: JSON.stringify(documentFile),
    status: 'Pending',
    submittedAt: now,
    consentAcceptedAt: now
  }
  db.prepare(`
    INSERT INTO applications (id, user_id, project_id, name, email, phone, unit, tier, document, document_file, status, submitted_at, consent_accepted_at)
    VALUES (@id, @userId, @projectId, @name, @email, @phone, @unit, @tier, @document, @documentFile, @status, @submittedAt, @consentAcceptedAt)
  `).run(app)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'application.submitted',
    targetType: 'application',
    targetId: app.id,
    projectId,
    metadata: { tier, unit }
  })

  // Cross-border transfer record — PDPA s.129 requires keeping records of
  // transfers of personal data out of Malaysia: receiver, (approximate)
  // country/region, purpose, and evidence of the compliance basis relied on
  // (here: explicit consent, captured moments ago at consentAcceptedAt).
  const destination = describeStorageDestination()
  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'application.cross_border_transfer',
    targetType: 'application',
    targetId: app.id,
    projectId,
    metadata: {
      receiver: destination.provider,
      region: destination.region,
      endpoint: destination.endpoint,
      purpose: 'Identity verification document storage',
      dataCategory: 'Ownership proof document (SPA / utility bill / property title)',
      legalBasis: 'Explicit consent (PDPA s.129(3))',
      consentAcceptedAt: app.consentAcceptedAt
    }
  })

  const row = db.prepare(`${SELECT_WITH_DECIDER} WHERE applications.id = ?`).get(app.id)
  res.status(201).json(await withDocumentUrl(row))
})

applicationsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const rows = getDb().prepare(`${SELECT_WITH_DECIDER} WHERE applications.user_id = ? ORDER BY submitted_at DESC`).all(req.user.id)
    res.json(await Promise.all(rows.map(withDocumentUrl)))
  } catch (err) {
    next(err)
  }
})

applicationsRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const { status } = req.query
  const db = getDb()
  try {
    const rows = status
      ? db.prepare(`${SELECT_WITH_DECIDER} WHERE status = ? ORDER BY submitted_at DESC`).all(status)
      : db.prepare(`${SELECT_WITH_DECIDER} ORDER BY submitted_at DESC`).all()

    recordAudit(db, {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'application.list_viewed',
      targetType: 'application',
      targetId: status || 'all',
      metadata: { count: rows.length, ids: rows.map(r => r.id) }
    })

    res.json(await Promise.all(rows.map(withDocumentUrl)))
  } catch (err) {
    next(err)
  }
})

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject'], { errorMap: () => ({ message: 'Please choose either Approve or Reject.' }) })
})

applicationsRouter.post('/:id/decision', requireAuth, requireRole('admin'), validate(decisionSchema), async (req, res, next) => {
  const db = getDb()
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id)
  if (!app) return next(notFound('We couldn\'t find that application.'))
  if (app.status !== 'Pending') return next(conflict(`This application has already been ${app.status.toLowerCase()}, so it can't be decided again.`))

  const status = req.body.decision === 'approve' ? 'Approved' : 'Rejected'
  const decidedAt = new Date().toISOString()

  const run = db.transaction(() => {
    db.prepare('UPDATE applications SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?').run(status, decidedAt, req.user.id, app.id)
    if (status === 'Approved') {
      db.prepare(`
        INSERT INTO community_memberships (id, user_id, project_id, tier, unit, verified_at)
        VALUES (@id, @userId, @projectId, @tier, @unit, @verifiedAt)
        ON CONFLICT(user_id, project_id) DO UPDATE SET tier = excluded.tier, unit = excluded.unit
      `).run({ id: id('mem'), userId: app.user_id, projectId: app.project_id, tier: app.tier, unit: app.unit, verifiedAt: decidedAt })
    }
    recordAudit(db, {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: status === 'Approved' ? 'application.approved' : 'application.rejected',
      targetType: 'application',
      targetId: app.id,
      projectId: app.project_id,
      metadata: { applicantUserId: app.user_id, tier: app.tier, unit: app.unit }
    })
  })
  run()

  const row = db.prepare(`${SELECT_WITH_DECIDER} WHERE applications.id = ?`).get(app.id)
  res.json(await withDocumentUrl(row))
})

// Residents may withdraw only while Pending — once an admin has decided, the
// application is part of the decision record. Admins can additionally erase a
// decided application, which is what makes a PDPA s.34/s.38 erasure request
// actionable: the row holds the applicant's name, email, phone and unit, and
// there is no other endpoint that can remove it. The retention job only clears
// document_file, never these fields.
applicationsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  const db = getDb()
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id)
  if (!app) return next(notFound('We couldn\'t find that application.'))

  const isAdmin = req.user.role === 'admin'
  if (app.user_id !== req.user.id && !isAdmin) return next(forbidden('You can only withdraw your own application.'))
  if (app.status !== 'Pending' && !isAdmin) return next(conflict('This application has already been reviewed, so it can no longer be withdrawn.'))

  const erasingDecided = app.status !== 'Pending'

  db.prepare('DELETE FROM applications WHERE id = ?').run(app.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    // A decided application being removed is an erasure of a decision record,
    // not a withdrawal — they need to be distinguishable in the audit trail.
    action: erasingDecided ? 'application.erased' : 'application.withdrawn',
    targetType: 'application',
    targetId: app.id,
    projectId: app.project_id,
    metadata: {
      applicantUserId: app.user_id,
      withdrawnBySelf: app.user_id === req.user.id,
      ...(erasingDecided ? { erasedStatus: app.status } : {})
    }
  })

  const documentFile = app.document_file ? JSON.parse(app.document_file) : null
  if (documentFile?.key) {
    // Best-effort: the application is already withdrawn either way, and the
    // bucket lifecycle rule (backend/infra/s3-lifecycle.json) is the backstop
    // if this delete fails.
    await deleteObject(documentFile.key).catch(err => {
      // eslint-disable-next-line no-console
      console.error(`Failed to delete S3 object ${documentFile.key}`, err)
    })
  }

  res.json({ ok: true })
})
