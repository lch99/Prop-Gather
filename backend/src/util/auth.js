import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production'
const JWT_EXPIRES_IN = '7d'
// bcryptjs is pure JS and cost-10 hashing is ~1s/call on this hardware — fine for
// real logins, far too slow across hundreds of test-suite registrations/logins.
// Lower the cost factor only when explicitly requested (tests set BCRYPT_ROUNDS=4).
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10

export function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash)
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}
