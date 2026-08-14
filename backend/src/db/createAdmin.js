// Creates — or promotes — a platform admin, without running the demo seed.
//
// A production database has no admin at all: seed() was the only thing that
// ever created one, POST /api/auth/register hardcodes role 'resident'
// (routes/auth.js), and there is no password-change endpoint. So on a clean
// deploy nobody can approve a single join application, and no resident can
// reach any project. This script is how a real deployment gets its first
// admin.
//
// Usage (password via env is preferred — a --password flag lands in your
// shell history and in `ps` output while it runs):
//
//   ADMIN_PASSWORD='...' npm run create-admin -- --email=you@example.com --name="Your Name"
//   npm run create-admin -- --email=you@example.com --name="Your Name" --password='...'
//
// If the email already exists, the account is promoted to admin and its
// password reset when one is supplied. That's the intended flow: register
// through the normal signup form like any resident, then promote yourself.
import { getDb } from './index.js'
import { hashPassword } from '../util/auth.js'
import { recordAudit } from '../util/audit.js'
import { id } from '../util/ids.js'

const MIN_PASSWORD_LENGTH = 12

// Passwords this repo publishes in its README and seed data. Someone reaching
// for one of these on a production box is copying from the demo, not choosing.
const PUBLISHED_PASSWORDS = new Set(['admin123', 'resident123', 'password123', 'changeme'])

function parseArgs(argv) {
  const out = {}
  for (const arg of argv) {
    const match = /^--([^=]+)=?(.*)$/.exec(arg)
    if (match) out[match[1]] = match[2]
  }
  return out
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`)
  process.exit(1)
}

export function createAdmin({ email, name, password }) {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email)

  if (existing) {
    if (existing.role === 'admin' && !password) {
      return { action: 'unchanged', userId: existing.id, name: existing.name }
    }
    db.prepare(`
      UPDATE users SET role = 'admin'${password ? ', password_hash = @passwordHash' : ''}
      WHERE id = @userId
    `).run({ userId: existing.id, ...(password ? { passwordHash: hashPassword(password) } : {}) })

    recordAudit(db, {
      actorRole: 'system',
      action: 'user.admin_granted',
      targetType: 'user',
      targetId: existing.id,
      metadata: { email, via: 'create-admin script', passwordReset: Boolean(password) }
    })
    return { action: password ? 'promoted and password reset' : 'promoted', userId: existing.id, name: existing.name }
  }

  if (!name) fail('--name is required when creating a new account')
  if (!password) fail('a password is required when creating a new account (set ADMIN_PASSWORD or pass --password)')

  const userId = id('usr')
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at)
    VALUES (@userId, @name, @email, @passwordHash, 'admin', @createdAt)
  `).run({ userId, name, email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() })

  recordAudit(db, {
    actorRole: 'system',
    action: 'user.admin_created',
    targetType: 'user',
    targetId: userId,
    metadata: { email, via: 'create-admin script' }
  })
  return { action: 'created', userId, name }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const email = (args.email || '').trim().toLowerCase()
  const name = (args.name || '').trim()
  const password = args.password || process.env.ADMIN_PASSWORD || ''

  if (!email) fail('--email is required')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`"${email}" is not a valid email address`)

  if (password) {
    // Checked before the length rule: every published password is already too
    // short, and "that one is in the README" tells you what you did wrong far
    // better than "needs 12 characters" does.
    if (PUBLISHED_PASSWORDS.has(password)) {
      fail('that password is published in this repo\'s README — choose a real one')
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      fail(`password must be at least ${MIN_PASSWORD_LENGTH} characters (got ${password.length})`)
    }
  }

  const result = createAdmin({ email, name, password })

  // Never echo the password back, not even masked — this output is what ends
  // up in deploy logs and terminal scrollback.
  console.log(`\n  ✓ admin ${result.action}`)
  console.log(`    ${result.name} <${email}>`)
  console.log(`    id: ${result.userId}\n`)
  if (result.action === 'unchanged') {
    console.log('    (already an admin; pass a password to reset it)\n')
  }
}

// Only run when invoked directly, so tests can import createAdmin().
if (process.argv[1] && process.argv[1].endsWith('createAdmin.js')) {
  main()
}
