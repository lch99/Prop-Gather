import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { toProject } from '../util/serialize.js'
import { badRequest, conflict, notFound } from '../util/errors.js'
import { COMMUNITY_IMAGE_PREFIX, buildCommunityImageKey, createUploadUrl, createDownloadUrl, headObject, deleteObject } from '../util/s3.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const projectsRouter = Router()

// Where a share can be sent, mirroring the sheet in src/components/Share.jsx.
// 'copy' (link copied to the clipboard) and 'native' (the phone's own share
// sheet) are real distribution too, so they count. A fixed list rather than an
// ENUM column keeps a new destination out of migration territory — but it is
// still a closed set, so the counter can't be seeded with junk labels by anyone
// posting by hand.
const SHARE_CHANNELS = ['whatsapp', 'telegram', 'facebook', 'x', 'email', 'copy', 'native']

// Reserved: arrivals on a share link, written only by the route below. Clients
// can't send it (it isn't in SHARE_CHANNELS), which is what keeps "shared 40
// times, opened 6 times" an honest pair of numbers rather than one total.
const VISIT_CHANNEL = 'visit'

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

// Declared before '/:id' on purpose: Express matches in order, so the route
// below would otherwise swallow this path and look for a community whose id is
// literally 'share-stats'.
//
// Admin-only. The counters themselves are anonymous (see the 0009 migration),
// but "which of our communities are being passed around" is operational data
// about the platform, not something a resident needs.
projectsRouter.get('/share-stats', requireAuth, requireRole('admin'), wrap(async (_req, res) => {
  const rows = await getDb().all(`
    SELECT s.project_id, s.channel, s.share_count, s.last_shared_at, p.name AS project_name
      FROM community_shares s
      JOIN projects p ON p.id = s.project_id
     ORDER BY s.project_id, s.channel
  `)

  const byProject = new Map()
  for (const row of rows) {
    let entry = byProject.get(row.project_id)
    if (!entry) {
      entry = { projectId: row.project_id, name: row.project_name, shares: 0, visits: 0, byChannel: {}, lastSharedAt: null }
      byProject.set(row.project_id, entry)
    }
    // 'visit' is the reserved arrival counter, not a place anyone shared to —
    // keeping it out of `shares` and `byChannel` is what lets a caller read
    // shares-sent against links-opened instead of one inflated number.
    if (row.channel === VISIT_CHANNEL) {
      entry.visits = row.share_count
    } else {
      entry.shares += row.share_count
      entry.byChannel[row.channel] = row.share_count
    }
    if (!entry.lastSharedAt || row.last_shared_at > entry.lastSharedAt) entry.lastSharedAt = row.last_shared_at
  }

  res.json([...byProject.values()].sort((a, b) => b.shares - a.shares || b.visits - a.visits))
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

// ── Profile picture & cover photo ───────────────────────────────────────────
//
// Same three-step shape as the verification upload in routes/applications.js:
// ask for a presigned PUT URL, send the bytes straight to S3, then hand back the
// key. The bytes never pass through this process, and the database stores the
// key alone — GET /api/projects returns the whole directory in one response, so
// an inline image per row would be paid for by every visitor on their first
// page load.
//
// The difference from a verification document is who may look: these are public
// images on a public directory page, which is why the GET below has no auth and
// why it is a cacheable redirect rather than a presigned URL handed to the
// client (a URL that expires in minutes cannot be cached, and cannot be used as
// an og:image either).

// Column per kind. A closed map, not a caller-supplied string interpolated into
// SQL — `kind` reaches these routes straight from the URL path.
const IMAGE_COLUMNS = { logo: 'logo_key', cover: 'cover_key' }

const MAX_IMAGE_MB = 8
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

// The redirect below is cached for this long; the presigned URL it points at
// lasts four times as long, so a browser that cached the redirect at the last
// possible moment still gets a signature with plenty of life left.
const IMAGE_REDIRECT_CACHE_SECONDS = 15 * 60
const IMAGE_SIGNATURE_TTL_SECONDS = 60 * 60

const imageKind = (value) => (Object.prototype.hasOwnProperty.call(IMAGE_COLUMNS, value) ? value : null)

const imageUploadUrlSchema = z.object({
  kind: z.enum(['logo', 'cover'], { errorMap: () => ({ message: 'Choose either the profile picture or the cover photo.' }) }),
  fileName: z.string().trim().min(1, 'fileName is required').max(200),
  fileType: z.string().trim().min(1, 'fileType is required'),
  fileSize: z.number().positive().max(MAX_IMAGE_MB * 1024 * 1024, `Image must be under ${MAX_IMAGE_MB} MB`)
})

// Admin-only, like POST / above: a community's photos are its shared identity in
// the directory, so they follow the same rule as every other project-level write
// rather than being editable by any single one of its residents.
projectsRouter.post('/:id/images/upload-url', requireAuth, requireRole('admin'), validate(imageUploadUrlSchema), wrap(async (req, res, next) => {
  const project = await getDb().get('SELECT id FROM projects WHERE id = ?', [req.params.id])
  if (!project) return next(notFound("We couldn't find that community."))

  if (!ALLOWED_IMAGE_TYPES.has(req.body.fileType)) {
    return next(badRequest("That file type isn't supported. Please upload a JPG, PNG, WebP or GIF image."))
  }

  const key = buildCommunityImageKey(req.params.id, req.body.kind)
  const uploadUrl = await createUploadUrl(key, req.body.fileType)
  res.json({ key, uploadUrl, expiresIn: 300 })
}))

const setImageSchema = z.object({
  key: z.string().trim().min(1, 'Image must be uploaded to storage before saving').max(255)
})

// Step 3: point the community at an object that is now in the bucket. Verified
// with a HEAD rather than trusted, for the same reason applications.js does it —
// the client asked for the upload URL, so it also knows a key it may never have
// actually uploaded anything to.
projectsRouter.put('/:id/images/:kind', requireAuth, requireRole('admin'), validate(setImageSchema), wrap(async (req, res, next) => {
  const kind = imageKind(req.params.kind)
  if (!kind) return next(notFound('That is not a community photo we recognise.'))

  const db = getDb()
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id])
  if (!project) return next(notFound("We couldn't find that community."))

  const { key } = req.body
  // Keys are minted by the route above and scoped to this community and kind.
  // Accepting one from anywhere else would let an admin point a community at any
  // object in the bucket — a resident's ownership-proof document included, which
  // the unauthenticated GET below would then publish.
  if (!key.startsWith(`${COMMUNITY_IMAGE_PREFIX}/${req.params.id}/${kind}-`)) {
    return next(badRequest("That image doesn't belong to this community. Please upload it again."))
  }

  const head = await headObject(key)
  if (!head) return next(badRequest("We couldn't find your uploaded image. Please choose the file again."))
  if (head.ContentLength > MAX_IMAGE_MB * 1024 * 1024) {
    await deleteObject(key).catch(() => {})
    return next(badRequest(`That image is larger than ${MAX_IMAGE_MB} MB. Please upload a smaller one.`))
  }

  const previousKey = project[IMAGE_COLUMNS[kind]]
  await db.run(`UPDATE projects SET ${IMAGE_COLUMNS[kind]} = ? WHERE id = ?`, [key, req.params.id])

  // After the row is updated, and never fatally: an orphaned object costs a few
  // cents of storage, whereas failing here would leave the community pointing at
  // a photo the admin has already been told was saved.
  if (previousKey && previousKey !== key) await deleteObject(previousKey).catch(() => {})

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'project.image_updated',
    targetType: 'project',
    targetId: req.params.id,
    projectId: req.params.id,
    metadata: { kind, replaced: !!previousKey }
  })

  res.json(toProject(await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id])))
}))

