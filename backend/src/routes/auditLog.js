import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { toAuditLogEntry } from '../util/serialize.js'
import { wrap } from '../util/asyncHandler.js'

export const auditLogRouter = Router()

const SELECT_WITH_ACTOR = `
  SELECT audit_log.*, actors.name AS actor_name
  FROM audit_log
  LEFT JOIN users actors ON actors.id = audit_log.actor_user_id
`

auditLogRouter.get('/', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const { action, targetType } = req.query
  const db = getDb()

  const clauses = []
  const params = []
  if (action) { clauses.push('audit_log.action = ?'); params.push(action) }
  if (targetType) { clauses.push('audit_log.target_type = ?'); params.push(targetType) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await db.all(`${SELECT_WITH_ACTOR} ${where} ORDER BY audit_log.created_at DESC LIMIT 200`, params)
  res.json(rows.map(toAuditLogEntry))
}))
