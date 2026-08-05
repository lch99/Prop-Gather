import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'

export const defectsRouter = Router({ mergeParams: true })

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
    description: row.description
  }
}

defectsRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM defects WHERE project_id = ? ORDER BY reported_at DESC').all(req.params.projectId)
  res.json(rows.map(r => serialize(db, r)))
})

defectsRouter.post('/', requireAuth, requireMembership, validate(createSchema), (req, res) => {
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
