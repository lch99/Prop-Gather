import { Router } from 'express'
import { getDb } from '../db/index.js'
import { wrap } from '../util/asyncHandler.js'

// The public face of the share sheet: GET /s/:projectId.
//
// Why this exists at all. The frontend is a Vite SPA — one index.html whose
// <title> and Open Graph tags are fixed at build time — and WhatsApp, Facebook
// and Telegram build their preview card by fetching the URL and reading the
// HTML *without running JavaScript*. So a shared link to /project/p1 previews as
// the generic site card no matter what the app renders afterwards (src/seo.jsx
// says the same thing from the other side). This route answers the same request
// with per-community tags, then bounces a real browser on to the app.
//
// It is mounted OUTSIDE /api (see app.js) because the whole point is a short,
// human-readable link a resident is willing to paste into a family group chat.
//
// Deployment note: nginx serves the built frontend and proxies /api to this
// process. Until /s/ is proxied here too (DEPLOYMENT.md 2.8b), the SPA's own
// /s/:id route handles the link — visitors still land in the right place, they
// just get the generic preview card. Nothing breaks either way.
export const sharePreviewRouter = Router()

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

// Community names and addresses are admin-entered free text that lands inside
// both HTML text and quoted attribute values here, so escape for both.
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

// Same value, but safe to sit inside <script>. JSON quoting alone is not enough:
// a literal `</script>` anywhere in the string ends the block early, and the rest
// of it is then parsed as HTML.
const jsString = (value) => JSON.stringify(String(value))
  .replace(/</g, '\\u003C')
  .replace(/>/g, '\\u003E')
  .replace(/&/g, '\\u0026')

// Hostnames and an optional port, nothing else. The Host header is client
// controlled — nginx forwards whatever arrived unless a server_name matched
// first — and it is about to be written into this page's canonical and og:url.
const HOST_PATTERN = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/

// Absolute URLs are mandatory in Open Graph tags — a crawler has no page context
// to resolve a relative one against.
//
// PUBLIC_SITE_URL is the override for a split deployment, where this process is
// reached on a different hostname than the one residents see. With frontend and
// API on one origin (the current production shape) the request's own headers are
// already right, and one fewer variable can be wrong.
//
// Returns null for a Host this can't vouch for, which the route turns into a 400
// rather than reflecting it back inside a tag.
function siteOrigin(req) {
  const configured = process.env.PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/+$/, '')

  const host = req.headers.host || ''
  if (!HOST_PATTERN.test(host)) return null

  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim()
  return `${proto === 'http' ? 'http' : 'https'}://${host}`
}

// `canonical` and `url` are absolute because crawlers require it; `redirectPath`
// stays relative, so the only place a hostname reaches the browser's navigation
// is one this origin already controls.
function page({ title, description, canonical, url, image, redirectPath }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="PropGather.com.my">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:locale" content="en_MY">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(redirectPath)}">
</head>
<body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#F7FAFD;color:#20242A">
<div style="max-width:520px;margin:0 auto;padding:64px 24px;text-align:center">
<p style="font-size:16px;line-height:1.6;color:#4B5563">Opening ${esc(title)} on PropGather…</p>
<p><a href="${esc(redirectPath)}" style="color:#4081C6;font-weight:700">Continue to PropGather</a></p>
</div>
<script>location.replace(${jsString(redirectPath)})</script>
</body>
</html>`
}

sharePreviewRouter.get('/:id', wrap(async (req, res) => {
  const origin = siteOrigin(req)
  if (!origin) {
    res.status(400).type('text').send('Bad request.')
    return
  }

  // Same image src/seo.jsx uses for DEFAULT_IMAGE — the 256x256 brand mark,
  // which is what the repo ships. Replacing it with a 1200x630
  // public/brand/og-image.png upgrades every card at once: change it here, in
  // src/seo.jsx, and in index.html.
  const image = `${origin}/brand/propgather-icon.png`

  const project = await getDb().get(
    'SELECT id, name, type, city, state, owner_count FROM projects WHERE id = ?',
    [req.params.id]
  )

  // A dead link still gets a valid card rather than a broken one: the id may be
  // stale, but the person tapping it is a visitor either way, so send them to the
  // directory instead of a 404 they can do nothing with.
  if (!project) {
    res.status(404).type('html').send(page({
      title: "PropGather.com.my — Malaysia's verified property communities",
      description: "That community link has expired or moved. Browse Malaysia's directory of verified property communities and find yours.",
      canonical: `${origin}/discover`,
      url: `${origin}/discover`,
      image,
      redirectPath: '/discover'
    }))
    return
  }

  const where = [project.city, project.state].filter(Boolean).join(', ')
  const residents = project.owner_count > 0
    ? `${project.owner_count} verified resident${project.owner_count === 1 ? '' : 's'} already inside. `
    : ''

  // /project/:id is the URL the sitemap lists and src/seo.jsx canonicalises to
  // (scripts/postbuild.mjs, ProjectPage.jsx), so this page points there rather
  // than at itself. /s/:id is a doorway, not a second copy of the community
  // page, and pointing search engines at both would split one page's ranking
  // across two URLs.
  const communityPath = `/project/${encodeURIComponent(project.id)}`

  // ?from=share is what the app watches to record the arrival — see
  // POST /api/projects/:id/share-visit for why the count is taken there and not
  // here (this URL is fetched by the crawlers building the card above).
  res.set('Cache-Control', 'public, max-age=300')
  res.type('html').send(page({
    title: `${project.name} on PropGather`,
    description: `The private, verified residents' community for ${project.name}${where ? `, ${where}` : ''}. ${residents}Forum, chat, defect reports, documents and community polls — for verified owners and residents only.`,
    canonical: `${origin}${communityPath}`,
    url: `${origin}${communityPath}`,
    image,
    redirectPath: `${communityPath}?from=share`
  }))
}))
