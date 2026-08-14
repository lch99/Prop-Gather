import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { C, card, badge, button, chipColor } from '../theme'

const activityColor = (level) => {
  if (level === 'High') return { color: C.success, bg: C.successBg }
  if (level === 'Medium') return { color: C.warning, bg: C.warningBg }
  return { color: C.neutral, bg: C.neutralBg }
}

const EMPTY_REQ = { name: '', city: '', state: '', developer: '', note: '' }

function RequestModal({ onClose }) {
  const [form, setForm] = useState(EMPTY_REQ)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim() || !form.state.trim()) {
      setError('Please add the community name, city and state so we can find it.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await api.requestCommunity(form)
      setDone(true)
    } catch {
      setError("We couldn't send your request just now. Please try again in a moment.")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldStyle = {
    width: '100%', padding: '10px 13px', border: `1px solid ${C.border}`,
    borderRadius: C.radiusSm, fontSize: 14, color: C.text, background: '#fff',
    boxSizing: 'border-box'
  }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 5 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,10,30,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{ ...card, width: '100%', maxWidth: 480, padding: 28, position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16, border: 'none', background: 'none',
          fontSize: 20, cursor: 'pointer', color: C.textMuted, lineHeight: 1
        }}>×</button>

        {done ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3 style={{ margin: '0 0 8px', color: C.navy }}>Request submitted!</h3>
            <p style={{ margin: '0 0 20px', color: C.textMuted, fontSize: 14 }}>
              Thanks for letting us know. We'll review your suggestion and add the community when verified.
            </p>
            <button onClick={onClose} style={button('primary')}>Done</button>
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px', color: C.navy }}>Request a missing community</h3>
            <p style={{ margin: '0 0 20px', color: C.textMuted, fontSize: 13 }}>
              Can't find your property? Tell us about it and we'll add it to the directory.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Community / Project Name <span style={{ color: C.danger }}>*</span></label>
                <input style={fieldStyle} placeholder="e.g. Taman Maju Jaya" value={form.name} onChange={set('name')} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>City <span style={{ color: C.danger }}>*</span></label>
                  <input style={fieldStyle} placeholder="e.g. Petaling Jaya" value={form.city} onChange={set('city')} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>State <span style={{ color: C.danger }}>*</span></label>
                  <input style={fieldStyle} placeholder="e.g. Selangor" value={form.state} onChange={set('state')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Developer / Management Company <span style={{ color: C.textFaint, fontWeight: 400 }}>(optional)</span></label>
                <input style={fieldStyle} placeholder="e.g. Sunway Property" value={form.developer} onChange={set('developer')} />
              </div>
              <div>
                <label style={labelStyle}>Additional notes <span style={{ color: C.textFaint, fontWeight: 400 }}>(optional)</span></label>
                <textarea style={{ ...fieldStyle, resize: 'vertical', minHeight: 72 }}
                  placeholder="Anything else that helps us find this community..."
                  value={form.note} onChange={set('note')} />
              </div>
              {error && <p style={{ margin: 0, color: C.danger, fontSize: 13 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={onClose} style={button('outline')}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ ...button('primary'), opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function CommunityJoinModal({ project, onClose }) {
  const navigate = useNavigate()
  const ac = activityColor(project.activityLevel)

  const handleJoin = () => {
    onClose()
    navigate(`/register?projectId=${project.id}`)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,10,30,0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{ ...card, width: '100%', maxWidth: 520, padding: 0, position: 'relative', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header strip */}
        <div style={{
          background: `${C.heroGlow}, ${C.headerGradient}`,
          padding: '24px 28px 20px',
          color: '#fff'
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 16, border: 'none', background: 'rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 28, height: 28, fontSize: 16, cursor: 'pointer',
            color: '#fff', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>×</button>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.7)', marginBottom: 6, textTransform: 'uppercase' }}>
            Community
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>{project.name}</h2>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)' }}>
            {project.address}, {project.city}, {project.state}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <InfoTile label="Property type" value={project.type} />
            <InfoTile label="Verified residents" value={`${project.ownerCount} owners`} />
            <InfoTile label="Activity level">
              <span style={{ fontWeight: 700, color: ac.color }}>{project.activityLevel}</span>
            </InfoTile>
            {project.developer && <InfoTile label="Developer" value={project.developer} />}
          </div>

          {/* Latest thread */}
          {project.latestThread && (
            <div style={{
              background: C.neutralBg, borderRadius: C.radiusSm, padding: '10px 14px', fontSize: 13
            }}>
              <span style={{ color: C.textMuted, fontWeight: 600 }}>Latest discussion: </span>
              <span style={{ color: C.text }}>{project.latestThread}</span>
            </div>
          )}

          {/* Owner-only notice */}
          <div style={{
            background: C.blueLight, border: `1px solid ${C.border}`,
            borderRadius: C.radiusSm, padding: '11px 14px',
            fontSize: 13, color: C.navy, lineHeight: 1.55
          }}>
            <strong>🔐 Verified owners only.</strong> To join this community you must be a registered property owner of this residence. You will need to upload your Sale and Purchase Agreement (SPA), a recent utility bill, or a copy of the property title as proof during registration.
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Link to={`/project/${project.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
              <button style={button('outline')}>View community</button>
            </Link>
            <button style={button('primary')} onClick={handleJoin}>
              Join now →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoTile({ label, value, children }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: C.radiusSm, padding: '10px 14px'
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>
        {children ?? value}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 5, background: C.border }} />
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="pg-skel" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="pg-skel" style={{ height: 16, width: '70%', marginBottom: 9 }} />
            <div className="pg-skel" style={{ height: 12, width: '92%' }} />
          </div>
        </div>
        <div className="pg-skel" style={{ height: 24, width: '58%', borderRadius: 999, marginTop: 16 }} />
        <div className="pg-skel" style={{ height: 12, width: '100%', marginTop: 16 }} />
        <div className="pg-skel" style={{ height: 12, width: '78%', marginTop: 9 }} />
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [type, setType] = useState('')
  const [showRequest, setShowRequest] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.getProjects().then(data => {
      setProjects(data)
      setLoading(false)
    })
  }, [])

  const states = useMemo(() => [...new Set(projects.map(p => p.state))].sort(), [projects])
  const types = useMemo(() => [...new Set(projects.map(p => p.type))].sort(), [projects])

  const filtered = projects.filter(p => {
    if (state && p.state !== state) return false
    if (type && p.type !== type) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.city.toLowerCase().includes(q) && !p.state.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalResidents = useMemo(() => projects.reduce((sum, p) => sum + (p.ownerCount || 0), 0), [projects])

  const inputStyle = {
    flex: '2 1 260px', padding: '11px 14px', border: `1px solid ${C.border}`,
    borderRadius: C.radiusSm, fontSize: 14, background: '#fff', color: C.text
  }
  const selectStyle = { ...inputStyle, flex: '1 1 170px', cursor: 'pointer' }

  return (
    <div>
      {showRequest && <RequestModal onClose={() => setShowRequest(false)} />}
      {selectedProject && <CommunityJoinModal project={selectedProject} onClose={() => setSelectedProject(null)} />}
      <div className="pg-hero-anim" style={{ background: C.headerGradientWide, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* soft static glow layer over the drifting gradient */}
        <div style={{ position: 'absolute', inset: 0, background: C.heroGlow, pointerEvents: 'none' }} />
        <div className="pg-float" style={{
          position: 'absolute', top: -70, right: -40, width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)', pointerEvents: 'none'
        }} />
        <div className="pg-float" style={{
          position: 'absolute', bottom: -90, left: '32%', width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,114,182,0.32), transparent 70%)',
          pointerEvents: 'none', animationDelay: '-3.5s'
        }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(20px, 4vw, 28px) clamp(18px, 5vw, 24px) clamp(16px, 3.5vw, 22px)', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 10,
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.32)',
            borderRadius: 999, padding: '5px 13px', fontSize: 12, fontWeight: 700, color: '#fff',
            backdropFilter: 'blur(6px)'
          }}>
            👋 Welcome to your neighbourhood
          </div>
          <h1 style={{ margin: '0 0 7px', fontSize: 'clamp(20px, 4.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.15 }}>
            Discover <span className="pg-gradient-text">verified property</span> communities
          </h1>
          <p style={{ margin: '0 0 14px', color: C.brandLight, fontSize: 14.5, lineHeight: 1.5, maxWidth: 580 }}>
            Search Malaysia's national directory of registered property projects. Join your project's
            verified community to access the forum, live chat, and owner tools.
          </p>
          <div className="pg-hero-bottom">
            <div className="pg-stat-chips" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              [projects.length, 'Registered projects'],
              [totalResidents.toLocaleString(), 'Verified residents'],
              [states.length, 'States covered']
            ].map(([value, label]) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 12, padding: '8px 16px', minWidth: 110, backdropFilter: 'blur(6px)'
              }}>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>{value}</div>
                <div style={{ fontSize: 12, color: C.brandLight }}>{label}</div>
              </div>
            ))}
            </div>
            <button
              onClick={() => setShowRequest(true)}
              className="pg-shine"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.38)',
                color: '#fff', borderRadius: C.radiusSm, padding: '7px 15px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                backdropFilter: 'blur(6px)', flexShrink: 0
              }}
            >
              + Can't find your community?
            </button>
          </div>

          {/* Search bar sits inside the hero for clean separation */}
          <div className="pg-discover-search" style={{
            background: 'rgba(255,255,255,0.96)', borderRadius: C.radius,
            padding: '12px 14px', boxShadow: '0 4px 24px rgba(0,0,0,0.18)'
          }}>
            <input
              placeholder="Search by project name, city, or state..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={inputStyle}
            />
            <div className="pg-discover-search-filters">
              <select value={state} onChange={e => setState(e.target.value)} style={selectStyle}>
                <option value="">All states</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
                <option value="">All types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(search || state || type) && (
              <button
                onClick={() => { setSearch(''); setState(''); setType('') }}
                style={{ border: 'none', background: 'none', color: C.blue, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                × Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 28px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px', color: C.navy }}>No projects match your search</h3>
            <p style={{ margin: '0 0 16px', color: C.textMuted, fontSize: 14 }}>
              Try a different name, city, or clear your filters.
            </p>
            <p style={{ margin: '0 0 12px', color: C.textMuted, fontSize: 14 }}>
              Still can't find your community?
            </p>
            <button onClick={() => setShowRequest(true)} style={button('primary')}>
              + Request to add it
            </button>
          </div>
        ) : (
          <>
            <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 12 }}>
              {filtered.length} project{filtered.length !== 1 ? 's' : ''} found
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filtered.map((p, i) => {
                const ac = activityColor(p.activityLevel)
                const [ctext, cbg] = chipColor(p.type)
                return (
                  <div
                    key={p.id}
                    className="pg-card-hover pg-fade-in"
                    style={{
                      ...card, padding: 0, height: '100%', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', overflow: 'hidden',
                      animationDelay: `${Math.min(i * 0.05, 0.4)}s`
                    }}
                    onClick={() => setSelectedProject(p)}
                  >
                    {/* brand accent strip ties every card to the theme */}
                    <div style={{ height: 5, background: C.headerGradient, flexShrink: 0 }} />
                    <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, background: cbg, color: ctext,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 19, flexShrink: 0
                        }}>{p.name.charAt(0)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <h3 style={{ margin: 0, color: C.navy, fontSize: 17, lineHeight: 1.25 }}>{p.name}</h3>
                            <span style={badge(ctext, cbg)}>{p.type}</span>
                          </div>
                          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
                            {p.address}, {p.city}, {p.state}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, margin: '14px 0 0', flexWrap: 'wrap' }}>
                        <span style={badge(C.navy, C.neutralBg)}>👥 {p.ownerCount} verified residents</span>
                        <span style={badge(ac.color, ac.bg)}>{p.activityLevel} activity</span>
                        {p.activeOfferBanner && <span style={badge(C.warning, C.warningBg)}>🏷 Vendor offer this week</span>}
                      </div>
                      <div style={{ fontSize: 13, color: C.text, marginTop: 14 }}>
                        {/* a just-added community has no threads yet */}
                        {p.latestThread
                          ? <><span style={{ color: C.textMuted }}>Latest: </span>{p.latestThread}</>
                          : <span style={{ color: C.textFaint, fontStyle: 'italic' }}>New community — no posts yet.</span>}
                      </div>
                      <div style={{ flexGrow: 1 }} />
                      {/* clear, full-width action affordance so it's obvious the card opens the community */}
                      <div className="pg-cta" style={{
                        marginTop: 16, marginLeft: -18, marginRight: -18, marginBottom: -18,
                        padding: '12px 18px', borderTop: `1px solid ${C.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        color: C.blue, fontWeight: 700, fontSize: 14
                      }}>
                        View community &amp; join
                        <span className="pg-arrow">→</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
