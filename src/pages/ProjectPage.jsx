import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useParams, Navigate, Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { C, card, badge, button } from '../theme'
import Seo, { SITE_URL } from '../seo'
import ForumTab from './project/ForumTab'
import ChatTab from './project/ChatTab'
import ToolsTab from './project/ToolsTab'
import ReferencesTab from './project/ReferencesTab'

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

function LockedGate({ projectId, projectName, isLoggedIn }) {
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
        The community forum and chat for <strong style={{ color: C.navy }}>{projectName}</strong> are
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
    </div>
  )
}

export default function ProjectPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [popupTab, setPopupTab] = useState(null)
  const [myComms, setMyComms] = useState(null)

  useEffect(() => {
    setProject(null)
    api.getProject(id).then(setProject).catch(() => setProject(false))
  }, [id])

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
        : <LockedGate projectId={id} projectName={project.name} isLoggedIn={!!user} />

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
          is members-only, so to a crawler they are the same page. */}
      <Seo
        path={`/project/${id}`}
        title={`${project.name} residents community`}
        description={seoDescription}
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
        <div style={{ position: 'absolute', inset: 0, background: C.heroGlow, pointerEvents: 'none' }} />
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: 'clamp(26px, 6vw, 32px) clamp(18px, 5vw, 24px) clamp(24px, 5vw, 28px)', position: 'relative', zIndex: 1,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(22px, 5.4vw, 30px)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{project.name}</h1>
            <div style={{ color: C.brandLight, fontSize: 14.5 }}>{project.address}, {project.city}, {project.state}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={glassBadge}>{project.type}</span>
            <span style={glassBadge}>👥 {project.ownerCount} verified residents</span>
            {isVerified
              ? <span style={glassBadge}>✓ Your access: verified</span>
              : <span style={lockedBadge}>🔐 {user ? 'Not yet verified' : 'Login to access'}</span>
            }
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
