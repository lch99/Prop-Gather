import { C } from '../theme'
import { useT } from '../i18n'

// What a resident sees while something is on its way: a page chunk, a
// community, a tab's content. A bare "Loading…" line on an empty page reads as
// broken to someone who isn't sure the tap worked; a moving brand mark says
// "it's coming".
//
// role="status" so a screen reader announces it once, politely. Lists that
// already have a skeleton (Discover) keep it — that shows the shape of what's
// coming, which is better still.

export function Spinner({ size = 22, stroke = 3, color = C.blue }) {
  return (
    <span
      aria-hidden="true"
      className="pg-spin"
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        borderRadius: '50%', border: `${stroke}px solid ${C.blueLight}`, borderTopColor: color
      }}
    />
  )
}

// Fills the page area: used for a whole page or a whole tab.
export default function LoadingScreen({ label, minHeight = '50vh' }) {
  const t = useT()
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: 24, color: C.textMuted, textAlign: 'center'
      }}
    >
      <div style={{ position: 'relative', width: 76, height: 76 }}>
        <Spinner size={76} stroke={4} />
        <div className="pg-breathe" style={{
          position: 'absolute', inset: 12, borderRadius: 16, background: '#fff',
          boxShadow: C.shadow, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8
        }}>
          <img
            src={`${import.meta.env.BASE_URL}brand/propgather-icon.png`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{label ?? t('Loading…')}</div>
    </div>
  )
}

// One line inside a card or list — replies, messages, a small panel.
export function LoadingInline({ label, style }) {
  const t = useT()
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, color: C.textMuted, fontSize: 14, ...style }}
    >
      <Spinner />
      <span>{label ?? t('Loading…')}</span>
    </div>
  )
}
