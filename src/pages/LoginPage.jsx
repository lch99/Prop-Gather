import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { C, card, button } from '../theme'
import { useAuth, DEMO_ACCOUNTS, SHOW_DEMO_LOGINS } from '../auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [focused, setFocused] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const next = searchParams.get('next') || '/my-communities'

  // Already signed in? Don't show the form — go where they were headed.
  if (user) return <Navigate to={next} replace />

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please enter both your email and password.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("That email doesn't look quite right — please check it.")
      return
    }
    setError('')
    setBusy(true)
    try {
      await login({ email: form.email, password: form.password, remember })
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong signing you in. Please try again.')
      setBusy(false)
    }
  }

  const fillDemo = (account) => {
    setForm({ email: account.email, password: account.password })
    setShowPassword(true)
    setError('')
  }

  const inputWith = (field) => ({
    ...inputStyle,
    outline: 'none',
    border: `1px solid ${focused === field ? C.blue : C.border}`,
    boxShadow: focused === field ? `0 0 0 3px ${C.blueLight}` : 'none',
    transition: 'border-color .12s ease, box-shadow .12s ease'
  })

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 24px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">🏡</div>
        <h1 style={{ color: C.navy, margin: '0 0 6px', fontSize: 30, letterSpacing: '-0.01em' }}>
          Welcome back 👋
        </h1>
        <p style={{ color: C.textMuted, margin: 0, fontSize: 16, lineHeight: 1.6 }}>
          Sign in to catch up with your verified property community.
        </p>
      </div>

      <form onSubmit={submit} style={{ ...card, padding: 28, display: 'grid', gap: 18 }}>
        <Field label="Email address">
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused('')}
            style={inputWith('email')}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />
        </Field>

        <Field
          label={
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span>Password</span>
              <Link to="/contact" style={{ color: C.blue, fontSize: 13.5, fontWeight: 700 }}>
                Forgot password?
              </Link>
            </span>
          }
        >
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused('')}
              style={{ ...inputWith('password'), paddingRight: 72 }}
              placeholder="Your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: C.blue,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '6px 8px'
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: C.text, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: C.blue }}
          />
          Keep me signed in on this device
        </label>

        {error && (
          <div role="alert" style={{
            background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: C.radiusSm,
            padding: '10px 14px', color: C.danger, fontSize: 14, fontWeight: 600, lineHeight: 1.5
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ ...button('primary'), fontSize: 16, padding: '13px 18px', opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Signing you in…' : 'Log in'}
        </button>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5, color: C.textMuted }}>
          New to PropGather?{' '}
          <Link to="/register" style={{ color: C.blue, fontWeight: 700 }}>
            Join &amp; verify your community
          </Link>
        </p>
      </form>

      {/* Seeded dev accounts only — never rendered in a production build, where
          these credentials don't exist and printing any would be a giveaway.
          See SHOW_DEMO_LOGINS in auth.jsx. */}
      {SHOW_DEMO_LOGINS && (
        <div style={{ ...card, padding: 18, marginTop: 16 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
            🔑 Demo logins
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: C.textMuted, lineHeight: 1.55 }}>
            Click an account to fill the form, then press <strong>Log in</strong>. These exist only in a
            database seeded with <code>SEED_DEMO_DATA=true</code>.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {DEMO_ACCOUNTS.map(account => (
              <button key={account.email} type="button" onClick={() => fillDemo(account)} style={demoRow}>
                <span style={{
                  ...badgeChip,
                  color: account.role === 'admin' ? C.accent : C.blue,
                  background: account.role === 'admin' ? C.accentLight : C.blueLight
                }}>
                  {account.label}
                </span>
                <span style={{ display: 'grid', gap: 2, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
                  <span style={{ color: C.text, fontSize: 14 }}>{account.email}</span>
                  <span style={{ color: C.textMuted, fontSize: 14 }}>{account.password}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 7, fontSize: 14.5, fontWeight: 700, color: C.text, minWidth: 0 }}>
      {label}
      {children}
    </label>
  )
}

const inputStyle = {
  width: '100%',
  minWidth: 0,
  padding: '13px 14px',
  border: `1px solid ${C.border}`,
  borderRadius: C.radiusSm,
  fontSize: 16,
  fontWeight: 400
}

const demoRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  textAlign: 'left',
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: C.radiusSm,
  padding: '10px 12px',
  cursor: 'pointer'
}

const badgeChip = {
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 999,
  padding: '4px 12px'
}
