// The API client — every call here hits the Express + MySQL backend in
// `backend/`. Data persists and access control is enforced by the server.
//
// Two consequences worth knowing when reading call sites:
//
//   - Most reads need a verified community membership for the project (granted
//     by an admin approving an application). An unverified resident gets a 403,
//     which is what ProjectPage's LockedGate is for.
//   - Anything that used to be attributed client-side ("Alex Lim", the acting
//     admin) is now attributed from the bearer token, server-side. Callers no
//     longer pass an actor.
//
// Errors arrive as ApiError with a resident-safe `.message`, plus `.status` and
// the backend's field-level `.details` — see apiClient.js.

import { request, uploadToStorage } from './apiClient'

export { ApiError } from './apiClient'

// useAttachments (components/Attachments.jsx) hands us `{ name, type, size,
// dataUrl }` rather than the original File, because the demo needed something
// serialisable. Turning the data URL back into bytes here keeps that shared
// picker unchanged for the one flow that uploads to storage instead of posting
// the payload inline.
async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // These three return the raw { token, user } / user payloads; auth.jsx owns
  // what happens to the token. Don't call them directly from a component —
  // useAuth() keeps React state and storage in step.
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),

  registerAccount: ({ name, email, password }) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } }),

  getMe: () => request('/auth/me'),

  // ── Projects ──────────────────────────────────────────────────────────────
  // Public: the directory is browsable before signing in.
  getProjects: (params = {}) =>
    request('/projects', { query: { state: params.state, type: params.type, search: params.search } }),

  getProject: (id) => request(`/projects/${id}`),

  // Admin-only. The `role` guard is a UX short-circuit so a non-admin gets the
  // same message without a round trip — the server's requireRole('admin') is
  // the actual boundary.
  createProject: async (data, role) => {
    if (role && role !== 'admin') throw new Error('Only platform admins can add a community.')
    return request('/projects', {
      method: 'POST',
      body: {
        name: data.name,
        type: data.type,
        state: data.state,
        city: data.city,
        address: data.address,
        ownerCount: data.ownerCount,
        activityLevel: data.activityLevel,
        units: data.units,
        blocks: data.blocks,
        floorsPerBlock: data.floorsPerBlock
      }
    })
  },

  // ── Registration / verification ───────────────────────────────────────────
  // Submits an ownership-proof application in the three steps the backend
  // expects: ask for a presigned upload URL, send the file bytes directly to S3
  // (they never pass through the API server), then submit the returned key.
  //
  // `consent: true` is required by the server and is what stamps
  // consent_accepted_at — the caller must only reach here from a ticked box.
  submitApplication: async ({ projectId, unit, tier, phone, document, documentFile }) => {
    const { key, uploadUrl } = await request('/applications/upload-url', {
      method: 'POST',
      body: { fileName: documentFile.name, fileType: documentFile.type, fileSize: documentFile.size }
    })

    const blob = await dataUrlToBlob(documentFile.dataUrl)
    await uploadToStorage(uploadUrl, blob, documentFile.type)

    return request('/applications', {
      method: 'POST',
      body: {
        projectId,
        unit,
        tier,
        document,
        documentFile: { name: documentFile.name, type: documentFile.type, size: documentFile.size, key },
        ...(phone ? { phone } : {}),
        consent: true
      }
    })
  },

  // The caller's own applications, newest first — each with a short-lived
  // presigned download URL on documentFile.dataUrl, so AttachmentList renders it
  // exactly as it rendered the demo's inline data URLs.
  myApplications: () => request('/applications/mine'),

  // Pending only while pending; an admin can also erase a decided one (PDPA
  // erasure). Deletes the stored document as well.
  withdrawApplication: (id) => request(`/applications/${id}`, { method: 'DELETE' }),

  // Admin-only. See createProject for why `role` is checked client-side too.
  getVerificationQueue: async (role) => {
    if (role && role !== 'admin') return []
    return request('/applications')
  },

  // The deciding admin is taken from the bearer token server-side, which is what
  // populates decidedBy / decidedByName and the audit entry.
  decideVerification: (id, decision) =>
    request(`/applications/${id}/decision`, { method: 'POST', body: { decision } }),

  // Admin-only, newest first, capped at 200 by the server.
  getAuditLog: async (role) => {
    if (role && role !== 'admin') return []
    return request('/audit-log')
  },

  // ── Forum ─────────────────────────────────────────────────────────────────
  getForum: (projectId) => request(`/projects/${projectId}/forum`),

  createThread: (projectId, data) =>
    request(`/projects/${projectId}/forum`, {
      method: 'POST',
      body: {
        category: data.category,
        title: data.title,
        body: data.body,
        attachments: data.attachments || [],
        poll: data.poll || null
      }
    }),

  // One edit per post, author only — the server owns both rules and answers 409
  // / 403 with a message meant for the resident, so callers show `err.message`.
  editThread: (projectId, threadId, { title, body }) =>
    request(`/projects/${projectId}/forum/${threadId}`, { method: 'PATCH', body: { title, body } }),

  // Idempotent server-side: upvoting twice is a no-op, not a second vote.
  upvoteThread: (projectId, threadId) =>
    request(`/projects/${projectId}/forum/${threadId}/upvote`, { method: 'POST' }),

  voteThreadPoll: (projectId, threadId, optionId) =>
    request(`/projects/${projectId}/forum/${threadId}/poll-vote`, { method: 'POST', body: { optionId } }),

  deleteThread: (projectId, threadId) =>
    request(`/projects/${projectId}/forum/${threadId}`, { method: 'DELETE' }),

  // ── Chat ──────────────────────────────────────────────────────────────────
  getChatChannels: (projectId) => request(`/projects/${projectId}/chat/channels`),

  getChatMessages: (projectId, channel) => request(`/projects/${projectId}/chat/${channel}/messages`),

  sendChatMessage: (projectId, channel, text, attachments = []) =>
    request(`/projects/${projectId}/chat/${channel}/messages`, { method: 'POST', body: { text, attachments } }),

  editChatMessage: (projectId, channel, messageId, text) =>
    request(`/projects/${projectId}/chat/${channel}/messages/${messageId}`, { method: 'PATCH', body: { text } }),

  deleteChatMessage: (projectId, channel, messageId) =>
    request(`/projects/${projectId}/chat/${channel}/messages/${messageId}`, { method: 'DELETE' }),

  // ── Vendors ───────────────────────────────────────────────────────────────
  // One global directory, filtered server-side to the project's state/city.
  getVendors: (projectId) => request(`/projects/${projectId}/vendors`),

  // ── Petitions ─────────────────────────────────────────────────────────────
  getPetitions: (projectId) => request(`/projects/${projectId}/petitions`),

  createPetition: (projectId, data) =>
    request(`/projects/${projectId}/petitions`, {
      method: 'POST',
      body: { title: data.title, description: data.description, target: data.target }
    }),

  signPetition: (projectId, petitionId) =>
    request(`/projects/${projectId}/petitions/${petitionId}/sign`, { method: 'POST' }),

  // ── Polls ─────────────────────────────────────────────────────────────────
  getPolls: (projectId) => request(`/projects/${projectId}/polls`),

  votePoll: (projectId, pollId, optionId) =>
    request(`/projects/${projectId}/polls/${pollId}/vote`, { method: 'POST', body: { optionId } }),

  // ── Defects ───────────────────────────────────────────────────────────────
  getDefects: (projectId) => request(`/projects/${projectId}/defects`),

  createDefect: (projectId, data) =>
    request(`/projects/${projectId}/defects`, {
      method: 'POST',
      body: {
        title: data.title,
        description: data.description,
        category: data.category,
        block: data.block || '-',
        floorRange: data.floorRange || '-',
        unit: data.unit || '-',
        attachments: data.attachments || []
      }
    }),

  // ── Documents ─────────────────────────────────────────────────────────────
  getDocuments: (projectId) => request(`/projects/${projectId}/documents`),

  // ── References ────────────────────────────────────────────────────────────
  getReferences: (projectId) => request(`/projects/${projectId}/references`),

  // Admin-only. `uploadedBy` is set from the acting admin's name server-side.
  addReference: (projectId, data) =>
    request(`/projects/${projectId}/references`, {
      method: 'POST',
      body: {
        type: data.type,
        title: data.title,
        description: data.description || '',
        date: data.date,
        progress: data.progress,
        attachments: data.attachments || []
      }
    }),

  deleteReference: (projectId, refId) =>
    request(`/projects/${projectId}/references/${refId}`, { method: 'DELETE' }),

  // ── Fees ──────────────────────────────────────────────────────────────────
  // null when the project has no tracker set up — FeesPanel renders an empty
  // state for that, so it must stay null rather than becoming {}.
  getFees: (projectId) => request(`/projects/${projectId}/fees`),

  // ── Community requests ────────────────────────────────────────────────────
  // Public and unauthenticated — this is how someone asks for a community that
  // isn't on the platform yet. Admins read them back via GET.
  requestCommunity: (data) =>
    request('/community-requests', {
      method: 'POST',
      body: {
        name: data.name,
        city: data.city,
        state: data.state,
        developer: data.developer || '',
        note: data.note || ''
      }
    })
}
