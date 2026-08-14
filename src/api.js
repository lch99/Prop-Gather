// Frontend-only demo API — no backend required.
// All data lives in demoData.js and is deep-cloned at startup.
// Mutations (upvotes, votes, posts) work in-memory and reset on page refresh.

import * as seed from './demoData.js'
import { detectSensitiveContent, sensitiveContentMessage } from './sensitiveContent.js'

const clone = (x) => JSON.parse(JSON.stringify(x))

// Mirrors the backend's blockSensitiveContent middleware, which returns a 400
// for the same inputs (see backend/src/middleware/sensitiveContent.js). Throwing
// here keeps the demo honest: a post the real server would reject is rejected in
// the prototype too, so the UI never learns to depend on it succeeding.
function assertNoSensitiveContent(...values) {
  const kinds = detectSensitiveContent(values)
  if (kinds.length) throw new Error(sensitiveContentMessage(kinds))
}

// Mutable in-memory store — deep clone seed data so mutations don't affect the originals
const store = {
  projects:      clone(seed.projects),
  forumThreads:  clone(seed.forumThreads),
  chatChannels:  clone(seed.chatChannels),
  chatMessages:  clone(seed.chatMessages),
  vendors:       clone(seed.vendors),
  petitions:     clone(seed.petitions),
  polls:         clone(seed.polls),
  defects:       clone(seed.defects),
  documents:     clone(seed.documents),
  references:    clone(seed.references),
  feeTracker:    clone(seed.feeTracker),
  verificationQueue: [],
  // Communities granted via an approved application, keyed by projectId — merged
  // into getMe() so "Simulate admin approval" actually unlocks that project.
  approvedMemberships: [],
  // Mirrors the backend's audit_log table at demo scale — who did what to which
  // application, and when. See src/pages/AdminActivityLogPage.jsx.
  auditLog: [],
}

function logAudit({ actorName, actorRole, action, targetType = 'application', targetId, projectId, metadata = {} }) {
  store.auditLog.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actorName,
    actorRole,
    action,
    targetType,
    targetId,
    projectId,
    metadata,
    createdAt: new Date().toISOString()
  })
}

// Helper to add a small async delay so UI loading states are visible
const delay = (ms = 120) => new Promise(r => setTimeout(r, ms))

// Mirrors CHANNELS in backend/src/routes/chat.js — the same set every project gets.
const DEFAULT_CHAT_CHANNELS = ['general', 'defects', 'announcements', 'facilities', 'renovation']

// Vendor filtering: match by project state or city appearing in vendor districts
function vendorsForProject(projectId) {
  const project = store.projects.find(p => p.id === projectId)
  if (!project) return store.vendors
  return store.vendors.filter(v =>
    v.state === project.state || v.districts.includes(project.city)
  )
}

let _msgCounter = 1000

