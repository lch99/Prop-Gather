import { C, button } from '../theme'

// Renders a poll with hidden results until the viewer votes (anti-bandwagon).
// Shared by the Polls tab and forum-thread polls. `onVote(optionId)` casts a vote.
export default function PollView({ poll, onVote, compact = false }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0)
  return (
    <div>
      {poll.question && (
        <h4 style={{ margin: `0 0 ${poll.expiresAt ? 4 : 10}px`, color: C.navy, fontSize: compact ? 15 : undefined }}>{poll.question}</h4>
      )}
      {poll.expiresAt && (
        <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 12 }}>Closes {poll.expiresAt}</div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {poll.options.map(o => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0
          return (
            <div key={o.id}>
              {poll.votedByMe ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{o.label}</span>
                    <span style={{ color: C.textMuted }}>{pct}% ({o.votes})</span>
                  </div>
                  <div style={{ background: C.neutralBg, borderRadius: 999, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: C.blue }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onVote(o.id)}
                  style={{ ...button('outline'), width: '100%', textAlign: 'left' }}
                >
                  {o.label}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {poll.votedByMe && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.textMuted }}>{total} vote{total !== 1 ? 's' : ''} total · you voted ✓</div>
      )}
    </div>
  )
}
