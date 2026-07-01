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
    return clone(seed.demoUser)
  },

  // ── Registration / verification ───────────────────────────────────────────
  register: async (data) => {
    await delay()
    const app = { ...data, id: `app-${Date.now()}`, status: 'Pending', submittedAt: new Date().toISOString() }
    store.verificationQueue.push(app)
    return clone(app)
  },

  getVerificationQueue: async () => {
    await delay()
    return clone(store.verificationQueue)
  },

  decideVerification: async (id, decision) => {
    await delay()
    const app = store.verificationQueue.find(a => a.id === id)
    if (app) app.status = decision
    return clone(app)
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
