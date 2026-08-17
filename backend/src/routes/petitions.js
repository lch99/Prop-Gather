import { Router } from 'express'
import { z } from 'zod'
import { getDb, withTransaction } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { blockSensitiveContent } from '../middleware/sensitiveContent.js'
import { notFound, forbidden, conflict } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const petitionsRouter = Router({ mergeParams: true })

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(4000),
  target: z.coerce.number().int().positive('Target must be a positive number')
})

// Signature count and author name are joined in, and the caller's own signature
// resolved in the same pass — three queries per petition became one. See the
// same note in chat.js for why that matters more on MySQL than it did on SQLite.
const PETITION_SELECT = `
  SELECT p.*,
         u.name AS creator_name,
         (SELECT COUNT(*) FROM petition_signatures s WHERE s.petition_id = p.id) AS signature_count,
         (SELECT COUNT(*) FROM petition_signatures s WHERE s.petition_id = p.id AND s.user_id = ?) AS signed_by_me
  FROM petitions p
  LEFT JOIN users u ON u.id = p.created_by_user_id
`

function serialize(row) {
  const signatures = Number(row.signature_count)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    target: row.target,
    signatures,
    signedByMe: Number(row.signed_by_me) > 0,
    createdBy: row.creator_name || 'Unknown',
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    // Lets the UI hide the Edit control rather than offer it and then 409.
    editable: !row.edited_at && signatures === 0
  }
}

const fetchPetition = (db, petitionId, userId) =>
  db.get(`${PETITION_SELECT} WHERE p.id = ?`, [userId, petitionId])

petitionsRouter.get('/', requireAuth, requireMembership, wrap(async (req, res) => {
  const rows = await getDb().all(
    `${PETITION_SELECT} WHERE p.project_id = ? ORDER BY p.created_at DESC`,
    [req.user.id, req.params.projectId]
  )
  res.json(rows.map(serialize))
}))

petitionsRouter.post('/', requireAuth, requireMembership, validate(createSchema), blockSensitiveContent('title', 'description'), wrap(async (req, res) => {
  const db = getDb()
  const petId = id('pet')
  const createdAt = new Date().toISOString().slice(0, 10)
  await db.run(`
    INSERT INTO petitions (id, project_id, title, description, target, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [petId, req.params.projectId, req.body.title, req.body.description, req.body.target, req.user.id, createdAt])

  res.status(201).json(serialize(await fetchPetition(db, petId, req.user.id)))
}))

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
petitionsRouter.patch('/:petitionId', requireAuth, requireMembership, validate(editSchema), blockSensitiveContent('title', 'description'), wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT * FROM petitions WHERE id = ? AND project_id = ?', [req.params.petitionId, req.params.projectId])
  if (!row) return next(notFound("We couldn't find that petition — it may have been removed."))
  if (row.created_by_user_id !== req.user.id) return next(forbidden('Only the person who started this petition can edit it.'))
  if (row.edited_at) return next(conflict('This petition has already been edited. Petitions can only be edited once.'))

  const { n: signatures } = await db.get('SELECT COUNT(*) n FROM petition_signatures WHERE petition_id = ?', [row.id])
  if (Number(signatures) > 0) return next(conflict('This petition already has signatures and can no longer be edited.'))

  await db.run('UPDATE petitions SET title = ?, description = ?, edited_at = ? WHERE id = ?',
    [req.body.title, req.body.description, new Date().toISOString(), row.id])

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'petition.edited',
    targetType: 'petition',
    targetId: row.id,
    projectId: req.params.projectId,
    metadata: {}
  })

  res.json(serialize(await fetchPetition(db, row.id, req.user.id)))
}))

petitionsRouter.post('/:petitionId/sign', requireAuth, requireMembership, wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT * FROM petitions WHERE id = ? AND project_id = ?', [req.params.petitionId, req.params.projectId])
  if (!row) return next(notFound("We couldn't find that petition — it may have been removed."))

  // INSERT IGNORE (SQLite's INSERT OR IGNORE) against the (petition_id, user_id)
  // primary key is what makes signing idempotent — signing twice is a no-op
  // rather than a duplicate signature or an error.
  await db.run('INSERT IGNORE INTO petition_signatures (petition_id, user_id) VALUES (?, ?)', [row.id, req.user.id])
  res.json(serialize(await fetchPetition(db, row.id, req.user.id)))
}))

// Creator or admin, matching forum threads and chat messages. Signatures are
// removed with the petition — a signature has no meaning once the thing it
// endorsed is gone, and leaving them would strand rows against a missing FK.
petitionsRouter.delete('/:petitionId', requireAuth, requireMembership, wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT * FROM petitions WHERE id = ? AND project_id = ?', [req.params.petitionId, req.params.projectId])
  if (!row) return next(notFound("We couldn't find that petition — it may have been removed."))
  if (row.created_by_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden('You can only delete petitions you started.'))

  const { n: signatures } = await db.get('SELECT COUNT(*) n FROM petition_signatures WHERE petition_id = ?', [row.id])

  await withTransaction(async (tx) => {
    await tx.run('DELETE FROM petition_signatures WHERE petition_id = ?', [row.id])
    await tx.run('DELETE FROM petitions WHERE id = ?', [row.id])
  })

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'petition.deleted',
    targetType: 'petition',
    targetId: row.id,
    projectId: req.params.projectId,
    metadata: { createdByUserId: row.created_by_user_id, deletedBySelf: row.created_by_user_id === req.user.id, signaturesRemoved: Number(signatures) }
  })

  res.json({ ok: true })
}))
