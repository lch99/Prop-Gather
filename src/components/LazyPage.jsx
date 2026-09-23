import { Component, lazy } from 'react'
import { C, card, button } from '../theme'

const RELOADED_KEY = 'pg_chunk_reload'

// Each page is its own chunk (see App.jsx), fetched the first time it's opened.
// After a deploy, a tab still running the previous build asks for chunk files
// that no longer exist — the import fails, and the only fix is to load the new
// build. So a failed import reloads the page once. The sessionStorage flag stops
// a chunk that genuinely can't load (offline, blocked) from reloading forever:
// the second failure is left to PageErrorBoundary to explain.
export function lazyPage(load) {
  return lazy(() => load().then(
    (module) => {
      try {
        sessionStorage.removeItem(RELOADED_KEY)
      } catch {
        // Storage refused — there is nothing to clear.
      }
      return module
    },
    (err) => {
      let reloadedAlready = true
      try {
        reloadedAlready = sessionStorage.getItem(RELOADED_KEY) === '1'
        if (!reloadedAlready) sessionStorage.setItem(RELOADED_KEY, '1')
      } catch {
        // Without storage a first failure can't be told from a loop, so don't
        // reload at all.
      }
      if (reloadedAlready) throw err
      window.location.reload()
      // Keeps Suspense on its fallback until the reload replaces the page.
      return new Promise(() => {})
    }
  ))
}

// Catches a page that fails to load or to render, so one broken page shows a
// message inside the normal header and footer instead of blanking the whole
// app. `resetKey` (the path) clears it once the visitor navigates elsewhere.
export class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(prevProps) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
        <div role="alert" style={{ ...card, padding: 28, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', color: C.navy }}>We couldn't open this page</h2>
          <p style={{ margin: '0 0 18px', color: C.textMuted, fontSize: 15, lineHeight: 1.6 }}>
            Please check your internet connection, then try again.
          </p>
          <button style={button('primary')} onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    )
  }
}

// Shown while a page's chunk downloads. The min-height keeps the footer from
// jumping up into view and back down again.
export function PageLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, minHeight: '50vh', color: C.textMuted }}>
      Loading…
    </div>
  )
}
