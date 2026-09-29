import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { C, card, button, badge } from '../../theme'
import { useAuth } from '../../auth'
import { AuthorLine } from '../../components/Badges'
import { useAttachments, AttachmentPicker, AttachmentList } from '../../components/Attachments'
import SensitiveContentNotice, { hasSensitiveContent } from '../../components/SensitiveContentNotice'
import PollView from '../../components/PollView'
import { msg, useI18n, useT } from '../../i18n'
import LoadingScreen, { LoadingInline } from '../../components/Loading'

// The values are what the server stores and filters on, so they stay English;
// only their labels are translated.
const categories = [
  msg('Defects & Repairs'), msg('Building Management'), msg('Security'), msg('Maintenance Fees'),
  msg('Contractors & Services'), msg('Marketplace'), msg('Facilities'), msg('General Discussion')
]

// A page at a time — the forum used to load every thread a community had ever
// posted each time it was opened. More load when the resident asks for them.
const PAGE_SIZE = 20

function timeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return t('just now')
  if (hours < 24) return t('{n}h ago', { n: hours })
  return t('{n}d ago', { n: Math.floor(hours / 24) })
}

// A thread's replies, opened under it on demand. Loads the newest page, oldest
// first, like a chat channel; `onCountChange(±1)` keeps the thread's 💬 count in
// step without re-reading the forum.
const REPLY_PAGE_SIZE = 50

