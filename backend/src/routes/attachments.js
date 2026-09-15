import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { badRequest } from '../util/errors.js'
import { buildAttachmentKey, createUploadUrl } from '../util/s3.js'
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_MB } from '../util/attachments.js'
import { wrap } from '../util/asyncHandler.js'

// Step 1 of attaching a file to a forum post, chat message, defect report or
// reference — see util/attachments.js for the whole flow and why it exists.
// Mounted at /api/projects/:projectId/attachments.
export const attachmentsRouter = Router({ mergeParams: true })

const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, 'fileName is required').max(200),
  fileType: z.string().trim().min(1, 'fileType is required'),
  fileSize: z.number().positive().max(MAX_ATTACHMENT_MB * 1024 * 1024, `Each file needs to be under ${MAX_ATTACHMENT_MB} MB.`)
})

// Members only (admins pass requireMembership everywhere): the people who can
// post in a community are the only ones who can put files in it. References are
// admin-only, but that is enforced where the key gets attached, not here.
attachmentsRouter.post('/upload-url', requireAuth, requireMembership, validate(uploadUrlSchema), wrap(async (req, res, next) => {
  if (!ALLOWED_ATTACHMENT_TYPES.has(req.body.fileType)) {
    return next(badRequest("That file type isn't supported. Please attach a photo (JPG, PNG, WebP or GIF), a PDF or a Word document."))
  }

  const key = buildAttachmentKey(req.params.projectId, req.user.id)
  const uploadUrl = await createUploadUrl(key, req.body.fileType)
  res.json({ key, uploadUrl, expiresIn: 300 })
}))
