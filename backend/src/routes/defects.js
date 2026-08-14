import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { blockSensitiveContent } from '../middleware/sensitiveContent.js'
import { notFound, forbidden, conflict } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'

export const defectsRouter = Router({ mergeParams: true })

// Matches the lifecycle the frontend already renders (see chipColor usage in
// the defects UI and the seeded values in src/demoData.js).
const STATUSES = ['Open', 'Acknowledged', 'In Progress', 'Resolved']

// A defect PATCH carries two different kinds of change with different rules:
// `status` is a workflow field (anyone responsible, any number of times) while
// `title`/`description` are the reporter's wording (author only, once). They
// share one endpoint because they're one resource, but the handler applies each
// rule separately — see the comments there.
const updateSchema = z.object({
  status: z.enum(STATUSES, { errorMap: () => ({ message: `status must be one of: ${STATUSES.join(', ')}` }) }).optional(),
  title: z.string().trim().min(1, 'Title is required').max(200).optional(),
  description: z.string().trim().min(1, 'Description is required').max(4000).optional()
}).refine(
  v => v.status !== undefined || v.title !== undefined || v.description !== undefined,
  { message: 'Please change the status, title or description before saving.' }
)

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(4000),
  category: z.string().trim().min(1, 'Category is required').max(80),
  block: z.string().trim().max(40).optional().default('-'),
  floorRange: z.string().trim().max(40).optional().default('-'),
  unit: z.string().trim().max(40).optional().default('-')
})

function serialize(db, row) {
  const author = db.prepare('SELECT name FROM users WHERE id = ?').get(row.reported_by_user_id)
  return {
    id: row.id,
    title: row.title,
    block: row.block,
    floorRange: row.floor_range,
    unit: row.unit,
    category: row.category,
    status: row.status,
    reportedBy: author?.name || 'Unknown',
    reportedAt: row.reported_at,
    matchingUnits: row.matching_units,
    description: row.description,
    editedAt: row.edited_at || null
  }
}

defectsRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM defects WHERE project_id = ? ORDER BY reported_at DESC').all(req.params.projectId)
  res.json(rows.map(r => serialize(db, r)))
})

defectsRouter.post('/', requireAuth, requireMembership, validate(createSchema), blockSensitiveContent('title', 'description'), (req, res) => {
  const db = getDb()
  const defectId = id('def')
  const reportedAt = new Date().toISOString().slice(0, 10)
  const { title, description, category, block, floorRange, unit } = req.body

  db.prepare(`
    INSERT INTO defects (id, project_id, title, block, floor_range, unit, category, status, reported_by_user_id, reported_at, matching_units, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, 1, ?)
  `).run(defectId, req.params.projectId, title, block, floorRange, unit, category, req.user.id, reportedAt, description)

  const row = db.prepare('SELECT * FROM defects WHERE id = ?').get(defectId)
  res.status(201).json(serialize(db, row))
})

// Without the status half of this a defect stays 'Open' forever — the create
// route hardcodes the status and nothing else could change it.
defectsRouter.patch('/:defectId', requireAuth, requireMembership, validate(updateSchema), blockSensitiveContent('title', 'description'), (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM defects WHERE id = ? AND project_id = ?').get(req.params.defectId, req.params.projectId)
  if (!row) return next(notFound("We couldn't find that defect report — it may have been removed."))

  const isReporter = row.reported_by_user_id === req.user.id
  const isAdmin = req.user.role === 'admin'
  const editingContent = req.body.title !== undefined || req.body.description !== undefined

  // Status: reporter or admin, any number of times — a building defect is
  // usually resolved by management rather than the person who saw it, and a
  // report legitimately moves back and forth through the lifecycle.
  if (!isReporter && !isAdmin) return next(forbidden('Only the person who reported this defect, or a community admin, can update it.'))

  // Content: reporter only and only once, same rule as forum posts. An admin
  // must not rewrite what a resident reported; they can change status or delete.
  if (editingContent) {
    if (!isReporter) return next(forbidden('Only the person who reported this defect can edit it.'))
    if (row.edited_at) return next(conflict('This report has already been edited. Reports can only be edited once.'))
  }

  const previous = row.status
  const next_ = {
    title: req.body.title ?? row.title,
    description: req.body.description ?? row.description,
    status: req.body.status ?? row.status,
    editedAt: editingContent ? new Date().toISOString() : row.edited_at
  }

  db.prepare('UPDATE defects SET title = ?, description = ?, status = ?, edited_at = ? WHERE id = ?')
    .run(next_.title, next_.description, next_.status, next_.editedAt, row.id)

  if (req.body.status !== undefined && req.body.status !== previous) {
    recordAudit(db, {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'defect.status_changed',
      targetType: 'defect',
      targetId: row.id,
      projectId: req.params.projectId,
      metadata: { from: previous, to: req.body.status }
    })
  }

  if (editingContent) {
    recordAudit(db, {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'defect.edited',
      targetType: 'defect',
      targetId: row.id,
      projectId: req.params.projectId,
      metadata: { titleChanged: row.title !== next_.title, descriptionChanged: row.description !== next_.description }
    })
  }

  res.json(serialize(db, db.prepare('SELECT * FROM defects WHERE id = ?').get(row.id)))
})

defectsRouter.delete('/:defectId', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM defects WHERE id = ? AND project_id = ?').get(req.params.defectId, req.params.projectId)
  if (!row) return next(notFound("We couldn't find that defect report — it may have been removed."))
  if (row.reported_by_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden('You can only delete defect reports you submitted.'))

  db.prepare('DELETE FROM defects WHERE id = ?').run(row.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'defect.deleted',
    targetType: 'defect',
    targetId: row.id,
    projectId: req.params.projectId,
    metadata: { reportedByUserId: row.reported_by_user_id, deletedBySelf: row.reported_by_user_id === req.user.id }
  })

  res.json({ ok: true })
})
