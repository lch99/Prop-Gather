import { Router } from 'express'
import { z } from 'zod'
import { getDb, withTransaction } from '../db/index.js'
import { id } from '../util/ids.js'
import { hashPassword, verifyPassword, signToken } from '../util/auth.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { conflict, unauthorized, notFound, forbidden } from '../util/errors.js'
import { toMembership, communityImagePath } from '../util/serialize.js'
import { recordAudit } from '../util/audit.js'
import { deleteObject } from '../util/s3.js'
import { wrap } from '../util/asyncHandler.js'

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

async function userWithCommunities(userRow) {
  const db = getDb()
  const memberships = await db.all(`
    SELECT cm.*, p.name AS project_name, p.city AS project_city, p.state AS project_state,
           p.logo_key AS project_logo_key
    FROM community_memberships cm JOIN projects p ON p.id = cm.project_id
    WHERE cm.user_id = ?
  `, [userRow.id])

  return {
    ...publicUser(userRow),
    communities: memberships.map(m => ({
      ...toMembership(m),
      project: {
        name: m.project_name,
        city: m.project_city,
        state: m.project_state,
        // Enough for My Communities to show each community by its profile
        // picture rather than its initial. Only the logo: the cover photo is a
        // page banner, and this list has no banners on it.
        ...(m.project_logo_key ? { logoUrl: communityImagePath(m.project_id, 'logo', m.project_logo_key) } : {})
      }
    }))
  }
}

authRouter.post('/register', validate(registerSchema), wrap(async (req, res, next) => {
  const { name, email, password } = req.body
  const db = getDb()

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email])
  if (existing) return next(conflict('An account with this email already exists. Try signing in instead.'))

  const user = {
    id: id('usr'),
    name,
    email,
    passwordHash: hashPassword(password),
    role: 'resident',
    createdAt: new Date().toISOString()
  }
  await db.run(
    'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (:id, :name, :email, :passwordHash, :role, :createdAt)',
    user
  )

  const token = signToken(user)
  res.status(201).json({ token, user: await userWithCommunities({ id: user.id, name, email, role: user.role }) })
}))

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required')
})

authRouter.post('/login', loginRateLimit, validate(loginSchema), wrap(async (req, res, next) => {
  const { email, password } = req.body
  const db = getDb()
  const row = await db.get('SELECT * FROM users WHERE email = ?', [email])
  if (!row || !verifyPassword(password, row.password_hash)) {
    // Audit failed attempts for breach-detection purposes (see
    // backend/docs/BREACH_RESPONSE.md) — never surfaced to the caller, whose
    // response stays the generic "Incorrect email or password" either way.
    await recordAudit(db, {
      actorRole: 'anonymous',
      action: 'auth.login_failed',
      targetType: 'user',
      targetId: email,
      metadata: { reason: row ? 'bad_password' : 'unknown_email' }
    })
    return next(unauthorized('Incorrect email or password'))
  }
  if (row.role === 'admin') {
    await recordAudit(db, {
      actorUserId: row.id,
      actorRole: row.role,
      action: 'auth.admin_login',
      targetType: 'user',
      targetId: row.id,
      metadata: {}
    })
  }
  const token = signToken(row)
  res.json({ token, user: await userWithCommunities(row) })
}))

authRouter.get('/me', requireAuth, wrap(async (req, res) => {
  const row = await getDb().get('SELECT * FROM users WHERE id = ?', [req.user.id])
  res.json(await userWithCommunities(row))
}))

