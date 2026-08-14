import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'

export const communityRequestsRouter = Router()

const schema = z.object({
  name: z.string().trim().min(1, 'Community name is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(120),
  state: z.string().trim().min(1, 'State is required').max(120),
  developer: z.string().trim().max(200).optional().default(''),
  note: z.string().trim().max(2000).optional().default('')
})

communityRequestsRouter.post('/', validate(schema), (req, res) => {
  const { name, city, state, developer, note } = req.body
  getDb().prepare(`
    INSERT INTO community_requests (id, name, email, project_name, city, state, message, created_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(id('creq'), name, name, city, state, [developer, note].filter(Boolean).join(' — '), new Date().toISOString())
  res.status(201).json({ ok: true })
})

// The submit route above is public and unauthenticated, so without this the
// requests were write-only — nothing on the platform could read them back and
// every "please add my community" submission was silently unreachable.
communityRequestsRouter.get('/', requireAuth, requireRole('admin'), (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM community_requests ORDER BY created_at DESC').all()
  res.json(rows.map(r => ({
    id: r.id,
    name: r.project_name,
    city: r.city,
    state: r.state,
    message: r.message || '',
    createdAt: r.created_at
  })))
})

communityRequestsRouter.delete('/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM community_requests WHERE id = ?').get(req.params.id)
  if (!row) return next(notFound("We couldn't find that community request."))

  db.prepare('DELETE FROM community_requests WHERE id = ?').run(row.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'community_request.deleted',
    targetType: 'community_request',
    targetId: row.id,
    metadata: { projectName: row.project_name, city: row.city, state: row.state }
  })

  res.json({ ok: true })
})
