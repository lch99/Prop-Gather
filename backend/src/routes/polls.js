import { Router } from 'express'
import { z } from 'zod'
import { getDb, withTransaction } from '../db/index.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership, requireRole } from '../middleware/auth.js'
import { badRequest, notFound } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const pollsRouter = Router({ mergeParams: true })

// Vote counts come from one aggregate rather than a COUNT per option. The
// synchronous version ran 2 + N queries per poll, which was fine in-process and
// is a round trip each against MySQL — a project with several polls turned one
// page load into dozens of them.
async function serialize(db, row, userId) {
  const [options, myVote] = await Promise.all([
    db.all(`
      SELECT o.id, o.label, COUNT(v.option_id) AS votes
      FROM poll_options o
      LEFT JOIN poll_votes v ON v.option_id = o.id
      WHERE o.poll_id = ?
      GROUP BY o.id, o.label, o.position
      ORDER BY o.position
    `, [row.id]),
    db.get('SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?', [row.id, userId])
  ])

  return {
    id: row.id,
    question: row.question,
    expiresAt: row.expires_at,
    votedByMe: myVote ? myVote.option_id : false,
    options: options.map(o => ({ id: o.id, label: o.label, votes: Number(o.votes) }))
  }
}

pollsRouter.get('/', requireAuth, requireMembership, wrap(async (req, res) => {
  const db = getDb()
  const rows = await db.all('SELECT * FROM polls WHERE project_id = ?', [req.params.projectId])
  res.json(await Promise.all(rows.map(r => serialize(db, r, req.user.id))))
}))

const voteSchema = z.object({ optionId: z.string().min(1, 'optionId is required') })

pollsRouter.post('/:pollId/vote', requireAuth, requireMembership, validate(voteSchema), wrap(async (req, res, next) => {
  const db = getDb()
  const poll = await db.get('SELECT * FROM polls WHERE id = ? AND project_id = ?', [req.params.pollId, req.params.projectId])
  if (!poll) return next(notFound("We couldn't find that poll — it may have been removed."))

  const option = await db.get('SELECT * FROM poll_options WHERE id = ? AND poll_id = ?', [req.body.optionId, poll.id])
  if (!option) return next(badRequest('That poll option is no longer available. Please refresh and try again.'))

  // The primary key on (poll_id, user_id) plus INSERT IGNORE is what makes
  // voting idempotent — a second vote from the same resident is silently
  // dropped rather than counted twice.
  await db.run('INSERT IGNORE INTO poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?)', [poll.id, req.user.id, option.id])
  res.json(await serialize(db, poll, req.user.id))
}))

// Admin-only: unlike a forum thread or petition, a community poll has no
// resident author to own it (there is no create endpoint — polls are seeded or
// set up by management), so there is nobody else who could reasonably remove one.
pollsRouter.delete('/:pollId', requireAuth, requireRole('admin'), wrap(async (req, res, next) => {
  const db = getDb()
  const poll = await db.get('SELECT * FROM polls WHERE id = ? AND project_id = ?', [req.params.pollId, req.params.projectId])
  if (!poll) return next(notFound("We couldn't find that poll — it may have been removed."))

  const { n: votes } = await db.get('SELECT COUNT(*) n FROM poll_votes WHERE poll_id = ?', [poll.id])

  await withTransaction(async (tx) => {
    await tx.run('DELETE FROM poll_votes WHERE poll_id = ?', [poll.id])
    await tx.run('DELETE FROM poll_options WHERE poll_id = ?', [poll.id])
    await tx.run('DELETE FROM polls WHERE id = ?', [poll.id])
  })

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'poll.deleted',
    targetType: 'poll',
    targetId: poll.id,
    projectId: req.params.projectId,
    metadata: { question: poll.question, votesRemoved: Number(votes) }
  })

  res.json({ ok: true })
}))
