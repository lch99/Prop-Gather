import { getDb } from '../db/index.js'
import { notFound } from '../util/errors.js'

export async function requireProjectExists(req, _res, next) {
  try {
    const project = await getDb().get('SELECT id FROM projects WHERE id = ?', [req.params.projectId])
    if (!project) return next(notFound("We couldn't find that community."))
    next()
  } catch (err) {
    next(err)
  }
}
