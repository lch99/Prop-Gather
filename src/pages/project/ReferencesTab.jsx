import { useEffect, useState } from 'react'
import { api } from '../../api'
import { C, card, badge } from '../../theme'
import { AttachmentList } from '../../components/Attachments'
import { refMeta, PROGRESS_TYPE } from '../../referenceTypes'

const coverImage = (item) => (item.attachments || []).find(a => a.type?.startsWith('image/'))

// Brochures / floor plans / site plans etc. — a tile with a cover and a download link.
function ReferenceCard({ item }) {
  const meta = refMeta(item.type)
  const cover = coverImage(item)
  return (
    <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 152, position: 'relative' }}>
        {cover ? (
          <img src={cover.dataUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 52, background: `linear-gradient(135deg, ${meta.color[1]}, #fff)`
          }}>
            <span aria-hidden="true">{meta.icon}</span>
          </div>
        )}
        <span style={{ ...badge(meta.color[0], meta.color[1]), position: 'absolute', top: 10, left: 10, boxShadow: C.shadow }}>
          {meta.icon} {item.type}
        </span>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16.5, color: C.navy, lineHeight: 1.25 }}>{item.title}</div>
        {item.description && (
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.45, flex: 1 }}>{item.description}</div>
        )}
        <div style={{ fontSize: 12.5, color: C.textFaint }}>Updated {item.date}</div>
        {item.attachments?.length > 0 ? (
          <AttachmentList attachments={item.attachments} thumb={66} style={{ marginTop: 2 }} />
        ) : (
          <span style={{ fontSize: 13, color: C.textFaint, fontStyle: 'italic' }}>File coming soon</span>
        )}
      </div>
    </div>
  )
}

// Building-progress updates rendered as a dated timeline with a progress bar + photos.
function ProgressTimeline({ items }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 30 }}>
      <div style={{ position: 'absolute', left: 9, top: 8, bottom: 8, width: 2, background: C.border }} />
      {items.map(item => (
        <div key={item.id} style={{ position: 'relative', marginBottom: 18 }}>
          <div style={{
            position: 'absolute', left: -29, top: 18, width: 20, height: 20, borderRadius: '50%',
            background: '#fff', border: `3px solid ${C.accent}`, boxShadow: C.shadow
          }} />
          <div style={{ ...card, padding: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, marginBottom: 4 }}>📅 {item.date}</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{item.title}</div>

            {item.progress != null && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ background: C.neutralBg, borderRadius: 999, height: 14, overflow: 'hidden' }}>
                  <div style={{ width: `${item.progress}%`, height: '100%', background: 'linear-gradient(90deg,#c2410c,#f59e0b)' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginTop: 5 }}>{item.progress}% complete</div>
              </div>
            )}

            {item.description && (
              <p style={{ margin: '0 0 10px', fontSize: 14.5, color: C.text, lineHeight: 1.5 }}>{item.description}</p>
            )}
            <AttachmentList attachments={item.attachments} thumb={110} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ReferencesTab({ projectId }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    setItems(null)
    api.getReferences(projectId).then(setItems).catch(() => setItems([]))
  }, [projectId])

  if (items === null) return <div style={{ color: C.textMuted, padding: 8 }}>Loading references…</div>

  const progress = items.filter(i => i.type === PROGRESS_TYPE)
  const docs = items.filter(i => i.type !== PROGRESS_TYPE)

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', color: C.navy, fontSize: 20 }}>References & Resources</h3>
      <p style={{ margin: '0 0 20px', color: C.textMuted, fontSize: 14.5, lineHeight: 1.5 }}>
        Project & residence references and building-progress updates kept for this community.
      </p>

      {items.length === 0 && (
        <div style={{ ...card, padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 15 }}>
          No references have been published yet. Check back soon.
        </div>
      )}

      {docs.length > 0 && (
        <section style={{ marginBottom: progress.length ? 32 : 0 }}>
          <h4 style={{ margin: '0 0 14px', color: C.text, fontSize: 16 }}>📂 Project & Residence References</h4>
          <div style={{
            display: 'grid', gap: 18,
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))'
          }}>
            {docs.map(item => <ReferenceCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {progress.length > 0 && (
        <section>
          <h4 style={{ margin: '0 0 16px', color: C.text, fontSize: 16 }}>🏗️ Building Progress</h4>
          <ProgressTimeline items={progress} />
        </section>
      )}
    </div>
  )
}
