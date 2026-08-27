import { Link } from 'react-router-dom'
import { C, button } from '../theme'
import Seo from '../seo'

export default function NotFoundPage() {
  return (
    <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', color: C.textMuted }}>
      {/* A client-routed SPA answers 200 for every URL, so this tag is the only
          way to tell a crawler the page is not real content. */}
      <Seo title="Page not found" noindex />
      <h1 style={{ color: C.navy }}>404 — Page not found</h1>
      <p>The page you're looking for doesn't exist in current phase yet.</p>
      <p>
        Need help? <Link to="/contact" style={{ color: C.blue, fontWeight: 700 }}>Contact us</Link>{' '}
        and we'll sort it out.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <Link to="/discover"><button style={button('primary')}>Back to Discover</button></Link>
        <Link to="/contact"><button style={button('outline')}>Contact Us</button></Link>
      </div>
    </div>
  )
}