export const api = {
  // ── Projects ──────────────────────────────────────────────────────────────
  getProjects: async (params = {}) => {
    await delay()
    let results = store.projects
    if (params.state) results = results.filter(p => p.state === params.state)
    if (params.type)  results = results.filter(p => p.type  === params.type)
    if (params.search) {
      const q = params.search.toLowerCase()
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q)
      )
    }
    return clone(results)
  },

  getProject: async (id) => {
    await delay()
    const p = store.projects.find(p => p.id === id)
    if (!p) throw new Error('Project not found')
    return clone(p)
  },

  // Admin-only, mirrors POST /api/projects — admins add communities directly,
  // without going through the resident-facing "request a community" flow.
  // `role` is the acting user's role (from useAuth()), same convention as
  // getVerificationQueue/getAuditLog since this mock has no server boundary.
  createProject: async (data, role, actor) => {
    await delay()
    if (role !== 'admin') throw new Error('Only platform admins can add a community.')

    const name = (data.name || '').trim()
    const city = (data.city || '').trim()
    const state = (data.state || '').trim()
    const type = (data.type || '').trim()
    const address = (data.address || '').trim()
    if (!name || !city || !state || !type || !address) {
      throw new Error('Please fill in the community name, property type, address, city and state.')
    }
    // Same guard as the backend's 409: two rows for one building would split its
    // residents across two private spaces, each invisible to the other.
    const clash = store.projects.find(p =>
      p.name.toLowerCase() === name.toLowerCase() && p.city.toLowerCase() === city.toLowerCase()
    )
    if (clash) throw new Error(`${clash.name} is already on PropGather in ${clash.city}. Open the existing community instead of adding a second one.`)

    const project = {
      id: `p-${Date.now().toString(36)}`,
      name, type, state, city, address,
      ownerCount: Number(data.ownerCount) || 0,
      activityLevel: data.activityLevel || 'Low',
      units: Number(data.units) || 0,
      blocks: (data.blocks || []).map(b => b.trim()).filter(Boolean),
      floorsPerBlock: Number(data.floorsPerBlock) || 0,
      latestThread: null
    }
    store.projects.push(project)
    // The backend serves the same fixed channel list for every project (see
    // CHANNELS in backend/src/routes/chat.js), so a community added here gets
    // them too — otherwise its Chat tab would open with no channels at all.
    store.chatChannels[project.id] = [...DEFAULT_CHAT_CHANNELS]
    logAudit({
      actorName: actor?.name || 'Unknown admin',
      actorRole: 'admin',
      action: 'project.created',
      targetType: 'project',
      targetId: project.id,
      projectId: project.id,
      metadata: { name, type, city, state }
    })
    return clone(project)
  },

  getMe: async () => {
    await delay(60)
    const extra = store.approvedMemberships
      .filter(m => !seed.demoUser.communities.some(c => c.projectId === m.projectId))
      .map(m => {
        const project = store.projects.find(p => p.id === m.projectId)
        return {
          projectId: m.projectId,
          tier: m.tier,
          unit: m.unit,
          verifiedAt: m.verifiedAt,
          project: project ? { name: project.name, city: project.city, state: project.state } : null
        }
      })
    return clone({ ...seed.demoUser, communities: [...seed.demoUser.communities, ...extra] })
  },

  // ── Registration / verification ───────────────────────────────────────────
  // consentTimestamp (Date) comes from the checkbox in RegisterPage — persisting
  // it here (rather than only in component state) mirrors the backend's
  // consent_accepted_at column.
  register: async (data) => {
    await delay()
    const { consentTimestamp, ...rest } = data
    const app = {
      ...rest,
      id: `app-${Date.now()}`,
      status: 'Pending',
      submittedAt: new Date().toISOString(),
      consentAcceptedAt: consentTimestamp ? new Date(consentTimestamp).toISOString() : new Date().toISOString()
    }
    store.verificationQueue.push(app)
    logAudit({
      actorName: app.name,
      actorRole: 'resident',
      action: 'application.submitted',
      targetId: app.id,
      projectId: app.projectId,
      metadata: { tier: app.tier, unit: app.unit }
    })
    return clone(app)
  },

  // role is the acting user's role (from useAuth()) — mirrors the backend's
  // requireRole('admin') gate, since this mock has no server boundary of its own.
  getVerificationQueue: async (role) => {
    await delay()
    if (role !== 'admin') return []
    return clone(store.verificationQueue)
  },

  // actor is the deciding admin ({id, name}) from useAuth() — recorded on the
  // application and in the audit log, mirroring the backend's decided_by column.
  decideVerification: async (id, decision, actor) => {
    await delay()
    const app = store.verificationQueue.find(a => a.id === id)
    if (app) {
      app.status = decision === 'approve' ? 'Approved' : 'Rejected'
      app.decidedAt = new Date().toISOString()
      app.decidedBy = actor?.id || null
      app.decidedByName = actor?.name || null
      if (app.status === 'Approved') {
        const verifiedAt = new Date().toISOString().slice(0, 10)
        const existing = store.approvedMemberships.find(m => m.projectId === app.projectId)
        if (existing) {
          Object.assign(existing, { tier: app.tier, unit: app.unit, verifiedAt })
        } else {
          store.approvedMemberships.push({ projectId: app.projectId, tier: app.tier, unit: app.unit, verifiedAt })
        }
      }
      logAudit({
        actorName: actor?.name || 'Unknown admin',
        actorRole: 'admin',
        action: app.status === 'Approved' ? 'application.approved' : 'application.rejected',
        targetId: app.id,
        projectId: app.projectId,
        metadata: { tier: app.tier, unit: app.unit }
      })
    }
    return clone(app)
  },

  // Admin-only, mirrors GET /api/audit-log — newest first.
  getAuditLog: async (role) => {
    await delay()
    if (role !== 'admin') return []
    return clone(store.auditLog)
  },

  // ── Forum ─────────────────────────────────────────────────────────────────
  getForum: async (projectId) => {
    await delay()
    const threads = store.forumThreads[projectId] || []
    return clone([...threads].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.createdAt) - new Date(a.createdAt)
    }))
  },

  createThread: async (projectId, data) => {
    assertNoSensitiveContent(data.title, data.body)
    await delay()
    const thread = {
      ...data,
      id: `f${projectId.slice(1)}-${Date.now()}`,
      upvotes: 0,
      replies: 0,
      editedAt: null,
      pinned: false,
      createdAt: new Date().toISOString(),
      author: { name: 'Alex Lim', unit: 'B-21-03', tier: 'Owner', verified: true }
    }
    if (!store.forumThreads[projectId]) store.forumThreads[projectId] = []
    store.forumThreads[projectId].unshift(thread)
    return clone(thread)
  },

  // One edit per post, author only — mirrors PATCH /api/projects/:id/forum/:threadId.
  // `editedAt` is both the "allowance spent" flag and what the UI shows as
  // "(edited)", so a changed post is never silently different from what people
  // replied to.
  editThread: async (projectId, threadId, { title, body }) => {
    assertNoSensitiveContent(title, body)
    const thread = (store.forumThreads[projectId] || []).find(t => t.id === threadId)
    if (!thread) throw new Error('Thread not found')
    if (thread.editedAt) throw new Error('This post has already been edited. Posts can only be edited once.')
    await delay()
    thread.title = title
    thread.body = body
    thread.editedAt = new Date().toISOString()
    return clone(thread)
  },

  upvoteThread: async (projectId, threadId) => {
    await delay(60)
    const thread = (store.forumThreads[projectId] || []).find(t => t.id === threadId)
    if (thread) thread.upvotes += 1
    return clone(thread)
  },

  voteThreadPoll: async (projectId, threadId, optionId) => {
    await delay(60)
    const thread = (store.forumThreads[projectId] || []).find(t => t.id === threadId)
    if (thread?.poll && !thread.poll.votedByMe) {
      const opt = thread.poll.options.find(o => o.id === optionId)
      if (opt) opt.votes += 1
      thread.poll.votedByMe = optionId
    }
    return clone(thread)
  },

  // Lets a resident remove their own post — mirrors the backend's
  // DELETE /api/projects/:projectId/forum/:threadId (PDPA right to have
  // personal data / contributed content removed, not just verification docs).
  deleteThread: async (projectId, threadId) => {
    await delay(60)
    if (store.forumThreads[projectId]) {
      store.forumThreads[projectId] = store.forumThreads[projectId].filter(t => t.id !== threadId)
    }
    return { ok: true }
  },

  // ── Chat ──────────────────────────────────────────────────────────────────
  getChatChannels: async (projectId) => {
    await delay()
    return clone(store.chatChannels[projectId] || [])
  },

  getChatMessages: async (projectId, channel) => {
    await delay()
    return clone((store.chatMessages[projectId] || {})[channel] || [])
  },

  sendChatMessage: async (projectId, channel, text, attachments = []) => {
    assertNoSensitiveContent(text)
    await delay(60)
    const msg = {
      id: `m${++_msgCounter}`,
      sender: 'Alex Lim', unit: 'B-21-03', tier: 'Owner', verified: true,
      text, attachments, editedAt: null,
      time: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
    if (!store.chatMessages[projectId]) store.chatMessages[projectId] = {}
    if (!store.chatMessages[projectId][channel]) store.chatMessages[projectId][channel] = []
    store.chatMessages[projectId][channel].push(msg)
    return clone(msg)
  },

  // One edit per message, sender only — mirrors
  // PATCH /api/projects/:projectId/chat/:channel/messages/:messageId.
  editChatMessage: async (projectId, channel, messageId, text) => {
    assertNoSensitiveContent(text)
    const msg = (store.chatMessages[projectId]?.[channel] || []).find(m => m.id === messageId)
    if (!msg) throw new Error('Message not found')
    if (msg.editedAt) throw new Error('This message has already been edited. Messages can only be edited once.')
    await delay(60)
    msg.text = text
    msg.editedAt = new Date().toISOString()
    return clone(msg)
  },

  // Lets a resident remove their own message — mirrors the backend's
  // DELETE /api/projects/:projectId/chat/:channel/messages/:messageId.
  deleteChatMessage: async (projectId, channel, messageId) => {
    await delay(60)
    const channelMessages = store.chatMessages[projectId]?.[channel]
    if (channelMessages) {
      store.chatMessages[projectId][channel] = channelMessages.filter(m => m.id !== messageId)
    }
    return { ok: true }
  },

  // ── Vendors ───────────────────────────────────────────────────────────────
  getVendors: async (projectId) => {
    await delay()
    return clone(vendorsForProject(projectId))
  },

  // ── Petitions ─────────────────────────────────────────────────────────────
  getPetitions: async (projectId) => {
    await delay()
    return clone(store.petitions[projectId] || [])
  },

  createPetition: async (projectId, data) => {
    assertNoSensitiveContent(data.title, data.description)
    await delay()
    const pet = {
      ...data,
      id: `pet${projectId.slice(1)}-${Date.now()}`,
      signatures: 0,
      signedByMe: false,
      createdBy: 'Alex Lim (B-21-03)',
      createdAt: new Date().toISOString().slice(0, 10)
    }
    if (!store.petitions[projectId]) store.petitions[projectId] = []
    store.petitions[projectId].unshift(pet)
    return clone(pet)
  },

  signPetition: async (projectId, petId) => {
    await delay(60)
    const pet = (store.petitions[projectId] || []).find(p => p.id === petId)
    if (pet && !pet.signedByMe) {
      pet.signatures += 1
      pet.signedByMe = true
    }
    return clone(pet)
  },

  // ── Polls ─────────────────────────────────────────────────────────────────
  getPolls: async (projectId) => {
    await delay()
    return clone(store.polls[projectId] || [])
  },

  votePoll: async (projectId, pollId, optionId) => {
    await delay(60)
    const poll = (store.polls[projectId] || []).find(p => p.id === pollId)
    if (poll && !poll.votedByMe) {
      const opt = poll.options.find(o => o.id === optionId)
      if (opt) opt.votes += 1
      poll.votedByMe = optionId
    }
    return clone(poll)
  },

  // ── Defects ───────────────────────────────────────────────────────────────
  getDefects: async (projectId) => {
    await delay()
    return clone(store.defects[projectId] || [])
  },

  createDefect: async (projectId, data) => {
    assertNoSensitiveContent(data.title, data.description)
    await delay()
    const defect = {
      ...data,
      id: `d${projectId.slice(1)}-${Date.now()}`,
      status: 'Open',
      reportedBy: 'Alex Lim',
      reportedAt: new Date().toISOString().slice(0, 10),
      matchingUnits: 1
    }
    if (!store.defects[projectId]) store.defects[projectId] = []
    store.defects[projectId].unshift(defect)
    return clone(defect)
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  getDocuments: async (projectId) => {
    await delay()
    return clone(store.documents[projectId] || [])
  },

  // ── References ────────────────────────────────────────────────────────────
  getReferences: async (projectId) => {
    await delay()
    return clone(store.references[projectId] || [])
  },

  addReference: async (projectId, data) => {
    await delay()
    const ref = {
      ...data,
      id: `ref-${projectId}-${Date.now()}`,
      uploadedBy: 'Admin',
      date: new Date().toISOString().slice(0, 10),
      attachments: data.attachments || []
    }
    if (!store.references[projectId]) store.references[projectId] = []
    store.references[projectId].unshift(ref)
    return clone(ref)
  },

  deleteReference: async (projectId, refId) => {
    await delay(60)
    if (store.references[projectId]) {
      store.references[projectId] = store.references[projectId].filter(r => r.id !== refId)
    }
    return { ok: true }
  },

  // ── Fees ──────────────────────────────────────────────────────────────────
  getFees: async (projectId) => {
    await delay()
    return clone(store.feeTracker[projectId] || null)
  },

  // ── Community requests ────────────────────────────────────────────────────
  requestCommunity: async (_data) => {
    await delay()
    return { ok: true }
  }
}
