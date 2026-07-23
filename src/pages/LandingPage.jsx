import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { C, card, button, badge, chipColor } from '../theme'

// Resident-facing features. Each entry borrows a cheerful chip hue for its icon tile,
// while card text stays dark on white for older-eye legibility (WCAG AA).
const FEATURES = [
  { icon: '💬', title: 'Community forum', text: 'Raise issues, ask questions, and get answers from neighbours who actually live in your building.' },
  { icon: '⚡', title: 'Live chat', text: 'Real-time channels for your block — coordinate quickly when something needs attention now.' },
  { icon: '🗳️', title: 'Polls & voting', text: 'Run quick community polls so every owner gets a fair, recorded say on the things that matter.' },
  { icon: '🛠️', title: 'Defects tracking', text: 'Log and follow building defects from report to fix — nothing slips through the cracks.' },
  { icon: '📄', title: 'Documents & fees', text: 'Keep statements, notices, and shared documents in one trusted place, always to hand.' },
  { icon: '🤝', title: 'Trusted vendors', text: 'See vendors and offers vetted for your community, plus petitions to rally support together.' }
]

const PAINS = [
  { icon: '📢', text: 'Important notices get buried under hundreds of unrelated messages in the WhatsApp group.' },
  { icon: '🕵️', text: 'You never really know if the person posting actually lives in your building — or who let them in.' },
  { icon: '🗳️', text: 'Big community decisions get made by a handful of people, with no clear record of who agreed to what.' },
  { icon: '🧾', text: 'Maintenance fees and accounts are a black box — hard to question, harder to track.' },
  { icon: '🔧', text: 'You report a leaking pipe or broken lift… and it vanishes into a void with no follow-up.' },
  { icon: '🗂️', text: 'Bylaws, receipts, and notices are scattered across emails, chats, and notice boards.' }
]

const STEPS = [
  { n: '1', title: 'Find your community', text: "Browse Malaysia's national directory and search for your property by name, city, or state." },
  { n: '2', title: 'Verify your ownership', text: "Upload your Sale and Purchase Agreement (SPA), a recent utility bill, or a copy of the property title. We confirm you're a genuine owner — that's what keeps it safe." },
  { n: '3', title: 'Join & unlock the tools', text: "Once verified, step inside your community's forum, chat, and owner tools." }
]

// [feature, in PropGather, in a normal group chat]
const COMPARE = [
  ['Everyone is a verified resident', true, false],
  ['Organised threads you can actually find', true, false],
  ['Transparent polls & voting records', true, false],
  ['A residents-only space, free of management', true, false],
  ['Track defects from report to fix', true, false],
  ['Shared documents & fee statements', true, false],
  ['No strangers, ads, or random adds', true, false],
  ['Your data stays private to your building', true, false]
]

const TESTIMONIALS = [
  { quote: 'Running a quick poll instead of a 200-message argument changed everything. Decisions are clear and the whole block can see the result.', name: 'Tan Wei Ming', role: 'Owner · Mont Kiara' },
  { quote: 'My mother is 68 and she can use it on her own. Big text, clear buttons — she reads every notice now instead of asking me.', name: 'Nurul Aina', role: 'Owner · Setapak' },
  { quote: "A defect I reported actually got tracked and fixed. No more \"I'll tell the management\" and never hearing back.", name: 'Rajesh Kumar', role: 'Owner · Bangsar South' }
]

const FAQS = [
  { q: 'Is PropGather free to use?', a: 'Yes. Browsing the directory and joining your verified community is completely free for residents and owners.' },
  { q: 'How do you verify that someone is a real owner?', a: 'During registration you upload your Sale and Purchase Agreement (SPA), a recent utility bill, or a copy of the property title. A platform admin reviews it — usually within 24 hours — before granting access.' },
  { q: 'Is my document and data safe?', a: 'Your proof document is used for verification only and is permanently deleted within 14 days of review. We never sell or share your documents with third parties.' },
  { q: "What if my building isn't listed yet?", a: "Open the directory and use 'Request a missing community'. Tell us the name and location and we'll add it once verified." },
  { q: 'Who can see what I post?', a: "Only verified members of your own community can see your posts and chats — not even your building's management or developer. Your space is private, not public or searchable." },
  { q: 'Is this a residents-only space?', a: "Yes. Only verified residents and owners can read and post here. Building management, JMB committees, and developers have no access — so you and your neighbours can speak openly." }
]

