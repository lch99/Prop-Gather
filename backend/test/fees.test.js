import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, RESIDENT } from './helpers.js'

let app
let residentToken

beforeEach(async () => {
  app = freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

describe('GET /api/projects/:projectId/fees', () => {
  it('returns the fee tracker with history and the caller\'s own payments', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p1/fees')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ sinkingFund: 482300, monthlyFee: 280, previousYearFee: 250, feeIncreaseFlag: true })
    expect(res.body.history).toHaveLength(6)
    expect(res.body.myPayments).toHaveLength(6)
    expect(res.body.myPayments.every(p => ['Paid', 'Pending'].includes(p.status))).toBe(true)
  })

  it("only returns the calling user's own payments, not other members'", async () => {
    const other = await login(app, 'tan.w@example.com', 'password123') // also p1
    const res = await authed(app, other).get('/api/projects/p1/fees')
    expect(res.status).toBe(200)
    expect(res.body.myPayments).toHaveLength(6)
  })

  it('rejects a non-member', async () => {
    const res = await authed(app, residentToken).get('/api/projects/p2/fees')
    expect(res.status).toBe(403)
  })

  it('404s for an unknown project', async () => {
    const res = await authed(app, residentToken).get('/api/projects/does-not-exist/fees')
    expect(res.status).toBe(404)
  })

  it('rejects an unauthenticated request', async () => {
    const request = (await import('supertest')).default
    const res = await request(app).get('/api/projects/p1/fees')
    expect(res.status).toBe(401)
  })
})
