// Frontend-only demo API — no backend required.
// All data lives in demoData.js and is deep-cloned at startup.
// Mutations (upvotes, votes, posts) work in-memory and reset on page refresh.

import * as seed from './demoData.js'

const clone = (x) => JSON.parse(JSON.stringify(x))

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

function logAudit({ actorName, actorRole, action, targetId, projectId, metadata = {} }) {
  store.auditLog.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actorName,
    actorRole,
    action,
    targetType: 'application',
    targetId,
    projectId,
    metadata,
    createdAt: new Date().toISOString()
  })
}

// Helper to add a small async delay so UI loading states are visible
const delay = (ms = 120) => new Promise(r => setTimeout(r, ms))

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
    await delay()
    const thread = {
      ...data,
      id: `f${projectId.slice(1)}-${Date.now()}`,
      upvotes: 0,
      replies: 0,
      pinned: false,
      createdAt: new Date().toISOString(),
      author: { name: 'Alex Lim', unit: 'B-21-03', tier: 'Owner', verified: true }
    }
    if (!store.forumThreads[projectId]) store.forumThreads[projectId] = []
    store.forumThreads[projectId].unshift(thread)
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
    await delay(60)
    const msg = {
      id: `m${++_msgCounter}`,
      sender: 'Alex Lim', unit: 'B-21-03', tier: 'Owner', verified: true,
      text, attachments,
      time: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
    if (!store.chatMessages[projectId]) store.chatMessages[projectId] = {}
    if (!store.chatMessages[projectId][channel]) store.chatMessages[projectId][channel] = []
    store.chatMessages[projectId][channel].push(msg)
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
