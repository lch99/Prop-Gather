import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useParams, useSearchParams, Navigate, Link } from 'react-router-dom'
import { api, mediaUrl } from '../api'
import { useAuth } from '../auth'
import { C, card, badge, button } from '../theme'
import Seo, { SITE_URL } from '../seo'
import ForumTab from './project/ForumTab'
import ChatTab from './project/ChatTab'
import ToolsTab from './project/ToolsTab'
import ReferencesTab from './project/ReferencesTab'
import ShareButton from '../components/Share'
import { CommunityAvatar, CommunityCover, HERO_SCRIM } from '../components/CommunityImage'

const comingSoonTabs = ['Subscription*', 'Vendors']

function ComingSoonModal({ tab, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...card, padding: '40px 48px', textAlign: 'center', maxWidth: 380, width: '90%',
          borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)'
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <h2 style={{ margin: '0 0 8px', color: C.navy, fontSize: 22 }}>{tab}</h2>
        <p style={{ color: C.textMuted, margin: '0 0 24px', fontSize: 15 }}>
          This feature is coming soon. Stay tuned for updates!
        </p>
        <button
          onClick={onClose}
          style={{
            background: C.blue, color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 32px', fontWeight: 600, fontSize: 14, cursor: 'pointer'
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

function LockedGate({ project, isLoggedIn }) {
  const projectId = project.id
  return (
    <div style={{
      ...card, maxWidth: 520, margin: '40px auto',
      padding: 'clamp(28px, 6vw, 44px) clamp(24px, 6vw, 40px)',
      textAlign: 'center', borderTop: `4px solid ${C.blue}`
    }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🔐</div>
      <h2 style={{ margin: '0 0 10px', color: C.navy, fontSize: 22, fontWeight: 800 }}>
        Verified residents only
      </h2>
      <p style={{ margin: '0 0 10px', color: C.textMuted, fontSize: 15, lineHeight: 1.65 }}>
        The community forum and chat for <strong style={{ color: C.navy }}>{project.name}</strong> are
        only accessible to verified property owners and residents of this building.
      </p>
      <p style={{ margin: '0 0 28px', color: C.textMuted, fontSize: 14, lineHeight: 1.55 }}>
        To gain access, register and upload your Sale and Purchase Agreement (SPA), a recent utility bill, or a
        copy of the property title as proof of ownership.
        Admin review takes less than 24 hours.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {isLoggedIn ? (
          <Link to={`/register?projectId=${projectId}`} style={{ textDecoration: 'none' }}>
            <button style={{ ...button('primary'), fontSize: 15, padding: '12px 28px' }}>
              Verify my ownership →
            </button>
          </Link>
        ) : (
          <Link to={`/login?next=${encodeURIComponent(`/project/${projectId}`)}`} style={{ textDecoration: 'none' }}>
            <button style={{ ...button('primary'), fontSize: 15, padding: '12px 28px' }}>
              Log in to verify
            </button>
          </Link>
        )}
        <Link to="/discover" style={{ textDecoration: 'none' }}>
          <button style={{ ...button('outline'), fontSize: 15, padding: '12px 28px' }}>
            Back to discover
          </button>
        </Link>
      </div>

      {/* This gate is where someone who followed a shared link and isn't a
          resident here ends up. Passing it on to a neighbour who *is* one is the
          most useful thing they can do from this screen. */}
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
        <p style={{ margin: '0 0 12px', color: C.textMuted, fontSize: 14 }}>
          Know someone who lives here? Send them this community.
        </p>
        <ShareButton project={project} variant="secondary" label={`Share ${project.name}`} style={{ fontSize: 14, padding: '10px 20px' }} />
      </div>
    </div>
  )
}

export default function ProjectPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [popupTab, setPopupTab] = useState(null)
  const [myComms, setMyComms] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    setProject(null)
    api.getProject(id).then(setProject).catch(() => setProject(false))
  }, [id])

  // ?from=share means this page was opened from a link the share sheet handed
  // out — the arrival half of the counter pair behind GET /projects/share-stats.
  // Counted here rather than on the /s/:id preview the backend serves, because
  // that URL is fetched by WhatsApp's and Facebook's crawlers to build the card.
  // The marker is stripped afterwards so a refresh doesn't count twice.
  useEffect(() => {
    if (searchParams.get('from') !== 'share') return
    api.recordShareVisit(id).catch(() => {})
    const next = new URLSearchParams(searchParams)
    next.delete('from')
    setSearchParams(next, { replace: true })
  }, [id, searchParams, setSearchParams])

  useEffect(() => {
    if (!user) { setMyComms([]); return }
    if (user.role === 'admin') { setMyComms('admin'); return }
    api.getMe()
      .then(me => setMyComms(me.communities || []))
      .catch(() => setMyComms([]))
  }, [user])

  if (project === false) return <Navigate to="/discover" replace />
  if (!project) return <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: C.textMuted }}>Loading project...</div>

  const isVerified = myComms === 'admin' || (Array.isArray(myComms) && myComms.some(c => c.projectId === id))

  const gatedTab = (tab) =>
    myComms === null
      ? <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Loading...</div>
      : isVerified
        ? tab
        : <LockedGate project={project} isLoggedIn={!!user} />

  const glassBadge = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700,
    color: '#fff', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.30)',
    borderRadius: 999, padding: '5px 13px', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)'
  }
  const lockedBadge = {
    ...glassBadge,
    background: 'rgba(239,68,68,0.22)', border: '1px solid rgba(239,68,68,0.45)'
  }

  // Community pages are the long tail worth ranking for — someone googling
  // their building by name. The page is public even when signed out
  // (LockedGate names the project), so a crawler has real content to index.
  const seoDescription =
    `Connect with verified owners and residents of ${project.name} in ${project.city}, ${project.state}. ` +
    'Private forum, live chat, polls, defect reports, and shared documents — residents only, no management, no strangers.'

  return (
    <div>
      {/* All four tabs canonicalise to the bare project URL: the tab content
          is members-only, so to a crawler they are the same page.

          A community with a cover photo shares as a picture of itself; `image`
          is left undefined otherwise so Seo falls back to the brand mark —
          passing null would blank the tag instead. */}
      <Seo
        path={`/project/${id}`}
        title={`${project.name} residents community`}
        description={seoDescription}
        image={mediaUrl(project.coverUrl) || undefined}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Discover', item: `${SITE_URL}/discover` },
            { '@type': 'ListItem', position: 3, name: project.name, item: `${SITE_URL}/project/${id}` }
          ]
        }}
      />
      <div className="pg-hero-anim" style={{ background: C.headerGradientWide, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* The community's own cover photo becomes the hero backdrop. HERO_SCRIM
            rather than the card default: the heading, the address and four
            badges all sit across the full height of this image, so the darkening
            has to be even instead of weighted to the bottom. */}
        {project.coverUrl && (
          <CommunityCover
            project={project}
            scrim={HERO_SCRIM}
            loading="eager"
            style={{ position: 'absolute', inset: 0, height: 'auto' }}
          />
        )}
        {/* The warm red/gold glow is what gives the plain gradient its character.
            Over a photo it only adds a colour cast and lifts the scrim it sits
            on top of, so a community with a cover photo goes without it. */}
        {!project.coverUrl && (
          <div style={{ position: 'absolute', inset: 0, background: C.heroGlow, pointerEvents: 'none' }} />
        )}
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: 'clamp(26px, 6vw, 32px) clamp(18px, 5vw, 24px) clamp(24px, 5vw, 28px)', position: 'relative', zIndex: 1,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
            <CommunityAvatar
              project={project}
              size={56}
              radius={15}
              style={{ border: '2px solid rgba(255,255,255,0.5)', marginTop: 3 }}
            />
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(22px, 5.4vw, 30px)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{project.name}</h1>
              <div style={{ color: C.brandLight, fontSize: 14.5 }}>{project.address}, {project.city}, {project.state}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={glassBadge}>{project.type}</span>
            <span style={glassBadge}>👥 {project.ownerCount} verified residents</span>
            {isVerified
              ? <span style={glassBadge}>✓ Your access: verified</span>
              : <span style={lockedBadge}>🔐 {user ? 'Not yet verified' : 'Login to access'}</span>
            }
            <ShareButton project={project} variant="hero" />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 28px' }}>
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { to: `/project/${id}/`, end: true, label: 'Forum', gated: true },
            { to: `/project/${id}/chat`, label: 'Chat', gated: true },
            { to: `/project/${id}/tools`, label: 'Tools', gated: true },
            { to: `/project/${id}/references`, label: 'References', gated: false }
          ].map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              style={({ isActive }) => ({
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: 14,
                color: isActive ? C.blue : C.textMuted,
                borderBottom: isActive ? `2px solid ${C.blue}` : '2px solid transparent',
                marginBottom: -1,
                display: 'flex', alignItems: 'center', gap: 5
              })}
            >
              {t.label} {t.gated && !isVerified && <span style={{ fontSize: 12 }}>🔐</span>}
            </NavLink>
          ))}

          {comingSoonTabs.map(label => (
            <button
              key={label}
              onClick={() => setPopupTab(label)}
              style={{
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: 14,
                color: C.textMuted,
                borderBottom: '2px solid transparent',
                marginBottom: -1,
                background: 'none',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: 'transparent',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <Routes>
          <Route path="" element={gatedTab(<ForumTab projectId={id} />)} />
          <Route path="chat" element={gatedTab(<ChatTab projectId={id} />)} />
          <Route path="tools" element={gatedTab(<ToolsTab projectId={id} project={project} />)} />
          <Route path="references" element={<ReferencesTab projectId={id} />} />
        </Routes>
      </div>

      {popupTab && <ComingSoonModal tab={popupTab} onClose={() => setPopupTab(null)} />}
    </div>
  )
}
