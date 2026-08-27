// The app used HashRouter, so every link ever shared looks like
// `https://propgather.com.my/#/project/p1`. Search engines ignore everything
// after the `#`, which meant only the homepage could be indexed — so the app
// moved to real paths (see main.jsx).
//
// Those old links are still in WhatsApp groups, bookmarks, and emails. This
// rewrites them to the equivalent real path before React mounts, so they keep
// working. `replaceState` (not `location.replace`) keeps it to a URL swap with
// no second page load, and leaves no dead entry in the back button.
//
// Run this before the router reads the URL — it is imported first in main.jsx.
export function redirectLegacyHashUrl() {
  if (typeof window === 'undefined') return

  const { hash } = window.location
  // Only `#/...` — a plain `#section` anchor is not a route.
  if (!hash.startsWith('#/')) return

  const legacyPath = hash.slice(1) // "#/project/p1?x=1" -> "/project/p1?x=1"
  // BASE_URL is "/" in production and "/Prop-Gather/" on GitHub Pages; it always
  // has a trailing slash, and legacyPath always has a leading one.
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')

  window.history.replaceState(null, '', base + legacyPath)
}
