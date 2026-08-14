import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { blockSensitiveContent } from '../middleware/sensitiveContent.js'
import { badRequest, notFound, forbidden, conflict } from '../util/errors.js'
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
  question: z.string().trim().min(1, 'Please enter a question for your poll.'),
  options: z.array(z.string().trim().min(1, 'Poll options can\'t be left blank.'))
    .min(2, 'A poll needs at least 2 options.')
    .max(8, 'A poll can have at most 8 options.')
})

const createThreadSchema = z.object({
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Please pick a category for your post.' }) }),
  title: z.string().trim().min(1, 'Please give your post a title.').max(200, 'Your title is too long — please keep it under 200 characters.'),
  body: z.string().trim().min(1, 'Please write something in your post.').max(5000, 'Your post is too long — please keep it under 5,000 characters.'),
  attachments: z.array(attachmentSchema).max(6, 'You can attach up to 6 files.').optional().default([]),
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
    editedAt: row.edited_at || null,
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

forumRouter.post('/', requireAuth, requireMembership, validate(createThreadSchema), blockSensitiveContent('title', 'body'), (req, res, next) => {
  const { category, title, body, attachments, poll } = req.body
  if (!attachAttachmentsTotalSize(attachments)) return next(badRequest('Your attachments add up to more than 10 MB. Please remove one or attach smaller files.'))

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

const editThreadSchema = z.object({
  title: z.string().trim().min(1, 'Please give your post a title.').max(200, 'Your title is too long — please keep it under 200 characters.'),
  body: z.string().trim().min(1, 'Please write something in your post.').max(5000, 'Your post is too long — please keep it under 5,000 characters.')
})

// One edit, author only.
//
// Author only — not admins: an admin quietly rewriting a resident's words is
// worse than removing the post, because a deletion is obvious and an edit isn't.
// Admins keep DELETE for moderation.
//
// One edit — the point is to fix a typo shortly after posting, not to let a
// thread others have already replied to and upvoted be rewritten into something
// else later. `edited_at` records that the allowance is spent and is surfaced as
// `editedAt` so every reader can see the post changed.
//
// The category, poll and attachments are deliberately not editable: they're what
// people voted on and filtered by, not wording.
forumRouter.patch('/:threadId', requireAuth, requireMembership, validate(editThreadSchema), blockSensitiveContent('title', 'body'), (req, res, next) => {
  const db = getDb()
  const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?').get(req.params.threadId, req.params.projectId)
  if (!thread) return next(notFound("We couldn't find that post — it may have been removed."))
  if (thread.author_user_id !== req.user.id) return next(forbidden('Only the person who wrote this post can edit it.'))
  if (thread.edited_at) return next(conflict('This post has already been edited. Posts can only be edited once.'))

  const editedAt = new Date().toISOString()
  db.prepare('UPDATE forum_threads SET title = ?, body = ?, edited_at = ? WHERE id = ?')
    .run(req.body.title, req.body.body, editedAt, thread.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'forum.thread_edited',
    targetType: 'forum_thread',
    targetId: thread.id,
    projectId: req.params.projectId,
    metadata: { titleChanged: thread.title !== req.body.title, bodyChanged: thread.body !== req.body.body }
  })

  res.json(serializeThread(db, db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(thread.id)))
})

forumRouter.post('/:threadId/upvote', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?').get(req.params.threadId, req.params.projectId)
  if (!row) return next(notFound("We couldn't find that post — it may have been removed."))

  db.prepare('INSERT OR IGNORE INTO forum_upvotes (thread_id, user_id) VALUES (?, ?)').run(row.id, req.user.id)
  res.json(serializeThread(db, row))
})

const pollVoteSchema = z.object({ optionId: z.string().min(1, 'Please choose an option before voting.') })

forumRouter.post('/:threadId/poll-vote', requireAuth, requireMembership, validate(pollVoteSchema), (req, res, next) => {
  const db = getDb()
  const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?').get(req.params.threadId, req.params.projectId)
  if (!thread) return next(notFound("We couldn't find that post — it may have been removed."))

  const pollRow = db.prepare('SELECT * FROM thread_polls WHERE thread_id = ?').get(thread.id)
  if (!pollRow) return next(badRequest("This post doesn't have a poll to vote on."))

  const option = db.prepare('SELECT * FROM thread_poll_options WHERE id = ? AND poll_id = ?').get(req.body.optionId, pollRow.id)
  if (!option) return next(badRequest("That poll option is no longer available. Please refresh and try again."))

  db.prepare('INSERT OR IGNORE INTO thread_poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?)').run(pollRow.id, req.user.id, option.id)
  res.json(serializeThread(db, thread))
})

// Lets a resident remove their own post (or an admin remove any post) — the
// PDPA right to withdraw consent / request deletion of personal data extends
// to content a user contributed, not just their verification documents.
forumRouter.delete('/:threadId', requireAuth, requireMembership, (req, res, next) => {
  const db = getDb()
  const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?').get(req.params.threadId, req.params.projectId)
  if (!thread) return next(notFound("We couldn't find that post — it may have been removed."))
  if (thread.author_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden('You can only delete your own posts.'))

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
