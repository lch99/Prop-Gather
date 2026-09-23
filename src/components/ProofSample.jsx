import { useState } from 'react'
import { C, card } from '../theme'

// Residents hesitate to upload an SPA, and they are right to: it carries their
// IC number, the purchase price and their financier — none of which verification
// needs. Telling them "you may redact" in prose doesn't land; showing them a page
// with the name highlighted and everything else blacked out does. Data we never
// receive is data we can never leak, so this is the cheapest PDPA control we have.

// Each sample is one page of a real Malaysian document, reduced to the few lines
// that decide the outcome: `keep` lines must stay readable, the rest get covered.
const SAMPLES = [
  {
    id: 'spa',
    label: 'SPA',
    title: 'SALE & PURCHASE AGREEMENT',
    note: 'Page 1 — the parties and the property',
    rows: [
      { label: 'Purchaser', value: 'TAN MEI LING', keep: true },
      { label: 'NRIC No.', hidden: 'covered' },
      { label: 'Property', value: 'B-21-03, Vista Residence', keep: true },
      { label: 'Purchase price', hidden: 'covered' },
      { label: 'Financier / loan', hidden: 'covered' }
    ]
  },
  {
    id: 'bill',
    label: 'Utility bill',
    title: 'ELECTRICITY BILL',
    note: 'Any bill from the last 3 months',
    rows: [
      { label: 'Account holder', value: 'TAN MEI LING', keep: true },
      { label: 'Address', value: 'B-21-03, Vista Residence', keep: true },
      { label: 'Bill date', value: '05 Sep 2026', keep: true },
      { label: 'Account no.', hidden: 'covered' },
      { label: 'Amount due', hidden: 'covered' }
    ]
  },
  {
    id: 'title',
    label: 'Property title',
    title: 'ISSUE DOCUMENT OF TITLE',
    note: 'The page naming the proprietor',
    rows: [
      { label: 'Registered proprietor', value: 'TAN MEI LING', keep: true },
      { label: 'NRIC No.', hidden: 'covered' },
      { label: 'Lot / parcel', value: 'B-21-03, Vista Residence', keep: true },
      { label: 'Consideration', hidden: 'covered' }
    ]
  }
]

// A House Owner's only accepted document is the SPA, so don't offer them tabs
// for documents we would turn away.
const optionsForTier = (tier) => (tier === 'House Owner' ? SAMPLES.filter(s => s.id === 'spa') : SAMPLES)

const FILLER = [100, 88, 94, 72]

export default function ProofSample({ tier = 'Owner' }) {
  const options = optionsForTier(tier)
  const [id, setId] = useState(options[0].id)
  const [open, setOpen] = useState(true)
  // The tier can change under us after a sample is picked, so fall back rather
  // than render nothing.
  const sample = options.find(s => s.id === id) || options[0]

  return (
    <div style={{ ...card, padding: 14, background: C.bg, boxShadow: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, color: C.navy, fontSize: 15 }}>
          You can black out the private parts
        </h4>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: C.blue, fontSize: 13, fontWeight: 700
          }}
        >
          {open ? 'Hide example' : 'See an example'}
        </button>
      </div>

      <p style={{ margin: '6px 0 12px', fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
        One page is enough — the page showing your name and the property address. Cover the rest
        before you upload: we don't need it, and what we never receive can never be leaked.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        <Panel
          tone={{ bg: C.successBg, border: C.success, text: '#065F46' }}
          heading="Must stay readable"
          items={['Your full name', 'The unit / address', "The document's own title"]}
        />
        <Panel
          tone={{ bg: C.neutralBg, border: C.neutral, text: C.text }}
          heading="Safe to cover up"
          items={['IC / NRIC number', 'Price, deposit, loan amount', 'Bank / account numbers', 'Signatures', "Other people's details"]}
        />
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {options.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {options.map(o => {
                const active = o.id === sample.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setId(o.id)}
                    style={{
                      border: `1px solid ${active ? C.blue : C.border}`,
                      background: active ? C.blueLight : '#fff',
                      color: active ? C.blue : C.textMuted,
                      borderRadius: 999, padding: '5px 12px',
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          )}

          <SamplePage sample={sample} />

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: C.textMuted }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, background: C.successBg, border: `1.5px solid ${C.success}` }} />
              we read this
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, background: C.text }} />
              you cover this
            </span>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
            No editing app needed — a marker on the paper, a sticky note, or your phone's photo markup
            all work. Just don't cover your name or the address: an admin has to match them to the unit
            you entered, and a page without them gets rejected.
          </p>
        </div>
      )}
    </div>
  )
}

function Panel({ tone, heading, items }) {
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: C.radiusSm, padding: '10px 12px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: tone.text, marginBottom: 6 }}>{heading}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: tone.text, lineHeight: 1.7 }}>
        {items.map(i => <li key={i}>{i}</li>)}
      </ul>
    </div>
  )
}

// A mock of the uploaded page rather than a photograph: it scales down to a
// 360px phone without turning into an unreadable thumbnail, and the lines that
// matter stay legible at the size a phone actually renders them.
function SamplePage({ sample }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
      boxShadow: C.shadow, padding: '14px 12px', maxWidth: 320, margin: '0 auto'
    }}>
      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: C.navy, lineHeight: 1.3 }}>
        {sample.title}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: C.textFaint, marginTop: 3 }}>{sample.note}</div>

      <Filler widths={FILLER.slice(0, 3)} style={{ margin: '12px 0 14px' }} />

      <div style={{ display: 'grid', gap: 10 }}>
        {sample.rows.map(row => (
          <div key={row.label}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textFaint, marginBottom: 3 }}>{row.label}</div>
            {row.keep ? (
              <div style={{
                background: C.successBg, border: `1.5px solid ${C.success}`, borderRadius: 6,
                padding: '5px 8px', fontSize: 12.5, fontWeight: 800, color: '#065F46'
              }}>
                {row.value}
              </div>
            ) : (
              <div style={{
                background: C.text, borderRadius: 6, padding: '6px 8px',
                fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#fff', textAlign: 'center'
              }}>
                {row.hidden}
              </div>
            )}
          </div>
        ))}
      </div>

      <Filler widths={FILLER} style={{ marginTop: 14 }} />
    </div>
  )
}

// Stand-in for the paragraphs an admin never reads — decorative, so it stays out
// of the accessibility tree.
function Filler({ widths, style }) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gap: 5, ...style }}>
      {widths.map((w, i) => (
        <div key={i} style={{ height: 5, borderRadius: 3, background: C.neutralBg, width: `${w}%` }} />
      ))}
    </div>
  )
}
