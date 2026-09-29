import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { C, card, badge } from '../../../theme'
import { useT } from '../../../i18n'
import { LoadingInline } from '../../../components/Loading'

// "RM" and its number format read the same in all three languages, so this
// stays en-MY whatever the site language is.
function fmtRM(n) {
  return `RM ${Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
}

export default function FeesPanel({ projectId }) {
  const t = useT()
  const [fees, setFees] = useState(undefined)

  // `undefined` is the loading state and `null` the "no tracker" empty state, so
  // a failed fetch has to land on null rather than staying undefined forever.
  useEffect(() => { api.getFees(projectId).then(setFees).catch(() => setFees(null)) }, [projectId])

  if (fees === undefined) return <LoadingInline />

  if (!fees) return <div style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>{t('No fee data available for this project.')}</div>

  const maxAmount = Math.max(...fees.history.map(h => h.amount))

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', color: C.navy }}>{t('Maintenance Fee Tracker')}</h3>
      <p style={{ margin: '0 0 16px', color: C.textMuted, fontSize: 13 }}>
        {t('Sinking fund balance and historical fee trend, visible to all verified residents.')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label={t('Sinking fund balance')} value={fmtRM(fees.sinkingFund)} />
        <Stat label={t('Current monthly fee')} value={fmtRM(fees.monthlyFee)} extra={
          fees.feeIncreaseFlag && <span style={badge(C.warning, C.warningBg)}>↑ {t('increased from {amount}', { amount: fmtRM(fees.previousYearFee) })}</span>
        } />
        <Stat label={t('Previous year fee')} value={fmtRM(fees.previousYearFee)} />
      </div>

      <h4 style={{ color: C.navy, marginBottom: 8 }}>{t('Fee trend ({year})', { year: 2026 })}</h4>
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

      <h4 style={{ color: C.navy, marginBottom: 8 }}>{t('My payment history')}</h4>
      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f6f7f9', textAlign: 'left' }}>
              <th style={th}>{t('Month')}</th>
              <th style={th}>{t('Amount')}</th>
              <th style={th}>{t('Status')}</th>
            </tr>
          </thead>
          <tbody>
            {fees.myPayments.map(p => (
              <tr key={p.month} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td}>{p.month}</td>
                <td style={td}>{fmtRM(p.amount)}</td>
                <td style={td}>
                  <span style={p.status === 'Paid' ? badge(C.success, C.successBg) : badge(C.warning, C.warningBg)}>
                    {t(p.status)}
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
