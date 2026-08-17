import { getDb } from '../db/index.js'
import { verifyToken } from '../util/auth.js'
import { unauthorized, forbidden } from '../util/errors.js'

// Populates req.user when a valid bearer token is present; does not require one.
//
// The two failure modes are separated deliberately. A bad or expired token means
// "anonymous" and continues. A database error does not — it propagates to the
// error handler as a 500. Catching both together (as the synchronous version
// effectively did) would turn a database outage into a wave of confusing 401s
// on endpoints that require auth, hiding the real fault.
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return next()

  let payload
  try {
    payload = verifyToken(token)
  } catch {
    return next() // invalid/expired token — treated as anonymous
  }

  try {
    const user = await getDb().get('SELECT id, name, email, role FROM users WHERE id = ?', [payload.sub])
    if (user) req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized())
  next()
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (req.user.role !== role) return next(forbidden('This area is for platform admins only.'))
    next()
  }
}

// Requires the authenticated user to be a verified member of :projectId (or an admin).
// Attaches the membership row to req.membership when present.
export async function requireMembership(req, _res, next) {
  if (!req.user) return next(unauthorized())
  if (req.user.role === 'admin') return next()

  try {
    const membership = await getDb().get(
      'SELECT * FROM community_memberships WHERE user_id = ? AND project_id = ?',
      [req.user.id, req.params.projectId]
    )

    if (!membership) return next(forbidden('Only verified residents of this community can view this. Submit your proof of ownership to get access.'))
    req.membership = membership
    next()
  } catch (err) {
    next(err)
  }
}
