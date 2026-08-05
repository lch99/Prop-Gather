import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'

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
    createdAt: row.created_at
  }
}

petitionsRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM petitions WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId)
  res.json(rows.map(r => serialize(db, r, req.user.id)))
})

petitionsRouter.post('/', requireAuth, requireMembership, validate(createSchema), (req, res) => {
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

petitionsRouter.post('/:petitionId/sign', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM petitions WHERE id = ? AND project_id = ?').get(req.params.petitionId, req.params.projectId)
  if (!row) return next(notFound('Petition not found'))

  db.prepare('INSERT OR IGNORE INTO petition_signatures (petition_id, user_id) VALUES (?, ?)').run(row.id, req.user.id)
  res.json(serialize(db, row, req.user.id))
})
