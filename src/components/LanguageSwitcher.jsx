import { LANGUAGES, useI18n } from '../i18n'

// The header's language picker. A native <select> under a small "🌐 BM ▾" pill:
// the pill fits beside the logo on a 360px phone, and the tap opens the phone's
// own full-screen picker with big, familiar rows, which suits older residents
// better than a custom dropdown would.
//
// The accessible name is in all three languages on purpose. Someone who landed
// on the wrong one can't read a label written in it.
export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useI18n()
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  return (
    <label
      className={`pg-lang ${className}`}
      title="Language · Bahasa · 语言"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        padding: '7px 11px',
        borderRadius: 9,
        fontSize: 14,
        fontWeight: 700,
        color: '#fff',
        background: 'rgba(255,255,255,0.16)',
        border: '1px solid rgba(255,255,255,0.40)',
        cursor: 'pointer'
      }}
    >
      <span aria-hidden="true">🌐</span>
      <span aria-hidden="true">{current.short}</span>
      <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.85 }}>▾</span>
      <select
        value={lang}
        onChange={e => setLang(e.target.value)}
        aria-label="Language · Bahasa · 语言"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0, cursor: 'pointer',
          // 16px keeps iOS Safari from zooming the page when the picker opens.
          fontSize: 16
        }}
      >
        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  )
}

// The same choice as plain links for the footer — the place people look for it
// when the header pill doesn't catch their eye.
export function LanguageLinks({ style }) {
  const { lang, setLang } = useI18n()
  return (
    <span style={style}>
      {LANGUAGES.map((l, i) => (
        <span key={l.code}>
          {i > 0 && ' · '}
          <button
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={lang === l.code}
            lang={l.htmlLang}
            style={{
              border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
              color: 'inherit', textDecoration: lang === l.code ? 'none' : 'underline',
              fontWeight: lang === l.code ? 700 : 400
            }}
          >
            {l.label}
          </button>
        </span>
      ))}
    </span>
  )
}
