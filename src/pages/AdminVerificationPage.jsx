import { useMemo, useState } from 'react'
import { api } from '../api'
import { C, card, button, badge } from '../theme'
import { AttachmentList } from '../components/Attachments'

const STATUS_ORDER = { Pending: 0, Approved: 1, Rejected: 2 }
const FILTERS = ['All', 'Pending', 'Approved', 'Rejected']

function statusBadge(status) {
  if (status === 'Pending') return <span style={badge(C.warning, C.warningBg)}>⏳ Pending</span>
  if (status === 'Approved') return <span style={badge(C.success, C.successBg)}>✓ Approved</span>
  return <span style={badge(C.danger, C.dangerBg)}>✕ Rejected</span>
}

export default function AdminVerificationPage({ queue, projects, reload, actor }) {
  const [filter, setFilter] = useState('Pending')
  const [search, setSearch] = useState('')
  const [decidingId, setDecidingId] = useState(null)

  const decide = async (id, decision) => {
    setDecidingId(id)
    try {
      await api.decideVerification(id, decision, actor)
      reload()
    } finally {
      setDecidingId(null)
    }
  }

  const counts = useMemo(() => {
    const c = { All: queue?.length || 0, Pending: 0, Approved: 0, Rejected: 0 }
    queue?.forEach(a => { c[a.status] = (c[a.status] || 0) + 1 })
    return c
  }, [queue])

  const visible = useMemo(() => {
    if (!queue) return []
    const q = search.trim().toLowerCase()
    return queue
      .filter(a => filter === 'All' || a.status === filter)
      .filter(a => {
        if (!q) return true
        const projName = projects[a.projectId]?.name || ''
        return [a.name, a.email, a.unit, projName].some(v => (v || '').toLowerCase().includes(q))
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || new Date(b.submittedAt) - new Date(a.submittedAt))
  }, [queue, filter, search, projects])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ color: C.navy, marginBottom: 6 }}>Admin & Trust Layer — Verification Queue</h1>
      <p style={{ color: C.textMuted, marginTop: 0 }}>
        Platform admins review uploaded ownership/tenancy documents and approve or reject applications
        (target: within 24 hours).
      </p>

      {queue === null ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="pg-skel" style={{ height: 96, borderRadius: C.radius }} />)}
        </div>
      ) : queue.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: C.textMuted }}>
          No applications yet. Go to <strong>Join / Verify</strong> to submit a sample application.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    ...badge(filter === f ? '#fff' : C.text, filter === f ? C.blue : C.neutralBg),
                    border: 'none', cursor: 'pointer', padding: '7px 14px', fontSize: 13
                  }}
                >
                  {f}{counts[f] ? ` (${counts[f]})` : ''}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, unit or project…"
              style={{
                flex: '1 1 220px', padding: '9px 14px', border: `1px solid ${C.border}`,
                borderRadius: C.radiusSm, fontSize: 14, background: '#fff'
              }}
            />
          </div>

          {visible.length === 0 ? (
            <div style={{ ...card, padding: 28, textAlign: 'center', color: C.textMuted }}>
              {filter === 'Pending' && !search ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                  <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>All caught up!</div>
                  <div>No applications are waiting for review right now.</div>
                </>
              ) : (
                <>
                  No applications match your filters.
                  <div style={{ marginTop: 10 }}>
                    <button style={button('outline')} onClick={() => { setFilter('All'); setSearch('') }}>Clear filters</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {visible.map(app => (
                <div key={app.id} className="pg-fade-in" style={{ ...card, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <div style={{ fontWeight: 700, color: C.navy }}>{app.name} <span style={{ fontWeight: 400, color: C.textMuted }}>· {app.tier}</span></div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>
                      {projects[app.projectId]?.name || app.projectId} · Unit {app.unit} · {app.email}
                    </div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>Document submitted: {app.document}</div>
                    {app.documentFile ? (
                      <AttachmentList attachments={[app.documentFile]} thumb={64} style={{ marginTop: 8 }} />
                    ) : (
                      <div style={{ fontSize: 12.5, color: C.danger, marginTop: 6 }}>⚠️ No file was attached to this application.</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {statusBadge(app.status)}
                      {app.status === 'Pending' && (
                        <>
                          <button
                            style={{ ...button('success'), opacity: decidingId === app.id ? 0.6 : 1, cursor: decidingId === app.id ? 'wait' : 'pointer' }}
                            disabled={decidingId === app.id}
                            onClick={() => decide(app.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            style={{ ...button('danger'), opacity: decidingId === app.id ? 0.6 : 1, cursor: decidingId === app.id ? 'wait' : 'pointer' }}
                            disabled={decidingId === app.id}
                            onClick={() => decide(app.id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                    {app.status !== 'Pending' && app.decidedByName && (
                      <div style={{ fontSize: 11.5, color: C.textFaint, textAlign: 'right' }}>
                        {app.status === 'Approved' ? 'Approved' : 'Rejected'} by {app.decidedByName}
                        {app.decidedAt && ` · ${new Date(app.decidedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
