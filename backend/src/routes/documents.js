import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireMembership, requireRole } from '../middleware/auth.js'
import { notFound } from '../util/errors.js'
import { toDocument } from '../util/serialize.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const documentsRouter = Router({ mergeParams: true })

documentsRouter.get('/', requireAuth, requireMembership, wrap(async (req, res) => {
  const rows = await getDb().all('SELECT * FROM documents WHERE project_id = ? ORDER BY date DESC', [req.params.projectId])
  res.json(rows.map(toDocument))
}))

// Admin-only, mirroring references — these are management-published building
// documents (by-laws, minutes, circulars), not resident-authored content.
// There is no create endpoint yet; this exists so a document published in error
// can be taken down rather than being permanent.
documentsRouter.delete('/:documentId', requireAuth, requireRole('admin'), wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT * FROM documents WHERE id = ? AND project_id = ?', [req.params.documentId, req.params.projectId])
  if (!row) return next(notFound("We couldn't find that document — it may have been removed."))

  await db.run('DELETE FROM documents WHERE id = ?', [row.id])

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'document.deleted',
    targetType: 'document',
    targetId: row.id,
    projectId: req.params.projectId,
    metadata: { title: row.title, category: row.category }
  })

  res.json({ ok: true })
}))
