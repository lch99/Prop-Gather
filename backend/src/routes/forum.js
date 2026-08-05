import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { badRequest, notFound, forbidden } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'

export const forumRouter = Router({ mergeParams: true })

const CATEGORIES = [
  'Defects & Repairs', 'Building Management', 'Security', 'Maintenance Fees',
  'Contractors & Services', 'Marketplace', 'Facilities', 'General Discussion'
]

const attachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  dataUrl: z.string()
})

const pollSchema = z.object({
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2, 'A poll needs at least 2 options').max(8)
})

const createThreadSchema = z.object({
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Unknown category' }) }),
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Post body is required').max(5000),
  attachments: z.array(attachmentSchema).max(6, 'Up to 6 files').optional().default([]),
  poll: pollSchema.nullable().optional()
})

function attachAttachmentsTotalSize(attachments) {
  const MAX_TOTAL = 10 * 1024 * 1024
  const total = attachments.reduce((sum, a) => sum + (a.size || 0), 0)
  return total <= MAX_TOTAL
}

function serializeThread(db, row) {
  const upvotes = db.prepare('SELECT COUNT(*) n FROM forum_upvotes WHERE thread_id = ?').get(row.id).n
  const author = db.prepare(`
    SELECT u.name, cm.unit, cm.tier
    FROM users u LEFT JOIN community_memberships cm ON cm.user_id = u.id AND cm.project_id = ?
    WHERE u.id = ?
  `).get(row.project_id, row.author_user_id)

  const pollRow = db.prepare('SELECT * FROM thread_polls WHERE thread_id = ?').get(row.id)
  let poll = null
  if (pollRow) {
    const options = db.prepare('SELECT * FROM thread_poll_options WHERE poll_id = ? ORDER BY position').all(pollRow.id)
    poll = {
      id: pollRow.id,
      question: pollRow.question,
      expiresAt: pollRow.expires_at,
      options: options.map(o => ({
        id: o.id,
        label: o.label,
        votes: db.prepare('SELECT COUNT(*) n FROM thread_poll_votes WHERE option_id = ?').get(o.id).n
      }))
    }
  }

  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    pinned: !!row.pinned,
    upvotes,
    replies: row.replies,
    createdAt: row.created_at,
    attachments: JSON.parse(row.attachments),
    author: author ? { name: author.name, unit: author.unit || '-', tier: author.tier || 'Owner', verified: true } : null,
    ...(poll ? { poll } : {})
  }
}

forumRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM forum_threads WHERE project_id = ?').all(req.params.projectId)
  rows.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at) - new Date(a.created_at)
  })
  res.json(rows.map(r => serializeThread(db, r)))
})

forumRouter.post('/', requireAuth, requireMembership, validate(createThreadSchema), (req, res, next) => {
  const { category, title, body, attachments, poll } = req.body
  if (!attachAttachmentsTotalSize(attachments)) return next(badRequest('Attachments exceed 10 MB total'))

  const db = getDb()
  const projectId = req.params.projectId
  const threadId = id('thr')
  const createdAt = new Date().toISOString()

  db.prepare(`
    INSERT INTO forum_threads (id, project_id, category, title, body, author_user_id, pinned, replies, attachments, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(threadId, projectId, category, title, body, req.user.id, JSON.stringify(attachments), createdAt)

  if (poll) {
    const pollId = id('tpoll')
    db.prepare('INSERT INTO thread_polls (id, thread_id, question, expires_at) VALUES (?, ?, ?, NULL)').run(pollId, threadId, poll.question)
    const insertOpt = db.prepare('INSERT INTO thread_poll_options (id, poll_id, label, position) VALUES (?, ?, ?, ?)')
    poll.options.forEach((label, i) => insertOpt.run(id('tpopt'), pollId, label, i))
  }

  const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(threadId)
  res.status(201).json(serializeThread(db, row))
})

forumRouter.post('/:threadId/upvote', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?').get(req.params.threadId, req.params.projectId)
  if (!row) return next(notFound('Thread not found'))

  db.prepare('INSERT OR IGNORE INTO forum_upvotes (thread_id, user_id) VALUES (?, ?)').run(row.id, req.user.id)
  res.json(serializeThread(db, row))
})

const pollVoteSchema = z.object({ optionId: z.string().min(1, 'optionId is required') })

forumRouter.post('/:threadId/poll-vote', requireAuth, requireMembership, validate(pollVoteSchema), (req, res, next) => {
  const db = getDb()
  const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?').get(req.params.threadId, req.params.projectId)
  if (!thread) return next(notFound('Thread not found'))

  const pollRow = db.prepare('SELECT * FROM thread_polls WHERE thread_id = ?').get(thread.id)
  if (!pollRow) return next(badRequest('This thread does not have a poll'))

  const option = db.prepare('SELECT * FROM thread_poll_options WHERE id = ? AND poll_id = ?').get(req.body.optionId, pollRow.id)
  if (!option) return next(badRequest('Unknown poll option'))

  db.prepare('INSERT OR IGNORE INTO thread_poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?)').run(pollRow.id, req.user.id, option.id)
  res.json(serializeThread(db, thread))
})

// Lets a resident remove their own post (or an admin remove any post) — the
// PDPA right to withdraw consent / request deletion of personal data extends
// to content a user contributed, not just their verification documents.
forumRouter.delete('/:threadId', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?').get(req.params.threadId, req.params.projectId)
  if (!thread) return next(notFound('Thread not found'))
  if (thread.author_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden())

  db.transaction(() => {
    const poll = db.prepare('SELECT id FROM thread_polls WHERE thread_id = ?').get(thread.id)
    if (poll) {
      db.prepare('DELETE FROM thread_poll_votes WHERE poll_id = ?').run(poll.id)
      db.prepare('DELETE FROM thread_poll_options WHERE poll_id = ?').run(poll.id)
      db.prepare('DELETE FROM thread_polls WHERE id = ?').run(poll.id)
    }
    db.prepare('DELETE FROM forum_upvotes WHERE thread_id = ?').run(thread.id)
    db.prepare('DELETE FROM forum_threads WHERE id = ?').run(thread.id)
  })()

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'forum.thread_deleted',
    targetType: 'forum_thread',
    targetId: thread.id,
    projectId: req.params.projectId,
    metadata: { authorUserId: thread.author_user_id, deletedBySelf: thread.author_user_id === req.user.id }
  })

  res.json({ ok: true })
})
