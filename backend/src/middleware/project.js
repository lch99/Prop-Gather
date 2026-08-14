import { getDb } from '../db/index.js'
import { notFound } from '../util/errors.js'

export function requireProjectExists(req, _res, next) {
  const project = getDb().prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return next(notFound("We couldn't find that community."))
  next()
}
