import { Link } from 'react-router-dom'
import { C, button } from '../theme'

export default function NotFoundPage() {
  return (
    <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', color: C.textMuted }}>
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
