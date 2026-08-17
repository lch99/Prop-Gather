import { Router } from 'express'
import { z } from 'zod'
import { getDb, withTransaction } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { blockSensitiveContent } from '../middleware/sensitiveContent.js'
import { badRequest, notFound, forbidden, conflict } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

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

// Author details and the upvote tally come back with the thread row. The
// synchronous version issued a separate query per thread for each — plus one per
// poll option — so listing a busy forum was hundreds of queries. In-process
// against SQLite that was invisible; against MySQL each one is a round trip.
const THREAD_SELECT = `
  SELECT t.*,
         u.name  AS author_name,
         cm.unit AS author_unit,
         cm.tier AS author_tier,
         (SELECT COUNT(*) FROM forum_upvotes fu WHERE fu.thread_id = t.id) AS upvote_count
  FROM forum_threads t
  LEFT JOIN users u ON u.id = t.author_user_id
  LEFT JOIN community_memberships cm
    ON cm.user_id = t.author_user_id AND cm.project_id = t.project_id
`

// Loads the polls for a set of threads — with their options and vote counts —
// in two queries total, however many threads there are.
async function loadPolls(db, threadIds) {
  const byThread = new Map()
  if (!threadIds.length) return byThread

  const threadPlaceholders = threadIds.map(() => '?').join(', ')
  const polls = await db.allDynamic(
    `SELECT * FROM thread_polls WHERE thread_id IN (${threadPlaceholders})`,
    threadIds
  )
  if (!polls.length) return byThread

  const pollIds = polls.map(p => p.id)
  const pollPlaceholders = pollIds.map(() => '?').join(', ')
  const options = await db.allDynamic(`
    SELECT o.id, o.poll_id, o.label, COUNT(v.option_id) AS votes
    FROM thread_poll_options o
    LEFT JOIN thread_poll_votes v ON v.option_id = o.id
    WHERE o.poll_id IN (${pollPlaceholders})
    GROUP BY o.id, o.poll_id, o.label, o.position
    ORDER BY o.position
  `, pollIds)

  const optionsByPoll = new Map()
  for (const o of options) {
    if (!optionsByPoll.has(o.poll_id)) optionsByPoll.set(o.poll_id, [])
    optionsByPoll.get(o.poll_id).push({ id: o.id, label: o.label, votes: Number(o.votes) })
  }

  for (const p of polls) {
    byThread.set(p.thread_id, {
      id: p.id,
      question: p.question,
      expiresAt: p.expires_at,
      options: optionsByPoll.get(p.id) || []
    })
  }
  return byThread
}

function serializeThread(row, poll = null) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    pinned: !!row.pinned,
    upvotes: Number(row.upvote_count),
    replies: row.replies,
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    attachments: JSON.parse(row.attachments),
    author: row.author_name
      ? { name: row.author_name, unit: row.author_unit || '-', tier: row.author_tier || 'Owner', verified: true }
      : null,
    ...(poll ? { poll } : {})
  }
}

// Fetches one thread and its poll, for the single-thread responses.
async function fetchThread(db, threadId) {
  const row = await db.get(`${THREAD_SELECT} WHERE t.id = ?`, [threadId])
  if (!row) return null
  const polls = await loadPolls(db, [row.id])
  return serializeThread(row, polls.get(row.id) || null)
}

forumRouter.get('/', requireAuth, requireMembership, wrap(async (req, res) => {
  const db = getDb()
  const rows = await db.all(`${THREAD_SELECT} WHERE t.project_id = ?`, [req.params.projectId])
  rows.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const polls = await loadPolls(db, rows.map(r => r.id))
  res.json(rows.map(r => serializeThread(r, polls.get(r.id) || null)))
}))

