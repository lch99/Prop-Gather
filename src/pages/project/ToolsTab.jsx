import { useState } from 'react'
import { C, card } from '../../theme'
import { msg, useT } from '../../i18n'
import PetitionsPanel from './tools/PetitionsPanel'
import PollsPanel from './tools/PollsPanel'
import DefectsPanel from './tools/DefectsPanel'
import FeesPanel from './tools/FeesPanel'
import DocumentsPanel from './tools/DocumentsPanel'

const subTabs = [
  { key: 'petitions', label: msg('Petitions') },
  { key: 'polls', label: msg('Polls') },
  { key: 'defects', label: msg('Defect Tracker') },
  { key: 'fees', label: msg('Fee Tracker') },
  { key: 'documents', label: msg('Documents') }
]

export default function ToolsTab({ projectId, project }) {
  const t = useT()
  const [active, setActive] = useState('petitions')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            aria-pressed={active === tab.key}
            style={{
              padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, border: 'none',
              background: active === tab.key ? C.navy : '#fff',
              color: active === tab.key ? '#fff' : C.text,
              boxShadow: C.shadow
            }}
          >
            {t(tab.label)}
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
