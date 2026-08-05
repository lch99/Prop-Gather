import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { toDocument } from '../util/serialize.js'

export const documentsRouter = Router({ mergeParams: true })

documentsRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY date DESC').all(req.params.projectId)
  res.json(rows.map(toDocument))
})
