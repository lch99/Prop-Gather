import { useEffect, useState } from 'react'
import { api } from '../api'
import { C, card, button } from '../theme'

// The one place sharing lives. Discover, My Communities, the admin overview and
// the project hero all open the same sheet, so the wording a resident sends to
// their neighbours is identical wherever they tapped Share from.
//
// Two things make this more than a row of links:
//
//   * WhatsApp comes first, deliberately. This is a Malaysian product and the
//     group chat it is trying to replace is almost always a WhatsApp one, so the
//     shortest path to a share is the first thing under the thumb.
//   * Every destination is reported to POST /api/projects/:id/share, and the
//     arrival on the other end to /share-visit (see ProjectPage). Without that
//     pair, "sharing brings people in" stays an assumption — with it, an admin
//     reads shares sent against links opened, per community.
//
// Reporting never blocks a share: it is fired without awaiting and its failure
// is swallowed, because a counter is not worth costing someone the share they
// were trying to send.

// Short and readable — the kind of link someone will actually paste into a
// family chat. `/s/:id` is answered by the backend with per-community Open Graph
// tags when nginx routes it there (backend/src/routes/sharePreview.js), and by
// the app's own redirect route otherwise; both land on the community page.
//
// BASE_URL, not a hardcoded '/': the GitHub Pages build serves the app from a
// subpath, and a link that drops it 404s.
export function communityShareUrl(projectId) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/+$/, '')
  return `${base}/s/${projectId}`
}

// Deliberately not written in the first person ("join me…"): the same sheet is
// opened by verified residents, by people still deciding whether to join, and by
// admins, and only the first of those could honestly claim to live there.
export function shareMessage(project) {
  const where = [project.city, project.state].filter(Boolean).join(', ')
  return `${project.name} is on PropGather${where ? ` (${where})` : ''} — the private, residents-only space for this building: forum, chat, defect reports, documents and community polls, for verified owners and residents.`
}

const shareSubject = (project) => `${project.name} on PropGather`

// Tints are deepened past each brand's raw hue for the same reason theme.js
// deepens its chip colours: white has to stay legible on them for older eyes.
const CHANNELS = [
  {
    key: 'whatsapp', label: 'WhatsApp', icon: '💬', tint: '#1E8E4E',
    href: ({ url, text }) => `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`
  },
  {
    key: 'telegram', label: 'Telegram', icon: '✈️', tint: '#1E7FAF',
    href: ({ url, text }) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  },
  {
    key: 'facebook', label: 'Facebook', icon: '👍', tint: '#1256A8',
    href: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  },
  {
    key: 'x', label: 'X', icon: '𝕏', tint: '#20242A',
    href: ({ url, text }) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  },
  {
    // sameTab: a mailto: opened in a new tab hands the message to the mail
    // client and then leaves an empty tab sitting behind it.
    key: 'email', label: 'Email', icon: '✉️', tint: '#4B5563', sameTab: true,
    href: ({ url, text, subject }) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
  }
]

// Fire-and-forget. A share that happened but wasn't counted is a lost data
// point; a share blocked because counting failed is a lost visitor.
function report(projectId, channel) {
  api.recordShare(projectId, channel).catch(() => {})
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // The async clipboard needs a secure context and a permission an in-app
    // browser (Facebook's, Instagram's) may not grant. The selection-based
    // fallback below still works in those.
  }
  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.top = '0'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}

