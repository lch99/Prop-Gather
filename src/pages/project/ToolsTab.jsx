import { useState } from 'react'
import { C, card } from '../../theme'
import PetitionsPanel from './tools/PetitionsPanel'
import PollsPanel from './tools/PollsPanel'
import DefectsPanel from './tools/DefectsPanel'
import FeesPanel from './tools/FeesPanel'
import DocumentsPanel from './tools/DocumentsPanel'

const subTabs = [
  { key: 'petitions', label: 'Petitions' },
  { key: 'polls', label: 'Polls' },
  { key: 'defects', label: 'Defect Tracker' },
  { key: 'fees', label: 'Fee Tracker' },
  { key: 'documents', label: 'Documents' }
]

export default function ToolsTab({ projectId, project }) {
  const [active, setActive] = useState('petitions')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, border: 'none',
              background: active === t.key ? C.navy : '#fff',
              color: active === t.key ? '#fff' : C.text,
              boxShadow: C.shadow
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ ...card, padding: 20 }}>
        {active === 'petitions' && <PetitionsPanel projectId={projectId} />}
        {active === 'polls' && <PollsPanel projectId={projectId} />}
        {active === 'defects' && <DefectsPanel projectId={projectId} project={project} />}
        {active === 'fees' && <FeesPanel projectId={projectId} />}
        {active === 'documents' && <DocumentsPanel projectId={projectId} />}
      </div>
    </div>
  )
}