function ThreadReplies({ projectId, threadId, isAdmin, onCountChange }) {
  const t = useT()
  const [replies, setReplies] = useState(null) // null = still loading
  const [hasEarlier, setHasEarlier] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const blocked = hasSensitiveContent(draft)

  useEffect(() => {
    let alive = true
    api.getThreadReplies(projectId, threadId, { limit: REPLY_PAGE_SIZE })
      .then(page => {
        if (!alive) return
        setReplies(page)
        setHasEarlier(page.length === REPLY_PAGE_SIZE)
      })
      .catch(err => {
        if (!alive) return
        setReplies([])
        setError(err.message)
      })
    return () => { alive = false }
  }, [projectId, threadId])

  const loadEarlier = async () => {
    const oldest = replies?.[0]
    if (!oldest || loadingEarlier) return
    setLoadingEarlier(true)
    try {
      const page = await api.getThreadReplies(projectId, threadId, { before: oldest.id, limit: REPLY_PAGE_SIZE })
      setReplies(rs => [...page, ...rs])
      setHasEarlier(page.length === REPLY_PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingEarlier(false)
    }
  }

  const send = async () => {
    const body = draft.trim()
    if (!body || blocked || sending || replies === null) return
    setSending(true)
    setError('')
    try {
      const reply = await api.createThreadReply(projectId, threadId, body)
      setReplies(rs => [...(rs || []), reply])
      setDraft('')
      onCountChange(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const remove = async (replyId) => {
    if (!window.confirm(t('Delete this reply? This cannot be undone.'))) return
    try {
      await api.deleteThreadReply(projectId, threadId, replyId)
      setReplies(rs => rs.filter(r => r.id !== replyId))
      onCountChange(-1)
      setError('')
    } catch (err) {
      setError(err.message || t("We couldn't delete that reply just now. Please try again."))
    }
  }

  // Also held until the list has loaded, or it could land on top of a reply
  // posted in the meantime.
  const cantSend = !draft.trim() || blocked || replies === null

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12, display: 'grid', gap: 10 }}>
      {hasEarlier && (
        <button onClick={loadEarlier} disabled={loadingEarlier} style={{ ...button('outline'), justifySelf: 'center', fontSize: 12, padding: '6px 12px' }}>
          {loadingEarlier ? t('Loading…') : t('Show earlier replies')}
        </button>
      )}
      {replies === null && <LoadingInline label={t('Loading replies…')} style={{ padding: 8, fontSize: 13 }} />}
      {replies?.length === 0 && !error && (
        <div style={{ fontSize: 13, color: C.textMuted }}>{t('No replies yet — be the first to respond.')}</div>
      )}
      {replies?.map(r => (
        <div key={r.id} style={{ background: C.bg, borderRadius: C.radiusSm, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            {r.author ? <AuthorLine author={r.author} /> : <span style={{ fontSize: 13, color: C.textMuted }}>{t('Former resident')}</span>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.textFaint }}>{timeAgo(r.createdAt, t)}</span>
              {(r.mine || isAdmin) && (
                <button
                  onClick={() => remove(r.id)}
                  title={r.mine ? t('Delete your reply') : t('Remove this reply (admin)')}
                  aria-label={r.mine ? t('Delete your reply') : t('Remove this reply')}
                  style={{ border: 'none', background: 'none', color: C.danger, fontSize: 13, cursor: 'pointer', padding: 0 }}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 14, color: C.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body}</div>
        </div>
      ))}
      {error && <div role="alert" style={{ fontSize: 13, color: C.danger }}>{error}</div>}
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder={t('Write a reply…')}
        aria-label={t('Write a reply')}
        rows={2}
        maxLength={2000}
        style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
      />
      <SensitiveContentNotice values={[draft]} />
      <button
        onClick={send}
        disabled={cantSend || sending}
        style={{
          ...button('primary'), justifySelf: 'end',
          ...(cantSend ? { opacity: 0.5, cursor: 'not-allowed' } : sending ? { opacity: 0.7, cursor: 'wait' } : {})
        }}
      >
        {sending ? t('Replying…') : t('Reply')}
      </button>
    </div>
  )
}

export default function ForumTab({ projectId }) {
  const { user } = useAuth()
  const { t, formatDate } = useI18n()
  const isAdmin = user?.role === 'admin'
  const [threads, setThreads] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [category, setCategory] = useState('All')
  // Bumped to re-read the first page, e.g. after posting.
  const [reloadKey, setReloadKey] = useState(0)
  const [showNew, setShowNew] = useState(false)
  const [newThread, setNewThread] = useState({ category: categories[0], title: '', body: '' })
  const [poll, setPoll] = useState(null) // null = no poll; { question, options: [str, ...] }
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [editingId, setEditingId] = useState(null) // thread id currently open in the inline editor
  const [editDraft, setEditDraft] = useState({ title: '', body: '' })
  const [editError, setEditError] = useState('')
  // For the one-tap actions below (upvote, poll vote, delete) rather than
  // loadError, which also gates the "no threads yet" empty state — a failed
  // upvote must not make a populated list look empty.
  const [actionError, setActionError] = useState('')
  const [openReplies, setOpenReplies] = useState(() => new Set()) // thread ids with replies expanded
  const { attachments, addFiles, removeAttachment, error: uploadError, reset: resetAttachments } = useAttachments()

  // Which list is on screen. A page that arrives after the category changed, or
  // after the first page was re-read, belongs to a list that is gone — dropped.
  const listVersion = useRef(0)

  const fetchPage = (before) => api.getForum(projectId, {
    category: category === 'All' ? undefined : category,
    before,
    limit: PAGE_SIZE
  })

  useEffect(() => {
    const version = ++listVersion.current
    setLoading(true)
    setLoadError('')
    fetchPage()
      .then(page => {
        if (version !== listVersion.current) return
        setThreads(page)
        setHasMore(page.length === PAGE_SIZE)
      })
      .catch(err => {
        if (version !== listVersion.current) return
        setThreads([])
        setHasMore(false)
        setLoadError(err.message)
      })
      .finally(() => {
        if (version === listVersion.current) setLoading(false)
      })
  }, [projectId, category, reloadKey])

  const loadMore = async () => {
    const last = threads[threads.length - 1]
    if (!last || loadingMore) return
    const version = listVersion.current
    setLoadingMore(true)
    setLoadError('')
    try {
      const page = await fetchPage(last.id)
      if (version !== listVersion.current) return
      setThreads(ts => [...ts, ...page])
      setHasMore(page.length === PAGE_SIZE)
    } catch (err) {
      if (version === listVersion.current) setLoadError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const blockedByPii = hasSensitiveContent(newThread.title, newThread.body)
  const editBlocked = hasSensitiveContent(editDraft.title, editDraft.body)

  // A second tap takes the upvote back.
  const toggleUpvote = async (thread) => {
    try {
      const updated = thread.upvotedByMe
        ? await api.removeThreadUpvote(projectId, thread.id)
        : await api.upvoteThread(projectId, thread.id)
      setThreads(ts => ts.map(th => th.id === updated.id ? updated : th))
      setActionError('')
    } catch (err) {
      setActionError(err.message || t("We couldn't record that upvote just now. Please try again."))
    }
  }

  const voteThreadPoll = async (threadId, optionId) => {
    try {
      const updated = await api.voteThreadPoll(projectId, threadId, optionId)
      setThreads(ts => ts.map(th => th.id === updated.id ? updated : th))
      setActionError('')
    } catch (err) {
      setActionError(err.message || t("We couldn't record that vote just now. Please try again."))
    }
  }

  // A post can be corrected once. The allowance is deliberately small: it covers
  // the typo you spot right after posting without letting a thread others have
  // replied to be rewritten into something else later.
  const startEdit = (thread) => {
    setEditingId(thread.id)
    setEditDraft({ title: thread.title, body: thread.body })
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEdit = async (threadId) => {
    if (!editDraft.title.trim() || !editDraft.body.trim()) {
      setEditError(t('Your post needs a title and some text.'))
      return
    }
    if (editBlocked) return
    try {
      const updated = await api.editThread(projectId, threadId, editDraft)
      // Replaced in place rather than re-reading the list, which would drop every
      // page loaded past the first.
      setThreads(ts => ts.map(th => th.id === updated.id ? updated : th))
      setEditingId(null)
      setEditError('')
    } catch (err) {
      setEditError(err.message)
    }
  }

  // You can remove your own post — this is the PDPA right to have content
  // you contributed deleted, not just your verification document.
  const deleteThread = async (threadId) => {
    if (!window.confirm(t('Delete this post? This cannot be undone.'))) return
    try {
      await api.deleteThread(projectId, threadId)
      setThreads(ts => ts.filter(th => th.id !== threadId))
      setActionError('')
    } catch (err) {
      setActionError(err.message || t("We couldn't delete that post just now. Please try again."))
    }
  }

  const toggleReplies = (threadId) => setOpenReplies(open => {
    const next = new Set(open)
    if (next.has(threadId)) next.delete(threadId)
    else next.add(threadId)
    return next
  })

  const changeReplyCount = (threadId, delta) =>
    setThreads(ts => ts.map(th => th.id === threadId ? { ...th, replies: Math.max(0, th.replies + delta) } : th))

  // --- poll builder helpers (form) ---
  const addPoll = () => setPoll({ question: '', options: ['', ''] })
  const removePoll = () => setPoll(null)
  const setPollQuestion = (q) => setPoll(p => ({ ...p, question: q }))
  const setPollOption = (i, val) => setPoll(p => ({ ...p, options: p.options.map((o, idx) => idx === i ? val : o) }))
  const addPollOption = () => setPoll(p => ({ ...p, options: [...p.options, ''] }))
  const removePollOption = (i) => setPoll(p => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }))

  const submit = async () => {
    if (!newThread.title || !newThread.body || posting) return
    if (hasSensitiveContent(newThread.title, newThread.body)) return
    let pollPayload = null
    if (poll) {
      const options = poll.options.map(o => o.trim()).filter(Boolean)
      // Said rather than quietly posting without the poll the resident built.
      if (!poll.question.trim() || options.length < 2) {
        setPostError(t('Your poll needs a question and at least 2 options. Fill them in, or tap "Remove poll" to post without one.'))
        return
      }
      pollPayload = { question: poll.question.trim(), options }
    }
    setPosting(true)
    setPostError('')
    try {
      await api.createThread(projectId, { ...newThread, attachments, poll: pollPayload })
    } catch (err) {
      // Photos upload before the post is created, so this is also where a failed
      // upload or a refused file surfaces. The form stays as it was.
      setPostError(err.message)
      return
    } finally {
      setPosting(false)
    }
    setNewThread({ category: categories[0], title: '', body: '' })
    setPoll(null)
    resetAttachments()
    setShowNew(false)
    setReloadKey(k => k + 1)
  }

  return (
    <div className="pg-forum-grid" style={{ display: 'grid', gap: 20 }}>
      <div>
        <div className="pg-forum-cats" style={{ ...card, padding: 12 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8, fontSize: 13 }}>{t('CATEGORIES')}</div>
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
              {t(c)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ color: C.textMuted, fontSize: 14 }}>
            {loading
              ? t('Loading posts…')
              : t(threads.length === 1 && !hasMore ? '{n} thread' : '{n} threads', { n: `${threads.length}${hasMore ? '+' : ''}` })}
          </div>
          <button style={button('primary')} onClick={() => setShowNew(s => !s)}>+ {t('New thread')}</button>
        </div>

        {showNew && (
          <div style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gap: 10 }}>
            <select value={newThread.category} onChange={e => setNewThread(nt => ({ ...nt, category: e.target.value }))}
              aria-label={t('Category')}
              style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}>
              {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
            </select>
            <input
              placeholder={t('Thread title')}
              value={newThread.title}
              onChange={e => setNewThread(nt => ({ ...nt, title: e.target.value }))}
              style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}
            />
            <textarea
              placeholder={t('Write your post...')}
              value={newThread.body}
              onChange={e => setNewThread(nt => ({ ...nt, body: e.target.value }))}
              rows={3}
              style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14, resize: 'vertical' }}
            />

            <SensitiveContentNotice values={[newThread.title, newThread.body]} />

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
                  📊 {t('Add a poll')}
                </button>
              )}
              <button
                style={{
                  ...button('primary'),
                  ...(blockedByPii ? { opacity: 0.5, cursor: 'not-allowed' } : posting ? { opacity: 0.7, cursor: 'wait' } : {})
                }}
                onClick={submit}
                disabled={blockedByPii || posting}
              >
                {posting ? (attachments.length ? t('Uploading…') : t('Posting…')) : t('Post')}
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.textFaint, marginTop: -4 }}>
              {t('Up to {max} files · {perFile} MB per file · {total} MB total', { max: 6, perFile: 5, total: 10 })}
            </div>

            {postError && (
              <div role="alert" style={{ fontSize: 13, color: C.danger, background: C.dangerBg, padding: '8px 10px', borderRadius: C.radiusSm }}>
                {postError}
              </div>
            )}

            {poll && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 12, display: 'grid', gap: 8, background: C.bg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>{t('POLL')}</span>
                  <button type="button" onClick={removePoll} style={{ border: 'none', background: 'none', color: C.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {t('Remove poll')}
                  </button>
                </div>
                <input
                  placeholder={t('Poll question (e.g. Should we repaint the lobby?)')}
                  value={poll.question}
                  onChange={e => setPollQuestion(e.target.value)}
                  style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}
                />
                {poll.options.map((o, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder={t('Option {n}', { n: i + 1 })}
                      value={o}
                      onChange={e => setPollOption(i, e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14 }}
                    />
                    {poll.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePollOption(i)}
                        aria-label={t('Remove option {n}', { n: i + 1 })}
                        style={{ border: `1px solid ${C.border}`, background: '#fff', color: C.danger, borderRadius: C.radiusSm, padding: '0 12px', fontSize: 16, cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div>
                  <button type="button" onClick={addPollOption} style={{ ...button('outline'), fontSize: 13, padding: '7px 14px' }}>
                    + {t('Add option')}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {loadError && (
          <div role="alert" style={{ ...card, padding: 14, marginBottom: 12, color: C.danger, fontSize: 14 }}>
            {loadError}
          </div>
        )}
        {actionError && (
          <div role="alert" style={{ ...card, padding: 14, marginBottom: 12, color: C.danger, fontSize: 14 }}>
            {actionError}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, opacity: loading && threads.length > 0 ? 0.5 : 1 }}>
          {/* First load of a category: nothing to dim yet, so show the loader. */}
          {loading && threads.length === 0 && (
            <div style={{ ...card }}>
              <LoadingScreen label={t('Loading posts…')} minHeight={220} />
            </div>
          )}
          {threads.map(th => (
            <div key={th.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {th.pinned && <span style={badge(C.accent, C.accentLight)}>📌 {t('Pinned')}</span>}
                  <span style={badge(C.blue, C.blueLight)}>{t(th.category)}</span>
                </div>
                <span style={{ fontSize: 12, color: C.textFaint }}>{timeAgo(th.createdAt, t)}</span>
              </div>
              {editingId === th.id ? (
                <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                  <input
                    value={editDraft.title}
                    onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                    style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 15, fontWeight: 700, color: C.navy }}
                  />
                  <textarea
                    value={editDraft.body}
                    onChange={e => setEditDraft(d => ({ ...d, body: e.target.value }))}
                    rows={3}
                    style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14, resize: 'vertical' }}
                  />
                  <SensitiveContentNotice values={[editDraft.title, editDraft.body]} />
                  <div style={{ fontSize: 12, color: C.textFaint }}>
                    {t('You can edit a post once — after saving, this can’t be changed again.')}
                  </div>
                  {editError && <div style={{ fontSize: 13, color: C.danger }}>{editError}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{ ...button('primary'), ...(editBlocked ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                      onClick={() => saveEdit(th.id)}
                      disabled={editBlocked}
                    >
                      {t('Save edit')}
                    </button>
                    <button style={button('outline')} onClick={cancelEdit}>{t('Cancel')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 style={{ margin: '0 0 6px', color: C.navy }}>{th.title}</h3>
                  <p style={{ margin: '0 0 10px', color: C.text, fontSize: 14 }}>
                    {th.body}
                    {th.editedAt && (
                      <span style={{ color: C.textFaint, fontSize: 12, marginLeft: 6 }} title={t('Edited {date}', { date: formatDate(th.editedAt) })}>
                        {t('(edited)')}
                      </span>
                    )}
                  </p>
                </>
              )}
              <AttachmentList attachments={th.attachments} style={{ marginBottom: 10 }} />
              {th.poll && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 14, marginBottom: 10, background: C.bg }}>
                  <PollView poll={th.poll} onVote={(optionId) => voteThreadPoll(th.id, optionId)} compact />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                {th.author ? <AuthorLine author={th.author} /> : <span style={{ fontSize: 13, color: C.textMuted }}>{t('Former resident')}</span>}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.textMuted }}>
                  <button
                    onClick={() => toggleUpvote(th)}
                    aria-pressed={!!th.upvotedByMe}
                    title={th.upvotedByMe ? t('Remove your upvote') : t('Upvote this post')}
                    style={{ border: 'none', background: 'none', color: th.upvotedByMe ? C.blue : C.textMuted, fontWeight: th.upvotedByMe ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
                  >
                    ▲ {th.upvotes}
                  </button>
                  <button
                    onClick={() => toggleReplies(th.id)}
                    aria-expanded={openReplies.has(th.id)}
                    style={{ border: 'none', background: 'none', color: openReplies.has(th.id) ? C.blue : C.textMuted, fontSize: 13, cursor: 'pointer' }}
                  >
                    💬 {t(th.replies === 1 ? '{n} reply' : '{n} replies', { n: th.replies })}
                  </button>
                  {/* One edit per post, your own — once spent, only delete remains. */}
                  {th.mine && !th.editedAt && editingId !== th.id && (
                    <button
                      onClick={() => startEdit(th)}
                      title={t('Edit your post (once only)')}
                      aria-label={t('Edit your post')}
                      style={{ border: 'none', background: 'none', color: C.blue, fontSize: 13, cursor: 'pointer', padding: 0 }}
                    >
                      ✏️
                    </button>
                  )}
                  {/* Your own post, or any post for an admin moderating. */}
                  {(th.mine || isAdmin) && editingId !== th.id && (
                    <button
                      onClick={() => deleteThread(th.id)}
                      title={th.mine ? t('Delete your post') : t('Remove this post (admin)')}
                      aria-label={th.mine ? t('Delete your post') : t('Remove this post')}
                      style={{ border: 'none', background: 'none', color: C.danger, fontSize: 13, cursor: 'pointer', padding: 0 }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              {openReplies.has(th.id) && (
                <ThreadReplies
                  projectId={projectId}
                  threadId={th.id}
                  isAdmin={isAdmin}
                  onCountChange={(delta) => changeReplyCount(th.id, delta)}
                />
              )}
            </div>
          ))}
          {!loading && !loadError && threads.length === 0 && (
            <div style={{ ...card, padding: 24, textAlign: 'center', color: C.textMuted }}>{t('No threads in this category yet.')}</div>
          )}
          {hasMore && (
            <button
              style={{ ...button('outline'), justifySelf: 'center' }}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? t('Loading…') : t('Load more threads')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
