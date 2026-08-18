import cors from 'cors'

// Which origins may call this API from a browser.
//
// The frontend is a separate origin in every deployment shape this project uses
// (the Vite dev server on :5173, GitHub Pages, or a domain fronted by nginx), so
// CORS is load-bearing here rather than incidental. But `cors()` with no options
// allows *every* origin, which means any page on the internet can drive this API
// with a resident's token — and since `src/apiClient.js` keeps the JWT in
// localStorage, "any page" includes ones the resident didn't mean to trust.
//
// `CORS_ORIGINS` is a comma-separated allowlist. Unset, it falls back to the
// local dev origins only: development works out of the box, and a server nobody
// configured fails closed (a frontend that can't reach its API — obvious and
// safe) rather than open. `CORS_ORIGINS=*` restores allow-anything explicitly,
// for someone who has decided that's what they want.
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

const stripSlash = (s) => s.trim().replace(/\/+$/, '')

export function allowedOrigins() {
  const raw = (process.env.CORS_ORIGINS || '').trim()
  if (!raw) return DEV_ORIGINS
  return raw.split(',').map(stripSlash).filter(Boolean)
}

export function corsMiddleware() {
  // Read once at startup: this is deployment config, and re-reading env per
  // request would let a half-edited value take effect without a restart.
  const allowed = allowedOrigins()
  const allowAll = allowed.includes('*')

  return cors({
    origin(origin, callback) {
      // No Origin header at all: same-origin requests, curl, uptime checks, and
      // the test suite's supertest calls. Nothing cross-origin to police.
      if (!origin) return callback(null, true)
      if (allowAll || allowed.includes(stripSlash(origin))) return callback(null, true)
      // Refuse by omitting the header rather than raising: the browser then
      // blocks the response itself, which is the actual enforcement. Throwing
      // here would turn every stray probe into a 500 in the logs instead.
      return callback(null, false)
    },
    // Tokens travel in the Authorization header and nothing here uses cookies,
    // so credentialed CORS stays off — combining it with a reflected origin is
    // how these get bypassed.
    credentials: false
  })
}
