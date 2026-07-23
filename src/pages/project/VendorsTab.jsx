import { useEffect, useState } from 'react'
import { api } from '../../api'
import { C, card, badge, button } from '../../theme'

const tierStyle = (tier) => {
  if (tier === 'Premium') return badge(C.accent, C.accentLight)
  if (tier === 'Standard') return badge(C.blue, C.blueLight)
  return badge(C.textMuted, C.neutralBg)
}

export default function VendorsTab({ projectId }) {
  const [vendors, setVendors] = useState([])
  const [category, setCategory] = useState('All')

  useEffect(() => { api.getVendors(projectId).then(setVendors) }, [projectId])

  const categories = ['All', ...new Set(vendors.map(v => v.category))]
  const filtered = category === 'All' ? vendors : vendors.filter(v => v.category === category)
  const offers = vendors.filter(v => v.offer)

  return (
    <div>
      <div style={{ ...card, padding: 14, marginBottom: 16, background: C.blueLight, border: 'none' }}>
        <div style={{ fontSize: 13, color: C.navy }}>
          🛡️ <strong>Vendor principles:</strong> search-only discovery, geo-targeted listings, zero cold outreach,
          verified reviews only. Vendors never appear in your forum or chat feeds.
        </div>
      </div>

      {offers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: C.navy, marginBottom: 8 }}>This week's offers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {offers.map(v => (
              <div key={v.id} style={{ ...card, padding: 14, borderLeft: `4px solid ${C.warning}` }}>
                <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>{v.name}</div>
                <div style={{ fontSize: 13, color: C.text }}>{v.offer}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              ...badge(category === c ? '#fff' : C.text, category === c ? C.blue : C.neutralBg),
              border: 'none', padding: '6px 14px', fontSize: 13
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {filtered.map(v => (
          <div key={v.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
              <h3 style={{ margin: 0, color: C.navy }}>{v.name}</h3>
              <span style={tierStyle(v.tier)}>{v.tier}</span>
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{v.category}</div>
            <p style={{ fontSize: 13, color: C.text, margin: '0 0 10px' }}>{v.description}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={badge(C.warning, C.warningBg)}>★ {v.rating} ({v.reviews} reviews)</span>
              {v.ssmVerified && <span style={badge(C.success, C.successBg)}>✓ Verified Business</span>}
              {v.ownerRecommended && <span style={badge(C.accent, C.accentLight)}>👍 Owner Recommended</span>}
            </div>
            <button style={{ ...button('outline'), width: '100%' }}>View profile & contact</button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ ...card, padding: 24, textAlign: 'center', color: C.textMuted, gridColumn: '1 / -1' }}>
            No vendors listed for this project's area yet.
          </div>
        )}
      </div>
    </div>
  )
}