function ShareSheet({ project, onClose }) {
  const [copied, setCopied] = useState(false)
  const url = communityShareUrl(project.id)
  const text = shareMessage(project)
  const subject = shareSubject(project)
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2200)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    const ok = await copyToClipboard(url)
    setCopied(ok)
    if (ok) report(project.id, 'copy')
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: subject, text, url })
      report(project.id, 'native')
      onClose()
    } catch {
      // Dismissing the OS sheet rejects too, and that is not a share — leaving
      // this sheet open lets them pick a destination here instead.
    }
  }

  const tile = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    padding: '13px 6px', borderRadius: C.radiusSm, border: `1px solid ${C.border}`,
    background: '#fff', color: C.navy, fontSize: 13.5, fontWeight: 700, textAlign: 'center'
  }
  const tileIcon = (background) => ({
    width: 38, height: 38, borderRadius: '50%', background, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
  })

  return (
    <div
      className="pg-share-backdrop"
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,10,30,0.55)', zIndex: 1100,
        display: 'flex', justifyContent: 'center'
      }}
    >
      <div
        className="pg-share-sheet pg-pop"
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${project.name}`}
        onClick={e => e.stopPropagation()}
        style={{ ...card, padding: 22, position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <button
          onClick={onClose}
          aria-label="Close share options"
          style={{
            position: 'absolute', top: 12, right: 14, border: 'none', background: 'none',
            fontSize: 22, cursor: 'pointer', color: C.textMuted, lineHeight: 1
          }}
        >×</button>

        <h3 style={{ margin: '0 0 4px', color: C.navy, fontSize: 19, paddingRight: 28 }}>Share this community</h3>
        <p style={{ margin: '0 0 16px', color: C.textMuted, fontSize: 14, lineHeight: 1.55 }}>
          Send <strong style={{ color: C.navy }}>{project.name}</strong> to your neighbours. Anyone can open the
          link — only verified residents can see what's inside.
        </p>

        <div className="pg-share-grid">
          {CHANNELS.map(ch => (
            <a
              key={ch.key}
              href={ch.href({ url, text, subject })}
              {...(ch.sameTab ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              onClick={() => report(project.id, ch.key)}
              style={tile}
            >
              <span aria-hidden="true" style={tileIcon(ch.tint)}>{ch.icon}</span>
              {ch.label}
            </a>
          ))}

          {canUseNativeShare && (
            <button onClick={handleNativeShare} style={tile}>
              <span aria-hidden="true" style={tileIcon(C.blue)}>➕</span>
              More apps
            </button>
          )}
        </div>

        <div style={{
          marginTop: 16, border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
          background: C.bg, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 13, color: C.textMuted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{url}</span>
          <button
            onClick={handleCopy}
            style={{
              ...button(copied ? 'success' : 'secondary'), fontSize: 13, padding: '8px 14px',
              flexShrink: 0, color: copied ? '#fff' : C.blue
            }}
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>

        <p style={{ margin: '12px 0 0', color: C.textFaint, fontSize: 12, lineHeight: 1.5 }}>
          The link opens this community's public page. The forum, chat and documents inside stay private
          to verified residents.
        </p>
      </div>
    </div>
  )
}

// `variant`:
//   'hero' — translucent pill for use on the blue gradient headers
//   'icon' — 36px circle for dense card layouts
//   anything else is passed through to theme's button()
export default function ShareButton({ project, variant = 'outline', label = 'Share', style }) {
  const [open, setOpen] = useState(false)

  // Discover renders these inside a card that opens the community on click, so a
  // share tap must not also trigger that.
  const openSheet = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  const variantStyles = {
    // Solid white on the gradient, like the active nav item in Layout — the
    // badges beside it in the hero are translucent glass, and an action that
    // looks like the labels around it doesn't get tapped.
    hero: {
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800,
      color: C.blue, background: '#fff', border: 'none',
      borderRadius: 999, padding: '6px 15px', whiteSpace: 'nowrap',
      boxShadow: '0 2px 10px rgba(0,0,0,0.14)', cursor: 'pointer'
    },
    icon: {
      width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.border}`,
      background: '#fff', color: C.blue, fontSize: 16, lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      flexShrink: 0, padding: 0
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={`Share ${project.name}`}
        style={{ ...(variantStyles[variant] || button(variant)), ...style }}
      >
        {variant === 'icon' ? <span aria-hidden="true">🔗</span> : <>📣 {label}</>}
      </button>
      {open && <ShareSheet project={project} onClose={() => setOpen(false)} />}
    </>
  )
}
