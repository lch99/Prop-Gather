import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { C, card, badge, button } from '../theme'
import { TierBadge } from '../components/Badges'

export default function MyCommunitiesPage() {
  const [me, setMe] = useState(null)

  useEffect(() => {
    api.getMe().then(setMe)
  }, [])

  if (!me) return <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, color: C.textMuted }}>Loading...</div>

  return (
    <div>
      <div className="pg-hero-anim" style={{ background: C.headerGradientWide, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: C.heroGlow, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(28px, 6.5vw, 34px) clamp(18px, 5vw, 24px) clamp(26px, 6vw, 30px)', position: 'relative', zIndex: 1 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
            My <span className="pg-gradient-text">Communities</span>
          </h1>
          <p style={{ margin: 0, color: C.brandLight, fontSize: 16, lineHeight: 1.55 }}>
            Quick access to projects where {me.name} is a verified resident.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 28px' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        {me.communities.map(c => (
          <div key={c.projectId} className="pg-card-hover" style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <h3 style={{ margin: 0, color: C.navy }}>{c.project.name}</h3>
                <TierBadge tier={c.tier} />
                <span style={badge(C.success, C.successBg)}>✓ Verified</span>
              </div>
              <div style={{ color: C.textMuted, fontSize: 13 }}>
                {c.project.city}, {c.project.state} · Unit {c.unit} · Verified since {c.verifiedAt}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={badge(C.accent, C.accentLight)}>💬 2 unread forum posts</span>
                <span style={badge(C.accent, C.accentLight)}>🔔 5 unread chat messages</span>
                <span style={badge(C.warning, C.warningBg)}>⚠️ 1 active petition needs attention</span>
              </div>
            </div>
            <Link to={`/project/${c.projectId}`}>
              <button style={button('primary')}>Open community →</button>
            </Link>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, ...card, padding: 20, textAlign: 'center' }}>
        <p style={{ margin: 0, color: C.textMuted }}>
          Not seeing your project? Search the national directory and submit a verification request.
        </p>
        <Link to="/register"><button style={{ ...button('secondary'), marginTop: 12 }}>Join another community</button></Link>
      </div>
      </div>
    </div>
  )
}
