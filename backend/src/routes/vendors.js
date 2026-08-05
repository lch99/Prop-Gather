import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'
import { toVendor } from '../util/serialize.js'

export const vendorsRouter = Router({ mergeParams: true })

vendorsRouter.get('/', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return next(notFound('Project not found'))

  const rows = db.prepare('SELECT * FROM vendors').all()
  const filtered = rows.filter(v => {
    const districts = JSON.parse(v.districts)
    return v.state === project.state || districts.includes(project.city)
  })
  res.json(filtered.map(toVendor))
})
