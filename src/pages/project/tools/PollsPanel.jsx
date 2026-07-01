import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card } from '../../../theme'
import PollView from '../../../components/PollView'

export default function PollsPanel({ projectId }) {
  const [polls, setPolls] = useState([])

  useEffect(() => { api.getPolls(projectId).then(setPolls) }, [projectId])

  const vote = async (pollId, optionId) => {
    const updated = await api.votePoll(projectId, pollId, optionId)
    setPolls(ps => ps.map(p => p.id === updated.id ? updated : p))
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', color: C.navy }}>Community Polls</h3>
      <p style={{ margin: '0 0 16px', color: C.textMuted, fontSize: 13 }}>
        Results are hidden until you vote — prevents the bandwagon effect.
      </p>

      <div style={{ display: 'grid', gap: 16 }}>
        {polls.map(poll => (
          <div key={poll.id} style={{ ...card, padding: 16 }}>
            <PollView poll={poll} onVote={(optionId) => vote(poll.id, optionId)} />
          </div>
        ))}
        {polls.length === 0 && (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>No active polls for this project.</div>
        )}
      </div>
    </div>
  )
}
