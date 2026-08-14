import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership, requireRole } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'
import { toReference } from '../util/serialize.js'

export const referencesRouter = Router({ mergeParams: true })

const REFERENCE_TYPES = ['Project Reference', 'Residence Reference', 'Building Progress']
const PROGRESS_TYPE = 'Building Progress'

const attachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  dataUrl: z.string()
})

const createSchema = z.object({
  type: z.enum(REFERENCE_TYPES, { errorMap: () => ({ message: 'Please choose a valid contact type.' }) }),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(4000).optional().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  progress: z.union([z.coerce.number().int().min(0).max(100), z.literal('').transform(() => null), z.null()]).optional(),
  attachments: z.array(attachmentSchema).max(6).optional().default([])
})

referencesRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM references_ WHERE project_id = ? ORDER BY date DESC').all(req.params.projectId)
  res.json(rows.map(toReference))
})

referencesRouter.post('/', requireAuth, requireRole('admin'), validate(createSchema), (req, res) => {
  const db = getDb()
  const refId = id('ref')
  const { type, title, description, date, attachments } = req.body
  const progress = type === PROGRESS_TYPE ? (req.body.progress ?? null) : null

  db.prepare(`
    INSERT INTO references_ (id, project_id, type, title, description, date, uploaded_by, progress, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(refId, req.params.projectId, type, title, description, date, req.user.name, progress, JSON.stringify(attachments))

  const row = db.prepare('SELECT * FROM references_ WHERE id = ?').get(refId)
  res.status(201).json(toReference(row))
})

referencesRouter.delete('/:refId', requireAuth, requireRole('admin'), (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM references_ WHERE id = ? AND project_id = ?').get(req.params.refId, req.params.projectId)
  if (!row) return next(notFound("We couldn't find that contact — it may have been removed."))
  db.prepare('DELETE FROM references_ WHERE id = ?').run(row.id)
  res.json({ ok: true })
})
