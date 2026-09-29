import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card, button, badge } from '../../../theme'
import { useT } from '../../../i18n'
import { LoadingInline } from '../../../components/Loading'
import SensitiveContentNotice, { hasSensitiveContent } from '../../../components/SensitiveContentNotice'

export default function PetitionsPanel({ projectId }) {
  const t = useT()
  const [petitions, setPetitions] = useState(null) // null = still loading
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target: 100 })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Which petition is mid-signature, so a slow tap can't be fired twice and the
  // list can show it as pending rather than just sitting there.
  const [signingId, setSigningId] = useState(null)

  const load = () => api.getPetitions(projectId).then(setPetitions).catch(() => setPetitions([]))
  useEffect(() => { load() }, [projectId])

  const sign = async (id) => {
    if (signingId) return
    setSigningId(id)
    setError('')
    try {
      const updated = await api.signPetition(projectId, id)
      setPetitions(ps => (ps || []).map(p => p.id === updated.id ? updated : p))
    } catch (err) {
      setError(err.message || t("We couldn't record your signature just now. Please try again."))
    } finally {
      setSigningId(null)
    }
  }

  const create = async () => {
    if (saving) return
    if (!form.title.trim() || !form.description.trim() || !form.target) {
      setError(t('Please add a title, a description and a signature target to continue.'))
      return
    }
    if (hasSensitiveContent(form.title, form.description)) return
    setError('')
    setSaving(true)
    try {
      await api.createPetition(projectId, form)
      setForm({ title: '', description: '', target: 100 })
      setShowNew(false)
      load()
    } catch (err) {
      setError(err.message || t("We couldn't create that petition just now. Please try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: '1 1 220px' }}>
          <h3 style={{ margin: 0, color: C.navy }}>{t('Petitions')}</h3>
          <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>
            {t('Create or sign a petition. Completed petitions can be exported as a signed PDF for the developer, JMB, or KPKT.')}
          </p>
        </div>
        <button style={button('primary')} onClick={() => setShowNew(s => !s)}>+ {t('New petition')}</button>
      </div>

      {showNew && (
        <div style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gap: 10 }}>
          <input placeholder={t('Petition title')} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={inputStyle} />
          <textarea placeholder={t("Describe what you're asking for...")} rows={3} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
          <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
            {t('Signature target')}
            <input type="number" min={1} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} style={{ ...inputStyle, maxWidth: 140 }} />
          </label>
          <SensitiveContentNotice values={[form.title, form.description]} />
          {error && (
            <div role="alert" style={{ fontSize: 13, color: C.danger, background: C.dangerBg, padding: '8px 10px', borderRadius: C.radiusSm }}>
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
              {saving ? t('Creating…') : t('Create petition')}
            </button>
          </div>
        </div>
      )}

      {!showNew && error && (
        <div role="alert" style={{
          fontSize: 13, color: C.danger, background: C.dangerBg, padding: '8px 10px',
          borderRadius: C.radiusSm, marginBottom: 14
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {petitions === null && <LoadingInline />}
        {petitions?.map(p => {
          const pct = Math.min(100, Math.round((p.signatures / p.target) * 100))
          return (
            <div key={p.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <h4 style={{ margin: '0 0 4px', color: C.navy }}>{p.title}</h4>
                {pct >= 100 && <span style={badge(C.success, C.successBg)}>🎉 {t('Target reached')}</span>}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: C.text }}>{p.description}</p>
              <div style={{ background: C.neutralBg, borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: C.blue, transition: 'width .3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 13, color: C.textMuted }}>
                <span>
                  {t('{signed} / {target} signatures ({pct}%) · by {name} · {date}', {
                    signed: p.signatures, target: p.target, pct, name: p.createdBy, date: p.createdAt
                  })}
                </span>
                <button
                  style={{
                    ...(p.signedByMe ? button('outline') : button('primary')),
                    ...(signingId === p.id ? { opacity: 0.7, cursor: 'wait' } : {})
                  }}
                  disabled={p.signedByMe || signingId === p.id}
                  onClick={() => sign(p.id)}
                >
                  {p.signedByMe ? `✓ ${t('Signed')}` : signingId === p.id ? t('Signing…') : t('Sign petition')}
                </button>
              </div>
            </div>
          )
        })}
        {petitions?.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>{t('No petitions yet for this project.')}</div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14
}
