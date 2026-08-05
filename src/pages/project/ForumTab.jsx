import { useEffect, useState } from 'react'
import { api } from '../../api'
import { C, card, button, badge } from '../../theme'
import { useAuth } from '../../auth'
import { AuthorLine } from '../../components/Badges'
import { useAttachments, AttachmentPicker, AttachmentList } from '../../components/Attachments'
import PollView from '../../components/PollView'

const categories = [
  'Defects & Repairs', 'Building Management', 'Security', 'Maintenance Fees',
  'Contractors & Services', 'Marketplace', 'Facilities', 'General Discussion'
]

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ForumTab({ projectId }) {
  const { user } = useAuth()
  const [threads, setThreads] = useState([])
  const [category, setCategory] = useState('All')
  const [showNew, setShowNew] = useState(false)
  const [newThread, setNewThread] = useState({ category: categories[0], title: '', body: '' })
  const [poll, setPoll] = useState(null) // null = no poll; { question, options: [str, ...] }
  const { attachments, addFiles, removeAttachment, error: uploadError, reset: resetAttachments } = useAttachments()

  const load = () => api.getForum(projectId).then(setThreads)

  useEffect(() => { load() }, [projectId])

  const filtered = category === 'All' ? threads : threads.filter(t => t.category === category)

  const upvote = async (threadId) => {
    const updated = await api.upvoteThread(projectId, threadId)
    setThreads(ts => ts.map(t => t.id === updated.id ? updated : t))
  }

  const voteThreadPoll = async (threadId, optionId) => {
    const updated = await api.voteThreadPoll(projectId, threadId, optionId)
    setThreads(ts => ts.map(t => t.id === updated.id ? updated : t))
  }

  // You can remove your own post — this is the PDPA right to have content
  // you contributed deleted, not just your verification document.
  const deleteThread = async (threadId) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    await api.deleteThread(projectId, threadId)
    setThreads(ts => ts.filter(t => t.id !== threadId))
  }

  // --- poll builder helpers (form) ---
  const addPoll = () => setPoll({ question: '', options: ['', ''] })
  const removePoll = () => setPoll(null)
  const setPollQuestion = (q) => setPoll(p => ({ ...p, question: q }))
  const setPollOption = (i, val) => setPoll(p => ({ ...p, options: p.options.map((o, idx) => idx === i ? val : o) }))
  const addPollOption = () => setPoll(p => ({ ...p, options: [...p.options, ''] }))
  const removePollOption = (i) => setPoll(p => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }))

  const submit = async () => {
    if (!newThread.title || !newThread.body) return
    let pollPayload = null
    if (poll) {
      const options = poll.options.map(o => o.trim()).filter(Boolean)
      if (poll.question.trim() && options.length >= 2) {
        pollPayload = { question: poll.question.trim(), options }
      }
    }
    await api.createThread(projectId, { ...newThread, attachments, poll: pollPayload })
    setNewThread({ category: categories[0], title: '', body: '' })
    setPoll(null)
    resetAttachments()
    setShowNew(false)
    load()
  }

  return (
    <div className="pg-forum-grid" style={{ display: 'grid', gap: 20 }}>
      <div>
        <div className="pg-forum-cats" style={{ ...card, padding: 12 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8, fontSize: 13 }}>CATEGORIES</div>
          {['All', ...categories].map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px',
                background: category === c ? C.blueLight : 'transparent',
                color: category === c ? C.blue : C.text,
                border: 'none', borderRadius: C.radiusSm, fontSize: 13, fontWeight: category === c ? 700 : 400,
                marginBottom: 2
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ color: C.textMuted, fontSize: 14 }}>{filtered.length} thread{filtered.length !== 1 ? 's' : ''}</div>
          <button style={button('primary')} onClick={() => setShowNew(s => !s)}>+ New thread</button>
        </div>

        {showNew && (
          <div style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gap: 10 }}>
            <select value={newThread.category} onChange={e => setNewThread(t => ({ ...t, category: e.target.value }))}
              style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Thread title"
              value={newThread.title}
              onChange={e => setNewThread(t => ({ ...t, title: e.target.value }))}
              style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}
            />
            <textarea
              placeholder="Write your post..."
              value={newThread.body}
              onChange={e => setNewThread(t => ({ ...t, body: e.target.value }))}
              rows={3}
              style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <AttachmentPicker
                attachments={attachments}
                addFiles={addFiles}
                removeAttachment={removeAttachment}
                error={uploadError}
                compact
              />
              {!poll && (
                <button
                  type="button"
                  onClick={addPoll}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
                    background: C.blueLight, color: C.blue, fontSize: 14, fontWeight: 600
                  }}
                >
                  📊 Add a poll
                </button>
              )}
              <button style={button('primary')} onClick={submit}>Post</button>
            </div>
            <div style={{ fontSize: 12, color: C.textFaint, marginTop: -4 }}>Up to 6 files · 5 MB per file · 10 MB total</div>

            {poll && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 12, display: 'grid', gap: 8, background: C.bg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>POLL</span>
                  <button type="button" onClick={removePoll} style={{ border: 'none', background: 'none', color: C.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Remove poll
                  </button>
                </div>
                <input
                  placeholder="Poll question (e.g. Should we repaint the lobby?)"
                  value={poll.question}
                  onChange={e => setPollQuestion(e.target.value)}
                  style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}
                />
                {poll.options.map((o, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder={`Option ${i + 1}`}
                      value={o}
                      onChange={e => setPollOption(i, e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}
                    />
                    {poll.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePollOption(i)}
                        aria-label={`Remove option ${i + 1}`}
                        style={{ border: `1px solid ${C.border}`, background: '#fff', color: C.danger, borderRadius: C.radiusSm, padding: '0 12px', fontSize: 16, cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div>
                  <button type="button" onClick={addPollOption} style={{ ...button('outline'), fontSize: 13, padding: '7px 14px' }}>
                    + Add option
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(t => (
            <div key={t.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {t.pinned && <span style={badge(C.accent, C.accentLight)}>📌 Pinned</span>}
                  <span style={badge(C.blue, C.blueLight)}>{t.category}</span>
                </div>
                <span style={{ fontSize: 12, color: C.textFaint }}>{timeAgo(t.createdAt)}</span>
              </div>
              <h3 style={{ margin: '0 0 6px', color: C.navy }}>{t.title}</h3>
              <p style={{ margin: '0 0 10px', color: C.text, fontSize: 14 }}>{t.body}</p>
              <AttachmentList attachments={t.attachments} style={{ marginBottom: 10 }} />
              {t.poll && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 14, marginBottom: 10, background: C.bg }}>
                  <PollView poll={t.poll} onVote={(optionId) => voteThreadPoll(t.id, optionId)} compact />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <AuthorLine author={t.author} />
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 13, color: C.textMuted }}>
                  <button onClick={() => upvote(t.id)} style={{ border: 'none', background: 'none', color: C.textMuted, fontSize: 13 }}>
                    ▲ {t.upvotes}
                  </button>
                  <span>💬 {t.replies}</span>
                  {t.author?.name === user?.name && (
                    <button
                      onClick={() => deleteThread(t.id)}
                      title="Delete your post"
                      style={{ border: 'none', background: 'none', color: C.danger, fontSize: 13, cursor: 'pointer', padding: 0 }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ ...card, padding: 24, textAlign: 'center', color: C.textMuted }}>No threads in this category yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
