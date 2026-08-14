import { useState } from 'react'
import { C, card } from '../theme'

export const MAX_FILES = 6
export const MAX_FILE_MB = 5
export const MAX_TOTAL_MB = 10
const ACCEPT = 'image/*,.pdf,.doc,.docx'

// Size errors name the actual size so "too big" is actionable rather than abstract.
const formatMb = (bytes) => (bytes / (1024 * 1024)).toFixed(1)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result })
  reader.onerror = reject
  reader.readAsDataURL(file)
})

// Shared attachment state + validation used by forum threads, chat and defect reports.
export function useAttachments(max = MAX_FILES) {
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')

  const addFiles = async (fileList) => {
    setError('')
    const files = Array.from(fileList)
    if (attachments.length + files.length > max) {
      const room = max - attachments.length
      // Three different situations, three different things to tell them: nothing
      // attached yet (state the cap), some room left (state the room), full
      // (tell them to remove one — "you can add 0 more" is not an instruction).
      setError(
        room === 0
          ? `You've already attached the maximum of ${plural(max, 'file')}. Remove one to add another.`
          : attachments.length === 0
            ? `You can attach up to ${plural(max, 'file')} here.`
            : `You can only add ${plural(room, 'more file')} — ${plural(max, 'file')} in total.`
      )
      return
    }
    const tooBig = files.find(f => f.size > MAX_FILE_MB * 1024 * 1024)
    if (tooBig) {
      setError(`"${tooBig.name}" is ${formatMb(tooBig.size)} MB — files need to be under ${MAX_FILE_MB} MB. Please pick a smaller one.`)
      return
    }
    const existingBytes = attachments.reduce((sum, a) => sum + (a.size || 0), 0)
    const newBytes = files.reduce((sum, f) => sum + f.size, 0)
    if (existingBytes + newBytes > MAX_TOTAL_MB * 1024 * 1024) {
      setError(`Your files add up to ${formatMb(existingBytes + newBytes)} MB — the total needs to stay under ${MAX_TOTAL_MB} MB. Please remove one or pick smaller files.`)
      return
    }
    try {
      const read = await Promise.all(files.map(readFile))
      setAttachments(a => [...a, ...read])
    } catch {
      setError("We couldn't open one of those files. Please try attaching it again.")
    }
  }

  const removeAttachment = (idx) => setAttachments(a => a.filter((_, i) => i !== idx))
  const reset = () => { setAttachments([]); setError('') }

  return { attachments, addFiles, removeAttachment, error, reset }
}

// Upload control: button + removable previews + inline error. For use inside a form.
export function AttachmentPicker({ attachments, addFiles, removeAttachment, error, label = 'Add photos or files', max = MAX_FILES, compact = false }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <label
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: compact ? '7px 12px' : '8px 14px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
            background: C.blueLight, color: C.blue, fontSize: 14, fontWeight: 600
          }}
        >
          📎 {label}
          <input
            type="file"
            multiple
            accept={ACCEPT}
            onChange={e => { addFiles(e.target.files); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </label>
        {!compact && (
          <div style={{ marginTop: 5, fontSize: 12, color: C.textFaint }}>
            Up to {plural(max, 'file')} · {MAX_FILE_MB} MB per file · {MAX_TOTAL_MB} MB total
          </div>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 13, color: C.danger, background: C.dangerBg, padding: '8px 10px', borderRadius: C.radiusSm }}>
          {error}
        </div>
      )}

      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {attachments.map((a, i) => (
            <div key={i} style={{ position: 'relative', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 6, background: C.bg }}>
              {a.type.startsWith('image/') ? (
                <img src={a.dataUrl} alt={a.name} style={{ display: 'block', width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 84, height: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 4 }}>
                  <span style={{ fontSize: 24 }}>📄</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 76 }}>{a.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                aria-label={`Remove ${a.name}`}
                style={{
                  position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 999,
                  border: 'none', background: C.danger, color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Read-only display of attachments on a posted item.
export function AttachmentList({ attachments, thumb = 120, style }) {
  if (!attachments?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, ...style }}>
      {attachments.map((a, i) => (
        a.type?.startsWith('image/') ? (
          <a key={i} href={a.dataUrl} target="_blank" rel="noreferrer" title={a.name}>
            <img
              src={a.dataUrl}
              alt={a.name}
              style={{ display: 'block', width: thumb, height: thumb, objectFit: 'cover', borderRadius: C.radiusSm, border: `1px solid ${C.border}` }}
            />
          </a>
        ) : (
          <a
            key={i}
            href={a.dataUrl}
            download={a.name}
            title={a.name}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              border: `1px solid ${C.border}`, borderRadius: C.radiusSm, background: C.bg,
              fontSize: 13, color: C.blue, fontWeight: 600, textDecoration: 'none', maxWidth: 220
            }}
          >
            <span>📄</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
          </a>
        )
      ))}
    </div>
  )
}
