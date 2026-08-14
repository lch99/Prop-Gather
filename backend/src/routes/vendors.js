import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireMembership, requireRole } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'
import { toVendor } from '../util/serialize.js'
import { recordAudit } from '../util/audit.js'

export const vendorsRouter = Router({ mergeParams: true })

vendorsRouter.get('/', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return next(notFound("We couldn't find that community."))

  const rows = db.prepare('SELECT * FROM vendors').all()
  const filtered = rows.filter(v => {
    const districts = JSON.parse(v.districts)
    return v.state === project.state || districts.includes(project.city)
  })
  res.json(filtered.map(toVendor))
})

// The `vendors` table is a single global directory — the project-scoped GET
// above only *filters* it by the project's state/city, it doesn't own the rows.
// So vendor management is mounted separately at /api/vendors rather than under
// /api/projects/:projectId/vendors, where a DELETE would look project-scoped
// while actually removing the vendor for every community on the platform.
export const vendorsAdminRouter = Router()

vendorsAdminRouter.get('/', requireAuth, requireRole('admin'), (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM vendors ORDER BY name').all()
  res.json(rows.map(toVendor))
})

vendorsAdminRouter.delete('/:vendorId', requireAuth, requireRole('admin'), (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.vendorId)
  if (!row) return next(notFound("We couldn't find that vendor — it may have been removed."))

  db.prepare('DELETE FROM vendors WHERE id = ?').run(row.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'vendor.deleted',
    targetType: 'vendor',
    targetId: row.id,
    metadata: { name: row.name, category: row.category, global: true }
  })

  res.json({ ok: true })
})
