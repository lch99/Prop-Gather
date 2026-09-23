import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { monthKey, monthRange, recentMonths } from '../util/months.js'
import { VISIT_CHANNEL } from './projects.js'
import { wrap } from '../util/asyncHandler.js'

// Platform growth numbers for the admin dashboard — how many people joined this
// month, and whether the shared links are bringing them.
//
// Its own resource rather than another route on /api/projects, because nothing
// here is about a project: it reads users, memberships, applications and the
// share counters together, and hanging a users query off a path that says
// "projects" would be a lie about where the data lives.
//
// Admin-only, like share-stats and reference-summary. The counts are aggregates
// with nobody's name in them, but platform-wide growth is operational data about
// the business, not something a resident needs.
export const statsRouter = Router()

// Six reads as a trend without becoming a chart that needs a real x-axis, and it
// covers the half-year an admin actually reasons about. The frontend renders
// whatever length it is sent rather than assuming this number.
const TREND_MONTHS = 6

// The length of "busiest this month" — a shortlist to act on, not a second copy
// of the directory, which the Overview tab already is.
const TOP_COMMUNITIES = 5

// Counts rows per calendar month in a single pass, rather than one query per
// month: each month becomes a SUM(CASE ...) column over the same scan.
//
// The boundaries come from util/months.js as ISO-8601 UTC strings and are
// compared as text — every timestamp in this schema is stored that way, and such
// strings sort chronologically. `table`, `column` and `where` are literals from
// this file; no request data is ever interpolated into them.
async function monthlyCounts(db, { table, column, months, where = '' }) {
  const params = {}
  const buckets = months.map((month, i) => {
    const { start, end } = monthRange(month)
    params[`s${i}`] = start
    params[`e${i}`] = end
    return `SUM(CASE WHEN ${column} >= :s${i} AND ${column} < :e${i} THEN 1 ELSE 0 END) AS m${i}`
  })

  // SUM() arrives as a DECIMAL string from mysql2, and as NULL when nothing
  // matched, so every bucket goes through Number() with a zero fallback.
  const row = await db.get(`SELECT ${buckets.join(', ')}, COUNT(*) AS total FROM ${table} ${where}`, params)
  const series = months.map((month, i) => ({ month, count: Number(row[`m${i}`] || 0) }))
  return summarise(series, Number(row.total || 0))
}

// Every metric on the dashboard is read the same way: a trend, an all-time
// total, and this month against last month.
function summarise(series, total) {
  return {
    series,
    total,
    thisMonth: series[series.length - 1].count,
    // Guarded rather than series.at(-2): TREND_MONTHS is 6 today, but a
    // one-month window should degrade to "no previous month" instead of NaN.
    lastMonth: series.length > 1 ? series[series.length - 2].count : 0
  }
}

