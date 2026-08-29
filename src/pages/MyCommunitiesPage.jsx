import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { C, card, badge, button } from '../theme'
import { TierBadge } from '../components/Badges'
import ShareButton from '../components/Share'
import { CommunityAvatar } from '../components/CommunityImage'
import Seo from '../seo'

export default function MyCommunitiesPage() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getMe().then(setMe).catch(err => setError(err.message))
  }, [])

  if (error) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <div role="alert" style={{ ...card, padding: 20, color: C.danger }}>{error}</div>
      </div>
    )
  }
  if (!me) return <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, color: C.textMuted }}>Loading...</div>

  return (
    <div>
      <Seo path="/my-communities" title="My communities" noindex />
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
      {/* Every new account starts with none of these — the demo's fixed resident
          always had two, so this state never used to be reachable. */}
      {me.communities.length === 0 && (
        <div style={{ ...card, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🏘️</div>
          <h3 style={{ margin: '0 0 8px', color: C.navy }}>No verified communities yet</h3>
          <p style={{ margin: '0 auto 16px', color: C.textMuted, fontSize: 14, lineHeight: 1.6, maxWidth: 420 }}>
            Find your condo or landed project in the directory, then upload a proof of ownership. A platform
            admin reviews it — usually within 24 hours — and your community unlocks here.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/discover"><button style={button('primary')}>Browse communities</button></Link>
            <Link to="/register"><button style={button('outline')}>Verify my property</button></Link>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {me.communities.map(c => (
          <div key={c.projectId} className="pg-card-hover" style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
              {/* /auth/me returns the membership's project without its id — see
                  userWithCommunities in backend/src/routes/auth.js — and the
                  avatar only needs the name, type and logoUrl it does carry. */}
              <CommunityAvatar project={c.project} size={46} radius={13} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
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
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Verified residents are the people who can actually vouch for a
                  community, so this is the highest-value place to offer a share.
                  /auth/me returns the membership's project without its id — see
                  userWithCommunities in backend/src/routes/auth.js — so it is
                  put back here for the share link. */}
              <ShareButton
                project={{ id: c.projectId, ...c.project }}
                variant="outline"
                label="Invite neighbours"
              />
              <Link to={`/project/${c.projectId}`}>
                <button style={button('primary')}>Open community →</button>
              </Link>
            </div>
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
