import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { C, card, badge } from '../theme'
import { useAuth } from '../auth'

// GET /api/stats frames everything on the Malaysian calendar month (UTC+8, see
// backend/src/util/months.js), so every "this month" on this page means the same
// thing the backend meant.

// One hue for every trend on the page. Colour is doing no work here — each panel
// is a single series that its own heading names — so varying it between panels
// would be decoration pretending to be an encoding. The current month is picked
// out by a printed value instead, which says what it is rather than hinting.
const BAR = C.blue
const BAR_MIN_PX = 3   // a zero month still draws a tick, so it reads as 0 rather than missing

// The share sheet's channel keys (backend SHARE_CHANNELS) in the words an admin
// would use. 'copy' and 'native' are real distribution — a link pasted by hand
// spreads as far as one tapped through WhatsApp — so they are named, not hidden.
const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  facebook: 'Facebook',
  x: 'X',
  email: 'Email',
  copy: 'Link copied',
  native: 'Phone share sheet'
}

const monthLabel = (key, withYear = false) => {
  // Parsed as UTC and formatted as UTC: 'YYYY-MM-01' in local time would slip to
  // the previous month for anyone west of Greenwich.
  const d = new Date(`${key}-01T00:00:00Z`)
  return d.toLocaleDateString('en-MY', { month: 'short', ...(withYear && { year: 'numeric' }), timeZone: 'UTC' })
}

// "+6 vs last month" — the number an admin actually reads a dashboard for. A
// first-ever month has nothing to compare against, so it says so rather than
// claiming an infinite rise.
function Delta({ now, before }) {
  if (before === 0 && now === 0) return <span style={{ color: C.textFaint, fontSize: 12 }}>None last month either</span>
  if (before === 0) return <span style={{ color: C.success, fontSize: 12, fontWeight: 700 }}>▲ First month with any</span>

  const change = now - before
  const pct = Math.round(Math.abs(change) / before * 100)
  const flat = change === 0
  const up = change > 0
  return (
    <span style={{ color: flat ? C.textFaint : up ? C.success : C.accent, fontSize: 12, fontWeight: flat ? 500 : 700 }}>
      {flat ? '—' : up ? '▲' : '▼'} {flat ? 'Same as' : `${pct}% vs`} last month
    </span>
  )
}

