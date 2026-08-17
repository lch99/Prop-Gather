import { describe, it, expect, beforeEach } from 'vitest'
import { freshApp, authed, login, verifiedResident, RESIDENT } from './helpers.js'
import { detectSensitiveContent } from '../src/util/sensitiveContent.js'

let app
let residentToken

beforeEach(async () => {
  app = await freshApp()
  residentToken = await login(app, RESIDENT.email, RESIDENT.password)
})

// A structurally valid NRIC: 901231 is a real date, 14 is an issued birthplace
// code (Kuala Lumpur). Used across the route tests below.
const NRIC = '901231-14-5678'
// Luhn-valid test card number (the standard Visa test PAN).
const CARD = '4111 1111 1111 1111'

describe('detectSensitiveContent', () => {
  it('flags an NRIC in every common written form', () => {
    expect(detectSensitiveContent(['901231-14-5678'])).toContain('NRIC / IC number')
    expect(detectSensitiveContent(['901231 14 5678'])).toContain('NRIC / IC number')
    expect(detectSensitiveContent(['901231145678'])).toContain('NRIC / IC number')
  })

  it('flags an NRIC embedded in surrounding prose', () => {
    expect(detectSensitiveContent(['my ic is 901231-14-5678 pls help'])).toContain('NRIC / IC number')
  })

  it('flags a Luhn-valid payment card number', () => {
    expect(detectSensitiveContent([CARD])).toContain('payment card number')
    expect(detectSensitiveContent(['4111-1111-1111-1111'])).toContain('payment card number')
  })

  it('ignores a 16-digit number that fails the Luhn check', () => {
    expect(detectSensitiveContent(['1234567812345678'])).toEqual([])
  })

  // These are the false positives that would make the check unusable in a
  // building community, where numbers are constantly discussed.
  it('does not flag ordinary community chatter', () => {
    expect(detectSensitiveContent(['Lift 2 in Block B broke down 3 times this month'])).toEqual([])
    expect(detectSensitiveContent(['Maintenance fee is RM 250.00 per month from 2026'])).toEqual([])
    expect(detectSensitiveContent(['Unit B-21-03, meeting on 2026-06-15 at 10am'])).toEqual([])
    expect(detectSensitiveContent(['Invoice 991234567890 was paid'])).toEqual([])
  })

  it('does not flag a 12-digit number with an impossible date prefix', () => {
    // 991331 — month 13, day 31
    expect(detectSensitiveContent(['991331145678'])).toEqual([])
  })

  it('does not flag a 12-digit number with an unissued birthplace code', () => {
    // 901231-99-5678 — 99 is not an issued state code
    expect(detectSensitiveContent(['901231-99-5678'])).toEqual([])
  })

  // Phone numbers and emails are intentionally allowed — sharing a contractor's
  // number is a core use of the forum's Marketplace/Contractors categories.
  it('allows phone numbers and email addresses', () => {
    expect(detectSensitiveContent(['Call the aircon guy at 012-345 6789'])).toEqual([])
    expect(detectSensitiveContent(['Reach me at jaya.lim@example.com'])).toEqual([])
    expect(detectSensitiveContent(['WhatsApp +60 12 345 6789 for quotes'])).toEqual([])
  })

  it('handles undefined and empty fields without throwing', () => {
    expect(detectSensitiveContent([undefined, '', null])).toEqual([])
  })
})

describe('sensitive content is blocked at the API boundary', () => {
  it('rejects a forum thread whose body contains an NRIC', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Need help', body: `My IC is ${NRIC}, please assist`
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/NRIC/i)
  })

  it('rejects a forum thread whose *title* contains an NRIC', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: `Owner ${NRIC} complaint`, body: 'see title'
    })
    expect(res.status).toBe(400)
  })

  it('never echoes the identifier back in the error response', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Need help', body: `My IC is ${NRIC}`
    })
    expect(JSON.stringify(res.body)).not.toContain('901231')
    expect(JSON.stringify(res.body)).not.toContain('5678')
  })

  it('does not persist the rejected thread', async () => {
    await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'General Discussion', title: 'Need help', body: `My IC is ${NRIC}`
    })
    const list = await authed(app, residentToken).get('/api/projects/p1/forum')
    expect(list.body.some(t => t.title === 'Need help')).toBe(false)
  })

  it('rejects a chat message containing a payment card number', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: `pay to ${CARD}` })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/payment card/i)
  })

  it('rejects a defect report containing an NRIC', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/defects').send({
      title: 'Leak', description: `Owner IC ${NRIC} reported this`, category: 'Plumbing'
    })
    expect(res.status).toBe(400)
  })

  it('rejects a petition containing an NRIC', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/petitions').send({
      title: 'Petition', description: `Signed by ${NRIC}`, target: 50
    })
    expect(res.status).toBe(400)
  })

  it('reports both kinds when a post contains an NRIC and a card number', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/chat/general/messages').send({ text: `${NRIC} and ${CARD}` })
    expect(res.status).toBe(400)
    expect(res.body.details).toHaveLength(2)
  })

  it('still allows a normal post to go through', async () => {
    const res = await authed(app, residentToken).post('/api/projects/p1/forum').send({
      category: 'Contractors & Services', title: 'Aircon guy', body: 'Call 012-345 6789, RM120 per unit'
    })
    expect(res.status).toBe(201)
  })

  it('applies to newly verified residents too, not just seeded ones', async () => {
    const user = await verifiedResident(app, 'p1')
    const res = await authed(app, user.token).post('/api/projects/p1/chat/general/messages').send({ text: `ic ${NRIC}` })
    expect(res.status).toBe(400)
  })
})
