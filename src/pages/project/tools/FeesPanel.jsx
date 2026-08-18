import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card, badge } from '../../../theme'

function fmtRM(n) {
  return `RM ${Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
}

export default function FeesPanel({ projectId }) {
  const [fees, setFees] = useState(undefined)

  // `undefined` is the loading state and `null` the "no tracker" empty state, so
  // a failed fetch has to land on null rather than staying undefined forever.
  useEffect(() => { api.getFees(projectId).then(setFees).catch(() => setFees(null)) }, [projectId])

  if (fees === undefined) return <div style={{ color: C.textMuted }}>Loading...</div>
  if (!fees) return <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>No fee data available for this project.</div>

  const maxAmount = Math.max(...fees.history.map(h => h.amount))

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', color: C.navy }}>Maintenance Fee Tracker</h3>
      <p style={{ margin: '0 0 16px', color: C.textMuted, fontSize: 13 }}>
        Sinking fund balance and historical fee trend, visible to all verified residents.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="Sinking fund balance" value={fmtRM(fees.sinkingFund)} />
        <Stat label="Current monthly fee" value={fmtRM(fees.monthlyFee)} extra={
          fees.feeIncreaseFlag && <span style={badge(C.warning, C.warningBg)}>↑ increased from {fmtRM(fees.previousYearFee)}</span>
        } />
        <Stat label="Previous year fee" value={fmtRM(fees.previousYearFee)} />
      </div>

      <h4 style={{ color: C.navy, marginBottom: 8 }}>Fee trend (2026)</h4>
      <div style={{ ...card, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
          {fees.history.map(h => (
            <div key={h.month} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: `${(h.amount / maxAmount) * 100}px`,
                background: h.amount > fees.previousYearFee ? C.warning : C.blue,
                borderRadius: '4px 4px 0 0', marginBottom: 6
              }} />
              <div style={{ fontSize: 11, color: C.textMuted }}>{h.month.slice(5)}</div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{h.amount}</div>
            </div>
          ))}
        </div>
      </div>

      <h4 style={{ color: C.navy, marginBottom: 8 }}>My payment history</h4>
      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f6f7f9', textAlign: 'left' }}>
              <th style={th}>Month</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {fees.myPayments.map(p => (
              <tr key={p.month} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td}>{p.month}</td>
                <td style={td}>{fmtRM(p.amount)}</td>
                <td style={td}>
                  <span style={p.status === 'Paid' ? badge(C.success, C.successBg) : badge(C.warning, C.warningBg)}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, extra }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>{value}</div>
      {extra && <div style={{ marginTop: 6 }}>{extra}</div>}
    </div>
  )
}

const th = { padding: '10px 14px', fontWeight: 600, color: C.textMuted }
const td = { padding: '10px 14px' }
