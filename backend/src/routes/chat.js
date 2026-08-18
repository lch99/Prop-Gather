import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { blockSensitiveContent } from '../middleware/sensitiveContent.js'
import { badRequest, notFound, forbidden, conflict } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'
import { wrap } from '../util/asyncHandler.js'

export const chatRouter = Router({ mergeParams: true })

export const CHANNELS = ['general', 'defects', 'announcements', 'facilities', 'renovation']

chatRouter.get('/channels', requireAuth, requireMembership, (_req, res) => {
  res.json(CHANNELS)
})

function requireValidChannel(req, _res, next) {
  if (!CHANNELS.includes(req.params.channel)) return next(badRequest("That chat channel doesn't exist. Please pick one from the list."))
  next()
}

const attachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  dataUrl: z.string()
})

const sendSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(2000),
  attachments: z.array(attachmentSchema).max(6).optional().default([])
})

// Author details are joined in rather than fetched per message: a lookup per
// row would be a network round trip, turning one request on a busy channel into
// hundreds of queries.
const MESSAGE_SELECT = `
  SELECT m.*, u.name AS sender_name, cm.unit AS sender_unit, cm.tier AS sender_tier
  FROM chat_messages m
  LEFT JOIN users u ON u.id = m.sender_user_id
  LEFT JOIN community_memberships cm
    ON cm.user_id = m.sender_user_id AND cm.project_id = m.project_id
`

function serializeMessage(row) {
  return {
    id: row.id,
    sender: row.sender_name || 'Unknown',
    unit: row.sender_unit || '-',
    tier: row.sender_tier || 'Owner',
    verified: true,
    text: row.text,
    attachments: JSON.parse(row.attachments),
    editedAt: row.edited_at || null,
    time: new Date(row.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
}

const fetchMessage = (db, messageId) => db.get(`${MESSAGE_SELECT} WHERE m.id = ?`, [messageId])

chatRouter.get('/:channel/messages', requireAuth, requireMembership, requireValidChannel, wrap(async (req, res) => {
  const rows = await getDb().all(
    `${MESSAGE_SELECT} WHERE m.project_id = ? AND m.channel = ? ORDER BY m.created_at`,
    [req.params.projectId, req.params.channel]
  )
  res.json(rows.map(serializeMessage))
}))

chatRouter.post('/:channel/messages', requireAuth, requireMembership, requireValidChannel, validate(sendSchema), blockSensitiveContent('text'), wrap(async (req, res) => {
  const db = getDb()
  const { text, attachments } = req.body
  const msgId = id('msg')
  const createdAt = new Date().toISOString()

  await db.run(`
    INSERT INTO chat_messages (id, project_id, channel, sender_user_id, text, attachments, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [msgId, req.params.projectId, req.params.channel, req.user.id, text, JSON.stringify(attachments), createdAt])

  res.status(201).json(serializeMessage(await fetchMessage(db, msgId)))
}))

const editSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(2000)
})

// One edit, sender only — same reasoning as forum threads (see forum.js).
// Attachments aren't editable; a message whose file was wrong should be deleted
// and resent rather than have different bytes appear under the same message.
chatRouter.patch('/:channel/messages/:messageId', requireAuth, requireMembership, requireValidChannel, validate(editSchema), blockSensitiveContent('text'), wrap(async (req, res, next) => {
  const db = getDb()
  const msg = await db.get(
    'SELECT * FROM chat_messages WHERE id = ? AND project_id = ? AND channel = ?',
    [req.params.messageId, req.params.projectId, req.params.channel]
  )
  if (!msg) return next(notFound("We couldn't find that message — it may have been deleted."))
  if (msg.sender_user_id !== req.user.id) return next(forbidden('Only the person who sent this message can edit it.'))
  if (msg.edited_at) return next(conflict('This message has already been edited. Messages can only be edited once.'))

  await db.run('UPDATE chat_messages SET text = ?, edited_at = ? WHERE id = ?', [req.body.text, new Date().toISOString(), msg.id])

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'chat.message_edited',
    targetType: 'chat_message',
    targetId: msg.id,
    projectId: req.params.projectId,
    metadata: { channel: req.params.channel }
  })

  res.json(serializeMessage(await fetchMessage(db, msg.id)))
}))

// Lets a resident remove their own message (or an admin remove any message) —
// same PDPA rationale as forum thread deletion (see forum.js).
chatRouter.delete('/:channel/messages/:messageId', requireAuth, requireMembership, requireValidChannel, wrap(async (req, res, next) => {
  const db = getDb()
  const msg = await db.get(
    'SELECT * FROM chat_messages WHERE id = ? AND project_id = ? AND channel = ?',
    [req.params.messageId, req.params.projectId, req.params.channel]
  )
  if (!msg) return next(notFound("We couldn't find that message — it may have been deleted."))
  if (msg.sender_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden('You can only delete your own messages.'))

  await db.run('DELETE FROM chat_messages WHERE id = ?', [msg.id])

  await recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'chat.message_deleted',
    targetType: 'chat_message',
    targetId: msg.id,
    projectId: req.params.projectId,
    metadata: { senderUserId: msg.sender_user_id, channel: req.params.channel, deletedBySelf: msg.sender_user_id === req.user.id }
  })

  res.json({ ok: true })
}))
