import { useLocation, useNavigate } from 'react-router-dom'
import { C } from '../theme'
import AdminVerificationPage from './AdminVerificationPage'
import AdminReferencesPage from './AdminReferencesPage'

const tabs = [
  { key: 'verification', label: 'Verification Queue', icon: '🛡️', path: '/admin/verification' },
  { key: 'references', label: 'Community References', icon: '📂', path: '/admin/references' }
]

export default function AdminPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = tabs.find(t => location.pathname.startsWith(t.path))?.key || 'verification'

  const select = (tab) => navigate(tab.path, { replace: true })

  return (
    <div>
      <div style={{ background: C.headerGradient, color: '#fff' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '26px 24px 0' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>⚙️ Admin Console</h1>
          <p style={{ margin: '0 0 18px', color: C.brandLight, fontSize: 14.5 }}>
            Verify residents and publish references for every community in one place.
          </p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tabs.map(t => {
              const on = active === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => select(t)}
                  style={{
                    padding: '11px 20px', border: 'none', cursor: 'pointer',
                    fontSize: 14.5, fontWeight: 700,
                    background: on ? C.bg : 'transparent',
                    color: on ? C.blue : '#fff',
                    borderRadius: '12px 12px 0 0',
                    marginBottom: on ? -1 : 0
                  }}
                >
                  {t.icon} {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {active === 'verification' && <AdminVerificationPage />}
      {active === 'references' && <AdminReferencesPage />}
    </div>
  )
}
