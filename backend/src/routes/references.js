import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership, requireRole } from '../middleware/auth.js'
import { badRequest, notFound } from '../util/errors.js'
import { attachmentsField, verifyAttachments, serializeReference, attachmentKeys, deleteAttachmentObjects } from '../util/attachments.js'
import { wrap } from '../util/asyncHandler.js'

export const referencesRouter = Router({ mergeParams: true })

const REFERENCE_TYPES = ['Project Reference', 'Residence Reference', 'Building Progress']
// Exported for the admin Overview summary in routes/projects.js.
export const PROGRESS_TYPE = 'Building Progress'

const createSchema = z.object({
  type: z.enum(REFERENCE_TYPES, { errorMap: () => ({ message: 'Please choose a valid contact type.' }) }),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(4000).optional().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  progress: z.union([z.coerce.number().int().min(0).max(100), z.literal('').transform(() => null), z.null()]).optional(),
  attachments: attachmentsField(6)
})

referencesRouter.get('/', requireAuth, requireMembership, wrap(async (req, res) => {
  const rows = await getDb().all('SELECT * FROM references_ WHERE project_id = ? ORDER BY date DESC', [req.params.projectId])
  res.json(await Promise.all(rows.map(row => serializeReference(row))))
}))

referencesRouter.post('/', requireAuth, requireRole('admin'), validate(createSchema), wrap(async (req, res, next) => {
  const db = getDb()
  const refId = id('ref')
  const { type, title, description, date } = req.body
  const progress = type === PROGRESS_TYPE ? (req.body.progress ?? null) : null

  const checked = await verifyAttachments(req.body.attachments, { projectId: req.params.projectId, userId: req.user.id })
  if (checked.error) return next(badRequest(checked.error))

  await db.run(`
    INSERT INTO references_ (id, project_id, type, title, description, date, uploaded_by, progress, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [refId, req.params.projectId, type, title, description, date, req.user.name, progress, JSON.stringify(checked.attachments)])

  const row = await db.get('SELECT * FROM references_ WHERE id = ?', [refId])
  res.status(201).json(await serializeReference(row))
}))

referencesRouter.delete('/:refId', requireAuth, requireRole('admin'), wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT * FROM references_ WHERE id = ? AND project_id = ?', [req.params.refId, req.params.projectId])
  if (!row) return next(notFound("We couldn't find that contact — it may have been removed."))
  await db.run('DELETE FROM references_ WHERE id = ?', [row.id])
  await deleteAttachmentObjects(attachmentKeys(row.attachments))
  res.json({ ok: true })
}))
