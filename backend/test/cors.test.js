import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

// These tests hit /api/health only, so they need no database state and skip
// freshApp() entirely. corsMiddleware() reads CORS_ORIGINS when createApp() runs,
// so each test sets the env var and then builds its own app.
const appWith = (origins) => {
  if (origins === undefined) delete process.env.CORS_ORIGINS
  else process.env.CORS_ORIGINS = origins
  return createApp()
}

const originalValue = process.env.CORS_ORIGINS

afterEach(() => {
  if (originalValue === undefined) delete process.env.CORS_ORIGINS
  else process.env.CORS_ORIGINS = originalValue
})

// What "allowed" means: the response carries Access-Control-Allow-Origin. A
// disallowed cross-origin request is not an error status — the server answers
// normally and the *browser* blocks it for lack of the header. Asserting on the
// header is therefore the only meaningful check.
const allowHeader = (res) => res.headers['access-control-allow-origin']

describe('CORS allowlist', () => {
  it('allows the local dev origin when CORS_ORIGINS is unset', async () => {
    const res = await request(appWith(undefined)).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(res.status).toBe(200)
    expect(allowHeader(res)).toBe('http://localhost:5173')
  })

  it('does not allow an unlisted origin when CORS_ORIGINS is unset', async () => {
    const res = await request(appWith(undefined)).get('/api/health').set('Origin', 'https://evil.example.com')
    expect(allowHeader(res)).toBeUndefined()
  })

  it('allows every origin in an explicit list', async () => {
    const app = appWith('https://lch99.github.io,https://propgather.com')
    for (const origin of ['https://lch99.github.io', 'https://propgather.com']) {
      const res = await request(app).get('/api/health').set('Origin', origin)
      expect(allowHeader(res)).toBe(origin)
    }
  })

  it('stops allowing the dev origin once an explicit list is set', async () => {
    const res = await request(appWith('https://propgather.com')).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(allowHeader(res)).toBeUndefined()
  })

  it('tolerates a trailing slash and surrounding spaces in the config', async () => {
    const res = await request(appWith(' https://propgather.com/ ')).get('/api/health').set('Origin', 'https://propgather.com')
    expect(allowHeader(res)).toBe('https://propgather.com')
  })

  it('allows anything when set to *', async () => {
    const res = await request(appWith('*')).get('/api/health').set('Origin', 'https://anywhere.example.com')
    expect(allowHeader(res)).toBe('https://anywhere.example.com')
  })

  // Requests without an Origin header are not cross-origin: curl, uptime checks,
  // server-to-server calls, and every other test in this suite. Blocking them
  // would break the whole suite, so this is the guard on that.
  it('serves requests that carry no Origin header', async () => {
    const res = await request(appWith('https://propgather.com')).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('answers a preflight from an allowed origin with the allowed methods', async () => {
    const res = await request(appWith('https://propgather.com'))
      .options('/api/projects')
      .set('Origin', 'https://propgather.com')
      .set('Access-Control-Request-Method', 'POST')
    expect(allowHeader(res)).toBe('https://propgather.com')
    expect(res.headers['access-control-allow-methods']).toBeDefined()
  })

  it('does not mark a preflight from a disallowed origin as allowed', async () => {
    const res = await request(appWith('https://propgather.com'))
      .options('/api/projects')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST')
    expect(allowHeader(res)).toBeUndefined()
  })

  // Credentialed CORS plus a reflected origin is the classic bypass; nothing here
  // uses cookies, so the header must never appear.
  it('never enables credentialed CORS', async () => {
    const res = await request(appWith('*')).get('/api/health').set('Origin', 'https://anywhere.example.com')
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
  })
})
