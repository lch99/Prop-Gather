import { useState } from 'react'
import { mediaUrl } from '../api'
import { C, typeChipColor } from '../theme'

// A community's two photos, and the fallbacks for the many communities that
// have neither. Both are read-only — uploading is admin-only and lives in
// CommunityPhotosEditor.jsx.
//
// `project.logoUrl` / `project.coverUrl` are paths the API returns (see
// communityImagePath in backend/src/util/serialize.js) and are simply absent
// when unset, so every check here is a plain truthiness test.
//
// Both components fall back on an <img> error as well as on a missing URL. The
// image is served by a redirect to object storage, and a photo that 404s or a
// signature that has gone stale must land on the same tidy initial the
// directory showed before photos existed — never a broken-image icon.

export function CommunityAvatar({ project, size = 44, radius = 12, style }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : mediaUrl(project?.logoUrl)
  // Same mapping the type badge beside it uses, so the fallback tile reads as
  // part of the card rather than as a stray colour.
  const [ctext, cbg] = typeChipColor(project?.type || '')

  const base = {
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
    ...style
  }

  if (src) {
    return (
      <div style={{ ...base, background: C.neutralBg }}>
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  return (
    <div style={{
      ...base,
      background: cbg, color: ctext,
      fontWeight: 800, fontSize: Math.round(size * 0.42)
    }}>
      {(project?.name || '?').charAt(0)}
    </div>
  )
}

// Banner strip above a community card, or behind a modal header. Without a photo
// it is the same brand gradient the cards already used, so a community that has
// not uploaded one still looks finished.
//
// Anything drawn on top of the photo is why a scrim is painted over it: white
// text on an arbitrary daytime photo of a building has no contrast guarantee at
// all, and this app is read by older eyes on phones outdoors. The default darkens
// towards the bottom, which suits a card banner with nothing on it; pass `scrim`
// to override where text sits across the whole image (the community hero does).
const CARD_SCRIM = 'linear-gradient(180deg, rgba(18,42,68,0.10) 0%, rgba(18,42,68,0.62) 100%)'

// Even and heavy, for a photo used as the backdrop to a full heading block.
export const HERO_SCRIM = 'linear-gradient(180deg, rgba(18,42,68,0.72) 0%, rgba(18,42,68,0.78) 100%)'

// `loading` is 'eager' for the one cover that is the page's own hero image —
// lazy-loading what the visitor is already looking at only delays it.
export function CommunityCover({ project, height = 104, children, style, scrim = CARD_SCRIM, loading = 'lazy' }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : mediaUrl(project?.coverUrl)

  return (
    <div style={{
      position: 'relative', height, flexShrink: 0, overflow: 'hidden',
      background: C.headerGradient, ...style
    }}>
      {src && (
        <img
          src={src}
          alt=""
          loading={loading}
          onError={() => setFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {src && <div style={{ position: 'absolute', inset: 0, background: scrim }} />}
      {children && (
        <div style={{ position: 'relative', height: '100%' }}>{children}</div>
      )}
    </div>
  )
}
