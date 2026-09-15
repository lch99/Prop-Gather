import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, hasResidentSpace } from '../auth'
import { C, card, badge, button } from '../theme'
import { TierBadge } from '../components/Badges'
import ShareButton from '../components/Share'
import { CommunityAvatar } from '../components/CommunityImage'
import Seo from '../seo'

function EmptyState({ emoji, title, children, actions }) {
  return (
    <div style={{ ...card, padding: 28, textAlign: 'center' }}>
      <div aria-hidden="true" style={{ fontSize: 34, marginBottom: 10 }}>{emoji}</div>
      <h3 style={{ margin: '0 0 8px', color: C.navy }}>{title}</h3>
      <p style={{ margin: '0 auto 16px', color: C.textMuted, fontSize: 14, lineHeight: 1.6, maxWidth: 440 }}>{children}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>{actions}</div>
    </div>
  )
}

export default function MyCommunitiesPage() {
  const { user: me, refresh } = useAuth()

  // Painted straight from the signed-in profile, then re-read once. It is the
  // shared profile that gets refreshed, not a private copy fetched for this
  // page, so the header nav and this page always agree on what the resident
  // belongs to — and a community approved since sign-in shows up in both.
  useEffect(() => {
    refresh().catch(() => {
      // Keep showing the cached profile. A token the server no longer accepts
      // signs the user out on its own (setSessionExpiredHandler in auth.jsx).
    })
  }, [refresh])

  // RequireAuth sends a signed-out visitor to /login; this only covers the render
  // in which a session has just expired.
  if (!me) return null

  const communities = me.communities ?? []
  // The same test the nav uses to hide this page, so the two can't disagree. An
  // admin promoted from a resident account (createAdmin keeps its memberships)
  // still gets the ordinary resident view.
  const staffOnlyAdmin = !hasResidentSpace(me)

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
            {staffOnlyAdmin
              ? 'Communities you belong to as a verified resident. As a platform admin, you open every community from the Admin dashboard instead.'
              : `Quick access to projects where ${me.name} is a verified resident.`}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 28px' }}>
      {/* Three states, one each. A staff-only admin lands here permanently empty:
          they already read every community from the Admin dashboard, so tell them
          that rather than send them off to queue behind their own approval. The
          nav hides this page for them — this is the direct-link fallback. Every
          new account starts with no communities, and gets pointed at the way in.
          Only once there is a list does "join another" mean anything. */}
      {staffOnlyAdmin ? (
        <EmptyState
          emoji="🛠️"
          title="You have access to every community"
          actions={<>
            <Link to="/admin"><button style={button('primary')}>Go to Admin</button></Link>
            <Link to="/discover"><button style={button('outline')}>Browse communities</button></Link>
          </>}
        >
          This page lists the communities you belong to as a verified resident. As a platform admin you open
          any community from the Admin dashboard without joining one, so it stays empty — unless you also
          verify a property you own.
        </EmptyState>
      ) : communities.length === 0 ? (
        <EmptyState
          emoji="🏘️"
          title="No verified communities yet"
          actions={<>
            <Link to="/discover"><button style={button('primary')}>Browse communities</button></Link>
            <Link to="/register"><button style={button('outline')}>Verify my property</button></Link>
          </>}
        >
          Find your condo or landed project in the directory, then upload a proof of ownership. A platform
          admin reviews it — usually within 24 hours — and your community unlocks here.
        </EmptyState>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 16 }}>
            {communities.map(c => (
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
        </>
      )}
      </div>
    </div>
  )
}
