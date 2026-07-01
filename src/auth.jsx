import { createContext, useCallback, useContext, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from './api'

const STORAGE_KEY = 'pg_user'
const AuthContext = createContext(null)

// Demo accounts — the only credentials with a fixed role. Any other email is
// allowed too (treated as a resident) so the prototype stays easy to explore.
export const DEMO_ACCOUNTS = [
  { role: 'resident', label: 'Resident', name: 'Alex Lim', email: 'resident@propgather.com', password: 'resident123' },
  { role: 'admin', label: 'Admin', name: 'Platform Admin', email: 'admin@propgather.com', password: 'admin123' }
]

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // Initialise synchronously from storage so a refresh keeps you signed in
  // without a logged-out flicker on the first paint.
  const [user, setUser] = useState(readStored)

  const login = useCallback(async ({ email, password, remember = true }) => {
    // Demo auth. The two DEMO_ACCOUNTS have fixed roles and require the right
    // password; any other email is accepted as a resident so the prototype
    // stays easy to explore.
    const normalized = (email || '').trim().toLowerCase()
    const account = DEMO_ACCOUNTS.find(a => a.email === normalized)
    if (account && password !== account.password) {
      throw new Error('That password is incorrect for this demo account.')
    }

    let profile
    if (account) {
      profile = { id: account.role, name: account.name, email: account.email, role: account.role }
    } else {
      // Unknown email — treat as a resident. Pull the canonical demo resident
      // from the API so the rest of the app stays consistent, falling back to
      // a lightweight profile if the backend isn't running.
      try {
        const me = await api.getMe()
        profile = { id: me.id, name: me.name, email: normalized || me.email, role: 'resident' }
      } catch {
        profile = { id: 'guest', name: (normalized.split('@')[0] || 'Resident'), email: normalized, role: 'resident' }
      }
    }

    const store = remember ? localStorage : sessionStorage
    const other = remember ? sessionStorage : localStorage
    store.setItem(STORAGE_KEY, JSON.stringify(profile))
    other.removeItem(STORAGE_KEY)
    setUser(profile)
    return profile
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
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

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}
