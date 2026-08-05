import { vi } from 'vitest'

// Applications routes talk to S3 for document storage. Tests run fully offline
// against an in-memory DB, so this fake stands in for real presigned URLs and
// uploaded objects — every key is treated as already-uploaded except the
// 'missing-key' sentinel, which lets tests exercise the "file never uploaded" 400.
const mocks = vi.hoisted(() => ({
  buildDocumentKey: vi.fn((userId) => `verification-docs/${userId}/${Math.random().toString(36).slice(2)}`),
  createUploadUrl: vi.fn(async (key) => `https://mock-s3.test/${key}?presigned=upload`),
  createDownloadUrl: vi.fn(async (key) => `https://mock-s3.test/${key}?presigned=download`),
  headObject: vi.fn(async (key) => (key === 'missing-key' ? null : { ContentLength: 1024 })),
  deleteObject: vi.fn(async () => {}),
  describeStorageDestination: vi.fn(() => ({ provider: 'Mock S3', region: 'test-region', endpoint: 'https://mock-s3.test', bucket: 'test-bucket' }))
}))

vi.mock('../src/util/s3.js', () => mocks)

export const s3Mock = mocks
