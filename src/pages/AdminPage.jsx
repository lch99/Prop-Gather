import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { C } from '../theme'
import { useAuth } from '../auth'
import AdminVerificationPage from './AdminVerificationPage'
import AdminReferencesPage from './AdminReferencesPage'
import AdminActivityLogPage from './AdminActivityLogPage'

export default function AdminPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [queue, setQueue] = useState(null)
  const [projects, setProjects] = useState({})

  const reload = useCallback(() => { api.getVerificationQueue(user?.role).then(setQueue) }, [user?.role])

  useEffect(() => {
    reload()
    api.getProjects().then(list => setProjects(Object.fromEntries(list.map(p => [p.id, p]))))
  }, [reload])

  const pendingCount = queue?.filter(a => a.status === 'Pending').length || 0

  const tabs = [
    { key: 'verification', label: 'Verification Queue', icon: '🛡️', path: '/admin/verification', count: pendingCount },
    { key: 'references', label: 'Community References', icon: '📂', path: '/admin/references' },
    { key: 'activity', label: 'Activity Log', icon: '📋', path: '/admin/activity' }
  ]
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
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '11px 20px', border: 'none', cursor: 'pointer',
                    fontSize: 14.5, fontWeight: 700,
                    background: on ? C.bg : 'transparent',
                    color: on ? C.blue : '#fff',
                    borderRadius: '12px 12px 0 0',
                    marginBottom: on ? -1 : 0
                  }}
                >
                  {t.icon} {t.label}
                  {!!t.count && (
                    <span style={{
                      background: on ? C.accent : 'rgba(255,255,255,0.32)', color: '#fff',
                      borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '1px 7px', lineHeight: 1.6
                    }}>
                      {t.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {active === 'verification' && <AdminVerificationPage queue={queue} projects={projects} reload={reload} actor={user} />}
      {active === 'references' && <AdminReferencesPage />}
      {active === 'activity' && <AdminActivityLogPage />}
    </div>
  )
}
