import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card, button, badge } from '../../../theme'

export default function PetitionsPanel({ projectId }) {
  const [petitions, setPetitions] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target: 100 })

  const load = () => api.getPetitions(projectId).then(setPetitions)
  useEffect(() => { load() }, [projectId])

  const sign = async (id) => {
    const updated = await api.signPetition(projectId, id)
    setPetitions(ps => ps.map(p => p.id === updated.id ? updated : p))
  }

  const create = async () => {
    if (!form.title || !form.description || !form.target) return
    await api.createPetition(projectId, form)
    setForm({ title: '', description: '', target: 100 })
    setShowNew(false)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: C.navy }}>Petitions</h3>
          <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>
            Create or sign a petition. Completed petitions can be exported as a signed PDF for the developer, JMB, or KPKT.
          </p>
        </div>
        <button style={button('primary')} onClick={() => setShowNew(s => !s)}>+ New petition</button>
      </div>

      {showNew && (
        <div style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gap: 10 }}>
          <input placeholder="Petition title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={inputStyle} />
          <textarea placeholder="Describe what you're asking for..." rows={3} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
          <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
            Signature target
            <input type="number" min={1} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} style={{ ...inputStyle, maxWidth: 140 }} />
          </label>
          <div><button style={button('primary')} onClick={create}>Create petition</button></div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {petitions.map(p => {
          const pct = Math.min(100, Math.round((p.signatures / p.target) * 100))
          return (
            <div key={p.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <h4 style={{ margin: '0 0 4px', color: C.navy }}>{p.title}</h4>
                {pct >= 100 && <span style={badge(C.success, C.successBg)}>🎉 Target reached</span>}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: C.text }}>{p.description}</p>
              <div style={{ background: C.neutralBg, borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: C.blue, transition: 'width .3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: C.textMuted }}>
                <span>{p.signatures} / {p.target} signatures ({pct}%) · by {p.createdBy} · {p.createdAt}</span>
                <button
                  style={p.signedByMe ? button('outline') : button('primary')}
                  disabled={p.signedByMe}
                  onClick={() => sign(p.id)}
                >
                  {p.signedByMe ? '✓ Signed' : 'Sign petition'}
                </button>
              </div>
            </div>
          )
        })}
        {petitions.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>No petitions yet for this project.</div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14
}
