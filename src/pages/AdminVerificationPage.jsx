import { useEffect, useState } from 'react'
import { api } from '../api'
import { C, card, button, badge } from '../theme'

function statusBadge(status) {
  if (status === 'Pending') return <span style={badge(C.warning, C.warningBg)}>⏳ Pending</span>
  if (status === 'Approved') return <span style={badge(C.success, C.successBg)}>✓ Approved</span>
  return <span style={badge(C.danger, C.dangerBg)}>✕ Rejected</span>
}

export default function AdminVerificationPage() {
  const [queue, setQueue] = useState([])
  const [projects, setProjects] = useState({})

  const load = () => {
    api.getVerificationQueue().then(setQueue)
  }

  useEffect(() => {
    load()
    api.getProjects().then(list => {
      setProjects(Object.fromEntries(list.map(p => [p.id, p])))
    })
  }, [])

  const decide = async (id, decision) => {
    await api.decideVerification(id, decision)
    load()
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ color: C.navy, marginBottom: 6 }}>Admin & Trust Layer — Verification Queue</h1>
      <p style={{ color: C.textMuted, marginTop: 0 }}>
        Platform admins review uploaded ownership/tenancy documents and approve or reject applications
        (target: within 24 hours).
      </p>

      {queue.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: C.textMuted }}>
          No applications yet. Go to <strong>Join / Verify</strong> to submit a sample application.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {queue.map(app => (
            <div key={app.id} style={{ ...card, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: C.navy }}>{app.name} <span style={{ fontWeight: 400, color: C.textMuted }}>· {app.tier}</span></div>
                <div style={{ fontSize: 13, color: C.textMuted }}>
                  {projects[app.projectId]?.name || app.projectId} · Unit {app.unit} · {app.email}
                </div>
                <div style={{ fontSize: 13, color: C.textMuted }}>Document submitted: {app.document}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {statusBadge(app.status)}
                {app.status === 'Pending' && (
                  <>
                    <button style={button('success')} onClick={() => decide(app.id, 'approve')}>Approve</button>
                    <button style={button('danger')} onClick={() => decide(app.id, 'reject')}>Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
