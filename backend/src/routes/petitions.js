import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { blockSensitiveContent } from '../middleware/sensitiveContent.js'
import { notFound, forbidden, conflict } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'

export const petitionsRouter = Router({ mergeParams: true })

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(4000),
  target: z.coerce.number().int().positive('Target must be a positive number')
})

function serialize(db, row, userId) {
  const signatures = db.prepare('SELECT COUNT(*) n FROM petition_signatures WHERE petition_id = ?').get(row.id).n
  const signedByMe = !!db.prepare('SELECT 1 FROM petition_signatures WHERE petition_id = ? AND user_id = ?').get(row.id, userId)
  const author = db.prepare('SELECT name FROM users WHERE id = ?').get(row.created_by_user_id)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    target: row.target,
    signatures,
    signedByMe,
    createdBy: author?.name || 'Unknown',
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    // Lets the UI hide the Edit control rather than offer it and then 409.
    editable: !row.edited_at && signatures === 0
  }
}

petitionsRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM petitions WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId)
  res.json(rows.map(r => serialize(db, r, req.user.id)))
})

petitionsRouter.post('/', requireAuth, requireMembership, validate(createSchema), blockSensitiveContent('title', 'description'), (req, res) => {
  const db = getDb()
  const petId = id('pet')
  const createdAt = new Date().toISOString().slice(0, 10)
  db.prepare(`
    INSERT INTO petitions (id, project_id, title, description, target, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(petId, req.params.projectId, req.body.title, req.body.description, req.body.target, req.user.id, createdAt)

  const row = db.prepare('SELECT * FROM petitions WHERE id = ?').get(petId)
  res.status(201).json(serialize(db, row, req.user.id))
})

const editSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(4000)
})

// One edit, creator only — and only while nobody has signed yet.
//
// The signature rule is the important one: a signature is an endorsement of
// specific wording, so letting the text change afterwards would silently
// re-attribute everyone's support to something they never read. `target` is
// likewise fixed, since the threshold is part of what was signed.
petitionsRouter.patch('/:petitionId', requireAuth, requireMembership, validate(editSchema), blockSensitiveContent('title', 'description'), (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM petitions WHERE id = ? AND project_id = ?').get(req.params.petitionId, req.params.projectId)
  if (!row) return next(notFound("We couldn't find that petition — it may have been removed."))
  if (row.created_by_user_id !== req.user.id) return next(forbidden('Only the person who started this petition can edit it.'))
  if (row.edited_at) return next(conflict('This petition has already been edited. Petitions can only be edited once.'))

  const signatures = db.prepare('SELECT COUNT(*) n FROM petition_signatures WHERE petition_id = ?').get(row.id).n
  if (signatures > 0) return next(conflict('This petition already has signatures and can no longer be edited.'))

  db.prepare('UPDATE petitions SET title = ?, description = ?, edited_at = ? WHERE id = ?')
    .run(req.body.title, req.body.description, new Date().toISOString(), row.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'petition.edited',
    targetType: 'petition',
    targetId: row.id,
    projectId: req.params.projectId,
    metadata: {}
  })

  res.json(serialize(db, db.prepare('SELECT * FROM petitions WHERE id = ?').get(row.id), req.user.id))
})

petitionsRouter.post('/:petitionId/sign', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM petitions WHERE id = ? AND project_id = ?').get(req.params.petitionId, req.params.projectId)
  if (!row) return next(notFound("We couldn't find that petition — it may have been removed."))

  db.prepare('INSERT OR IGNORE INTO petition_signatures (petition_id, user_id) VALUES (?, ?)').run(row.id, req.user.id)
  res.json(serialize(db, row, req.user.id))
})

// Creator or admin, matching forum threads and chat messages. Signatures are
// removed with the petition — a signature has no meaning once the thing it
// endorsed is gone, and leaving them would strand rows against a missing FK.
petitionsRouter.delete('/:petitionId', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM petitions WHERE id = ? AND project_id = ?').get(req.params.petitionId, req.params.projectId)
  if (!row) return next(notFound("We couldn't find that petition — it may have been removed."))
  if (row.created_by_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden('You can only delete petitions you started.'))

  const signatures = db.prepare('SELECT COUNT(*) n FROM petition_signatures WHERE petition_id = ?').get(row.id).n
  db.transaction(() => {
    db.prepare('DELETE FROM petition_signatures WHERE petition_id = ?').run(row.id)
    db.prepare('DELETE FROM petitions WHERE id = ?').run(row.id)
  })()

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'petition.deleted',
    targetType: 'petition',
    targetId: row.id,
    projectId: req.params.projectId,
    metadata: { createdByUserId: row.created_by_user_id, deletedBySelf: row.created_by_user_id === req.user.id, signaturesRemoved: signatures }
  })

  res.json({ ok: true })
})
