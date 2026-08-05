import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card, button, badge } from '../../../theme'
import { useAttachments, AttachmentPicker, AttachmentList } from '../../../components/Attachments'

const statusStyle = (status) => {
  if (status === 'Open') return badge(C.danger, C.dangerBg)
  if (status === 'Acknowledged') return badge(C.warning, C.warningBg)
  if (status === 'In Progress') return badge(C.blue, C.blueLight)
  return badge(C.success, C.successBg)
}

export default function DefectsPanel({ projectId, project }) {
  const [defects, setDefects] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', block: '', floorRange: '', unit: '', category: 'General', description: '' })
  const { attachments, addFiles, removeAttachment, error: uploadError, reset: resetAttachments } = useAttachments()

  const load = () => api.getDefects(projectId).then(setDefects)
  useEffect(() => { load() }, [projectId])

  const create = async () => {
    if (!form.title || !form.description) return
    await api.createDefect(projectId, { ...form, attachments })
    setForm({ title: '', block: '', floorRange: '', unit: '', category: 'General', description: '' })
    resetAttachments()
    setShowNew(false)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: '1 1 220px' }}>
          <h3 style={{ margin: 0, color: C.navy }}>Defect Tracker</h3>
          <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>
            Logged defects automatically surface how many other units reported the same issue —
            turning complaints into documented evidence of systemic defects.
          </p>
        </div>
        <button style={button('primary')} onClick={() => setShowNew(s => !s)}>+ Log defect</button>
      </div>

      {showNew && (
        <div style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <input placeholder="Defect title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          <select value={form.block} onChange={e => setForm(f => ({ ...f, block: e.target.value }))} style={inputStyle}>
            <option value="">Block...</option>
            {(project.blocks || []).map(b => <option key={b} value={b}>{b}</option>)}
            {(!project.blocks || project.blocks.length === 0) && <option value="-">-</option>}
          </select>
          <input placeholder="Floor / floor range" value={form.floorRange} onChange={e => setForm(f => ({ ...f, floorRange: e.target.value }))} style={inputStyle} />
          <input placeholder="Your unit number" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
            {['General', 'Lift', 'Electrical', 'Plumbing', 'Waterproofing', 'Facilities', 'Structural'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea placeholder="Describe the defect, include details others can match against..." rows={3} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical' }} />
          <div style={{ gridColumn: '1 / -1' }}>
            <AttachmentPicker
              attachments={attachments}
              addFiles={addFiles}
              removeAttachment={removeAttachment}
              error={uploadError}
              label="Add photos of the defect"
            />
          </div>
          <div><button style={button('primary')} onClick={create}>Submit</button></div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {defects.map(d => (
          <div key={d.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <h4 style={{ margin: 0, color: C.navy }}>{d.title}</h4>
              <span style={statusStyle(d.status)}>{d.status}</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: C.text }}>{d.description}</p>
            <AttachmentList attachments={d.attachments} thumb={110} style={{ marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: C.textMuted }}>
              <span>📍 Block {d.block} · Floor {d.floorRange}</span>
              <span>🏷 {d.category}</span>
              <span>Reported by {d.reportedBy} ({d.unit}) on {d.reportedAt}</span>
              {d.matchingUnits > 1 && <span style={{ color: C.danger, fontWeight: 600 }}>⚠ {d.matchingUnits} units reported same issue</span>}
            </div>
          </div>
        ))}
        {defects.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>No defects logged for this project.</div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14
}
