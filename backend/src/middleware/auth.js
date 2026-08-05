import { getDb } from '../db/index.js'
import { verifyToken } from '../util/auth.js'
import { unauthorized, forbidden } from '../util/errors.js'

// Populates req.user when a valid bearer token is present; does not require one.
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return next()

  try {
    const payload = verifyToken(token)
    const user = getDb().prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.sub)
    if (user) req.user = user
  } catch {
    // invalid/expired token — treated as anonymous
  }
  next()
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized())
  next()
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (req.user.role !== role) return next(forbidden(`Requires ${role} role`))
    next()
  }
}

// Requires the authenticated user to be a verified member of :projectId (or an admin).
// Attaches the membership row to req.membership when present.
export function requireMembership(req, _res, next) {
  if (!req.user) return next(unauthorized())
  if (req.user.role === 'admin') return next()

  const { projectId } = req.params
  const membership = getDb()
    .prepare('SELECT * FROM community_memberships WHERE user_id = ? AND project_id = ?')
    .get(req.user.id, projectId)

  if (!membership) return next(forbidden('You must be a verified resident of this community'))
  req.membership = membership
  next()
}
