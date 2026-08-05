import { Router } from 'express'
import { getDb } from '../db/index.js'
import { toProject } from '../util/serialize.js'
import { notFound } from '../util/errors.js'

export const projectsRouter = Router()

projectsRouter.get('/', (req, res) => {
  const { state, type, search } = req.query
  const db = getDb()

  let sql = 'SELECT * FROM projects WHERE 1=1'
  const params = []
  if (state) { sql += ' AND state = ?'; params.push(state) }
  if (type) { sql += ' AND type = ?'; params.push(type) }
  if (search) {
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(city) LIKE ? OR LOWER(state) LIKE ?)'
    const q = `%${String(search).toLowerCase()}%`
    params.push(q, q, q)
  }
  sql += ' ORDER BY name'

  const rows = db.prepare(sql).all(...params)
  res.json(rows.map(toProject))
})

projectsRouter.get('/:id', (req, res, next) => {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!row) return next(notFound('Project not found'))
  res.json(toProject(row))
})
