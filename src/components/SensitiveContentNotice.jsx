import { C } from '../theme'
import { sensitiveContentWarning } from '../sensitiveContent'

// Warns a resident that what they're typing contains a personal identifier
// (NRIC, payment card) before they post it somewhere every verified member of
// the community can read and that has no edit endpoint.
//
// Advisory only — the actual block is the backend's blockSensitiveContent
// middleware, which rejects the same inputs with a 400. Rendering nothing when
// the text is clean keeps this out of the way for the overwhelming majority of
// posts.
//
// Uses `warning` rather than `danger` colours on purpose: the resident hasn't
// done anything wrong, they're about to make a mistake we can still catch.
export default function SensitiveContentNotice({ values }) {
  const message = sensitiveContentWarning(...values)
  if (!message) return null

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        background: C.warningBg,
        border: `1px solid ${C.warning}33`,
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 13,
        lineHeight: 1.45,
        color: C.warning
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1.3 }}>⚠️</span>
      <span>{message}</span>
    </div>
  )
}

// Shared by the form components so "is this postable?" is decided in one place.
export function hasSensitiveContent(...values) {
  return sensitiveContentWarning(...values) !== null
}
