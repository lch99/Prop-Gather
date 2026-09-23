import { z } from 'zod'
import { ATTACHMENT_PREFIX, createDownloadUrl, headObject, deleteObject } from './s3.js'
import { toReference } from './serialize.js'

// Files attached to forum posts, chat messages, defect reports and references.
//
// They used to travel inline: the browser base64-encoded each file into the
// JSON body and it was stored in a TEXT column. That failed twice over — TEXT
// holds 64 KB, so MySQL rejected an ordinary phone photo outright, and whatever
// did fit came back inside every list response, so opening a forum meant
// downloading every photo ever posted to it. Now the bytes go browser → object
// storage directly (routes/attachments.js hands out the upload URL), a row keeps
// only { name, type, size, key }, and a read signs a URL per file.

export const MAX_ATTACHMENT_MB = 5
export const MAX_ATTACHMENTS_TOTAL_MB = 10
const MB = 1024 * 1024

// Mirrors ALLOWED_TYPES in src/components/Attachments.jsx, which refuses
// anything else when it is picked — this is the check that counts.
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

const attachmentSchema = z.object({
  name: z.string().trim().min(1, 'Every attachment needs a file name.').max(200),
  type: z.string().trim().min(1, 'Every attachment needs a file type.').max(120),
  size: z.number().positive(),
  key: z.string().trim().min(1, 'Please attach your file again — it was not uploaded.').max(255)
})

export const attachmentsField = (max = 6) =>
  z.array(attachmentSchema).max(max, `You can attach up to ${max} files.`).optional().default([])

const totalBytes = (list) => list.reduce((sum, a) => sum + (a.size || 0), 0)

// Checks that every attachment is a file this user uploaded, for this community,
// that actually reached storage. Returns { attachments } to store — sizes as
// storage reports them, not as the request claimed — or { error } for the
// resident.
//
// The prefix check is the one that matters. The bucket also holds ownership
// documents, and a read signs a URL for whatever key a row carries: accepting a
// key from anywhere would let a post publish somebody's SPA to a whole
// community. It runs before storage is touched at all.
export async function verifyAttachments(attachments, { projectId, userId }) {
  if (!attachments.length) return { attachments: [] }

  const totalError = `Your attachments add up to more than ${MAX_ATTACHMENTS_TOTAL_MB} MB. Please remove one or attach smaller files.`
  if (totalBytes(attachments) > MAX_ATTACHMENTS_TOTAL_MB * MB) return { error: totalError }

  const prefix = `${ATTACHMENT_PREFIX}/${projectId}/${userId}/`
  if (attachments.some(a => !a.key.startsWith(prefix))) {
    return { error: "One of your attachments wasn't uploaded for this post. Please attach it again." }
  }
  if (attachments.some(a => !ALLOWED_ATTACHMENT_TYPES.has(a.type))) {
    return { error: "One of your files isn't a type we support. Please attach a photo (JPG, PNG, WebP or GIF), a PDF or a Word document." }
  }

  const heads = await Promise.all(attachments.map(a => headObject(a.key)))
  if (heads.some(head => !head)) {
    return { error: "We couldn't find one of your uploaded files. Please attach it again." }
  }

  const stored = attachments.map((a, i) => ({ name: a.name, type: a.type, size: heads[i].ContentLength ?? a.size, key: a.key }))
  const oversized = stored.filter(a => a.size > MAX_ATTACHMENT_MB * MB)
  if (oversized.length) {
    await deleteAttachmentObjects(oversized.map(a => a.key))
    return { error: `Each file needs to be under ${MAX_ATTACHMENT_MB} MB. Please attach a smaller one.` }
  }
  if (totalBytes(stored) > MAX_ATTACHMENTS_TOTAL_MB * MB) return { error: totalError }

  return { attachments: stored }
}

// Signed against the start of the current hour and valid for two. Every read in
// the same hour then hands out the identical URL, so a browser that already has
// a photo serves it from its cache instead of downloading it again on each
// visit — and a URL a page is holding stays good for at least an hour.
const URL_WINDOW_MS = 60 * 60 * 1000

// Under `dataUrl`, the field AttachmentList has always read — the same choice
// routes/applications.js makes for ownership documents. The key stays
// server-side.
export async function withAttachmentUrls(attachments) {
  if (!attachments?.length) return []
  const signingDate = new Date(Math.floor(Date.now() / URL_WINDOW_MS) * URL_WINDOW_MS)
  const ttlSeconds = (2 * URL_WINDOW_MS) / 1000
  return Promise.all(attachments.map(async (a) => (
    a.key
      ? { name: a.name, type: a.type, size: a.size, dataUrl: await createDownloadUrl(a.key, ttlSeconds, { signingDate }) }
      // Rows written before attachments moved to storage carry their bytes
      // inline as a data URL — still valid, so passed through as they are.
      : a
  )))
}

export const parseAttachments = (json) => JSON.parse(json || '[]')

export const attachmentKeys = (json) => parseAttachments(json).map(a => a.key).filter(Boolean)

// Best-effort, after the row is already gone: a failed delete leaves an orphaned
// object, which costs storage, whereas failing the request would tell the
// resident their post still exists when it doesn't. Nothing else removes these —
// there is no lifecycle rule over this prefix.
export async function deleteAttachmentObjects(keys) {
  await Promise.all(keys.map(key => deleteObject(key).catch(err => {
    // eslint-disable-next-line no-console
    console.error(`Failed to delete S3 object ${key}`, err)
  })))
}

// toReference plus signed attachment URLs — shared by routes/references.js and
// the admin Overview summary in routes/projects.js.
export async function serializeReference(row) {
  const reference = toReference(row)
  return { ...reference, attachments: await withAttachmentUrls(reference.attachments) }
}