export default function LandingPage() {
  const [projects, setProjects] = useState([])

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {})
  }, [])

  const stats = useMemo(() => {
    const residents = projects.reduce((sum, p) => sum + (p.ownerCount || 0), 0)
    const states = new Set(projects.map(p => p.state)).size
    return [
      [projects.length || '—', 'Registered projects'],
      [residents ? residents.toLocaleString() : '—', 'Verified residents'],
      [states || '—', 'States covered']
    ]
  }, [projects])

  return (
    <div>
      {/* ───────────────── Hero ───────────────── */}
      <div className="pg-hero-anim" style={{ background: C.headerGradientWide, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: C.heroGlow, pointerEvents: 'none' }} />
        <div className="pg-float" style={{
          position: 'absolute', top: -80, right: -50, width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)', pointerEvents: 'none'
        }} />
        <div className="pg-float" style={{
          position: 'absolute', bottom: -110, left: '28%', width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,114,182,0.30), transparent 70%)',
          pointerEvents: 'none', animationDelay: '-3.5s'
        }} />

        <div className="pg-fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(40px, 9vw, 64px) clamp(18px, 5vw, 24px) clamp(48px, 10vw, 72px)', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
            background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.34)',
            borderRadius: 999, padding: '7px 17px', fontSize: 'clamp(12.5px, 3.4vw, 14.5px)', fontWeight: 700, color: '#fff',
            backdropFilter: 'blur(6px)'
          }}>
            🏡 Malaysia's verified property community
          </div>

          <h1 style={{ margin: '0 auto 16px', fontSize: 'clamp(27px, 7vw, 46px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.12, maxWidth: 860 }}>
            Your building, your neighbours,{' '}
            <span className="pg-gradient-text">all in one trusted place</span>
          </h1>

          <p style={{ margin: '0 auto 30px', color: 'rgba(255,255,255,0.94)', fontSize: 'clamp(15.5px, 4.2vw, 19px)', lineHeight: 1.6, maxWidth: 660 }}>
            PropGather brings the residents of your property together — a private, verified space to
            discuss, decide, and look after your home. Free to browse; join your own community once you're verified.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            <Link to="/discover">
              <button className="pg-shine" style={{
                background: '#fff', color: C.blue, border: 'none', borderRadius: C.radiusSm,
                padding: '15px 30px', fontSize: 17, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 10px 28px rgba(0,0,0,0.20)'
              }}>
                Browse communities →
              </button>
            </Link>
            <Link to="/login">
              <button style={{
                background: 'rgba(255,255,255,0.16)', color: '#fff', border: '2px solid rgba(255,255,255,0.55)',
                borderRadius: C.radiusSm, padding: '15px 30px', fontSize: 17, fontWeight: 800, cursor: 'pointer',
                backdropFilter: 'blur(6px)'
              }}>
                Log in
              </button>
            </Link>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 15, fontWeight: 700, color: '#fff',
            background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 999, padding: '8px 18px'
          }}>
            🔐 Only verified owners can join a community — your space stays private and safe.
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 36 }}>
            {stats.map(([value, label]) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 16, padding: '14px 24px', minWidth: 150, backdropFilter: 'blur(6px)'
              }}>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>{value}</div>
                <div style={{ fontSize: 14.5, color: C.brandLight }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────── Problem / "Sound familiar?" ───────────────── */}
      <Band background={C.brandLight}>
        <SectionHeading
          eyebrow="Sound familiar?"
          title="Living in a community shouldn't be this frustrating"
          subtitle="Most buildings run on noisy group chats and word of mouth. Things get lost, trust breaks down, and the same problems repeat."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 36 }}>
          {PAINS.map(p => (
            <div key={p.text} style={{
              ...card, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start'
            }}>
              <div style={{ fontSize: 26, lineHeight: 1.2, flexShrink: 0 }} aria-hidden="true">{p.icon}</div>
              <p style={{ margin: 0, color: C.text, fontSize: 16, lineHeight: 1.55 }}>{p.text}</p>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', margin: '32px auto 0', maxWidth: 620, fontSize: 18, fontWeight: 700, color: C.navy, lineHeight: 1.5 }}>
          PropGather fixes all of this — by making sure everyone is verified, and everything has its place. 👇
        </p>
      </Band>

      {/* ───────────────── How it works ───────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 16px' }}>
        <SectionHeading
          eyebrow="Getting started is simple"
          title="Three steps to join your community"
          subtitle="No paperwork queues, no guesswork. If you own your home, you're a few minutes away from being in."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 36 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ ...card, padding: 28, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, margin: '0 auto 16px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #4081C6, #5192D2)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 800, boxShadow: '0 6px 18px rgba(64,129,198,0.32)'
              }}>{s.n}</div>
              <h3 style={{ margin: '0 0 8px', color: C.navy, fontSize: 20 }}>{s.title}</h3>
              <p style={{ margin: 0, color: C.textMuted, fontSize: 16, lineHeight: 1.6 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────── Features ───────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 16px' }}>
        <SectionHeading
          eyebrow="Everything in one place"
          title="Made for the people who live here"
          subtitle="The tools your community needs to run well together — clear, friendly, and built for every resident."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18, marginTop: 36 }}>
          {FEATURES.map(f => {
            const [fg, bg] = chipColor(f.title)
            return (
              <div key={f.title} className="pg-card-hover" style={{ ...card, padding: 24 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, background: bg, color: fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, marginBottom: 14
                }}>{f.icon}</div>
                <h3 style={{ margin: '0 0 7px', color: C.navy, fontSize: 19 }}>{f.title}</h3>
                <p style={{ margin: 0, color: C.textMuted, fontSize: 16, lineHeight: 1.6 }}>{f.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ───────────────── Comparison ───────────────── */}
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '56px 24px 16px' }}>
        <SectionHeading
          eyebrow="Why not just a group chat?"
          title="The difference is night and day"
          subtitle="A WhatsApp or Facebook group was never built to run a building. PropGather is."
        />
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginTop: 36 }}>
          {/* header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', alignItems: 'center',
            background: C.neutralBg, fontWeight: 800, color: C.navy
          }}>
            <div style={{ padding: '14px 18px', fontSize: 15 }}>What you get</div>
            <div style={{ padding: '14px 12px', textAlign: 'center', fontSize: 15, color: C.blue, background: C.blueLight }}>PropGather</div>
            <div style={{ padding: '14px 12px', textAlign: 'center', fontSize: 15, color: C.textMuted }}>Group chat</div>
          </div>
          {COMPARE.map(([label, a, b], i) => (
            <div key={label} style={{
              display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', alignItems: 'center',
              borderTop: `1px solid ${C.border}`, background: i % 2 ? '#fff' : '#fafcfe'
            }}>
              <div style={{ padding: '14px 18px', fontSize: 16, color: C.text, fontWeight: 600 }}>{label}</div>
              <div style={{ padding: '14px 12px', textAlign: 'center', background: 'rgba(64,129,198,0.06)' }}>
                <Mark on={a} />
              </div>
              <div style={{ padding: '14px 12px', textAlign: 'center' }}>
                <Mark on={b} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────── Testimonials ───────────────── */}
      <Band background={C.brandLight} style={{ marginTop: 56 }}>
        <SectionHeading
          eyebrow="Loved by communities"
          title="Neighbours, committees, and seniors alike"
          subtitle="Real talk from the people who use PropGather to look after their homes."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 36 }}>
          {TESTIMONIALS.map(t => {
            const [fg, bg] = chipColor(t.name)
            return (
              <div key={t.name} style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#f59e0b', fontSize: 18, letterSpacing: 2, marginBottom: 10 }} aria-hidden="true">★★★★★</div>
                <p style={{ margin: '0 0 18px', color: C.text, fontSize: 16.5, lineHeight: 1.6, flex: 1 }}>"{t.quote}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: bg, color: fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0
                  }}>{initials(t.name)}</div>
                  <div>
                    <div style={{ fontWeight: 800, color: C.navy, fontSize: 15.5 }}>{t.name}</div>
                    <div style={{ color: C.textMuted, fontSize: 14 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Band>

      {/* ───────────────── Trust band ───────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 16px' }}>
        <div style={{
          ...card, padding: '32px 28px', background: C.blueLight, border: `1px solid ${C.border}`,
          display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center'
        }}>
          <div style={{ fontSize: 46, lineHeight: 1 }}>🛡️</div>
          <div style={{ maxWidth: 720 }}>
            <h3 style={{ margin: '0 0 8px', color: C.navy, fontSize: 22 }}>Real owners. Real neighbours. No strangers.</h3>
            <p style={{ margin: 0, color: C.text, fontSize: 16.5, lineHeight: 1.6 }}>
              Every member is verified against their Sale and Purchase Agreement (SPA), a recent utility bill, or a
              copy of the property title before joining. Your proof document is
              used for verification only and deleted within 14 days — never sold or shared. It's a residents-only
              space: building management and developers have no access, so the only people here are the ones who
              actually live in your building.
            </p>
          </div>
        </div>
      </div>

      {/* ───────────────── FAQ ───────────────── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 16px' }}>
        <SectionHeading
          eyebrow="Questions, answered"
          title="Everything you might be wondering"
          subtitle="Still unsure? Here are the things people ask us most before joining."
        />
        <div style={{ display: 'grid', gap: 12, marginTop: 36 }}>
          {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 16, color: C.textMuted }}>
          Have another question?{' '}
          <Link to="/contact" style={{ color: C.blue, fontWeight: 800 }}>Contact us →</Link>
        </p>
      </div>

      {/* ───────────────── Final CTA ───────────────── */}
      <div className="pg-hero-anim" style={{ background: C.headerGradient, color: '#fff', position: 'relative', overflow: 'hidden', marginTop: 56 }}>
        <div style={{ position: 'absolute', inset: 0, background: C.heroGlow, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(44px, 9vw, 60px) clamp(18px, 5vw, 24px)', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(24px, 6vw, 34px)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.18 }}>
            Ready to meet your neighbours?
          </h2>
          <p style={{ margin: '0 auto 28px', color: 'rgba(255,255,255,0.94)', fontSize: 'clamp(15.5px, 4.2vw, 18px)', lineHeight: 1.6, maxWidth: 560 }}>
            Find your property in the directory and request to join. It only takes a few minutes to verify.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/discover">
              <button className="pg-shine" style={{
                background: '#fff', color: C.blue, border: 'none', borderRadius: C.radiusSm,
                padding: '15px 32px', fontSize: 17, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 10px 28px rgba(0,0,0,0.22)'
              }}>
                Browse communities →
              </button>
            </Link>
            <Link to="/register">
              <button style={{
                background: 'rgba(255,255,255,0.16)', color: '#fff', border: '2px solid rgba(255,255,255,0.55)',
                borderRadius: C.radiusSm, padding: '15px 32px', fontSize: 17, fontWeight: 800, cursor: 'pointer',
                backdropFilter: 'blur(6px)'
              }}>
                Verify my ownership
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Band({ children, background, style }) {
  return (
    <div style={{ background, ...style }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(40px, 9vw, 64px) clamp(16px, 5vw, 24px)' }}>
        {children}
      </div>
    </div>
  )
}

function Mark({ on }) {
  if (on) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: '50%', background: C.successBg,
        color: C.success, fontWeight: 900, fontSize: 16
      }} aria-label="Yes">✓</span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '50%', background: C.neutralBg,
      color: C.textFaint, fontWeight: 900, fontSize: 16
    }} aria-label="No">✕</span>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
          padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700, color: C.navy }}>{q}</span>
        <span style={{
          flexShrink: 0, fontSize: 20, fontWeight: 800, color: C.blue,
          transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .18s ease', lineHeight: 1
        }} aria-hidden="true">+</span>
      </button>
      {open && (
        <div className="pg-fade-in" style={{ padding: '0 20px 18px', color: C.textMuted, fontSize: 16, lineHeight: 1.65 }}>
          {a}
        </div>
      )}
    </div>
  )
}

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
      <div style={{
        display: 'inline-block', fontSize: 13.5, fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: C.blue, background: '#fff',
        border: `1px solid ${C.border}`, borderRadius: 999, padding: '5px 14px', marginBottom: 14
      }}>
        {eyebrow}
      </div>
      <h2 style={{ margin: '0 0 12px', color: C.navy, fontSize: 'clamp(22px, 5.4vw, 32px)', fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.18 }}>
        {title}
      </h2>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 'clamp(15px, 4vw, 17px)', lineHeight: 1.6 }}>{subtitle}</p>
    </div>
  )
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
}