projectsRouter.delete('/:id/images/:kind', requireAuth, requireRole('admin'), wrap(async (req, res, next) => {
  const kind = imageKind(req.params.kind)
  if (!kind) return next(notFound('That is not a community photo we recognise.'))

  const db = getDb()
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id])
  if (!project) return next(notFound("We couldn't find that community."))

  const existingKey = project[IMAGE_COLUMNS[kind]]
  if (!existingKey) return next(notFound('There is no photo to remove here.'))

  await db.run(`UPDATE projects SET ${IMAGE_COLUMNS[kind]} = NULL WHERE id = ?`, [req.params.id])
  await deleteObject(existingKey).catch(() => {})

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'project.image_removed',
    targetType: 'project',
    targetId: req.params.id,
    projectId: req.params.id,
    metadata: { kind }
  })

  res.json(toProject(await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id])))
}))

// Public and unauthenticated, because the pages it appears on are: an <img> on
// /discover is loaded by browsers that have never signed in, and by the crawlers
// building a share card (routes/sharePreview.js points og:image here).
//
// A 302 to a freshly signed URL rather than a proxied stream, so the bytes
// travel from S3 to the browser directly and this process stays out of the path
// of every thumbnail on a directory page. The URL is stable and versioned (see
// communityImagePath in util/serialize.js), which is what makes it cacheable.
projectsRouter.get('/:id/images/:kind', wrap(async (req, res, next) => {
  const kind = imageKind(req.params.kind)
  if (!kind) return next(notFound('That is not a community photo we recognise.'))

  const row = await getDb().get(
    `SELECT ${IMAGE_COLUMNS[kind]} AS image_key FROM projects WHERE id = ?`,
    [req.params.id]
  )
  if (!row?.image_key) return next(notFound('That community has no photo here yet.'))

  res.set('Cache-Control', `public, max-age=${IMAGE_REDIRECT_CACHE_SECONDS}`)
  res.redirect(302, await createDownloadUrl(row.image_key, IMAGE_SIGNATURE_TTL_SECONDS))
}))

