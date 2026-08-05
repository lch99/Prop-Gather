import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { C, card, badge } from '../theme'

const ACTION_LABELS = {
  'application.submitted': 'Application submitted',
  'application.approved': 'Application approved',
  'application.rejected': 'Application rejected'
}

const ACTION_COLORS = {
  'application.submitted': [C.blue, C.blueLight],
  'application.approved': [C.success, C.successBg],
  'application.rejected': [C.danger, C.dangerBg]
}

export default function AdminActivityLogPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    api.getAuditLog(user?.role).then(setEntries)
  }, [user?.role])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ color: C.navy, marginBottom: 6 }}>Admin & Trust Layer — Activity Log</h1>
      <p style={{ color: C.textMuted, marginTop: 0 }}>
        Every submission, decision, and document access on verification applications — who did what, and when.
        This is what makes admin access to identity documents auditable, per our{' '}
        <a href="/privacy" style={{ color: C.blue }}>Privacy Policy</a>.
      </p>

      {entries === null ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="pg-skel" style={{ height: 56, borderRadius: C.radius }} />)}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: C.textMuted }}>
          No activity recorded yet. Submit or decide an application to see it appear here.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {entries.map((e, i) => {
            const [fg, bg] = ACTION_COLORS[e.action] || [C.text, C.neutralBg]
            return (
              <div
                key={e.id}
                className="pg-fade-in"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                  padding: '14px 18px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={badge(fg, bg)}>{ACTION_LABELS[e.action] || e.action}</span>
                  <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
                    by <strong>{e.actorName}</strong> ({e.actorRole}) · application {e.targetId}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.textFaint, whiteSpace: 'nowrap' }}>
                  {new Date(e.createdAt).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
