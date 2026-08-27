// Client-side SEO: per-route <title>, meta description, canonical, Open Graph,
// Twitter cards, and JSON-LD.
//
// The app is a client-rendered SPA, so there is no server to render these into
// the HTML. Google executes JavaScript and picks up what this sets, but social
// crawlers (WhatsApp, Facebook, Telegram, X) do NOT — they read the raw HTML
// and stop. That is why index.html carries a full, static set of the same tags
// describing the site as a whole: it is the card every shared link falls back
// to. What this module does is *overwrite* those tags once React is running,
// so Google sees per-page values.
//
// Practical consequence: a link shared to WhatsApp always previews as the
// site-level card from index.html, whatever page it points at. Making
// per-page previews work would need prerendering or SSR — see "SEO" in
// DEPLOYMENT.md.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// The canonical origin. Canonical/OG URLs must be absolute and must point at
// the real public site, never at localhost or the GitHub Pages mirror —
// otherwise the mirror competes with production for the same keywords.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://propgather.com.my').replace(/\/+$/, '')
export const SITE_NAME = 'PropGather.com.my'
export const DEFAULT_TITLE = "PropGather.com.my — Malaysia's Verified Property Community"
export const DEFAULT_DESCRIPTION =
  'A private, verified space for the residents of your Malaysian condo or housing project — ' +
  'forum, chat, polls, defect tracking, documents, and fees. Free to browse; join your own community once verified.'

// og:image should be an absolute URL and ideally 1200×630. This is the 256×256
// brand mark, which previews as a small square thumbnail — replace it with a
// proper 1200×630 og-image.png when there is one and update this constant.
export const DEFAULT_IMAGE = `${SITE_URL}/brand/propgather-icon.png`

const TITLE_SUFFIX = ` · ${SITE_NAME}`

/**
 * Absolute URL for a route path, for canonical/og:url.
 *
 * The homepage keeps its trailing slash (`https://propgather.com.my/`) and every
 * other path drops one, so a single page never advertises two spellings of its
 * own canonical URL.
 */
export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_URL}/`
  const withSlash = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${withSlash}`.replace(/\/+$/, '')
}

/**
 * Create or update a tag in <head>, matched by `selector` so the static tags
 * already in index.html get reused rather than duplicated.
 */
function upsert(selector, tagName, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(tagName)
    el.setAttribute('data-pg-seo', '')
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function setMetaByName(name, content) {
  upsert(`meta[name="${name}"]`, 'meta', { name, content })
}

function setMetaByProperty(property, content) {
  upsert(`meta[property="${property}"]`, 'meta', { property, content })
}

/**
 * Replace the page-level JSON-LD block. Passing null removes it, which matters
 * because these tags outlive a route change — stale structured data describing
 * the previous page is worse than none.
 */
function setJsonLd(data) {
  const existing = document.head.querySelector('script[data-pg-seo="jsonld-page"]')
  if (!data) {
    if (existing) existing.remove()
    return
  }
  const el = existing || document.head.appendChild(
    Object.assign(document.createElement('script'), { type: 'application/ld+json' })
  )
  el.setAttribute('data-pg-seo', 'jsonld-page')
  el.textContent = JSON.stringify(data)
}

/**
 * Declare the SEO metadata for a page. Render one per route, near the top of
 * the page component.
 *
 * @param {string}  [title]       Page title; the site name is appended unless `bareTitle`.
 * @param {boolean} [bareTitle]   Use `title` verbatim (the landing page owns the full title).
 * @param {string}  [description] Meta description — aim for 120–160 characters.
 * @param {string}  [path]        Canonical path; defaults to the current pathname.
 * @param {boolean} [noindex]     Keep out of search results (private/duplicate pages).
 * @param {object}  [jsonLd]      Schema.org structured data for this page.
 * @param {string}  [image]       Absolute og:image URL.
 * @param {string}  [type]        og:type, default 'website'.
 */
export default function Seo({
  title,
  bareTitle = false,
  description = DEFAULT_DESCRIPTION,
  path,
  noindex = false,
  jsonLd = null,
  image = DEFAULT_IMAGE,
  type = 'website'
}) {
  const location = useLocation()
  const canonicalPath = path || location.pathname
  const url = absoluteUrl(canonicalPath)
  const fullTitle = !title ? DEFAULT_TITLE : bareTitle ? title : `${title}${TITLE_SUFFIX}`
  // Objects are new on every render; serialising keeps the effect from re-running
  // (and rewriting the whole head) on each parent re-render.
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    document.title = fullTitle
    setMetaByName('description', description)
    // Always written, never merely omitted: these persist across route changes,
    // so leaving a previous page's noindex in place would silently drop this
    // page from search results.
    setMetaByName('robots', noindex ? 'noindex, follow' : 'index, follow')
    upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: url })

    setMetaByProperty('og:title', fullTitle)
    setMetaByProperty('og:description', description)
    setMetaByProperty('og:url', url)
    setMetaByProperty('og:image', image)
    setMetaByProperty('og:type', type)
    setMetaByProperty('og:site_name', SITE_NAME)

    setMetaByName('twitter:card', 'summary_large_image')
    setMetaByName('twitter:title', fullTitle)
    setMetaByName('twitter:description', description)
    setMetaByName('twitter:image', image)

    setJsonLd(jsonLdKey ? JSON.parse(jsonLdKey) : null)
  }, [fullTitle, description, url, noindex, image, type, jsonLdKey])

  // Structured data is removed on unmount so it cannot leak onto the next page;
  // the plain meta tags are left for the next <Seo> to overwrite, which avoids a
  // flash of title-less document between routes.
  useEffect(() => () => setJsonLd(null), [])

  return null
}
