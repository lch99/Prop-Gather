import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { C, card, badge, button, chipColor } from '../theme'
import { useAuth } from '../auth'
import { PROGRESS_TYPE } from '../referenceTypes'

const activityColor = (level) => {
  if (level === 'High') return { color: C.success, bg: C.successBg }
  if (level === 'Medium') return { color: C.warning, bg: C.warningBg }
  return { color: C.neutral, bg: C.neutralBg }
}

// Same convention as ReferencesTab.jsx: first image attachment is the cover.
const coverImage = (item) => (item?.attachments || []).find(a => a.type?.startsWith('image/'))

function StatTile({ icon, value, label, onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        ...card, padding: '14px 18px', flex: '1 1 160px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <span style={{ fontSize: 24 }} aria-hidden="true">{icon}</span>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12.5, color: C.textMuted }}>{label}</div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 5, background: C.border }} />
      <div style={{ padding: 18 }}>
        <div className="pg-skel" style={{ height: 16, width: '65%', marginBottom: 10 }} />
        <div className="pg-skel" style={{ height: 12, width: '90%', marginBottom: 16 }} />
        <div className="pg-skel" style={{ height: 84, borderRadius: C.radiusSm }} />
      </div>
    </div>
  )
}

export default function AdminOverviewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState(null)
  const [queue, setQueue] = useState([])
  const [refsByProject, setRefsByProject] = useState({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    let alive = true
    api.getProjects().then(async (list) => {
      if (!alive) return
      setProjects(list)
      // One references fetch per community — same api.getReferences() the References
      // admin page uses, just gathered across every project instead of one at a time.
      const entries = await Promise.all(list.map(p => api.getReferences(p.id).then(refs => [p.id, refs])))
      if (alive) setRefsByProject(Object.fromEntries(entries))
    })
    api.getVerificationQueue(user?.role).then(q => { if (alive) setQueue(q) })
    return () => { alive = false }
  }, [user?.role])

  const pendingByProject = useMemo(() => {
    const m = {}
    queue.forEach(a => { if (a.status === 'Pending') m[a.projectId] = (m[a.projectId] || 0) + 1 })
    return m
  }, [queue])

  const totals = useMemo(() => {
    const communities = projects?.length || 0
    const residents = projects?.reduce((s, p) => s + (p.ownerCount || 0), 0) || 0
    const pending = queue.filter(a => a.status === 'Pending').length
    const progressUpdates = Object.values(refsByProject)
      .reduce((s, refs) => s + refs.filter(r => r.type === PROGRESS_TYPE).length, 0)
    return { communities, residents, pending, progressUpdates }
  }, [projects, queue, refsByProject])

  const rows = useMemo(() => {
    if (!projects) return []
    const q = search.trim().toLowerCase()
    return projects
      .filter(p => !q || [p.name, p.city, p.state].some(v => v.toLowerCase().includes(q)))
      .map(p => {
        const refs = refsByProject[p.id] || []
        const progress = refs.filter(r => r.type === PROGRESS_TYPE)
        return { project: p, refCount: refs.length, latestProgress: progress[0] || null, pending: pendingByProject[p.id] || 0 }
      })
      // communities waiting on a decision surface first; alphabetical after that
      .sort((a, b) => b.pending - a.pending || a.project.name.localeCompare(b.project.name))
  }, [projects, refsByProject, pendingByProject, search])

  const goReferences = (projectId, type) => {
    const qs = type ? `?projectId=${projectId}&type=${encodeURIComponent(type)}` : `?projectId=${projectId}`
    navigate(`/admin/references${qs}`)
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ color: C.navy, marginBottom: 6, fontSize: 27 }}>Communities Overview</h1>
      <p style={{ color: C.textMuted, marginTop: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 720 }}>
        Every community in one place — see who's waiting on verification, what's been published to
        References, and jump straight into uploading a building-progress update with photos.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '18px 0 22px' }}>
        <StatTile icon="🏙️" value={totals.communities} label="Communities" />
        <StatTile icon="👥" value={totals.residents.toLocaleString()} label="Verified residents" />
        <StatTile icon="⏳" value={totals.pending} label="Pending applications" onClick={() => navigate('/admin/verification')} />
        <StatTile icon="🏗️" value={totals.progressUpdates} label="Progress updates published" />
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search communities by name, city or state…"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 14px', border: `1px solid ${C.border}`,
          borderRadius: C.radiusSm, fontSize: 14, background: '#fff', color: C.text, marginBottom: 18
        }}
      />

      {projects === null ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, padding: 28, textAlign: 'center', color: C.textMuted }}>
          No communities match your search.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {rows.map(({ project: p, refCount, latestProgress, pending }, i) => {
            const ac = activityColor(p.activityLevel)
            const [ctext, cbg] = chipColor(p.type)
            const cover = coverImage(latestProgress)
            return (
              <div
                key={p.id}
                className="pg-fade-in"
                style={{
                  ...card, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  animationDelay: `${Math.min(i * 0.04, 0.3)}s`
                }}
              >
                <div style={{ height: 5, background: C.headerGradient, flexShrink: 0 }} />
                <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11, background: cbg, color: ctext,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 17, flexShrink: 0
                    }}>{p.name.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <h3 style={{ margin: 0, color: C.navy, fontSize: 16, lineHeight: 1.25 }}>{p.name}</h3>
                        <span style={badge(ctext, cbg)}>{p.type}</span>
                      </div>
                      <div style={{ color: C.textMuted, fontSize: 12.5, marginTop: 3 }}>{p.city}, {p.state}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <span style={badge(C.navy, C.neutralBg)}>👥 {p.ownerCount}</span>
                    <span style={badge(ac.color, ac.bg)}>{p.activityLevel} activity</span>
                    <span style={badge(C.textMuted, C.neutralBg)}>📂 {refCount} reference{refCount !== 1 ? 's' : ''}</span>
                    {pending > 0 && (
                      <span
                        role="button"
                        style={{ ...badge(C.warning, C.warningBg), cursor: 'pointer' }}
                        onClick={() => navigate('/admin/verification')}
                      >
                        ⏳ {pending} pending
                      </span>
                    )}
                  </div>

                  <div style={{
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
                    padding: 12, display: 'flex', gap: 12, alignItems: 'center'
                  }}>
                    {latestProgress ? (
                      <>
                        <div style={{
                          width: 56, height: 56, borderRadius: C.radiusSm, flexShrink: 0, overflow: 'hidden',
                          background: C.warningBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
                        }}>
                          {cover ? (
                            <img src={cover.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : '🏗️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: C.textFaint }}>Latest progress · {latestProgress.date}</div>
                          <div style={{ fontWeight: 700, color: C.navy, fontSize: 13.5, lineHeight: 1.3 }}>{latestProgress.title}</div>
                          {latestProgress.progress != null && (
                            <div style={{ background: C.neutralBg, borderRadius: 999, height: 8, overflow: 'hidden', marginTop: 5 }}>
                              <div style={{ width: `${latestProgress.progress}%`, height: '100%', background: 'linear-gradient(90deg,#B45309,#f59e0b)' }} />
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: C.textFaint, fontStyle: 'italic' }}>
                        No building-progress update published yet.
                      </div>
                    )}
                  </div>

                  <div style={{ flexGrow: 1 }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      style={{ ...button('accent'), flex: '1 1 auto', fontSize: 13, padding: '8px 12px' }}
                      onClick={() => goReferences(p.id, PROGRESS_TYPE)}
                    >
                      🏗️ Add progress update
                    </button>
                    <button
                      style={{ ...button('outline'), flex: '1 1 auto', fontSize: 13, padding: '8px 12px' }}
                      onClick={() => goReferences(p.id)}
                    >
                      Manage references
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
