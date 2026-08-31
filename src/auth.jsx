import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from './api'
import { clearToken, setSessionExpiredHandler, setToken } from './apiClient'

const STORAGE_KEY = 'pg_user'
const AuthContext = createContext(null)

// Accounts created by the backend's demo seed (`SEED_DEMO_DATA=true`, see
// backend/src/db/seed.js). They exist in a local dev database and nowhere else —
// a production database starts empty and gets its first admin from
// `npm run create-admin`. LoginPage only offers them when
// VITE_SHOW_DEMO_LOGINS is on, which is dev-only by default.
export const DEMO_ACCOUNTS = [
  { role: 'resident', label: 'Resident', name: 'Alex Lim', email: 'resident@propgather.com', password: 'resident123' },
  { role: 'admin', label: 'Admin', name: 'Platform Admin', email: 'admin@propgather.com', password: 'admin123' }
]

export const SHOW_DEMO_LOGINS = import.meta.env.VITE_SHOW_DEMO_LOGINS
  ? import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true'
  : import.meta.env.DEV

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// The profile is cached next to the token purely so a refresh paints a signed-in
// header immediately. The token is the actual credential; this copy is a hint
// that gets replaced by whatever /auth/me says.
function persist(profile, remember) {
  const store = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage
  store.setItem(STORAGE_KEY, JSON.stringify(profile))
  other.removeItem(STORAGE_KEY)
}

function forget() {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}

export function AuthProvider({ children }) {
  // Initialised synchronously from storage so a refresh keeps you signed in
  // without a logged-out flicker on the first paint.
  const [user, setUser] = useState(readStored)
  // Which storage the current session lives in, so refresh()/logout() keep
  // honouring the "keep me signed in" choice made at login.
  const [remember, setRemember] = useState(() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY)
    } catch {
      return true
    }
  })

  // A token the server no longer accepts (expired, or the account was erased)
  // has to clear the cached profile too, or the UI stays "signed in" and 401s on
  // every request. RequireAuth then bounces to /login on the next render.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      forget()
      setUser(null)
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  const login = useCallback(async ({ email, password, remember: keep = true }) => {
    const { token, user: profile } = await api.login((email || '').trim().toLowerCase(), password)
    setToken(token, { remember: keep })
    persist(profile, keep)
    setRemember(keep)
    setUser(profile)
    return profile
  }, [])

  // Creates the account and signs in with the token the server returns, so the
  // registration flow can immediately upload a document (which needs auth).
  const signup = useCallback(async ({ name, email, password, remember: keep = true }) => {
    const { token, user: profile } = await api.registerAccount({
      name: (name || '').trim(),
      email: (email || '').trim().toLowerCase(),
      password
    })
    setToken(token, { remember: keep })
    persist(profile, keep)
    setRemember(keep)
    setUser(profile)
    return profile
  }, [])

  // Re-reads the profile from the server — call it after anything that changes
  // the user's memberships (an approved application) so gated tabs unlock
  // without a full reload.
  const refresh = useCallback(async () => {
    const profile = await api.getMe()
    persist(profile, remember)
    setUser(profile)
    return profile
  }, [remember])

  const logout = useCallback(() => {
    clearToken()
    forget()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, login, signup, logout, refresh }),
    [user, login, signup, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// Route guard: bounce to /login (remembering where the user was headed), and
// optionally require a specific role — non-matching users are sent home.
export function RequireAuth({ children, role }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />
  }
  return children
}

// A platform admin reaches every community through the Admin dashboard without
// ever joining one, so a staff-only admin account has no resident side at all —
// My Communities is permanently empty for it. Admins promoted from a resident
// account (backend/src/db/createAdmin.js, the intended way to make one) keep the
// memberships they had, so this asks about memberships rather than the role.
export function hasResidentSpace(user) {
  return !!user && (user.role !== 'admin' || (user.communities?.length ?? 0) > 0)
}

// Where signing in lands you when no `next` was requested.
export function homePathFor(user) {
  if (!user) return '/'
  return hasResidentSpace(user) ? '/my-communities' : '/admin'
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}