// ── Share counters ──────────────────────────────────────────────────────────
//
// Both routes are public and unauthenticated by necessity: a share is handed to
// someone who has no account yet, and the person clicking it is exactly the
// visitor we are trying to reach. Nothing here reads or writes anything about
// who the caller is — see the 0009 migration for why that is deliberate.

// Keyed by community rather than by caller. The limiter is in-memory and keys on
// a caller-supplied string (middleware/rateLimit.js), and there is no caller
// identity here to key on; capping per community still bounds how fast one row's
// counter can be inflated, and a rejected call costs nothing — the frontend
// fires these off without waiting and ignores the result, so the share itself
// still happens.
const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyFn: (req) => `share:${req.params.id}`,
  message: 'That community has been shared a lot in the last minute. Please try again shortly.'
})

const shareSchema = z.object({
  channel: z.enum(SHARE_CHANNELS, { errorMap: () => ({ message: 'That is not a share destination we recognise.' }) })
})

async function bumpShareCounter(projectId, channel) {
  const now = new Date().toISOString()
  await getDb().run(`
    INSERT INTO community_shares (project_id, channel, share_count, first_shared_at, last_shared_at)
    VALUES (:projectId, :channel, 1, :now, :now)
    ON DUPLICATE KEY UPDATE share_count = share_count + 1, last_shared_at = :now
  `, { projectId, channel, now })
}

// Records that someone sent this community's link somewhere.
projectsRouter.post('/:id/share', shareLimiter, validate(shareSchema), wrap(async (req, res, next) => {
  const project = await getDb().get('SELECT id FROM projects WHERE id = ?', [req.params.id])
  if (!project) return next(notFound("We couldn't find that community."))

  await bumpShareCounter(req.params.id, req.body.channel)
  // 202, not 201: nothing addressable was created, and the caller isn't waiting.
  res.status(202).json({ ok: true })
}))

// Records an arrival on a share link. Called from the frontend once the shared
// link has actually opened the community page, never from the /s/:id preview
// that routes/sharePreview.js serves — that URL is fetched by WhatsApp's and
// Facebook's crawlers to build the preview card, and counting those would report
// bot fetches as visitors.
projectsRouter.post('/:id/share-visit', shareLimiter, wrap(async (req, res, next) => {
  const project = await getDb().get('SELECT id FROM projects WHERE id = ?', [req.params.id])
  if (!project) return next(notFound("We couldn't find that community."))

  await bumpShareCounter(req.params.id, VISIT_CHANNEL)
  res.status(202).json({ ok: true })
}))
