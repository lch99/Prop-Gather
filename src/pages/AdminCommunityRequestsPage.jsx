import { useState } from 'react'
import { api } from '../api'
import { C, card, button } from '../theme'

const formatDate = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

// `requests` is owned by AdminPage and passed down (as with the verification
// queue) so the tab's count badge and this list can never disagree. null means
// "still loading" and renders skeletons, so AdminPage's fetch must land on []
// even when it fails.
export default function AdminCommunityRequestsPage({ requests, reload }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const handleDelete = async (req) => {
    if (!window.confirm(
      `Remove the request for "${req.name}"? This also deletes ${req.contactName || 'the submitter'}'s contact details.`
    )) return
    setBusyId(req.id)
    setError('')
    try {
      await api.deleteCommunityRequest(req.id)
      await reload()
    } catch {
      setError("We couldn't remove that request just now. Please try again in a moment.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <h1 style={{ color: C.navy, marginBottom: 6 }}>Requested Communities</h1>
      <p style={{ color: C.textMuted, marginTop: 0, fontSize: 14.5, lineHeight: 1.6 }}>
        Residents whose property isn't in the directory yet. Add the community under{' '}
        <strong>Overview → Add community</strong>, email the person to tell them it's live,
        then remove the request — that's also what clears their contact details.
      </p>

      {error && (
        <div style={{
          ...card, padding: '12px 16px', marginBottom: 16,
          background: C.dangerBg, color: C.danger, fontSize: 14
        }}>
          {error}
        </div>
      )}

      {requests === null ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="pg-skel" style={{ height: 108, borderRadius: C.radius }} />)}
        </div>
      ) : requests.length === 0 ? (
        <div style={{ ...card, padding: 28, textAlign: 'center', color: C.textMuted }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📭</div>
          No community requests right now. They appear here when someone can't find
          their property on Discover.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {requests.map(req => (
            <div key={req.id} style={{ ...card, padding: 18 }}>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 10,
                alignItems: 'baseline', justifyContent: 'space-between'
              }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.navy }}>{req.name}</h2>
                <span style={{ color: C.textFaint, fontSize: 12.5 }}>{formatDate(req.createdAt)}</span>
              </div>

              <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 14 }}>
                📍 {req.city}, {req.state}
              </p>

              {req.message && (
                <p style={{
                  margin: '12px 0 0', padding: '10px 13px', background: C.bg,
                  borderRadius: C.radiusSm, color: C.text, fontSize: 14, lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {req.message}
                </p>
              )}

              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 12,
                alignItems: 'center', justifyContent: 'space-between',
                marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`
              }}>
                <div style={{ fontSize: 13.5, color: C.textMuted, minWidth: 0 }}>
                  {req.email ? (
                    <>
                      <span style={{ fontWeight: 700, color: C.text }}>{req.contactName || 'Someone'}</span>{' '}
                      <a href={`mailto:${req.email}?subject=${encodeURIComponent(`Your PropGather community request: ${req.name}`)}`}
                        style={{ color: C.blue, wordBreak: 'break-all' }}>
                        {req.email}
                      </a>
                    </>
                  ) : (
                    // Pre-0007 rows: the old form never asked who was submitting.
                    <em>No contact details — submitted before we collected them.</em>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(req)}
                  disabled={busyId === req.id}
                  style={{ ...button('outline'), color: C.danger, opacity: busyId === req.id ? 0.6 : 1 }}
                >
                  {busyId === req.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
