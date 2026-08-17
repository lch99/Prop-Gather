import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireMembership, requireRole } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'
import { toVendor } from '../util/serialize.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const vendorsRouter = Router({ mergeParams: true })

vendorsRouter.get('/', requireAuth, requireMembership, wrap(async (req, res, next) => {
  const db = getDb()
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId])
  if (!project) return next(notFound("We couldn't find that community."))

  const rows = await db.all('SELECT * FROM vendors')
  const filtered = rows.filter(v => {
    const districts = JSON.parse(v.districts)
    return v.state === project.state || districts.includes(project.city)
  })
  res.json(filtered.map(toVendor))
}))

// The `vendors` table is a single global directory — the project-scoped GET
// above only *filters* it by the project's state/city, it doesn't own the rows.
// So vendor management is mounted separately at /api/vendors rather than under
// /api/projects/:projectId/vendors, where a DELETE would look project-scoped
// while actually removing the vendor for every community on the platform.
export const vendorsAdminRouter = Router()

vendorsAdminRouter.get('/', requireAuth, requireRole('admin'), wrap(async (_req, res) => {
  const rows = await getDb().all('SELECT * FROM vendors ORDER BY name')
  res.json(rows.map(toVendor))
}))

vendorsAdminRouter.delete('/:vendorId', requireAuth, requireRole('admin'), wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT * FROM vendors WHERE id = ?', [req.params.vendorId])
  if (!row) return next(notFound("We couldn't find that vendor — it may have been removed."))

  await db.run('DELETE FROM vendors WHERE id = ?', [row.id])

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'vendor.deleted',
    targetType: 'vendor',
    targetId: row.id,
    metadata: { name: row.name, category: row.category, global: true }
  })

  res.json({ ok: true })
}))
