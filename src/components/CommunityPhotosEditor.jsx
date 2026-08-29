import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { C, card, button } from '../theme'
import { CommunityAvatar, CommunityCover } from './CommunityImage'

// Admin-only editor for a community's profile picture and cover photo.
//
// Deliberately not built on useAttachments/AttachmentPicker: those read a file
// into a base64 data URL for posting inline, and these bytes go straight to
// object storage instead (see api.uploadProjectImage). A cover photo off a phone
// is several megabytes, so base64-ing it only to decode it again before the PUT
// is a detour that costs the admin real seconds on a Malaysian mobile connection.

// Mirrors ALLOWED_IMAGE_TYPES / MAX_IMAGE_MB in backend/src/routes/projects.js.
// Checked here too so a bad pick fails instantly rather than after an upload.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
const MAX_MB = 8

const SLOTS = [
  {
    kind: 'logo',
    title: 'Profile picture',
    hint: 'Shown beside the community name everywhere it appears. A square logo or building photo works best — around 400 × 400.',
    urlField: 'logoUrl'
  },
  {
    kind: 'cover',
    title: 'Cover photo',
    hint: 'The banner across the top of the community. A wide shot of the development — around 1600 × 600.',
    urlField: 'coverUrl'
  }
]

const formatMb = (bytes) => (bytes / (1024 * 1024)).toFixed(1)

function Slot({ project, slot, busy, onPick, onRemove }) {
  const has = !!project[slot.urlField]

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 14, background: C.bg }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 3 }}>{slot.title}</div>
      <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5, marginBottom: 11 }}>{slot.hint}</div>

      {/* Preview uses the same components the rest of the app renders with, so
          what an admin approves here is literally what residents will see. */}
      <div style={{ position: 'relative', marginBottom: 11 }}>
        {slot.kind === 'logo' ? (
          <CommunityAvatar project={project} size={84} radius={16} />
        ) : (
          <CommunityCover project={project} height={104} style={{ borderRadius: C.radiusSm }} />
        )}
        {busy && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: C.radiusSm,
            background: 'rgba(255,255,255,0.78)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.blue
          }}>
            Uploading…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{
          ...button('secondary'),
          display: 'inline-flex', alignItems: 'center', gap: 7,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontSize: 13, padding: '8px 14px'
        }}>
          📷 {has ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            disabled={busy}
            onChange={e => { onPick(e.target.files?.[0]); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </label>
        {has && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            style={{ ...button('outline'), color: C.danger, fontSize: 13, padding: '8px 14px', opacity: busy ? 0.6 : 1 }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * @param {object}   project    The community being edited.
 * @param {Function} onUpdated  Called with the updated project after every save
 *                              or removal — the parent owns the list, and each
 *                              action is committed on its own, so it must not
 *                              wait for the modal to close.
 * @param {Function} onClose
 */
export default function CommunityPhotosEditor({ project, onUpdated, onClose }) {
  const { user } = useAuth()
  const [busyKind, setBusyKind] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busyKind) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busyKind])

  const run = async (kind, action) => {
    setError('')
    setBusyKind(kind)
    try {
      onUpdated(await action())
    } catch (err) {
      setError(err.message || "We couldn't save that photo just now. Please try again.")
    } finally {
      setBusyKind(null)
    }
  }

  const pick = (kind) => (file) => {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPG, PNG, WebP or GIF image.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`"${file.name}" is ${formatMb(file.size)} MB — images need to be under ${MAX_MB} MB. Please pick a smaller one.`)
      return
    }
    run(kind, () => api.uploadProjectImage(project.id, kind, file, user?.role))
  }

  const remove = (kind, title) => () => {
    if (!window.confirm(`Remove the ${title.toLowerCase()} for ${project.name}?`)) return
    run(kind, () => api.removeProjectImage(project.id, kind, user?.role))
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,10,30,0.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto'
      }}
      onClick={() => { if (!busyKind) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Photos for ${project.name}`}
        style={{ ...card, width: '100%', maxWidth: 520, padding: 24, position: 'relative', margin: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          disabled={!!busyKind}
          style={{
            position: 'absolute', top: 14, right: 16, border: 'none', background: 'none',
            fontSize: 20, cursor: 'pointer', color: C.textMuted, lineHeight: 1
          }}
        >×</button>

        <h3 style={{ margin: '0 0 4px', color: C.navy, fontSize: 18 }}>🖼️ Photos — {project.name}</h3>
        <p style={{ margin: '0 0 16px', color: C.textMuted, fontSize: 13, lineHeight: 1.55 }}>
          These are public: they appear in the directory, on the community page, and on the preview card
          when someone shares this community. Each change saves as soon as you pick a file.
        </p>

        {error && (
          <div role="alert" style={{
            marginBottom: 14, padding: '9px 12px', borderRadius: C.radiusSm,
            background: C.dangerBg, color: C.danger, fontSize: 13, lineHeight: 1.5
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {SLOTS.map(slot => (
            <Slot
              key={slot.kind}
              project={project}
              slot={slot}
              busy={busyKind === slot.kind}
              onPick={pick(slot.kind)}
              onRemove={remove(slot.kind, slot.title)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={!!busyKind} style={{ ...button('primary'), opacity: busyKind ? 0.6 : 1 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
