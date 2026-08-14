import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { hashPassword, verifyPassword, signToken } from '../util/auth.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { conflict, unauthorized, notFound, forbidden } from '../util/errors.js'
import { toMembership } from '../util/serialize.js'
import { recordAudit } from '../util/audit.js'
import { deleteObject } from '../util/s3.js'

export const authRouter = Router()

// Keyed by the attempted email (not IP — see rateLimit.js) so repeated
// credential-stuffing against one account is throttled regardless of how
// the request is proxied. Generous enough not to lock out a real user who
// mistypes their password a few times.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => req.body?.email && String(req.body.email).trim().toLowerCase(),
  message: 'Too many login attempts for this account. Please try again in a few minutes.'
})

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200)
})

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

function userWithCommunities(userRow) {
  const db = getDb()
  const memberships = db.prepare(`
    SELECT cm.*, p.name AS project_name, p.city AS project_city, p.state AS project_state
    FROM community_memberships cm JOIN projects p ON p.id = cm.project_id
    WHERE cm.user_id = ?
  `).all(userRow.id)

  return {
    ...publicUser(userRow),
    communities: memberships.map(m => ({
      ...toMembership(m),
      project: { name: m.project_name, city: m.project_city, state: m.project_state }
    }))
  }
}

authRouter.post('/register', validate(registerSchema), (req, res, next) => {
  try {
    const { name, email, password } = req.body
    const db = getDb()

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) return next(conflict('An account with this email already exists. Try signing in instead.'))

    const user = {
      id: id('usr'),
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'resident',
      createdAt: new Date().toISOString()
    }
    db.prepare('INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (@id, @name, @email, @passwordHash, @role, @createdAt)').run(user)

    const token = signToken(user)
    res.status(201).json({ token, user: userWithCommunities({ id: user.id, name, email, role: user.role }) })
  } catch (err) {
    next(err)
  }
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required')
})

authRouter.post('/login', loginRateLimit, validate(loginSchema), (req, res, next) => {
  try {
    const { email, password } = req.body
    const db = getDb()
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!row || !verifyPassword(password, row.password_hash)) {
      // Audit failed attempts for breach-detection purposes (see
      // backend/docs/BREACH_RESPONSE.md) — never surfaced to the caller, whose
      // response stays the generic "Incorrect email or password" either way.
      recordAudit(db, {
        actorRole: 'anonymous',
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: email,
        metadata: { reason: row ? 'bad_password' : 'unknown_email' }
      })
      return next(unauthorized('Incorrect email or password'))
    }
    if (row.role === 'admin') {
      recordAudit(db, {
        actorUserId: row.id,
        actorRole: row.role,
        action: 'auth.admin_login',
        targetType: 'user',
        targetId: row.id,
        metadata: {}
      })
    }
    const token = signToken(row)
    res.json({ token, user: userWithCommunities(row) })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', requireAuth, (req, res, next) => {
  try {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    res.json(userWithCommunities(row))
  } catch (err) {
    next(err)
  }
})

// PDPA s.34/s.38 erasure. No FK in the schema uses ON DELETE CASCADE and
// `foreign_keys = ON` is set, so every referencing row has to be removed here in
// dependency order or the final DELETE throws a constraint error.
//
// Two things are deliberately kept rather than deleted:
//   - audit_log rows are anonymised (actor_user_id -> NULL), not removed. The
//     accountability record of what an admin did is exactly what PDPA requires
//     be retained; erasing it to satisfy an erasure request would defeat it.
//   - applications this user *decided* as an admin keep the row and lose only
//     the decided_by pointer — that record belongs to a different applicant.
authRouter.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const db = getDb()
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!target) return next(notFound("We couldn't find that user account."))
  // Self-deletion would revoke the acting admin's own access mid-request and
  // could remove the last admin account entirely.
  if (target.id === req.user.id) return next(forbidden("You can't delete your own admin account. Ask another admin to do it."))

  // Collected before the transaction: S3 deletes are async and must not run
  // inside better-sqlite3's synchronous transaction.
  const documentKeys = db.prepare('SELECT document_file FROM applications WHERE user_id = ?').all(target.id)
    .map(r => (r.document_file ? JSON.parse(r.document_file)?.key : null))
    .filter(Boolean)

  const counts = db.transaction(() => {
    // Threads authored by the user take their poll and upvotes with them.
    const threadIds = db.prepare('SELECT id FROM forum_threads WHERE author_user_id = ?').all(target.id).map(r => r.id)
    for (const threadId of threadIds) {
      const poll = db.prepare('SELECT id FROM thread_polls WHERE thread_id = ?').get(threadId)
      if (poll) {
        db.prepare('DELETE FROM thread_poll_votes WHERE poll_id = ?').run(poll.id)
        db.prepare('DELETE FROM thread_poll_options WHERE poll_id = ?').run(poll.id)
        db.prepare('DELETE FROM thread_polls WHERE id = ?').run(poll.id)
      }
      db.prepare('DELETE FROM forum_upvotes WHERE thread_id = ?').run(threadId)
    }
    db.prepare('DELETE FROM forum_threads WHERE author_user_id = ?').run(target.id)

    // Petitions created by the user take their signatures with them.
    const petitionIds = db.prepare('SELECT id FROM petitions WHERE created_by_user_id = ?').all(target.id).map(r => r.id)
    for (const petitionId of petitionIds) {
      db.prepare('DELETE FROM petition_signatures WHERE petition_id = ?').run(petitionId)
    }
    db.prepare('DELETE FROM petitions WHERE created_by_user_id = ?').run(target.id)

    // The user's own participation in content owned by others.
    db.prepare('DELETE FROM forum_upvotes WHERE user_id = ?').run(target.id)
    db.prepare('DELETE FROM thread_poll_votes WHERE user_id = ?').run(target.id)
    db.prepare('DELETE FROM poll_votes WHERE user_id = ?').run(target.id)
    db.prepare('DELETE FROM petition_signatures WHERE user_id = ?').run(target.id)
    const messages = db.prepare('DELETE FROM chat_messages WHERE sender_user_id = ?').run(target.id).changes
    const defects = db.prepare('DELETE FROM defects WHERE reported_by_user_id = ?').run(target.id).changes
    db.prepare('DELETE FROM fee_payments WHERE user_id = ?').run(target.id)
    db.prepare('DELETE FROM community_memberships WHERE user_id = ?').run(target.id)
    const applications = db.prepare('DELETE FROM applications WHERE user_id = ?').run(target.id).changes

    db.prepare('UPDATE applications SET decided_by = NULL WHERE decided_by = ?').run(target.id)
    const auditRows = db.prepare('UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = ?').run(target.id).changes

    db.prepare('DELETE FROM users WHERE id = ?').run(target.id)

    return { threads: threadIds.length, petitions: petitionIds.length, messages, defects, applications, auditRowsAnonymised: auditRows }
  })()

  // Recorded after the delete so the anonymisation pass above can't blank the
  // acting admin's own id on this entry. targetId keeps the erased user's id:
  // it is no longer resolvable to a person, which is the point.
  recordAudit(db, {
    actorUserId: req.user.id,
    actorRole: req.user.role,
    action: 'user.erased',
    targetType: 'user',
    targetId: target.id,
    metadata: counts
  })

  for (const key of documentKeys) {
    // Best-effort, same as application withdrawal — the bucket lifecycle rule
    // (backend/infra/s3-lifecycle.json) is the backstop.
    await deleteObject(key).catch(err => {
      // eslint-disable-next-line no-console
      console.error(`Failed to delete S3 object ${key}`, err)
    })
  }

  res.json({ ok: true, erased: counts })
})
