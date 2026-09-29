// Site language: English, Bahasa Melayu and Simplified Chinese.
//
// English is the source language — the strings in the components ARE the keys:
//
//   t('Log in')                                   → 'Log masuk' / '登录'
//   t('Unit {unit}', { unit: c.unit })            → placeholders, filled after lookup
//   t('Read our {link}.', { link: <Link …/> })    → an element placeholder returns an
//                                                   array React can render, so word order
//                                                   is the translation's, not English's
//
// Anything without a translation falls back to the English it was called with,
// so a missing entry costs polish, never a blank button. That fallback is also
// what translates the backend: its error messages are resident-facing English
// (see ApiError in apiClient.js), so the ones listed in src/locales/*.js are
// looked up like any other string, and the rest arrive in English.
//
// Only the language in use is downloaded: English needs no dictionary, and
// ms/zh are separate chunks. main.jsx loads the stored choice before the first
// render so a returning Chinese reader never sees an English flash.
//
// There is no per-language URL, so Google indexes the English page only. That is
// deliberate for now — hreflang would need /ms/… and /zh/… routes.
//
// Module-level strings (nav items, FAQ lists) are wrapped in msg() so
// scripts/check-i18n.mjs can find them; they are translated with t() at render.

import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', htmlLang: 'en-MY', locale: 'en-MY' },
  { code: 'ms', label: 'Bahasa Melayu', short: 'BM', htmlLang: 'ms-MY', locale: 'ms-MY' },
  { code: 'zh', label: '中文', short: '中文', htmlLang: 'zh-Hans-MY', locale: 'zh-Hans-MY' }
]

const CODES = LANGUAGES.map(l => l.code)
const STORAGE_KEY = 'pg_lang'

const loaders = {
  ms: () => import('./locales/ms.js'),
  zh: () => import('./locales/zh.js')
}

const dictionaries = { en: {} }

// Marks a module-level string for translation without translating it — the
// component calls t() on it at render, when the language is known.
export const msg = (s) => s

function storedLanguage() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return CODES.includes(v) ? v : null
  } catch {
    return null
  }
}

// A visitor who has never chosen gets the language their phone is set to, when
// it's one we have. `id` counts as Malay: Indonesian is close enough to read,
// and a phone set to it in Malaysia is almost always a Malay speaker's.
export function initialLanguage() {
  const stored = storedLanguage()
  if (stored) return stored
  const prefs = typeof navigator !== 'undefined' ? (navigator.languages || [navigator.language]) : []
  for (const p of prefs) {
    const tag = (p || '').toLowerCase()
    if (tag.startsWith('en')) return 'en'
    if (tag.startsWith('ms') || tag.startsWith('id')) return 'ms'
    if (tag.startsWith('zh')) return 'zh'
  }
  return 'en'
}

export async function loadLanguage(code) {
  if (dictionaries[code] || !loaders[code]) return
  dictionaries[code] = (await loaders[code]()).default
}

let current = 'en'

function applyToDocument(code) {
  const meta = LANGUAGES.find(l => l.code === code)
  if (meta && typeof document !== 'undefined') document.documentElement.lang = meta.htmlLang
}

// Dev-only: say once per string what still needs translating, so a new label
// doesn't ship English-only unnoticed. scripts/check-i18n.mjs is the full audit.
const warned = new Set()

function lookup(code, key) {
  const dict = dictionaries[code]
  if (!dict || code === 'en') return key
  const hit = dict[key]
  if (hit !== undefined) return hit
  if (import.meta.env.DEV && typeof key === 'string' && key && !warned.has(`${code}:${key}`)) {
    warned.add(`${code}:${key}`)
    // eslint-disable-next-line no-console
    console.warn(`[i18n] no ${code} translation for:`, key)
  }
  return key
}

function fill(template, vars) {
  if (!vars) return template
  const parts = template.split(/\{(\w+)\}/)
  let hasElement = false
  const out = parts.map((part, i) => {
    if (i % 2 === 0) return part
    if (!(part in vars)) return `{${part}}`
    const v = vars[part]
    if (isValidElement(v)) {
      hasElement = true
      return cloneElement(v, { key: `${part}-${i}` })
    }
    return v
  })
  return hasElement ? out.filter(p => p !== '') : out.join('')
}

function translateIn(code, key, vars) {
  if (typeof key !== 'string') return key
  return fill(lookup(code, key), vars)
}

// For code that runs outside React (apiClient.js building an error message).
// Uses whichever language is active when it runs.
export function translate(key, vars) {
  return translateIn(current, key, vars)
}

const I18nContext = createContext(null)

export function I18nProvider({ initial = 'en', children }) {
  const [lang, setLangState] = useState(() => (dictionaries[initial] ? initial : 'en'))
  current = lang

  useEffect(() => {
    current = lang
    applyToDocument(lang)
  }, [lang])

  const setLang = useCallback(async (code) => {
    if (!CODES.includes(code)) return
    try {
      await loadLanguage(code)
    } catch {
      // Offline, or a tab still on an older deploy whose chunk is gone. Staying
      // on the current language beats switching to a half-empty one.
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // Storage refused — the choice still holds for this visit.
    }
    current = code
    setLangState(code)
  }, [])

  const value = useMemo(() => {
    const meta = LANGUAGES.find(l => l.code === lang)
    const t = (key, vars) => translateIn(lang, key, vars)
    return {
      lang,
      setLang,
      t,
      locale: meta.locale,
      // Dates and times in the reader's language; the rest of the options are the caller's.
      formatDate: (value, options) => {
        const d = value instanceof Date ? value : new Date(value)
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(meta.locale, options)
      }
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}

export function useT() {
  return useI18n().t
}
