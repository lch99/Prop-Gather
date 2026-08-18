// HTTP plumbing for the Express backend in `backend/`.
//
// Kept separate from api.js so auth.jsx can own the bearer token without
// importing the whole API surface: api.js imports this module, auth.jsx imports
// both, and routing the token through api.js instead would make that a cycle.

// Where the backend lives. `/api` (same origin) is the right default for a
// deployment that puts a reverse proxy in front of Express — see VPS_SETUP.md.
// The GitHub Pages demo isn't same-origin as its API, so that build needs a full
// origin in VITE_API_URL at build time (Vite inlines it, it is not read at runtime).
const DEFAULT_BASE = import.meta.env.DEV ? 'http://localhost:4000/api' : '/api'

export const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_BASE).replace(/\/+$/, '')

const TOKEN_KEY = 'pg_token'

// Mirrors the storage choice auth.jsx makes for the user profile: localStorage
// when "keep me signed in" is ticked, sessionStorage otherwise. Held in a module
// variable too so every request doesn't hit storage.
function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

let token = readStoredToken()

export function getToken() {
  return token
}

export function setToken(value, { remember = true } = {}) {
  token = value || null
  try {
    const store = remember ? localStorage : sessionStorage
    const other = remember ? sessionStorage : localStorage
    other.removeItem(TOKEN_KEY)
    if (value) store.setItem(TOKEN_KEY, value)
    else store.removeItem(TOKEN_KEY)
  } catch {
    // Private-browsing modes can refuse storage. The in-memory token above still
    // works for this tab, so a failed write costs persistence, not the session.
  }
}

export function clearToken() {
  token = null
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignored — see setToken
  }
}

// Carries the HTTP status and the backend's field-level `details` array (see
// backend/src/middleware/validate.js) alongside the message, so a caller can
// tell "your password is too short" from "the server is down" when it matters.
// `message` is always safe to show a resident: the backend writes 4xx messages
// for end users and replaces 5xx ones with a generic line.
export class ApiError extends Error {
  constructor(message, { status = 0, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

// Lets AuthProvider drop the signed-in user when a token stops being accepted,
// so an expired session becomes a clean trip to /login rather than a UI that
// looks signed in and 401s on everything.
let onSessionExpired = null

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn
}

function buildUrl(path, query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') params.append(key, value)
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

async function readBody(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    // A non-JSON body means something other than our Express app answered — a
    // proxy error page, usually. Keep it as the message rather than throwing a
    // parse error that says nothing about what happened.
    return { error: text.slice(0, 200) }
  }
}

export async function request(path, { method = 'GET', body, query } = {}) {
  const sentWithAuth = !!token

  let res
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    })
  } catch {
    // fetch only rejects on a transport-level failure — server down, DNS, or a
    // blocked CORS preflight. Anything the server actually answered lands below.
    throw new ApiError("We can't reach PropGather right now. Please check your connection and try again.", { status: 0 })
  }

  const payload = await readBody(res)

  if (!res.ok) {
    // A 401 on a request that carried a token means the token is no longer good
    // (expired, or the account was removed) — that's an expired session. A 401
    // without one is just a failed sign-in, which must not trigger a logout.
    if (res.status === 401 && sentWithAuth) {
      clearToken()
      onSessionExpired?.()
    }
    throw new ApiError(payload?.error || 'Something went wrong. Please try again.', {
      status: res.status,
      details: payload?.details
    })
  }

  return payload
}

// Uploads bytes straight to S3 with a presigned PUT URL — deliberately not
// through `request`: the URL is already signed (an Authorization header would
// make S3 reject it), it isn't under API_BASE, and it answers with an empty body.
//
// Content-Type must match what the URL was signed for (see createUploadUrl in
// backend/src/util/s3.js) or the signature check fails.
export async function uploadToStorage(uploadUrl, blob, contentType) {
  let res
  try {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob
    })
  } catch {
    throw new ApiError("We couldn't upload your file. Please check your connection and try again.", { status: 0 })
  }

  if (!res.ok) {
    // S3 replies in XML, which is no use to a resident. The common causes are a
    // bucket CORS rule that doesn't list this origin (see
    // backend/infra/s3-cors.json) and a URL that sat unused past its 5 minutes.
    throw new ApiError("We couldn't upload your file to secure storage. Please try again.", { status: res.status })
  }
}
