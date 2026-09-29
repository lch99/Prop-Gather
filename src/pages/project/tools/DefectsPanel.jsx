import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card, button, badge } from '../../../theme'
import { msg, useT } from '../../../i18n'
import { LoadingInline } from '../../../components/Loading'
import { useAttachments, AttachmentPicker, AttachmentList } from '../../../components/Attachments'
import SensitiveContentNotice, { hasSensitiveContent } from '../../../components/SensitiveContentNotice'

// Stored as English (the server keeps free text); shown translated.
const DEFECT_CATEGORIES = [
  msg('General'), msg('Lift'), msg('Electrical'), msg('Plumbing'), msg('Waterproofing'), msg('Facilities'), msg('Structural')
]

const statusStyle = (status) => {
  if (status === 'Open') return badge(C.danger, C.dangerBg)
  if (status === 'Acknowledged') return badge(C.warning, C.warningBg)
  if (status === 'In Progress') return badge(C.blue, C.blueLight)
  return badge(C.success, C.successBg)
}

export default function DefectsPanel({ projectId, project }) {
  const t = useT()
  const [defects, setDefects] = useState(null) // null = still loading
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', block: '', floorRange: '', unit: '', category: 'General', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { attachments, addFiles, removeAttachment, error: uploadError, reset: resetAttachments } = useAttachments()

  const load = () => api.getDefects(projectId).then(setDefects).catch(() => setDefects([]))
  useEffect(() => { load() }, [projectId])

  const create = async () => {
    if (!form.title || !form.description || saving) return
    if (hasSensitiveContent(form.title, form.description)) return
    // Photos upload to storage before the report is filed, so a failed upload or
    // a refused file surfaces here — silently swallowing it would leave the form
    // open with no explanation and the report unfiled.
    setError('')
    setSaving(true)
    try {
      await api.createDefect(projectId, { ...form, attachments })
    } catch (err) {
      setError(err.message)
      return
    } finally {
      setSaving(false)
    }
    setForm({ title: '', block: '', floorRange: '', unit: '', category: 'General', description: '' })
    resetAttachments()
    setShowNew(false)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: '1 1 220px' }}>
          <h3 style={{ margin: 0, color: C.navy }}>{t('Defect Tracker')}</h3>
          <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>
            {t('Logged defects automatically surface how many other units reported the same issue — turning complaints into documented evidence of systemic defects.')}
          </p>
        </div>
        <button style={button('primary')} onClick={() => setShowNew(s => !s)}>+ {t('Log defect')}</button>
      </div>

      {showNew && (
        <div style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <input placeholder={t('Defect title')} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          <select value={form.block} onChange={e => setForm(f => ({ ...f, block: e.target.value }))} style={inputStyle} aria-label={t('Block')}>
            <option value="">{t('Block...')}</option>
            {(project.blocks || []).map(b => <option key={b} value={b}>{b}</option>)}
            {(!project.blocks || project.blocks.length === 0) && <option value="-">-</option>}
          </select>
          <input placeholder={t('Floor / floor range')} value={form.floorRange} onChange={e => setForm(f => ({ ...f, floorRange: e.target.value }))} style={inputStyle} />
          <input placeholder={t('Your unit number')} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle} aria-label={t('Category')}>
            {DEFECT_CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
          </select>
          <textarea placeholder={t('Describe the defect, include details others can match against...')} rows={3} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical' }} />
          <div style={{ gridColumn: '1 / -1' }}>
            <AttachmentPicker
              attachments={attachments}
              addFiles={addFiles}
              removeAttachment={removeAttachment}
              error={uploadError}
              label={t('Add photos of the defect')}
            />
          </div>
          <SensitiveContentNotice values={[form.title, form.description]} />
          {error && (
            <div role="alert" style={{
              gridColumn: '1 / -1', fontSize: 13, color: C.danger, background: C.dangerBg,
              padding: '8px 10px', borderRadius: C.radiusSm
            }}>
              {error}
            </div>
          )}
          <div>
            <button
              style={{
                ...button('primary'),
                ...(hasSensitiveContent(form.title, form.description) ? { opacity: 0.5, cursor: 'not-allowed' } : saving ? { opacity: 0.7, cursor: 'wait' } : {})
              }}
              onClick={create}
              disabled={saving || hasSensitiveContent(form.title, form.description)}
            >
              {saving ? (attachments.length ? t('Uploading…') : t('Submitting…')) : t('Submit')}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {defects === null && <LoadingInline />}
        {defects?.map(d => (
          <div key={d.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <h4 style={{ margin: 0, color: C.navy }}>{d.title}</h4>
              <span style={statusStyle(d.status)}>{t(d.status)}</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: C.text }}>{d.description}</p>
            <AttachmentList attachments={d.attachments} thumb={110} style={{ marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: C.textMuted }}>
              <span>📍 {t('Block {block} · Floor {floor}', { block: d.block, floor: d.floorRange })}</span>
              <span>🏷 {t(d.category)}</span>
              <span>{t('Reported by {name} ({unit}) on {date}', { name: d.reportedBy, unit: d.unit, date: d.reportedAt })}</span>
              {d.matchingUnits > 1 && (
                <span style={{ color: C.danger, fontWeight: 600 }}>
                  ⚠ {t('{n} units reported same issue', { n: d.matchingUnits })}
                </span>
              )}
            </div>
          </div>
        ))}
        {defects?.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>{t('No defects logged for this project.')}</div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14
}
