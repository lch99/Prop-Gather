// Minimal in-memory rate limiter, keyed by a caller-supplied string (e.g. the
// attempted login email) rather than IP — avoids depending on correct
// `trust proxy` configuration behind whatever host/reverse-proxy this ends up
// deployed on. Single-process, in-memory: fine for this app's scale, but
// resets on restart and doesn't share state across multiple server instances
// — swap for a shared store (Redis, etc.) before running more than one process.
const buckets = new Map()

export function rateLimit({ windowMs, max, keyFn, message = 'Too many attempts. Please try again later.' }) {
  return (req, res, next) => {
    const key = keyFn(req)
    if (!key) return next()

    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (bucket.count >= max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      return res.status(429).json({ error: message })
    }

    bucket.count += 1
    next()
  }
}

// Test-only: clears all rate-limit state between test runs (the module-level
// Map otherwise persists across the whole vitest process).
export function _resetRateLimits() {
  buckets.clear()
}
