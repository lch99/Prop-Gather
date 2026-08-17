import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { toProject } from '../util/serialize.js'
import { conflict, notFound } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const projectsRouter = Router()

projectsRouter.get('/', wrap(async (req, res) => {
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

  const rows = await db.all(sql, params)
  res.json(rows.map(toProject))
}))

projectsRouter.get('/:id', wrap(async (req, res, next) => {
  const row = await getDb().get('SELECT * FROM projects WHERE id = ?', [req.params.id])
  if (!row) return next(notFound("We couldn't find that community."))
  res.json(toProject(row))
}))

const createSchema = z.object({
  name: z.string().trim().min(1, 'Community name is required').max(200),
  // Free text, not an enum: Malaysian developments don't fit a fixed list
  // (serviced apartment, SoHo, townhouse, mixed strata…), and an admin adding a
  // real community shouldn't be blocked behind a schema change. The frontend's
  // chipColor() hashes any label to a WCAG-AA colour pair, so new types render.
  type: z.string().trim().min(1, 'Property type is required').max(60),
  state: z.string().trim().min(1, 'State is required').max(120),
  city: z.string().trim().min(1, 'City is required').max(120),
  address: z.string().trim().min(1, 'Address is required').max(300),
  ownerCount: z.coerce.number().int().min(0).max(1000000).optional().default(0),
  activityLevel: z.enum(['Low', 'Medium', 'High']).optional().default('Low'),
  units: z.coerce.number().int().min(0).max(1000000).optional().default(0),
  blocks: z.array(z.string().trim().min(1).max(40)).max(100).optional().default([]),
  floorsPerBlock: z.coerce.number().int().min(0).max(300).optional().default(0)
})

// Admins add communities directly — no application or request needed. This is the
// counterpart to POST /api/community-requests, which is what a resident submits
// when the community they live in isn't on the platform yet.
projectsRouter.post('/', requireAuth, requireRole('admin'), validate(createSchema), wrap(async (req, res, next) => {
  const { name, type, state, city, address, ownerCount, activityLevel, units, blocks, floorsPerBlock } = req.body
  const db = getDb()

  // Two rows for the same building would split its residents across two private
  // spaces — each invisible to the other — so the same name in the same city is a
  // conflict rather than a second community.
  const existing = await db.get(
    'SELECT id, name, city FROM projects WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?)',
    [name, city]
  )
  if (existing) {
    return next(conflict(`${existing.name} is already on PropGather in ${existing.city}. Open the existing community instead of adding a second one.`))
  }

  const projectId = id('p')
  await db.run(`
    INSERT INTO projects (id, name, type, state, city, address, owner_count, activity_level, units, blocks, floors_per_block, latest_thread, active_offer_banner)
    VALUES (:id, :name, :type, :state, :city, :address, :ownerCount, :activityLevel, :units, :blocks, :floorsPerBlock, NULL, 0)
  `, {
    id: projectId, name, type, state, city, address,
    ownerCount, activityLevel, units, blocks: JSON.stringify(blocks), floorsPerBlock
  })

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'project.created',
    targetType: 'project',
    targetId: projectId,
    projectId,
    metadata: { name, type, city, state }
  })

  res.status(201).json(toProject(await db.get('SELECT * FROM projects WHERE id = ?', [projectId])))
}))
