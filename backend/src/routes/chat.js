import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { blockSensitiveContent } from '../middleware/sensitiveContent.js'
import { badRequest, notFound, forbidden, conflict } from '../util/errors.js'
import { recordAudit } from '../util/audit.js'

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

function serializeMessage(db, row, projectId) {
  const author = db.prepare(`
    SELECT u.name, cm.unit, cm.tier
    FROM users u LEFT JOIN community_memberships cm ON cm.user_id = u.id AND cm.project_id = ?
    WHERE u.id = ?
  `).get(projectId, row.sender_user_id)

  return {
    id: row.id,
    sender: author?.name || 'Unknown',
    unit: author?.unit || '-',
    tier: author?.tier || 'Owner',
    verified: true,
    text: row.text,
    attachments: JSON.parse(row.attachments),
    editedAt: row.edited_at || null,
    time: new Date(row.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
}

chatRouter.get('/:channel/messages', requireAuth, requireMembership, requireValidChannel, (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM chat_messages WHERE project_id = ? AND channel = ? ORDER BY created_at').all(req.params.projectId, req.params.channel)
  res.json(rows.map(r => serializeMessage(db, r, req.params.projectId)))
})

chatRouter.post('/:channel/messages', requireAuth, requireMembership, requireValidChannel, validate(sendSchema), blockSensitiveContent('text'), (req, res) => {
  const db = getDb()
  const { text, attachments } = req.body
  const msgId = id('msg')
  const createdAt = new Date().toISOString()

  db.prepare(`
    INSERT INTO chat_messages (id, project_id, channel, sender_user_id, text, attachments, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, req.params.projectId, req.params.channel, req.user.id, text, JSON.stringify(attachments), createdAt)

  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msgId)
  res.status(201).json(serializeMessage(db, row, req.params.projectId))
})

// Lets a resident remove their own message (or an admin remove any message) —
// same PDPA rationale as forum thread deletion (see forum.js).
const editSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(2000)
})

// One edit, sender only — same reasoning as forum threads (see forum.js).
// Attachments aren't editable; a message whose file was wrong should be deleted
// and resent rather than have different bytes appear under the same message.
chatRouter.patch('/:channel/messages/:messageId', requireAuth, requireMembership, requireValidChannel, validate(editSchema), blockSensitiveContent('text'), (req, res, next) => {
  const db = getDb()
  const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ? AND project_id = ? AND channel = ?')
    .get(req.params.messageId, req.params.projectId, req.params.channel)
  if (!msg) return next(notFound("We couldn't find that message — it may have been deleted."))
  if (msg.sender_user_id !== req.user.id) return next(forbidden('Only the person who sent this message can edit it.'))
  if (msg.edited_at) return next(conflict('This message has already been edited. Messages can only be edited once.'))

  db.prepare('UPDATE chat_messages SET text = ?, edited_at = ? WHERE id = ?')
    .run(req.body.text, new Date().toISOString(), msg.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'chat.message_edited',
    targetType: 'chat_message',
    targetId: msg.id,
    projectId: req.params.projectId,
    metadata: { channel: req.params.channel }
  })

  res.json(serializeMessage(db, db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msg.id), req.params.projectId))
})

chatRouter.delete('/:channel/messages/:messageId', requireAuth, requireMembership, requireValidChannel, (req, res, next) => {
  const db = getDb()
  const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ? AND project_id = ? AND channel = ?')
    .get(req.params.messageId, req.params.projectId, req.params.channel)
  if (!msg) return next(notFound("We couldn't find that message — it may have been deleted."))
  if (msg.sender_user_id !== req.user.id && req.user.role !== 'admin') return next(forbidden('You can only delete your own messages.'))

  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(msg.id)

  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'chat.message_deleted',
    targetType: 'chat_message',
    targetId: msg.id,
    projectId: req.params.projectId,
    metadata: { senderUserId: msg.sender_user_id, channel: req.params.channel, deletedBySelf: msg.sender_user_id === req.user.id }
  })

  res.json({ ok: true })
})