// PDPA s.34/s.38 erasure. No FK in the schema uses ON DELETE CASCADE and InnoDB
// enforces them, so every referencing row has to be removed here in dependency
// order or the final DELETE throws a constraint error.
//
// Two things are deliberately kept rather than deleted:
//   - audit_log rows are anonymised (actor_user_id -> NULL), not removed. The
//     accountability record of what an admin did is exactly what PDPA requires
//     be retained; erasing it to satisfy an erasure request would defeat it.
//   - applications this user *decided* as an admin keep the row and lose only
//     the decided_by pointer — that record belongs to a different applicant.
authRouter.delete('/users/:id', requireAuth, requireRole('admin'), wrap(async (req, res, next) => {
  const db = getDb()
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id])
  if (!target) return next(notFound("We couldn't find that user account."))
  // Self-deletion would revoke the acting admin's own access mid-request and
  // could remove the last admin account entirely.
  if (target.id === req.user.id) return next(forbidden("You can't delete your own admin account. Ask another admin to do it."))

  // Collected before the transaction: the S3 deletes at the end are network
  // calls and must not hold the transaction open while they run.
  const documentRows = await db.all('SELECT document_file FROM applications WHERE user_id = ?', [target.id])
  const documentKeys = documentRows
    .map(r => (r.document_file ? JSON.parse(r.document_file)?.key : null))
    .filter(Boolean)

  const counts = await withTransaction(async (tx) => {
    // Threads authored by the user take their poll and upvotes with them.
    const threadRows = await tx.all('SELECT id FROM forum_threads WHERE author_user_id = ?', [target.id])
    const threadIds = threadRows.map(r => r.id)
    for (const threadId of threadIds) {
      const poll = await tx.get('SELECT id FROM thread_polls WHERE thread_id = ?', [threadId])
      if (poll) {
        await tx.run('DELETE FROM thread_poll_votes WHERE poll_id = ?', [poll.id])
        await tx.run('DELETE FROM thread_poll_options WHERE poll_id = ?', [poll.id])
        await tx.run('DELETE FROM thread_polls WHERE id = ?', [poll.id])
      }
      await tx.run('DELETE FROM forum_upvotes WHERE thread_id = ?', [threadId])
    }
    await tx.run('DELETE FROM forum_threads WHERE author_user_id = ?', [target.id])

    // Petitions created by the user take their signatures with them.
    const petitionRows = await tx.all('SELECT id FROM petitions WHERE created_by_user_id = ?', [target.id])
    const petitionIds = petitionRows.map(r => r.id)
    for (const petitionId of petitionIds) {
      await tx.run('DELETE FROM petition_signatures WHERE petition_id = ?', [petitionId])
    }
    await tx.run('DELETE FROM petitions WHERE created_by_user_id = ?', [target.id])

    // The user's own participation in content owned by others.
    await tx.run('DELETE FROM forum_upvotes WHERE user_id = ?', [target.id])
    await tx.run('DELETE FROM thread_poll_votes WHERE user_id = ?', [target.id])
    await tx.run('DELETE FROM poll_votes WHERE user_id = ?', [target.id])
    await tx.run('DELETE FROM petition_signatures WHERE user_id = ?', [target.id])
    const { changes: messages } = await tx.run('DELETE FROM chat_messages WHERE sender_user_id = ?', [target.id])
    const { changes: defects } = await tx.run('DELETE FROM defects WHERE reported_by_user_id = ?', [target.id])
    await tx.run('DELETE FROM fee_payments WHERE user_id = ?', [target.id])
    await tx.run('DELETE FROM community_memberships WHERE user_id = ?', [target.id])
    const { changes: applications } = await tx.run('DELETE FROM applications WHERE user_id = ?', [target.id])

    await tx.run('UPDATE applications SET decided_by = NULL WHERE decided_by = ?', [target.id])
    const { changes: auditRows } = await tx.run('UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = ?', [target.id])

    await tx.run('DELETE FROM users WHERE id = ?', [target.id])

    return { threads: threadIds.length, petitions: petitionIds.length, messages, defects, applications, auditRowsAnonymised: auditRows }
  })

  // Recorded after the delete so the anonymisation pass above can't blank the
  // acting admin's own id on this entry. targetId keeps the erased user's id:
  // it is no longer resolvable to a person, which is the point.
  await recordAudit(db, {
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
}))
