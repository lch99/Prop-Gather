import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { C, card, badge, button, chipColor } from '../theme'
import { useAuth } from '../auth'
import { PROGRESS_TYPE } from '../referenceTypes'

const EMPTY_COMMUNITY = { name: '', type: 'Condo', address: '', city: '', state: '', units: '', blocks: '', floorsPerBlock: '' }

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

// Admins add communities themselves — nothing here waits on a resident request.
// Quick-pick types come from the communities already on the platform, with a
// free-text escape hatch so an unusual development (SoHo, townhouse, mixed
// strata) never blocks the form. Mirrors POST /api/projects.
function AddCommunityModal({ existingTypes, onClose, onCreated }) {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY_COMMUNITY)
  const [customType, setCustomType] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.name.trim() || !form.type.trim() || !form.address.trim() || !form.city.trim() || !form.state.trim()) {
      setError('Please fill in the community name, property type, address, city and state.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const project = await api.createProject({
        ...form,
        units: form.units,
        floorsPerBlock: form.floorsPerBlock,
        blocks: form.blocks.split(',').map(b => b.trim()).filter(Boolean)
      }, user?.role, user)
      onCreated(project)
    } catch (err) {
      setError(err.message || "We couldn't add that community just now. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const fieldStyle = {
    width: '100%', padding: '10px 13px', border: `1px solid ${C.border}`,
    borderRadius: C.radiusSm, fontSize: 14, color: C.text, background: '#fff', boxSizing: 'border-box'
  }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 5 }
  const req = <span style={{ color: C.danger }}>*</span>

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,10,30,0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a community"
        style={{ ...card, width: '100%', maxWidth: 520, padding: 26, position: 'relative', margin: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 16, border: 'none', background: 'none',
            fontSize: 20, cursor: 'pointer', color: C.textMuted, lineHeight: 1
          }}
        >×</button>

        <h3 style={{ margin: '0 0 4px', color: C.navy }}>＋ Add a community</h3>
        <p style={{ margin: '0 0 18px', color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>
          It goes live in the directory straight away. Residents can then apply to join, and you can publish
          references and progress updates for it.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle} htmlFor="ac-name">Community name {req}</label>
            <input id="ac-name" autoFocus style={fieldStyle} placeholder="e.g. Harmony Park Residences"
              value={form.name} onChange={set('name')} />
          </div>

          <div>
            <label style={labelStyle}>Property type {req}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: customType ? 10 : 0 }}>
              {existingTypes.map(t => {
                const [ctext, cbg] = chipColor(t)
                const on = !customType && form.type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setCustomType(false); setForm(f => ({ ...f, type: t })) }}
                    style={{
                      ...badge(on ? '#fff' : ctext, on ? ctext : cbg),
                      cursor: 'pointer', border: `1px solid ${on ? ctext : cbg}`, fontSize: 13, padding: '7px 13px'
                    }}
                  >{t}</button>
                )
              })}
              <button
                type="button"
                onClick={() => { setCustomType(true); setForm(f => ({ ...f, type: '' })) }}
                style={{
                  ...badge(customType ? '#fff' : C.textMuted, customType ? C.neutral : C.neutralBg),
                  cursor: 'pointer', border: `1px solid ${customType ? C.neutral : C.neutralBg}`, fontSize: 13, padding: '7px 13px'
                }}
              >Other…</button>
            </div>
            {customType && (
              <input style={fieldStyle} placeholder="e.g. Serviced Apartment" value={form.type} onChange={set('type')} />
            )}
          </div>

          <div>
            <label style={labelStyle} htmlFor="ac-address">Address {req}</label>
            <input id="ac-address" style={fieldStyle} placeholder="e.g. Jalan SS15/4, Subang Jaya"
              value={form.address} onChange={set('address')} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle} htmlFor="ac-city">City {req}</label>
              <input id="ac-city" style={fieldStyle} placeholder="e.g. Subang Jaya" value={form.city} onChange={set('city')} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle} htmlFor="ac-state">State {req}</label>
              <input id="ac-state" style={fieldStyle} placeholder="e.g. Selangor" value={form.state} onChange={set('state')} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle} htmlFor="ac-units">Total units <span style={{ color: C.textFaint, fontWeight: 400 }}>(optional)</span></label>
              <input id="ac-units" type="number" min="0" inputMode="numeric" style={fieldStyle} placeholder="e.g. 480"
                value={form.units} onChange={set('units')} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle} htmlFor="ac-floors">Floors per block <span style={{ color: C.textFaint, fontWeight: 400 }}>(optional)</span></label>
              <input id="ac-floors" type="number" min="0" inputMode="numeric" style={fieldStyle} placeholder="e.g. 30"
                value={form.floorsPerBlock} onChange={set('floorsPerBlock')} />
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="ac-blocks">Blocks <span style={{ color: C.textFaint, fontWeight: 400 }}>(optional, comma separated)</span></label>
            <input id="ac-blocks" style={fieldStyle} placeholder="e.g. A, B, C — leave blank for landed"
              value={form.blocks} onChange={set('blocks')} />
          </div>

          {error && <p style={{ margin: 0, color: C.danger, fontSize: 13 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={button('outline')}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...button('primary'), opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding…' : 'Add community'}
            </button>
          </div>
        </form>
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
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(null)

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

  // Quick-pick types for the add form, same derive-from-data approach the
  // Discover filters use, so a type an admin invents once is offered next time.
  const existingTypes = useMemo(() => {
    const found = [...new Set((projects || []).map(p => p.type))].sort()
    return found.length ? found : ['Condo', 'Apartment', 'Landed G&G']
  }, [projects])

  const onCreated = (project) => {
    setProjects(list => [...(list || []), project])
    setRefsByProject(m => ({ ...m, [project.id]: [] }))
    setSearch('')            // so the new card isn't filtered out of view
    setAdding(false)
    setJustAdded(project)
  }

  const goReferences = (projectId, type) => {
    const qs = type ? `?projectId=${projectId}&type=${encodeURIComponent(type)}` : `?projectId=${projectId}`
    navigate(`/admin/references${qs}`)
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 320px' }}>
          <h1 style={{ color: C.navy, marginBottom: 6, fontSize: 27 }}>Communities Overview</h1>
          <p style={{ color: C.textMuted, marginTop: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 720 }}>
            Every community in one place — add a new one, see who's waiting on verification, what's been
            published to References, and jump straight into uploading a building-progress update with photos.
          </p>
        </div>
        <button style={{ ...button('primary'), padding: '11px 20px' }} onClick={() => setAdding(true)}>
          ＋ Add community
        </button>
      </div>

      {justAdded && (
        <div className="pg-fade-in" style={{
          ...card, padding: '13px 16px', marginTop: 14, background: C.successBg, borderColor: '#A7F3D0',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 18 }} aria-hidden="true">✅</span>
          <span style={{ color: C.success, fontSize: 14, fontWeight: 600, flex: '1 1 220px' }}>
            {justAdded.name} is live in the directory — residents can now apply to join.
          </span>
          <button
            style={{ ...button('outline'), fontSize: 13, padding: '7px 12px' }}
            onClick={() => goReferences(justAdded.id)}
          >
            Add its first reference
          </button>
        </div>
      )}

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
          <div style={{ marginBottom: 14 }}>No communities match your search.</div>
          <button style={button('primary')} onClick={() => setAdding(true)}>＋ Add this community</button>
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

      {adding && (
        <AddCommunityModal
          existingTypes={existingTypes}
          onClose={() => setAdding(false)}
          onCreated={onCreated}
        />
      )}
    </div>
  )
}