statsRouter.get('/', requireAuth, requireRole('admin'), wrap(async (_req, res) => {
  const db = getDb()
  const months = recentMonths(TREND_MONTHS)
  const current = monthKey()
  const { start, end } = monthRange(current)

  const [signups, joiners, applications] = await Promise.all([
    // Staff accounts are not growth. Admins are created by hand
    // (scripts/create-admin.js) and would otherwise read as residents signing up.
    monthlyCounts(db, { table: 'users', column: 'created_at', months, where: "WHERE role = 'resident'" }),
    // The number this dashboard is really about. A membership row exists only
    // once an admin has approved the ownership document, so this counts people
    // who actually got inside a community — not people who started the form.
    monthlyCounts(db, { table: 'community_memberships', column: 'verified_at', months }),
    monthlyCounts(db, { table: 'applications', column: 'submitted_at', months })
  ])

  // Not a monthly figure: an application submitted in July and still undecided is
  // today's backlog, so it counts whenever it arrived.
  const pendingRow = await db.get("SELECT COUNT(*) AS n FROM applications WHERE status = 'Pending'")

  // Shares already carry their own month (migration 0012), so these need no CASE
  // columns — just the months the dashboard is showing.
  const placeholders = months.map(() => '?').join(', ')
  const shareRows = await db.allDynamic(
    `SELECT month, channel, SUM(share_count) AS total
       FROM community_share_months
      WHERE month IN (${placeholders})
      GROUP BY month, channel`,
    months
  )

  // All-time totals come from community_shares rather than from summing the rows
  // above: the month table only starts filling on the deploy that created it, so
  // for the first month the lifetime figure is legitimately the larger of the two.
  const lifetime = await db.all(
    'SELECT channel, SUM(share_count) AS total FROM community_shares GROUP BY channel'
  )

  const sharesByMonth = Object.fromEntries(months.map(m => [m, 0]))
  const visitsByMonth = Object.fromEntries(months.map(m => [m, 0]))
  const channelsThisMonth = {}

  for (const row of shareRows) {
    const count = Number(row.total || 0)
    // 'visit' is the reserved arrival counter, never a place anyone shared to.
    // Keeping the two apart is what makes "sent 40, opened 6" an honest pair
    // rather than one inflated number — same split as GET /projects/share-stats.
    if (row.channel === VISIT_CHANNEL) {
      visitsByMonth[row.month] += count
    } else {
      sharesByMonth[row.month] += count
      if (row.month === current) channelsThisMonth[row.channel] = count
    }
  }

  const lifetimeShares = lifetime
    .filter(r => r.channel !== VISIT_CHANNEL)
    .reduce((sum, r) => sum + Number(r.total || 0), 0)
  const lifetimeVisits = Number(lifetime.find(r => r.channel === VISIT_CHANNEL)?.total || 0)

  const fromMonthly = (byMonth, total) =>
    summarise(months.map(month => ({ month, count: byMonth[month] })), total)

  // Which communities the month actually happened in. Joiners and share activity
  // are counted separately and merged here rather than joined in SQL: two
  // aggregates over unrelated tables joined on project_id would multiply each
  // other's rows. A community qualifies on either signal, so one that was passed
  // around a lot without converting anyone still surfaces — that gap is exactly
  // what an admin is looking for.
  const [joinerRows, shareRowsByProject] = await Promise.all([
    db.all(`
      SELECT m.project_id, p.name, COUNT(*) AS joiners
        FROM community_memberships m
        JOIN projects p ON p.id = m.project_id
       WHERE m.verified_at >= :start AND m.verified_at < :end
       GROUP BY m.project_id, p.name
    `, { start, end }),
    db.all(`
      SELECT s.project_id, p.name, s.channel, s.share_count
        FROM community_share_months s
        JOIN projects p ON p.id = s.project_id
       WHERE s.month = :month
    `, { month: current })
  ])

  const byProject = new Map()
  const entryFor = (projectId, name) => {
    if (!byProject.has(projectId)) byProject.set(projectId, { projectId, name, joiners: 0, shares: 0, visits: 0 })
    return byProject.get(projectId)
  }
  for (const row of joinerRows) entryFor(row.project_id, row.name).joiners = Number(row.joiners || 0)
  for (const row of shareRowsByProject) {
    const entry = entryFor(row.project_id, row.name)
    if (row.channel === VISIT_CHANNEL) entry.visits += Number(row.share_count || 0)
    else entry.shares += Number(row.share_count || 0)
  }

  const topCommunities = [...byProject.values()]
    .sort((a, b) => b.joiners - a.joiners || b.visits - a.visits || b.shares - a.shares || a.name.localeCompare(b.name))
    .slice(0, TOP_COMMUNITIES)

  res.json({
    month: current,
    months,
    signups,
    joiners,
    applications: { ...applications, pending: Number(pendingRow?.n || 0) },
    shares: { ...fromMonthly(sharesByMonth, lifetimeShares), byChannel: channelsThisMonth },
    visits: fromMonthly(visitsByMonth, lifetimeVisits),
    topCommunities
  })
}))
