import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { C, card, button, badge, tierColor } from '../../theme'
import { useAuth } from '../../auth'
import { useAttachments, AttachmentPicker, AttachmentList } from '../../components/Attachments'
import SensitiveContentNotice, { hasSensitiveContent } from '../../components/SensitiveContentNotice'

const channelIcons = {
  general: '# general',
  defects: '# defects',
  announcements: '# announcements',
  facilities: '# facilities',
  renovation: '# renovation'
}

export default function ChatTab({ projectId }) {
  const { user } = useAuth()
  const [channels, setChannels] = useState([])
  const [active, setActive] = useState('general')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState(null) // message id currently open in the inline editor
  const [editDraft, setEditDraft] = useState('')
  const [editError, setEditError] = useState('')
  const { attachments, addFiles, removeAttachment, error: uploadError, reset: resetAttachments } = useAttachments(4)
  const bottomRef = useRef(null)

  useEffect(() => {
    api.getChatChannels(projectId).then(chs => {
      setChannels(chs)
      setActive(chs[0] || 'general')
    })
  }, [projectId])

  useEffect(() => {
    if (!active) return
    api.getChatMessages(projectId, active).then(setMessages)
  }, [projectId, active])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const blockedByPii = hasSensitiveContent(text)
  const editBlocked = hasSensitiveContent(editDraft)

  // One correction per message — enough for the typo you notice immediately,
  // not enough to rewrite what someone already replied to.
  const startEdit = (msg) => {
    setEditingId(msg.id)
    setEditDraft(msg.text)
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEdit = async (messageId) => {
    if (!editDraft.trim() || editBlocked) return
    try {
      const updated = await api.editChatMessage(projectId, active, messageId, editDraft.trim())
      setMessages(ms => ms.map(m => m.id === updated.id ? updated : m))
      setEditingId(null)
      setEditError('')
    } catch (err) {
      setEditError(err.message)
    }
  }

  const send = async () => {
    if (!text.trim() && attachments.length === 0) return
    if (blockedByPii) return
    const msg = await api.sendChatMessage(projectId, active, text.trim(), attachments)
    setMessages(m => [...m, msg])
    setText('')
    resetAttachments()
  }

  // You can remove your own message — mirrors the forum "delete your post"
  // right (see ForumTab.jsx).
  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return
    await api.deleteChatMessage(projectId, active, messageId)
    setMessages(m => m.filter(msg => msg.id !== messageId))
  }

  // Residents-only platform — every verified resident can post in every channel.

  return (
    <div className="pg-chat-grid" style={{ display: 'grid', gap: 20 }}>
      <div className="pg-chat-channels" style={{ ...card, padding: 12, overflowY: 'auto' }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 8, fontSize: 13 }}>CHANNELS</div>
        {channels.map(ch => (
          <button
            key={ch}
            onClick={() => setActive(ch)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', textAlign: 'left', padding: '8px 8px',
              background: active === ch ? C.blueLight : 'transparent',
              color: active === ch ? C.blue : C.text,
              border: 'none', borderRadius: C.radiusSm, fontSize: 13, fontWeight: active === ch ? 700 : 400,
              marginBottom: 2
            }}
          >
            <span>{channelIcons[ch] || `# ${ch}`}</span>
          </button>
        ))}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <button style={{ ...button('outline'), width: '100%', fontSize: 12 }}>+ Propose channel</button>
        </div>
      </div>

      <div className="pg-chat-panel" style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, color: C.navy }}>{channelIcons[active] || `# ${active}`}</div>
          <span style={badge(C.success, C.successBg)}>● 12 online</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 40 }}>No messages yet — be the first to say hello!</div>
          )}
          {messages.map(m => (
            <div key={m.id}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{m.sender}</span>
                {m.unit && m.unit !== '-' && <span style={{ fontSize: 12, color: C.textMuted }}>{m.unit}</span>}
                <span style={{ ...badge(tierColor(m.tier), `${tierColor(m.tier)}1a`), fontSize: 11 }}>{m.tier}</span>
                {m.verified && <span style={{ fontSize: 11, color: C.success }}>✓</span>}
                <span style={{ fontSize: 11, color: C.textFaint, marginLeft: 'auto' }}>{m.time}</span>
                {m.sender === user?.name && editingId !== m.id && (
                  <>
                    {/* One edit per message — once spent, only delete remains. */}
                    {!m.editedAt && m.text && (
                      <button
                        onClick={() => startEdit(m)}
                        title="Edit your message (once only)"
                        style={{ border: 'none', background: 'none', color: C.blue, fontSize: 12, cursor: 'pointer', padding: 0 }}
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      onClick={() => deleteMessage(m.id)}
                      title="Delete your message"
                      style={{ border: 'none', background: 'none', color: C.danger, fontSize: 12, cursor: 'pointer', padding: 0 }}
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
              {editingId === m.id ? (
                <div style={{ display: 'grid', gap: 6, maxWidth: '85%' }}>
                  <input
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(m.id); if (e.key === 'Escape') cancelEdit() }}
                    autoFocus
                    style={{ padding: '8px 12px', border: `1px solid ${C.blue}`, borderRadius: C.radiusSm, fontSize: 14 }}
                  />
                  <SensitiveContentNotice values={[editDraft]} />
                  <div style={{ fontSize: 11, color: C.textFaint }}>You can edit a message once. Enter to save, Esc to cancel.</div>
                  {editError && <div style={{ fontSize: 12, color: C.danger }}>{editError}</div>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{ ...button('primary'), fontSize: 12, padding: '6px 12px', ...(editBlocked ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                      onClick={() => saveEdit(m.id)}
                      disabled={editBlocked}
                    >
                      Save
                    </button>
                    <button style={{ ...button('outline'), fontSize: 12, padding: '6px 12px' }} onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : m.text && (
                <div style={{ fontSize: 14, color: C.text, background: '#f6f7f9', padding: '8px 12px', borderRadius: C.radiusSm, display: 'inline-block', maxWidth: '85%' }}>
                  {m.text}
                  {m.editedAt && (
                    <span style={{ color: C.textFaint, fontSize: 11, marginLeft: 6 }} title={`Edited ${new Date(m.editedAt).toLocaleString('en-MY')}`}>
                      (edited)
                    </span>
                  )}
                </div>
              )}
              <AttachmentList attachments={m.attachments} thumb={140} style={{ marginTop: m.text ? 6 : 0 }} />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: 'grid', gap: 8 }}>
          {(attachments.length > 0 || uploadError) && (
            <AttachmentPicker
              attachments={attachments}
              addFiles={addFiles}
              removeAttachment={removeAttachment}
              error={uploadError}
              compact
            />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {attachments.length === 0 && !uploadError && (
              <label
                title="Attach a photo or file"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
                  background: C.blueLight, color: C.blue, fontSize: 18
                }}
              >
                📎
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={e => { addFiles(e.target.files); e.target.value = '' }}
                  style={{ display: 'none' }}
                />
              </label>
            )}
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, fontSize: 14, background: '#fff' }}
            />
            <button
              style={{ ...button('primary'), ...(blockedByPii ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              onClick={send}
              disabled={blockedByPii}
            >
              Send
            </button>
          </div>
          <SensitiveContentNotice values={[text]} />
        </div>
      </div>
    </div>
  )
}