function StatTile({ icon, value, label, hint, delta, onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={{ ...card, padding: '15px 18px', flex: '1 1 190px', cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
        <span style={{ fontSize: 17 }} aria-hidden="true">{icon}</span>
        <span style={{ fontSize: 12.5, color: C.textMuted, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 29, fontWeight: 800, color: C.navy, lineHeight: 1.05 }}>{value.toLocaleString()}</div>
      <div style={{ marginTop: 5 }}>{delta}</div>
      {hint && <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

// A six-month bar trend. Deliberately one series with no legend, no y-axis and
// no number on every bar: at this size a labelled grid is more ink than signal,
// and the exact figure for any month is one hover away. The heading names the
// series, so identity never rests on the colour.
function TrendPanel({ title, series, unit }) {
  const max = Math.max(...series.map(p => p.count), 1)
  const last = series[series.length - 1]

  return (
    <div style={{ ...card, padding: '15px 16px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>{title}</div>

      <div
        role="img"
        aria-label={`${title}, last ${series.length} months: ${series.map(p => `${monthLabel(p.month)} ${p.count}`).join(', ')}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 86 }}
      >
        {series.map((point, i) => {
          const current = i === series.length - 1
          return (
            <div
              key={point.month}
              title={`${monthLabel(point.month, true)}: ${point.count.toLocaleString()} ${unit}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}
            >
              {current && (
                <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, textAlign: 'center', marginBottom: 3 }}>
                  {point.count.toLocaleString()}
                </div>
              )}
              <div
                style={{
                  height: `${Math.max((point.count / max) * 100, 0)}%`,
                  minHeight: BAR_MIN_PX,
                  background: BAR,
                  // Rounded only at the data end; the baseline stays square so
                  // every bar starts from the same visual line.
                  borderRadius: '4px 4px 0 0',
                  opacity: current ? 1 : 0.55
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Recessive baseline — an axis you read the bars against, not a border. */}
      <div style={{ height: 1, background: C.border, margin: '0 0 5px' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        {series.map((point, i) => (
          <div
            key={point.month}
            style={{
              flex: 1, textAlign: 'center', fontSize: 10.5, minWidth: 0,
              color: i === series.length - 1 ? C.navy : C.textFaint,
              fontWeight: i === series.length - 1 ? 700 : 500
            }}
          >
            {monthLabel(point.month)}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.textFaint, textAlign: 'right', marginTop: 6 }}>
        {last.count.toLocaleString()} {unit} this month
      </div>
    </div>
  )
}

function SkeletonTile({ height = 104 }) {
  return <div className="pg-skel" style={{ ...card, height, flex: '1 1 190px', border: 'none' }} />
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.getDashboardStats(user?.role)
      .then(stats => { if (alive) setData(stats) })
      // The page renders skeletons while `data` is null, so a rejected request
      // has to land somewhere concrete or they spin forever.
      .catch(err => { if (alive) { setError(err.message || "We couldn't load the dashboard just now."); setData(undefined) } })
    return () => { alive = false }
  }, [user?.role])

  if (data === null) {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px' }}>
        <div className="pg-skel" style={{ height: 26, width: 240, marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonTile key={i} height={190} />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ ...card, padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden="true">📉</div>
          <div style={{ color: C.navy, fontWeight: 700, marginBottom: 6 }}>{error}</div>
          <div style={{ color: C.textMuted, fontSize: 13.5 }}>Reload the page to try again.</div>
        </div>
      </div>
    )
  }

  const { month, signups, joiners, applications, shares, visits, topCommunities } = data
  const thisMonth = monthLabel(month, true)

  // Of the links sent this month, how many were actually opened. Kept out of the
  // tiles because it is a ratio of two numbers already shown, and a ratio over a
  // handful of shares swings wildly — it belongs next to the counts it comes from.
  const openRate = shares.thisMonth > 0 ? Math.round(visits.thisMonth / shares.thisMonth * 100) : null

  const channels = Object.entries(shares.byChannel).sort((a, b) => b[1] - a[1])
  const channelMax = Math.max(...channels.map(([, n]) => n), 1)

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ color: C.navy, margin: 0, fontSize: 27 }}>Dashboard</h1>
        <span style={badge(C.blue, C.blueLight)}>{thisMonth}</span>
      </div>
      <p style={{ color: C.textMuted, marginTop: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 720 }}>
        How PropGather grew this month, and how much of it came from residents passing their
        community&rsquo;s link around. Months run on Malaysian time.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '20px 0 26px' }}>
        <StatTile
          icon="🎉"
          label="New joiners"
          value={joiners.thisMonth}
          delta={<Delta now={joiners.thisMonth} before={joiners.lastMonth} />}
          hint={`${joiners.total.toLocaleString()} verified members all time`}
        />
        <StatTile
          icon="📝"
          label="New sign-ups"
          value={signups.thisMonth}
          delta={<Delta now={signups.thisMonth} before={signups.lastMonth} />}
          hint="Accounts created — not all of them get verified"
        />
        <StatTile
          icon="⏳"
          label="Applications this month"
          value={applications.thisMonth}
          delta={<Delta now={applications.thisMonth} before={applications.lastMonth} />}
          hint={applications.pending > 0 ? `${applications.pending} still waiting on a decision` : 'Nothing waiting on a decision'}
          onClick={() => navigate('/admin/verification')}
        />
        <StatTile
          icon="🔗"
          label="Shared links opened"
          value={visits.thisMonth}
          delta={<Delta now={visits.thisMonth} before={visits.lastMonth} />}
          hint={`${visits.total.toLocaleString()} all time`}
        />
      </div>

      <h2 style={{ color: C.navy, fontSize: 17, margin: '0 0 12px' }}>The last six months</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 28 }}>
        <TrendPanel title="New joiners" series={joiners.series} unit="joiners" />
        <TrendPanel title="New sign-ups" series={signups.series} unit="sign-ups" />
        <TrendPanel title="Shared links opened" series={visits.series} unit="opens" />
      </div>

      <h2 style={{ color: C.navy, fontSize: 17, margin: '0 0 12px' }}>Shared links</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 28 }}>
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>This month, end to end</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>{shares.thisMonth.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>links sent</div>
            </div>
            <span style={{ fontSize: 20, color: C.textFaint }} aria-hidden="true">→</span>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>{visits.thisMonth.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>opened</div>
            </div>
            {openRate !== null && (
              <span style={{ ...badge(C.blue, C.blueLight), marginLeft: 'auto' }}>{openRate}% opened</span>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.5, margin: '12px 0 0' }}>
            A link opened is counted when someone actually lands on the community page — never when
            WhatsApp or Facebook fetch it to build the preview card. Counts are anonymous: no name,
            no account, no IP.
          </p>
        </div>

        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 2 }}>Where residents sent it</div>
          <div style={{ fontSize: 11.5, color: C.textFaint, marginBottom: 12 }}>{thisMonth}</div>
          {channels.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textFaint, fontStyle: 'italic' }}>
              Nobody has shared a community link yet this month.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {channels.map(([channel, count]) => (
                <div key={channel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: C.textMuted, width: 118, flexShrink: 0 }}>
                    {CHANNEL_LABELS[channel] || channel}
                  </div>
                  <div style={{ flex: 1, background: C.neutralBg, borderRadius: 999, height: 9, minWidth: 0 }}>
                    <div style={{ width: `${(count / channelMax) * 100}%`, height: '100%', background: BAR, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, width: 34, textAlign: 'right', flexShrink: 0 }}>
                    {count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 style={{ color: C.navy, fontSize: 17, margin: '0 0 4px' }}>Busiest communities this month</h2>
      <p style={{ color: C.textMuted, margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.5 }}>
        Ranked by new joiners. A community with opens but no joiners is a link that landed and a
        sign-up that didn&rsquo;t follow &mdash; usually worth a look at its directory listing.
      </p>
      {topCommunities.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
          No new members and no shares yet this month.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {topCommunities.map((c, i) => (
            <div
              key={c.projectId}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/project/${c.projectId}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/project/${c.projectId}`) } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`, flexWrap: 'wrap'
              }}
            >
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 14.5, lineHeight: 1.3 }}>{c.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <span style={badge(c.joiners > 0 ? C.success : C.textMuted, c.joiners > 0 ? C.successBg : C.neutralBg)}>
                  🎉 {c.joiners} joined
                </span>
                <span style={badge(C.blue, C.blueLight)}>📣 {c.shares} sent</span>
                <span style={badge(C.navy, C.neutralBg)}>🔗 {c.visits} opened</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
