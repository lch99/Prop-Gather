import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const communityRequestsRouter = Router()

// Every `max()` here is the width of the column the value lands in, because
// MySQL runs in strict mode: a value that passes zod but overflows the column
// raises ER_DATA_TOO_LONG, which surfaces to the submitter as a 500 and an
// unexplained "we couldn't send your request". `name` (the submitter) is
// VARCHAR(120) and `project_name` (the community) is VARCHAR(200) — they are
// deliberately different, so don't collapse them to one bound.
const schema = z.object({
  contactName: z.string().trim().min(1, 'Your name is required').max(120),
  // Required, not optional: without a reply address a request is a dead end —
  // there is no other field that identifies who asked, and the admin's only
  // possible response is to add the community and hope they come back.
  email: z.string().trim().max(190).email('Please enter a valid email address'),
  name: z.string().trim().min(1, 'Community name is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(120),
  state: z.string().trim().min(1, 'State is required').max(120),
  developer: z.string().trim().max(200).optional().default(''),
  note: z.string().trim().max(2000).optional().default('')
})

communityRequestsRouter.post('/', validate(schema), wrap(async (req, res) => {
  const { contactName, email, name, city, state, developer, note } = req.body
  await getDb().run(`
    INSERT INTO community_requests (id, name, email, project_name, city, state, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id('creq'),
    contactName,
    email,
    name,
    city,
    state,
    [developer, note].filter(Boolean).join(' — '),
    new Date().toISOString()
  ])
  res.status(201).json({ ok: true })
}))

// The submit route above is public and unauthenticated, so without this the
// requests were write-only — nothing on the platform could read them back and
// every "please add my community" submission was silently unreachable.
communityRequestsRouter.get('/', requireAuth, requireRole('admin'), wrap(async (_req, res) => {
  const rows = await getDb().all('SELECT * FROM community_requests ORDER BY created_at DESC')
  res.json(rows.map(r => ({
    id: r.id,
    name: r.project_name,
    // Null for anything submitted before contact capture existed: the old route
    // hardcoded email to NULL and copied the community name into `name`, so
    // 0007 blanked those to stop them being read back as a submitter's name.
    contactName: r.name || '',
    email: r.email || '',
    city: r.city,
    state: r.state,
    message: r.message || '',
    createdAt: r.created_at
  })))
}))

communityRequestsRouter.delete('/:id', requireAuth, requireRole('admin'), wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT * FROM community_requests WHERE id = ?', [req.params.id])
  if (!row) return next(notFound("We couldn't find that community request."))

  await db.run('DELETE FROM community_requests WHERE id = ?', [row.id])

  // The row holds a name and email, so its removal is an admin action on
  // personal data and belongs in the audit log — but the address itself stays
  // out of the metadata, which is readable by every admin via GET /audit-log.
  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'community_request.deleted',
    targetType: 'community_request',
    targetId: row.id,
    metadata: { projectName: row.project_name, city: row.city, state: row.state }
  })

  res.json({ ok: true })
}))
