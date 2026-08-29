import { vi } from 'vitest'

// Applications routes talk to S3 for document storage. Tests run fully offline
// against an in-memory DB, so this fake stands in for real presigned URLs and
// uploaded objects — every key is treated as already-uploaded unless
// 'missing-key' appears in it, which lets tests exercise the "file never
// uploaded" 400. A substring rather than the whole key, so a route that requires
// a particular key prefix (community photos) can still name the sentinel.
const mocks = vi.hoisted(() => ({
  buildDocumentKey: vi.fn((userId) => `verification-docs/${userId}/${Math.random().toString(36).slice(2)}`),
  // Community photos (profile picture / cover) go to the same fake bucket under
  // their own prefix. The prefix is re-exported because routes/projects.js
  // checks a submitted key against it before publishing the object on an
  // unauthenticated URL — a mock without it would make that guard vacuous.
  COMMUNITY_IMAGE_PREFIX: 'community-images',
  buildCommunityImageKey: vi.fn((projectId, kind) => `community-images/${projectId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`),
  createUploadUrl: vi.fn(async (key) => `https://mock-s3.test/${key}?presigned=upload`),
  createDownloadUrl: vi.fn(async (key) => `https://mock-s3.test/${key}?presigned=download`),
  headObject: vi.fn(async (key) => (key.includes('missing-key') ? null : { ContentLength: 1024 })),
  deleteObject: vi.fn(async () => {}),
  describeStorageDestination: vi.fn(() => ({ provider: 'Mock S3', region: 'test-region', endpoint: 'https://mock-s3.test', bucket: 'test-bucket' }))
}))

vi.mock('../src/util/s3.js', () => mocks)

export const s3Mock = mocks
