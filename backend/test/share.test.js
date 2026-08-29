import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, login, authed, outsider, ADMIN } from './helpers.js'

let app
beforeEach(async () => { app = await freshApp() })

const share = (projectId, channel) =>
  request(app).post(`/api/projects/${projectId}/share`).send({ channel })

const statsFor = async (projectId) => {
  const token = await login(app, ADMIN.email, ADMIN.password)
  const res = await authed(app, token).get('/api/projects/share-stats')
  expect(res.status).toBe(200)
  return res.body.find(s => s.projectId === projectId)
}

describe('POST /api/projects/:id/share', () => {
  it('records a share with no account at all — that is the point of sharing', async () => {
    const res = await share('p1', 'whatsapp')
    expect(res.status).toBe(202)
    expect(await statsFor('p1')).toMatchObject({ shares: 1, visits: 0, byChannel: { whatsapp: 1 } })
  })

  it('accumulates repeat shares onto one row per channel', async () => {
    await share('p1', 'whatsapp')
    await share('p1', 'whatsapp')
    await share('p1', 'telegram')

    const stats = await statsFor('p1')
    expect(stats.shares).toBe(3)
    expect(stats.byChannel).toEqual({ whatsapp: 2, telegram: 1 })
  })

  it('rejects a channel that is not one we offer', async () => {
    const res = await share('p1', 'carrier-pigeon')
    expect(res.status).toBe(400)
    expect(await statsFor('p1')).toBeUndefined()
  })

  // 'visit' is the reserved arrival counter. If a client could post it, the
  // shares-sent and links-opened numbers would stop meaning anything.
  it('rejects the reserved visit channel from a client', async () => {
    const res = await share('p1', 'visit')
    expect(res.status).toBe(400)
  })

  it('404s for a community that does not exist', async () => {
    const res = await share('does-not-exist', 'whatsapp')
    expect(res.status).toBe(404)
  })

  it('requires a channel', async () => {
    const res = await request(app).post('/api/projects/p1/share').send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/projects/:id/share-visit', () => {
  it('counts an arrival separately from shares sent', async () => {
    await share('p1', 'whatsapp')
    const res = await request(app).post('/api/projects/p1/share-visit').send({})
    expect(res.status).toBe(202)

    const stats = await statsFor('p1')
    expect(stats).toMatchObject({ shares: 1, visits: 1 })
    expect(stats.byChannel).toEqual({ whatsapp: 1 })
  })

  it('404s for a community that does not exist', async () => {
    const res = await request(app).post('/api/projects/nope/share-visit').send({})
    expect(res.status).toBe(404)
  })
})

describe('GET /api/projects/share-stats', () => {
  it('is admin-only', async () => {
    expect((await request(app).get('/api/projects/share-stats')).status).toBe(401)

    const { token } = await outsider(app)
    expect((await authed(app, token).get('/api/projects/share-stats')).status).toBe(403)
  })

  it('ranks communities by shares sent and names them', async () => {
    await share('p2', 'whatsapp')
    await share('p1', 'whatsapp')
    await share('p1', 'facebook')

    const token = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, token).get('/api/projects/share-stats')

    expect(res.status).toBe(200)
    expect(res.body.map(s => s.projectId)).toEqual(['p1', 'p2'])
    expect(res.body[0]).toMatchObject({ name: 'The Lumina Residences', shares: 2 })
    expect(res.body[0].lastSharedAt).toBeTruthy()
  })

  it('is empty before anything has been shared', async () => {
    const token = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, token).get('/api/projects/share-stats')
    expect(res.body).toEqual([])
  })

  // The route sits above '/:id' in the router; if that order is ever lost this
  // asks for a community whose id is 'share-stats' and 404s instead.
  it('is not shadowed by GET /api/projects/:id', async () => {
    const token = await login(app, ADMIN.email, ADMIN.password)
    const res = await authed(app, token).get('/api/projects/share-stats')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /s/:id — the share link crawlers see', () => {
  it('serves per-community Open Graph tags', async () => {
    const res = await request(app).get('/s/p1')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toContain('<meta property="og:title" content="The Lumina Residences on PropGather">')
    expect(res.text).toContain('og:description')
    expect(res.text).toContain('/project/p1?from=share')
  })

  it('previews with the brand mark until the community has a cover photo, then with the photo', async () => {
    // Absolute, because a crawler has no page context to resolve a relative URL
    // against. The hostname is the one the request arrived on, so assert on the
    // path the tag points at rather than on the ephemeral test origin.
    const ogImage = (html) => html.match(/<meta property="og:image" content="([^"]+)">/)[1]

    const before = ogImage((await request(app).get('/s/p1')).text)
    expect(before).toMatch(/^https?:\/\//)
    expect(before.endsWith('/brand/propgather-icon.png')).toBe(true)

    const token = await login(app, ADMIN.email, ADMIN.password)
    const minted = await authed(app, token).post('/api/projects/p1/images/upload-url')
      .send({ kind: 'cover', fileName: 'block-a.jpg', fileType: 'image/jpeg', fileSize: 200000 })
    const saved = await authed(app, token).put('/api/projects/p1/images/cover').send({ key: minted.body.key })
    expect(saved.status).toBe(200)

    // The public /api image route, not a presigned URL — that would be expired
    // long before anyone tapped the card.
    const after = ogImage((await request(app).get('/s/p1')).text)
    expect(after.endsWith(`/api${saved.body.coverUrl}`)).toBe(true)
  })

  it('escapes a community name so a stray quote or angle bracket cannot break out of the tag', async () => {
    const token = await login(app, ADMIN.email, ADMIN.password)
    const created = await authed(app, token).post('/api/projects').send({
      name: 'The "Grand" <Vista> & Co',
      type: 'Condo',
      state: 'Selangor',
      city: 'Shah Alam',
      address: 'Jalan Test 1'
    })
    expect(created.status).toBe(201)

    const res = await request(app).get(`/s/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('The &quot;Grand&quot; &lt;Vista&gt; &amp; Co on PropGather')
    expect(res.text).not.toContain('<Vista>')
  })

  // A stale link is still a visitor: send them to the directory with a valid
  // card rather than a broken preview.
  it('falls back to the directory for an unknown community', async () => {
    const res = await request(app).get('/s/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.text).toContain('/discover')
    expect(res.text).toContain('og:title')
  })

  // The Host header is client controlled and lands in canonical/og:url, so a
  // hostile one must not be reflected back inside a tag.
  it('refuses a Host header that is not a plain hostname', async () => {
    const res = await request(app).get('/s/p1').set('Host', 'evil.test/"><script>alert(1)</script>')
    expect(res.status).toBe(400)
    expect(res.text).not.toContain('<script>alert(1)')
  })

  it('keeps the in-page redirect relative, so no header can steer it off-site', async () => {
    const res = await request(app).get('/s/p1')
    expect(res.text).toContain('content="0; url=/project/p1?from=share"')
    expect(res.text).toContain('location.replace("/project/p1?from=share")')
  })

  it('does not count crawler fetches as visits', async () => {
    await request(app).get('/s/p1')
    await request(app).get('/s/p1')
    expect(await statsFor('p1')).toBeUndefined()
  })
})
