import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { customAlphabet } from 'nanoid'

// All ownership-proof verification documents live under this prefix — it's what
// the bucket's lifecycle rule (see backend/infra/s3-lifecycle.json) matches on
// to auto-expire objects, independent of anything this app does.
export const VERIFICATION_DOC_PREFIX = 'verification-docs'

// Community profile pictures and cover photos. A separate prefix from the one
// above on purpose: the lifecycle rule expires everything under
// verification-docs/ after 14 days, and a community's photo is not on a
// retention clock — it stays until an admin replaces it.
export const COMMUNITY_IMAGE_PREFIX = 'community-images'

// Files attached to community content — forum posts, chat messages, defect
// reports and references. A third prefix for a third set of rules: private like
// verification documents (a URL is only ever signed for a member of that
// community, see util/attachments.js), but kept for as long as the post that
// carries them rather than for 14 days, so the lifecycle rule must not reach it.
export const ATTACHMENT_PREFIX = 'community-attachments'

const UPLOAD_URL_TTL_SECONDS = 5 * 60
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60

const keySuffix = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12)

let client
// S3_ENDPOINT targets an S3-compatible provider other than AWS (e.g. Cloudflare
// R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com). R2 has no real AWS
// region, so region defaults to 'auto' (Cloudflare's documented value) once an
// endpoint is set; plain AWS S3 still requires AWS_REGION explicitly.
// forcePathStyle is required for R2 — it doesn't support virtual-hosted-style
// bucket addressing, which the SDK otherwise defaults to for custom endpoints.
function s3() {
  if (!client) {
    if (!process.env.AWS_S3_BUCKET) {
      throw new Error('AWS_S3_BUCKET must be set to use document storage')
    }
    const endpoint = process.env.S3_ENDPOINT
    const region = process.env.AWS_REGION || (endpoint ? 'auto' : undefined)
    if (!region) {
      throw new Error('AWS_REGION must be set to use document storage')
    }
    client = new S3Client({ region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) })
  }
  return client
}

function bucket() {
  return process.env.AWS_S3_BUCKET
}

// userId + random suffix keeps keys unguessable and unique without a DB round-trip;
// the original filename is kept only for the admin's display label, not as a path segment.
export function buildDocumentKey(userId) {
  return `${VERIFICATION_DOC_PREFIX}/${userId}/${Date.now()}-${keySuffix()}`
}

// One key per upload rather than a fixed `<projectId>/logo` path, so replacing a
// photo produces a new key. That is what lets the public image URL carry a
// version token derived from the key (see serialize.js): a stable URL whose
// contents changed silently would keep serving the old photo out of every
// browser and CDN cache that already has it.
export function buildCommunityImageKey(projectId, kind) {
  return `${COMMUNITY_IMAGE_PREFIX}/${projectId}/${kind}-${Date.now()}-${keySuffix()}`
}

// Scoped to the community *and* the uploader. util/attachments.js checks both
// before a key can be attached to anything, so a key is only usable by the
// person who uploaded it, in the community it was uploaded for — never to point
// a post at someone else's file, or at a verification document.
export function buildAttachmentKey(projectId, userId) {
  return `${ATTACHMENT_PREFIX}/${projectId}/${userId}/${Date.now()}-${keySuffix()}`
}

export async function createUploadUrl(key, contentType) {
  const command = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType })
  return getSignedUrl(s3(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS })
}

// `ttlSeconds` is overridden for community photos, which are public images
// redirected to from a cacheable URL rather than handed to one admin to open
// once — the signature has to outlive the redirect's own cache window.
//
// `signingDate` pins the signature's timestamp. Left unset, every call signs
// "now" and returns a different URL for the same object, so a browser can never
// reuse bytes it already downloaded; post attachments pass the start of a fixed
// window instead (see util/attachments.js).
export async function createDownloadUrl(key, ttlSeconds = DOWNLOAD_URL_TTL_SECONDS, { signingDate } = {}) {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key })
  return getSignedUrl(s3(), command, { expiresIn: ttlSeconds, ...(signingDate ? { signingDate } : {}) })
}

// Returns the object's metadata, or null if it doesn't exist (e.g. the client
// requested an upload URL but never actually uploaded to it).
export async function headObject(key) {
  try {
    return await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return null
    throw err
  }
}

export async function deleteObject(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

// Describes where documents actually go, for the cross-border transfer record
// PDPA s.129 requires (see recordAudit('application.cross_border_transfer')
// in routes/applications.js). Provider/region are read from env at call time
// (not cached like the S3 client) so this stays accurate if config changes.
export function describeStorageDestination() {
  const endpoint = process.env.S3_ENDPOINT
  const region = process.env.AWS_REGION || (endpoint ? 'auto' : null)
  return {
    provider: endpoint?.includes('r2.cloudflarestorage.com') ? 'Cloudflare R2' : (endpoint ? 'S3-compatible storage' : 'AWS S3'),
    region: region || 'unset',
    endpoint: endpoint || 'aws (region-based)',
    bucket: bucket() || 'unset'
  }
}
