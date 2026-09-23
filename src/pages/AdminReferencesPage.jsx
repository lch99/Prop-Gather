import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { C, card, button, badge } from '../theme'
import { useAttachments, AttachmentPicker } from '../components/Attachments'
import { REFERENCE_TYPES, refMeta, PROGRESS_TYPE } from '../referenceTypes'

const today = () => new Date().toISOString().slice(0, 10)
const blankForm = (type = 'Project Reference') => ({ type, title: '', description: '', date: today(), progress: '' })

const inputStyle = {
  padding: '11px 12px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
  fontSize: 15, width: '100%', boxSizing: 'border-box', background: '#fff', color: C.text
}
const labelStyle = { fontSize: 13.5, fontWeight: 700, color: C.navy, marginBottom: 6, display: 'block' }

export default function AdminReferencesPage() {
  const [searchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [refs, setRefs] = useState(null)
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const [projectsError, setProjectsError] = useState('')
  const [listError, setListError] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const { attachments, addFiles, removeAttachment, error: uploadError, reset } = useAttachments()

  // With no community selected there are no references to load, so every path
  // out of here that leaves projectId empty — no communities yet (a fresh
  // install), or a failed request — lands `refs` on [] itself. Otherwise the
  // skeletons below never resolve.
  useEffect(() => {
    api.getProjects()
      .then(list => {
        setProjects(list)
        if (list.length) setProjectId(list[0].id)
        else setRefs([])
      })
      .catch(() => {
        setProjectsError("We couldn't load the list of communities. Please refresh the page to try again.")
        setRefs([])
      })
      .finally(() => setProjectsLoaded(true))
  }, [])

  // Deep-linked from the Overview dashboard (?projectId=&type=) — e.g. its
  // "Add progress update" quick action. Re-runs on every navigation here so
  // switching communities from Overview updates the form without a remount.
  useEffect(() => {
    if (!projects.length) return
    const paramId = searchParams.get('projectId')
    const paramType = searchParams.get('type')
    if (paramId && projects.some(p => p.id === paramId)) setProjectId(paramId)
    if (paramType && REFERENCE_TYPES.some(t => t.key === paramType)) setForm(blankForm(paramType))
  }, [searchParams, projects])

  // `refs === null` renders skeletons, so a failed fetch has to land on [] or
  // they never resolve into the empty state.
  const load = () => { if (projectId) api.getReferences(projectId).then(setRefs).catch(() => setRefs([])) }
  useEffect(() => {
    if (!projectId) return
    setRefs(null)
    load()
  }, [projectId])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim() || saving) return
    if (!projectId) {
      setPublishError('Choose a community to publish this to first.')
      return
    }
    setSaving(true)
    setJustPublished(false)
    setPublishError('')
    try {
      await api.addReference(projectId, { ...form, attachments })
      setForm(blankForm())
      reset()
      load()
      setJustPublished(true)
      setTimeout(() => setJustPublished(false), 3500)
    } catch (err) {
      // Files upload to storage before the reference is created, so this is also
      // where a failed upload surfaces.
      setPublishError(err.message || "We couldn't publish that just now. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (refId, title) => {
    if (!window.confirm(`Remove "${title}"? Residents will no longer see this reference.`)) return
    setRemovingId(refId)
    setListError('')
    try {
      await api.deleteReference(projectId, refId)
      load()
    } catch (err) {
      setListError(err.message || `We couldn't remove "${title}" just now. Please try again.`)
    } finally {
      setRemovingId(null)
    }
  }

  const selectedProject = projects.find(p => p.id === projectId)

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ color: C.navy, marginBottom: 6, fontSize: 27 }}>Manage Community References</h1>
      <p style={{ color: C.textMuted, marginTop: 0, fontSize: 15, lineHeight: 1.5 }}>
        Upload brochures, floor plans and building-progress updates for a community. Published items appear
        on the community's <strong>References</strong> tab for verified residents.
      </p>

      {/* Community picker */}
      <div style={{ ...card, padding: 18, marginBottom: 20 }}>
        <label style={labelStyle} htmlFor="ref-community">Community</label>
        <select
          id="ref-community"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          style={{ ...inputStyle, maxWidth: 420, cursor: 'pointer' }}
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}, {p.state}</option>)}
        </select>
        {projectsError && (
          <div role="alert" style={{ marginTop: 10, fontSize: 13.5, color: C.danger }}>{projectsError}</div>
        )}
        {projectsLoaded && !projectsError && projects.length === 0 && (
          <div style={{ marginTop: 10, fontSize: 13.5, color: C.textMuted }}>
            There are no communities yet. Add one from the Overview tab, then publish its references here.
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, alignItems: 'start' }}>
        {/* ---- Upload form ---- */}
        <div style={{ ...card, padding: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, color: C.navy }}>＋ Add a reference</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {REFERENCE_TYPES.map(t => {
                  const active = form.type === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => set('type', t.key)}
                      title={t.hint}
                      style={{
                        ...badge(active ? '#fff' : t.color[0], active ? t.color[0] : t.color[1]),
                        cursor: 'pointer', border: active ? `1px solid ${t.color[0]}` : `1px solid ${t.color[1]}`,
                        fontSize: 13, padding: '7px 13px'
                      }}
                    >
                      {t.icon} {t.key}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="ref-title">Title</label>
              <input
                id="ref-title"
                placeholder="e.g. Project Brochure 2026"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="ref-desc">Description</label>
              <textarea
                id="ref-desc"
                placeholder="Short summary residents will see…"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle} htmlFor="ref-date">Date</label>
                <input id="ref-date" type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
              </div>
              {form.type === PROGRESS_TYPE && (
                <div style={{ flex: '1 1 160px' }}>
                  <label style={labelStyle} htmlFor="ref-progress">Progress (%)</label>
                  <input
                    id="ref-progress"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0–100"
                    value={form.progress}
                    onChange={e => set('progress', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Files</label>
              <AttachmentPicker
                attachments={attachments}
                addFiles={addFiles}
                removeAttachment={removeAttachment}
                error={uploadError}
                label="Add brochure, plans or photos"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button style={{ ...button('primary'), opacity: saving || !form.title.trim() ? 0.6 : 1 }} onClick={submit} disabled={saving}>
                {saving ? 'Publishing…' : 'Publish to community'}
              </button>
              {justPublished && (
                <span className="pg-fade-in" style={{ ...badge(C.success, C.successBg), padding: '7px 13px' }}>
                  ✓ Published
                </span>
              )}
            </div>
            {publishError && (
              <div role="alert" style={{ fontSize: 13.5, color: C.danger, background: C.dangerBg, padding: '9px 12px', borderRadius: C.radiusSm }}>
                {publishError}
              </div>
            )}
          </div>
        </div>

        {/* ---- Existing references ---- */}
        <div>
          <h2 style={{ margin: '4px 0 16px', fontSize: 18, color: C.navy }}>
            Published{selectedProject ? ` — ${selectedProject.name}` : ''}
            {refs?.length > 0 && <span style={{ color: C.textFaint, fontWeight: 400 }}> ({refs.length})</span>}
          </h2>
          {listError && (
            <div role="alert" style={{
              fontSize: 13.5, color: C.danger, background: C.dangerBg, padding: '9px 12px',
              borderRadius: C.radiusSm, marginBottom: 12
            }}>
              {listError}
            </div>
          )}
          {refs === null ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[0, 1].map(i => <div key={i} className="pg-skel" style={{ height: 72, borderRadius: C.radius }} />)}
            </div>
          ) : refs.length === 0 ? (
            <div style={{ ...card, padding: 22, textAlign: 'center', color: C.textMuted }}>
              {projectId ? 'Nothing published yet for this community.' : 'Nothing to show until there is a community to publish to.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {refs.map(item => {
                const meta = refMeta(item.type)
                return (
                  <div key={item.id} style={{ ...card, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: C.radiusSm, flexShrink: 0, fontSize: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.color[1]
                    }}>
                      <span aria-hidden="true">{meta.icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={badge(meta.color[0], meta.color[1])}>{item.type}</span>
                        {item.progress != null && <span style={badge(C.accent, C.accentLight)}>{item.progress}%</span>}
                      </div>
                      <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{item.title}</div>
                      <div style={{ fontSize: 12.5, color: C.textFaint }}>
                        {item.date} · {item.attachments?.length || 0} file{(item.attachments?.length || 0) !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(item.id, item.title)}
                      disabled={removingId === item.id}
                      style={{
                        ...button('outline'), color: C.danger, padding: '7px 12px', fontSize: 13,
                        ...(removingId === item.id ? { opacity: 0.6, cursor: 'wait' } : {})
                      }}
                    >
                      {removingId === item.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
