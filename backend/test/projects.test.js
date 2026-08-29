import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { freshApp, login, authed, outsider, verifiedResident, ADMIN } from './helpers.js'
import { s3Mock } from './setup.js'

let app
beforeEach(async () => { app = await freshApp() })

const newCommunity = (over = {}) => ({
  name: 'Harmony Park Residences',
  type: 'Condo',
  state: 'Selangor',
  city: 'Subang Jaya',
  address: 'Jalan SS15/4, Subang Jaya',
  ...over
})

describe('GET /api/projects', () => {
  it('lists all seeded projects without auth', async () => {
    const res = await request(app).get('/api/projects')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(6)
  })

  it('filters by state', async () => {
    const res = await request(app).get('/api/projects?state=Penang')
    expect(res.status).toBe(200)
    expect(res.body.every(p => p.state === 'Penang')).toBe(true)
    expect(res.body).toHaveLength(1)
  })

  it('filters by type', async () => {
    const res = await request(app).get('/api/projects').query({ type: 'Landed G&G' })
    expect(res.status).toBe(200)
    expect(res.body.every(p => p.type === 'Landed G&G')).toBe(true)
    expect(res.body).toHaveLength(2)
  })

  it('filters by free-text search across name/city/state', async () => {
    const res = await request(app).get('/api/projects?search=lumina')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe('p1')
  })

  it('returns an empty array when nothing matches', async () => {
    const res = await request(app).get('/api/projects?state=Sabah')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('GET /api/projects/:id', () => {
  it('returns project detail', async () => {
    const res = await request(app).get('/api/projects/p1')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 'p1', name: 'The Lumina Residences', blocks: ['A', 'B', 'C'] })
  })

  it('404s for an unknown project id', async () => {
    const res = await request(app).get('/api/projects/does-not-exist')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/projects', () => {
  let adminToken
  beforeEach(async () => { adminToken = await login(app, ADMIN.email, ADMIN.password) })

  it('lets an admin add a community, which then appears in the directory', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: 'Harmony Park Residences', type: 'Condo', city: 'Subang Jaya', state: 'Selangor'
    })
    expect(res.body.id).toBeTruthy()

    const list = await request(app).get('/api/projects')
    expect(list.body).toHaveLength(7)
    expect(list.body.some(p => p.id === res.body.id)).toBe(true)

    const detail = await request(app).get(`/api/projects/${res.body.id}`)
    expect(detail.status).toBe(200)
  })

  it('defaults the optional fields so only name/type/state/city/address are needed', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      ownerCount: 0, activityLevel: 'Low', units: 0, blocks: [], floorsPerBlock: 0, latestThread: null
    })
    expect(res.body.activeOfferBanner).toBeUndefined()
  })

  it('stores the optional details when supplied', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({
      ownerCount: 42, activityLevel: 'High', units: 300, blocks: ['A', 'B'], floorsPerBlock: 24
    }))
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ ownerCount: 42, activityLevel: 'High', units: 300, blocks: ['A', 'B'], floorsPerBlock: 24 })
  })

  it('accepts a property type outside the seeded ones', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ type: 'Serviced Apartment' }))
    expect(res.status).toBe(201)
    expect(res.body.type).toBe('Serviced Apartment')
  })

  it('records the creation in the audit log', async () => {
    const created = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const log = await authed(app, adminToken).get('/api/audit-log?targetType=project')
    expect(log.status).toBe(200)
    expect(log.body[0]).toMatchObject({
      action: 'project.created',
      targetType: 'project',
      targetId: created.body.id,
      actorRole: 'admin'
    })
  })

  it('the new community is usable — an approved resident can post in its forum', async () => {
    const created = await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const { token } = await outsider(app)

    const applied = await authed(app, token).post('/api/applications').send({
      projectId: created.body.id, unit: 'A-1-1', tier: 'Owner',
      document: 'utility bill',
      documentFile: { name: 'proof.pdf', type: 'application/pdf', size: 1024, key: 'verification-docs/new/proof.pdf' },
      consent: true
    })
    expect(applied.status).toBe(201)

    const decided = await authed(app, adminToken).post(`/api/applications/${applied.body.id}/decision`).send({ decision: 'approve' })
    expect(decided.status).toBe(200)

    const posted = await authed(app, token).post(`/api/projects/${created.body.id}/forum`)
      .send({ title: 'Hello neighbours', body: 'First post in our new community.', category: 'General Discussion' })
    expect(posted.status).toBe(201)
  })

  it('409s on a community with the same name in the same city', async () => {
    await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ name: 'harmony park residences' }))
    expect(res.status).toBe(409)

    const list = await request(app).get('/api/projects')
    expect(list.body).toHaveLength(7)
  })

  it('allows the same name in a different city', async () => {
    await authed(app, adminToken).post('/api/projects').send(newCommunity())
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ city: 'Ipoh', state: 'Perak' }))
    expect(res.status).toBe(201)
  })

  it('400s when required fields are missing', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send({ name: 'Nameless Court' })
    expect(res.status).toBe(400)
    expect(res.body.details.map(d => d.path)).toEqual(expect.arrayContaining(['type', 'state', 'city', 'address']))
  })

  it('400s on an unknown activity level', async () => {
    const res = await authed(app, adminToken).post('/api/projects').send(newCommunity({ activityLevel: 'Extreme' }))
    expect(res.status).toBe(400)
  })

  it('401s without a token', async () => {
    const res = await request(app).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(401)
  })

  it('403s for a non-admin', async () => {
    const { token } = await outsider(app)
    const res = await authed(app, token).post('/api/projects').send(newCommunity())
    expect(res.status).toBe(403)

    const list = await request(app).get('/api/projects')
    expect(list.body).toHaveLength(6)
  })
})