forumRouter.post('/', requireAuth, requireMembership, validate(createThreadSchema), blockSensitiveContent('title', 'body'), wrap(async (req, res, next) => {
  const { category, title, body, attachments, poll } = req.body
  if (!attachAttachmentsTotalSize(attachments)) return next(badRequest('Your attachments add up to more than 10 MB. Please remove one or attach smaller files.'))

  const db = getDb()
  const projectId = req.params.projectId
  const threadId = id('thr')
  const createdAt = new Date().toISOString()

  // The thread and its poll are one unit: a thread that advertised a poll but
  // failed halfway through writing the options would render an empty vote.
  await withTransaction(async (tx) => {
    await tx.run(`
      INSERT INTO forum_threads (id, project_id, category, title, body, author_user_id, pinned, replies, attachments, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `, [threadId, projectId, category, title, body, req.user.id, JSON.stringify(attachments), createdAt])

    if (poll) {
      const pollId = id('tpoll')
      await tx.run('INSERT INTO thread_polls (id, thread_id, question, expires_at) VALUES (?, ?, ?, NULL)', [pollId, threadId, poll.question])
      for (const [i, label] of poll.options.entries()) {
        await tx.run('INSERT INTO thread_poll_options (id, poll_id, label, position) VALUES (?, ?, ?, ?)', [id('tpopt'), pollId, label, i])
      }
    }
  })

  res.status(201).json(await fetchThread(db, threadId))
}))

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
forumRouter.patch('/:threadId', requireAuth, requireMembership, validate(editThreadSchema), blockSensitiveContent('title', 'body'), wrap(async (req, res, next) => {
  const db = getDb()
  const thread = await db.get('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?', [req.params.threadId, req.params.projectId])
  if (!thread) return next(notFound("We couldn't find that post — it may have been removed."))
  if (thread.author_user_id !== req.user.id) return next(forbidden('Only the person who wrote this post can edit it.'))
  if (thread.edited_at) return next(conflict('This post has already been edited. Posts can only be edited once.'))

  const editedAt = new Date().toISOString()
  await db.run('UPDATE forum_threads SET title = ?, body = ?, edited_at = ? WHERE id = ?',
    [req.body.title, req.body.body, editedAt, thread.id])

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'forum.thread_edited',
    targetType: 'forum_thread',
    targetId: thread.id,
    projectId: req.params.projectId,
    metadata: { titleChanged: thread.title !== req.body.title, bodyChanged: thread.body !== req.body.body }
  })

  res.json(await fetchThread(db, thread.id))
}))

forumRouter.post('/:threadId/upvote', requireAuth, requireMembership, wrap(async (req, res, next) => {
  const db = getDb()
  const row = await db.get('SELECT id FROM forum_threads WHERE id = ? AND project_id = ?', [req.params.threadId, req.params.projectId])
  if (!row) return next(notFound("We couldn't find that post — it may have been removed."))

  // Idempotent by the (thread_id, user_id) primary key — upvoting twice is a
  // no-op rather than a second vote.
  await db.run('INSERT IGNORE INTO forum_upvotes (thread_id, user_id) VALUES (?, ?)', [row.id, req.user.id])
  res.json(await fetchThread(db, row.id))
}))

const pollVoteSchema = z.object({ optionId: z.string().min(1, 'Please choose an option before voting.') })

forumRouter.post('/:threadId/poll-vote', requireAuth, requireMembership, validate(pollVoteSchema), wrap(async (req, res, next) => {
  const db = getDb()
  const thread = await db.get('SELECT id FROM forum_threads WHERE id = ? AND project_id = ?', [req.params.threadId, req.params.projectId])
  if (!thread) return next(notFound("We couldn't find that post — it may have been removed."))

  const pollRow = await db.get('SELECT * FROM thread_polls WHERE thread_id = ?', [thread.id])
  if (!pollRow) return next(badRequest("This post doesn't have a poll to vote on."))

  const option = await db.get('SELECT * FROM thread_poll_options WHERE id = ? AND poll_id = ?', [req.body.optionId, pollRow.id])
  if (!option) return next(badRequest("That poll option is no longer available. Please refresh and try again."))

  await db.run('INSERT IGNORE INTO thread_poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?)', [pollRow.id, req.user.id, option.id])
  res.json(await fetchThread(db, thread.id))
}))

// Lets a resident remove their own post (or an admin remove any post) — the
// PDPA right to withdraw consent / request deletion of personal data extends
// to content a user contributed, not just their verification documents.
forumRouter.delete('/:threadId', requireAuth, requireMembership, wrap(async (req, res, next) => {
  const db = getDb()
  const thread = await db.get('SELECT * FROM forum_threads WHERE id = ? AND project_id = ?', [req.params.threadId, req.params.projectId])
  if (!thread) return next(notFound("We couldn't find that post — it may have been removed."))
  if (thread.author_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden('You can only delete your own posts.'))

  await withTransaction(async (tx) => {
    const poll = await tx.get('SELECT id FROM thread_polls WHERE thread_id = ?', [thread.id])
    if (poll) {
      await tx.run('DELETE FROM thread_poll_votes WHERE poll_id = ?', [poll.id])
      await tx.run('DELETE FROM thread_poll_options WHERE poll_id = ?', [poll.id])
      await tx.run('DELETE FROM thread_polls WHERE id = ?', [poll.id])
    }
    await tx.run('DELETE FROM forum_upvotes WHERE thread_id = ?', [thread.id])
    await tx.run('DELETE FROM forum_threads WHERE id = ?', [thread.id])
  })

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'forum.thread_deleted',
    targetType: 'forum_thread',
    targetId: thread.id,
    projectId: req.params.projectId,
    metadata: { authorUserId: thread.author_user_id, deletedBySelf: thread.author_user_id === req.user.id }
  })

  res.json({ ok: true })
}))
