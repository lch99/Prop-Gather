import { useEffect, useRef, useState } from 'react'
import { LANGUAGES, useI18n } from '../i18n'
import { C } from '../theme'

// Under each language's own name, what it is in English — for someone who
// landed on a language they can't read and is looking for their way back.
const SUBTITLES = { en: 'English', ms: 'Malay', zh: 'Chinese (Simplified)' }

// The header's language picker: a "🌐 BM ▾" pill that opens a small menu of
// big, clearly labelled rows. A native <select> was tried first; on desktop it
// drops a grey system list that looks nothing like the rest of the site.
//
// The accessible name is in all three languages on purpose. Someone who landed
// on the wrong one can't read a label written in it.
export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  // Closes on a tap anywhere else, and on Escape (focus goes back to the pill
  // so a keyboard user isn't dropped at the top of the page).
  useEffect(() => {
    if (!open) return
    const onPointer = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Opening puts focus on the language in use, so arrow keys start from there.
  useEffect(() => {
    if (open) itemRefs.current[LANGUAGES.findIndex(l => l.code === lang)]?.focus()
  }, [open, lang])

  const choose = (code) => {
    setOpen(false)
    triggerRef.current?.focus()
    if (code !== lang) setLang(code)
  }

  const onMenuKey = (e) => {
    const i = itemRefs.current.indexOf(document.activeElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + LANGUAGES.length) % LANGUAGES.length
      itemRefs.current[next]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        className="pg-lang"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language · Bahasa · 语言: ${current.label}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 11px', borderRadius: 9, fontSize: 14, fontWeight: 700,
          color: '#fff', background: open ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.40)', cursor: 'pointer'
        }}
      >
        <span aria-hidden="true">🌐</span>
        <span aria-hidden="true">{current.short}</span>
        <span aria-hidden="true" style={{
          fontSize: 10, opacity: 0.85, display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease'
        }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Language · Bahasa · 语言"
          onKeyDown={onMenuKey}
          className="pg-pop"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 70,
            width: 232, padding: 6, background: '#fff',
            border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadowLg
          }}
        >
          <div aria-hidden="true" style={{
            padding: '6px 10px 8px', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: C.textFaint
          }}>
            Language · Bahasa · 语言
          </div>
          {LANGUAGES.map((l, i) => {
            const selected = l.code === lang
            return (
              <button
                key={l.code}
                ref={el => { itemRefs.current[i] = el }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                lang={l.htmlLang}
                onClick={() => choose(l.code)}
                className="pg-lang-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 10px', border: 'none', borderRadius: 10, cursor: 'pointer',
                  textAlign: 'left', background: selected ? C.blueLight : 'transparent'
                }}
              >
                <span aria-hidden="true" style={{
                  minWidth: 38, height: 30, padding: '0 6px', borderRadius: 8, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800,
                  color: selected ? '#fff' : C.blue, background: selected ? C.blue : C.blueLight
                }}>
                  {l.short}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.navy, lineHeight: 1.25 }}>{l.label}</span>
                  {l.code !== 'en' && (
                    <span lang="en" style={{ display: 'block', fontSize: 12.5, color: C.textMuted, lineHeight: 1.3 }}>{SUBTITLES[l.code]}</span>
                  )}
                </span>
                <span aria-hidden="true" style={{ width: 18, color: C.blue, fontWeight: 900, fontSize: 15 }}>
                  {selected ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
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