// Profile picture + cover photo. S3 is mocked (test/setup.js), so the middle
// step of the real flow — PUTting the bytes to the presigned URL — is skipped:
// a key reads back as already uploaded unless 'missing-key' appears in it.
describe('community images', () => {
  let adminToken

  beforeEach(async () => {
    adminToken = await login(app, ADMIN.email, ADMIN.password)
    s3Mock.deleteObject.mockClear()
  })

  // Walks the flow an admin actually goes through, returning the key.
  const uploadImage = async (projectId, kind, token = adminToken) => {
    const res = await authed(app, token).post(`/api/projects/${projectId}/images/upload-url`)
      .send({ kind, fileName: `${kind}.png`, fileType: 'image/png', fileSize: 2048 })
    expect(res.status).toBe(200)
    const saved = await authed(app, token).put(`/api/projects/${projectId}/images/${kind}`).send({ key: res.body.key })
    return { key: res.body.key, saved }
  }

  describe('POST /api/projects/:id/images/upload-url', () => {
    it('hands an admin a presigned PUT URL scoped to this community', async () => {
      const res = await authed(app, adminToken).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'cover', fileName: 'block-a.jpg', fileType: 'image/jpeg', fileSize: 400000 })
      expect(res.status).toBe(200)
      expect(res.body.key).toContain('community-images/p1/cover-')
      expect(res.body.uploadUrl).toContain('https://mock-s3.test/')
    })

    it('400s on a file type that is not an image', async () => {
      const res = await authed(app, adminToken).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'logo', fileName: 'deed.pdf', fileType: 'application/pdf', fileSize: 2048 })
      expect(res.status).toBe(400)
    })

    it('400s on an image over the size limit', async () => {
      const res = await authed(app, adminToken).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'cover', fileName: 'huge.png', fileType: 'image/png', fileSize: 9 * 1024 * 1024 })
      expect(res.status).toBe(400)
    })

    it('400s on a photo slot that does not exist', async () => {
      const res = await authed(app, adminToken).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'banner', fileName: 'x.png', fileType: 'image/png', fileSize: 2048 })
      expect(res.status).toBe(400)
    })

    it('404s for an unknown community', async () => {
      const res = await authed(app, adminToken).post('/api/projects/nope/images/upload-url')
        .send({ kind: 'logo', fileName: 'x.png', fileType: 'image/png', fileSize: 2048 })
      expect(res.status).toBe(404)
    })

    it('401s without a token and 403s for a resident of that very community', async () => {
      const anon = await request(app).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'logo', fileName: 'x.png', fileType: 'image/png', fileSize: 2048 })
      expect(anon.status).toBe(401)

      const { token } = await verifiedResident(app, 'p1')
      const resident = await authed(app, token).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'logo', fileName: 'x.png', fileType: 'image/png', fileSize: 2048 })
      expect(resident.status).toBe(403)
    })
  })

  describe('PUT /api/projects/:id/images/:kind', () => {
    it('publishes the photo on the project, for both slots independently', async () => {
      const logo = await uploadImage('p1', 'logo')
      expect(logo.saved.status).toBe(200)
      expect(logo.saved.body.logoUrl).toMatch(/^\/projects\/p1\/images\/logo\?v=/)
      expect(logo.saved.body.coverUrl).toBeUndefined()

      const cover = await uploadImage('p1', 'cover')
      expect(cover.saved.body.coverUrl).toMatch(/^\/projects\/p1\/images\/cover\?v=/)
      expect(cover.saved.body.logoUrl).toMatch(/^\/projects\/p1\/images\/logo\?v=/)
    })

    it('exposes the photo to anonymous callers on the public directory', async () => {
      await uploadImage('p1', 'cover')

      const detail = await request(app).get('/api/projects/p1')
      expect(detail.body.coverUrl).toBeTruthy()

      const list = await request(app).get('/api/projects')
      expect(list.body.find(p => p.id === 'p1').coverUrl).toBeTruthy()
    })

    it('deletes the object it replaced, and changes the URL version so caches miss', async () => {
      const first = await uploadImage('p1', 'logo')
      const second = await uploadImage('p1', 'logo')

      expect(s3Mock.deleteObject).toHaveBeenCalledWith(first.key)
      expect(second.saved.body.logoUrl).not.toBe(first.saved.body.logoUrl)
    })

    it('400s on a key with the right shape that nothing was ever uploaded to', async () => {
      // 'missing-key' is the sentinel the mocked headObject reports as absent —
      // the real case is an admin who asked for an upload URL and then never
      // finished sending the bytes.
      const res = await authed(app, adminToken).put('/api/projects/p1/images/logo')
        .send({ key: 'community-images/p1/logo-missing-key' })
      expect(res.status).toBe(400)

      const detail = await request(app).get('/api/projects/p1')
      expect(detail.body.logoUrl).toBeUndefined()
    })

    it("refuses a key belonging to another community, or to another community's documents", async () => {
      const other = await authed(app, adminToken).post('/api/projects/p2/images/upload-url')
        .send({ kind: 'logo', fileName: 'x.png', fileType: 'image/png', fileSize: 2048 })

      const stolen = await authed(app, adminToken).put('/api/projects/p1/images/logo').send({ key: other.body.key })
      expect(stolen.status).toBe(400)

      // The one that matters: a verification document is private personal data,
      // and the GET below is unauthenticated.
      const doc = await authed(app, adminToken).put('/api/projects/p1/images/logo')
        .send({ key: 'verification-docs/usr_1/some-spa-scan' })
      expect(doc.status).toBe(400)

      const detail = await request(app).get('/api/projects/p1')
      expect(detail.body.logoUrl).toBeUndefined()
    })

    it('refuses a key minted for the other slot', async () => {
      const cover = await authed(app, adminToken).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'cover', fileName: 'x.png', fileType: 'image/png', fileSize: 2048 })
      const res = await authed(app, adminToken).put('/api/projects/p1/images/logo').send({ key: cover.body.key })
      expect(res.status).toBe(400)
    })

    it('404s on an unknown slot or community', async () => {
      const slot = await authed(app, adminToken).put('/api/projects/p1/images/banner').send({ key: 'community-images/p1/banner-x' })
      expect(slot.status).toBe(404)

      const project = await authed(app, adminToken).put('/api/projects/nope/images/logo').send({ key: 'community-images/nope/logo-x' })
      expect(project.status).toBe(404)
    })

    it('401s without a token and 403s for a non-admin', async () => {
      const minted = await authed(app, adminToken).post('/api/projects/p1/images/upload-url')
        .send({ kind: 'logo', fileName: 'x.png', fileType: 'image/png', fileSize: 2048 })
      const key = minted.body.key

      const anon = await request(app).put('/api/projects/p1/images/logo').send({ key })
      expect(anon.status).toBe(401)

      const { token } = await verifiedResident(app, 'p1')
      const resident = await authed(app, token).put('/api/projects/p1/images/logo').send({ key })
      expect(resident.status).toBe(403)

      const detail = await request(app).get('/api/projects/p1')
      expect(detail.body.logoUrl).toBeUndefined()
    })

    it('records the change in the audit log', async () => {
      await uploadImage('p1', 'cover')
      const log = await authed(app, adminToken).get('/api/audit-log?targetType=project')
      expect(log.body[0]).toMatchObject({
        action: 'project.image_updated',
        targetType: 'project',
        targetId: 'p1',
        projectId: 'p1',
        actorRole: 'admin'
      })
      expect(log.body[0].metadata).toMatchObject({ kind: 'cover', replaced: false })
    })
  })

  describe('DELETE /api/projects/:id/images/:kind', () => {
    it('clears the photo, deletes the object, and leaves the other slot alone', async () => {
      const logo = await uploadImage('p1', 'logo')
      await uploadImage('p1', 'cover')
      s3Mock.deleteObject.mockClear()

      const res = await authed(app, adminToken).delete('/api/projects/p1/images/logo')
      expect(res.status).toBe(200)
      expect(res.body.logoUrl).toBeUndefined()
      expect(res.body.coverUrl).toBeTruthy()
      expect(s3Mock.deleteObject).toHaveBeenCalledWith(logo.key)
    })

    it('404s when there is no photo in that slot', async () => {
      const res = await authed(app, adminToken).delete('/api/projects/p1/images/cover')
      expect(res.status).toBe(404)
    })

    it('401s without a token and 403s for a non-admin', async () => {
      await uploadImage('p1', 'logo')

      const anon = await request(app).delete('/api/projects/p1/images/logo')
      expect(anon.status).toBe(401)

      const { token } = await verifiedResident(app, 'p1')
      const resident = await authed(app, token).delete('/api/projects/p1/images/logo')
      expect(resident.status).toBe(403)

      const detail = await request(app).get('/api/projects/p1')
      expect(detail.body.logoUrl).toBeTruthy()
    })

    it('records the removal in the audit log', async () => {
      await uploadImage('p1', 'logo')
      await authed(app, adminToken).delete('/api/projects/p1/images/logo')

      const log = await authed(app, adminToken).get('/api/audit-log?targetType=project')
      expect(log.body[0]).toMatchObject({ action: 'project.image_removed', targetId: 'p1' })
      expect(log.body[0].metadata).toMatchObject({ kind: 'logo' })
    })
  })

  describe('GET /api/projects/:id/images/:kind', () => {
    it('redirects an anonymous visitor to the stored object, cacheably', async () => {
      const { key } = await uploadImage('p1', 'cover')

      const res = await request(app).get('/api/projects/p1/images/cover')
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(`https://mock-s3.test/${key}?presigned=download`)
      expect(res.headers['cache-control']).toContain('max-age=')
    })

    it('404s when the community has no photo in that slot, and for an unknown slot', async () => {
      expect((await request(app).get('/api/projects/p1/images/logo')).status).toBe(404)
      expect((await request(app).get('/api/projects/p1/images/banner')).status).toBe(404)
      expect((await request(app).get('/api/projects/nope/images/logo')).status).toBe(404)
    })
  })
})
