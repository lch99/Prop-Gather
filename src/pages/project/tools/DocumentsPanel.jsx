import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card, badge } from '../../../theme'

const categoryColor = (cat) => {
  if (cat === 'By-Laws') return badge('#7B44AA', '#f3e8fb')
  if (cat === 'Circular') return badge(C.warning, C.warningBg)
  if (cat === 'Minutes') return badge(C.success, C.successBg)
  return badge(C.textMuted, C.neutralBg)
}

export default function DocumentsPanel({ projectId }) {
  const [docs, setDocs] = useState([])

  useEffect(() => { api.getDocuments(projectId).then(setDocs) }, [projectId])

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', color: C.navy }}>Document Library</h3>
      <p style={{ margin: '0 0 16px', color: C.textMuted, fontSize: 13 }}>
        House rules, by-laws, meeting minutes, circulars, and contractor warranties — shared and kept up to date by verified residents.
      </p>

      <div style={{ ...card, overflow: 'hidden' }}>
        {docs.map((d, i) => (
          <div key={d.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`, flexWrap: 'wrap', gap: 8
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div>
                <div style={{ fontWeight: 600, color: C.navy }}>{d.title}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>Uploaded by {d.uploadedBy} on {d.date}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={categoryColor(d.category)}>{d.category}</span>
              <button style={{ border: 'none', background: 'none', color: C.blue, fontWeight: 600, fontSize: 13 }}>Download</button>
            </div>
          </div>
        ))}
        {docs.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>No documents uploaded yet.</div>
        )}
      </div>
    </div>
  )
}
