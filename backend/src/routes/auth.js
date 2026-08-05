import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { hashPassword, verifyPassword, signToken } from '../util/auth.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { conflict, unauthorized } from '../util/errors.js'
import { toMembership } from '../util/serialize.js'
import { recordAudit } from '../util/audit.js'

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
    if (existing) return next(conflict('An account with this email already exists'))

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
