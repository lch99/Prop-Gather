import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { badRequest, notFound } from '../util/errors.js'

export const pollsRouter = Router({ mergeParams: true })

function serialize(db, row, userId) {
  const options = db.prepare('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY position').all(row.id)
  const myVote = db.prepare('SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(row.id, userId)
  return {
    id: row.id,
    question: row.question,
    expiresAt: row.expires_at,
    votedByMe: myVote ? myVote.option_id : false,
    options: options.map(o => ({
      id: o.id,
      label: o.label,
      votes: db.prepare('SELECT COUNT(*) n FROM poll_votes WHERE option_id = ?').get(o.id).n
    }))
  }
}

pollsRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM polls WHERE project_id = ?').all(req.params.projectId)
  res.json(rows.map(r => serialize(db, r, req.user.id)))
})

const voteSchema = z.object({ optionId: z.string().min(1, 'optionId is required') })

pollsRouter.post('/:pollId/vote', requireAuth, requireMembership, validate(voteSchema), (req, res, next) => {
  const db = getDb()
  const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND project_id = ?').get(req.params.pollId, req.params.projectId)
  if (!poll) return next(notFound('Poll not found'))

  const option = db.prepare('SELECT * FROM poll_options WHERE id = ? AND poll_id = ?').get(req.body.optionId, poll.id)
  if (!option) return next(badRequest('Unknown poll option'))

  db.prepare('INSERT OR IGNORE INTO poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?)').run(poll.id, req.user.id, option.id)
  res.json(serialize(db, poll, req.user.id))
})
