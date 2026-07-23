import { Link, useLocation, useNavigate } from 'react-router-dom'
import { C } from '../theme'
import { useAuth, initials } from '../auth'

const navItems = [
  { to: '/discover', label: 'Discover', short: 'Discover' },
  { to: '/my-communities', label: 'My Communities', short: 'My Comms', auth: true },
  { to: '/register', label: 'Join / Verify', short: 'Join', },
  { to: '/admin', label: 'Admin', short: 'Admin', auth: true, role: 'admin' }
]

const headerBtn = {
  padding: '8px 16px',
  borderRadius: 9,
  fontSize: 14.5,
  fontWeight: 700,
  color: '#fff',
  background: 'rgba(255,255,255,0.16)',
  border: '1px solid rgba(255,255,255,0.40)',
  cursor: 'pointer',
  textDecoration: 'none'
}

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: C.headerGradient,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 6px 26px rgba(46, 93, 143, 0.28)',
        borderBottom: '1px solid rgba(255,255,255,0.12)'
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: 'clamp(10px,2.5vw,14px) clamp(14px,3vw,24px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
        }}>
          <Link to="/" className="pg-header-logo" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, background: '#fff',
              border: '1px solid rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
              boxShadow: '0 2px 10px rgba(0,0,0,0.10)'
            }}>
              <img src={`${import.meta.env.BASE_URL}brand/propgather-icon.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.1, color: '#fff', letterSpacing: '-0.01em' }}>
                PropGather<span style={{ color: C.brandLight }}>.com</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.brandLight, lineHeight: 1.2 }}>Malaysia's Verified Property Community</div>
            </div>
          </Link>
          <nav className="pg-header-nav" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: 4 }}>
            {navItems.filter(item => (!item.auth || user) && (!item.role || user?.role === item.role)).map(item => {
              const active = location.pathname === item.to ||
                (item.to !== '/' && location.pathname.startsWith(item.to + '/'))
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    padding: '9px 15px',
                    borderRadius: 9,
                    fontSize: 14.5,
                    fontWeight: 700,
                    transition: 'background .15s ease, color .15s ease',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? C.blue : C.brandLight,
                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
                  }}
                >
                  <span className="pg-nav-full">{item.label}</span>
                <span className="pg-nav-short">{item.short}</span>
                </Link>
              )
            })}
          </nav>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#fff', fontWeight: 500 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12
                }}>{initials(user.name)}</div>
                <span className="pg-header-username">{user.name}</span>
              </div>
              <button onClick={handleLogout} style={headerBtn}>Log out</button>
            </div>
          ) : (
            <Link to="/login" style={headerBtn}>Log in</Link>
          )}
        </div>
      </header>
      <main style={{ flex: 1, background: C.bg }}>
        {children}
      </main>
      <footer style={{ textAlign: 'center', padding: '20px 0', color: C.textFaint, fontSize: 12 }}>
        PropGather.com demo prototype — mock data only, not for production use.
        {' · '}
        <Link to="/contact" style={{ color: C.textFaint, textDecoration: 'underline' }}>Contact Us</Link>
        {' · '}
        <Link to="/privacy" style={{ color: C.textFaint, textDecoration: 'underline' }}>Privacy Policy</Link>
      </footer>

      {location.pathname !== '/contact' && (
        <Link
          to="/contact"
          className="pg-fab"
          aria-label="Contact us — we're here to help"
          style={{
            position: 'fixed',
            right: 22,
            bottom: 22,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #C74B54, #D46B72)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            boxShadow: '0 8px 24px rgba(199, 75, 84, 0.42)',
            border: '2px solid rgba(255,255,255,0.55)'
          }}
        >
          <span style={{ fontSize: 19, lineHeight: 1 }} aria-hidden="true">💬</span>
          <span className="pg-fab-label">Contact&nbsp;Us</span>
        </Link>
      )}
    </div>
  )
}
