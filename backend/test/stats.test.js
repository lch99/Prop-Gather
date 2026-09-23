import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, login, authed, outsider, verifiedResident, ADMIN, sampleDocumentFile } from './helpers.js'
import { getDb } from '../src/db/index.js'
import { monthKey } from '../src/util/months.js'

let app
beforeEach(async () => { app = await freshApp() })

const stats = async () => {
  const token = await login(app, ADMIN.email, ADMIN.password)
  const res = await authed(app, token).get('/api/stats')
  expect(res.status).toBe(200)
  return res.body
}

const share = (projectId, channel) =>
  request(app).post(`/api/projects/${projectId}/share`).send({ channel })

const visit = (projectId) =>
  request(app).post(`/api/projects/${projectId}/share-visit`).send({})

describe('GET /api/stats', () => {
  it('is admin-only', async () => {
    expect((await request(app).get('/api/stats')).status).toBe(401)

    const { token } = await outsider(app)
    expect((await authed(app, token).get('/api/stats')).status).toBe(403)
  })

  it('frames everything on the current Malaysian month, oldest month first', async () => {
    const body = await stats()

    expect(body.month).toBe(monthKey())
    expect(body.months).toHaveLength(6)
    expect(body.months[body.months.length - 1]).toBe(body.month)
    // Lexicographic order is calendar order for 'YYYY-MM', which is what the
    // month column and the range comparisons both depend on.
    expect([...body.months].sort()).toEqual(body.months)

    for (const metric of [body.signups, body.joiners, body.applications, body.shares, body.visits]) {
      expect(metric.series.map(p => p.month)).toEqual(body.months)
      expect(metric.thisMonth).toBe(metric.series[5].count)
      expect(metric.lastMonth).toBe(metric.series[4].count)
    }
  })

  // Deltas rather than absolute counts: freshApp() reseeds demo residents whose
  // created_at is "now", so the month already has a population before the test
  // does anything.
  it('counts a resident who gets verified as both a signup and a joiner this month', async () => {
    const before = await stats()

    await verifiedResident(app, 'p1')

    const after = await stats()
    expect(after.signups.thisMonth).toBe(before.signups.thisMonth + 1)
    expect(after.joiners.thisMonth).toBe(before.joiners.thisMonth + 1)
    expect(after.applications.thisMonth).toBe(before.applications.thisMonth + 1)
    expect(after.signups.total).toBe(before.signups.total + 1)
  })

  // The distinction the dashboard turns on: an account is not a member. Someone
  // who registers but is never approved has joined nothing.
  it('counts a registration without an approved application as a signup but not a joiner', async () => {
    const before = await stats()

    await outsider(app)

    const after = await stats()
    expect(after.signups.thisMonth).toBe(before.signups.thisMonth + 1)
    expect(after.joiners.thisMonth).toBe(before.joiners.thisMonth)
  })

  // Admin accounts are created by hand, never by anyone signing up, so counting
  // them would inflate growth by the size of the staff.
  it('leaves staff accounts out of the signup count', async () => {
    const body = await stats()
    const db = getDb()
    const residents = Number((await db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'resident'")).n)
    const everyone = Number((await db.get('SELECT COUNT(*) AS n FROM users')).n)

    expect(everyone).toBeGreaterThan(residents)   // the seeded admin
    expect(body.signups.total).toBe(residents)
  })

  it('counts applications still awaiting a decision whatever month they arrived in', async () => {
    const before = await stats()

    const { token } = await outsider(app)
    const submitted = await authed(app, token).post('/api/applications').send({
      projectId: 'p1', unit: 'A-9-9', tier: 'Owner',
      document: 'utility bill', documentFile: sampleDocumentFile(), consent: true
    })
    expect(submitted.status).toBe(201)

    const after = await stats()
    expect(after.applications.pending).toBe(before.applications.pending + 1)
  })

  it('reports shares sent and links opened this month as separate numbers', async () => {
    await share('p1', 'whatsapp')
    await share('p1', 'whatsapp')
    await share('p1', 'telegram')
    await visit('p1')

    const body = await stats()
    expect(body.shares.thisMonth).toBe(3)
    expect(body.visits.thisMonth).toBe(1)
    // The arrival counter must never be folded into shares sent, or the
    // click-through ratio the dashboard shows stops meaning anything.
    expect(body.shares.byChannel).toEqual({ whatsapp: 2, telegram: 1 })
    expect(body.shares.byChannel.visit).toBeUndefined()
  })

  it('starts every month at zero and puts this month at the end of the trend', async () => {
    const body = await stats()
    expect(body.shares.series.map(p => p.count)).toEqual([0, 0, 0, 0, 0, 0])

    await share('p1', 'copy')

    const after = await stats()
    expect(after.shares.series.map(p => p.count)).toEqual([0, 0, 0, 0, 0, 1])
  })

  it('keeps the all-time share total alongside the monthly one', async () => {
    await share('p2', 'facebook')
    await visit('p2')

    const body = await stats()
    expect(body.shares.total).toBe(1)
    expect(body.visits.total).toBe(1)
  })

  it('ranks the busiest communities by new joiners, then by links opened', async () => {
    await verifiedResident(app, 'p1')
    await verifiedResident(app, 'p1')
    await verifiedResident(app, 'p2')

    const body = await stats()
    const p1 = body.topCommunities.find(c => c.projectId === 'p1')
    const p2 = body.topCommunities.find(c => c.projectId === 'p2')

    expect(p1).toMatchObject({ name: 'The Lumina Residences', joiners: 2 })
    expect(p2.joiners).toBe(1)
    expect(body.topCommunities.indexOf(p1)).toBeLessThan(body.topCommunities.indexOf(p2))
    expect(body.topCommunities.length).toBeLessThanOrEqual(5)
  })

  // The gap worth acting on: a link going round a community that converts nobody
  // is invisible if the list is built from memberships alone.
  it('lists a community that was shared this month even with no new joiners', async () => {
    await share('p3', 'whatsapp')
    await visit('p3')
    await visit('p3')

    const body = await stats()
    expect(body.topCommunities.find(c => c.projectId === 'p3'))
      .toMatchObject({ joiners: 0, shares: 1, visits: 2 })
  })

  it('is empty rather than broken on a platform where nothing has been shared', async () => {
    const body = await stats()
    expect(body.shares).toMatchObject({ thisMonth: 0, lastMonth: 0, total: 0, byChannel: {} })
    expect(body.visits).toMatchObject({ thisMonth: 0, total: 0 })
  })
})
