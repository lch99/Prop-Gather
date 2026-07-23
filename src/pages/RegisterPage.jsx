import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { C, card, button, badge } from '../theme'

const steps = ['Register', 'Upload proof', 'Admin review', 'Access granted']

const docByTier = {
  Owner: 'SPA, utility bill, or property title',
  'House Owner': 'Sale & Purchase Agreement'
}

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', unit: '', projectId: searchParams.get('projectId') || '', tier: 'Owner'
  })
  const [application, setApplication] = useState(null)
  const [error, setError] = useState('')
  const [tncAccepted, setTncAccepted] = useState(false)
  const [tncChecked, setTncChecked] = useState(false)
  const [docConsentChecked, setDocConsentChecked] = useState(false)
  const [consentTimestamp, setConsentTimestamp] = useState(null)

  useEffect(() => { api.getProjects().then(setProjects) }, [])

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const submitRegistration = async () => {
    if (!form.name || !form.email || !form.projectId || !form.unit) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setStep(1)
  }

  const submitDocument = async () => {
    setError('')
    try {
      const app = await api.register({ ...form, document: `${docByTier[form.tier]}.pdf` })
      setApplication(app)
      setConsentTimestamp(new Date())
      setStep(2)
    } catch (e) {
      setError(e.message)
    }
  }

  const withdrawApplication = () => {
    setApplication(null)
    setConsentTimestamp(null)
    setDocConsentChecked(false)
    setStep(1)
  }

  const simulateApproval = async () => {
    if (!application) return
    await api.decideVerification(application.id, 'approve')
    setStep(3)
  }

  if (!tncAccepted) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 24px' }}>
        <h1 style={{ color: C.navy, marginBottom: 6, fontSize: 28 }}>Before you continue</h1>
        <p style={{ color: C.textMuted, marginTop: 0, marginBottom: 16, fontSize: 15 }}>
          Please read and accept our Terms & Conditions before starting your community verification.
        </p>

        <div style={{ ...card, padding: 28 }}>
          <h3 style={{ margin: '0 0 12px', color: C.navy, fontSize: 19 }}>Terms & Conditions</h3>
          <div style={{
            border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 16,
            maxHeight: 240, overflowY: 'auto', fontSize: 13, color: C.textMuted, lineHeight: 1.7
          }}>
            <p><strong>1. Accurate information.</strong> You confirm that all details and documents submitted are true, accurate, and belong to you.</p>
            <p><strong>2. Verification process.</strong> Your application, including any uploaded documents, will be reviewed by a Platform Admin. False or fraudulent submissions may result in rejection or permanent suspension.</p>
            <p><strong>3. Community conduct.</strong> Once verified, you agree to engage respectfully with other residents and to use shared community channels for legitimate property-related discussion only.</p>
            <p><strong>4. Data usage & document retention.</strong> Your personal information will be used solely to verify your connection to the property and to operate your community account. Any proof document you upload (e.g. SPA, utility bill, property title, Tenancy Agreement) will be used for verification purposes only and will <strong>not be stored permanently</strong>. Documents are deleted from our systems within 14 days of your application being reviewed, whether approved or rejected. We do not share your documents with third parties.</p>
            <p><strong>5. Account integrity.</strong> Sharing your verified access with non-residents or misrepresenting your tier (Owner / House Owner) is prohibited and may lead to access being revoked.</p>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, fontSize: 13, color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={tncChecked} onChange={e => setTncChecked(e.target.checked)} style={{ marginTop: 2 }} />
            I have read and agree to the Terms & Conditions and{' '}
            <Link to="/privacy" style={{ color: C.blue }} onClick={e => e.stopPropagation()}>Privacy Policy</Link>.
          </label>

          {error && <div style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}

          <button
            style={{ ...button('primary'), marginTop: 16, opacity: tncChecked ? 1 : 0.5, cursor: tncChecked ? 'pointer' : 'not-allowed' }}
            disabled={!tncChecked}
            onClick={() => { setError(''); setTncAccepted(true) }}
          >
            Agree & continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 24px' }}>
      <h1 style={{ color: C.navy, marginBottom: 6, fontSize: 28 }}>Join your verified community</h1>
      <p style={{ color: C.textMuted, marginTop: 0, marginBottom: 16, fontSize: 15 }}>
        Every resident must prove their connection to the property before accessing the community —
        this protects discussion quality for everyone.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <div key={s} style={{
            ...badge(i <= step ? C.blue : C.textFaint, i <= step ? C.blueLight : C.neutralBg),
            padding: '8px 14px', fontSize: 14
          }}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'start' }}>
      <div style={{ ...card, padding: 28 }}>
        {step === 0 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0, color: C.navy, fontSize: 19 }}>Step 1 — Create your account</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px 28px' }}>
              <Field label="Full name">
                <input value={form.name} onChange={update('name')} style={inputStyle} placeholder="e.g. Alex Lim" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={update('email')} style={inputStyle} placeholder="you@example.com" />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={update('phone')} style={inputStyle} placeholder="+60 12-345 6789" />
              </Field>
              <Field label="Unit / lot number">
                <input value={form.unit} onChange={update('unit')} style={inputStyle} placeholder="e.g. B-21-03" />
              </Field>
              <Field label="Property project">
                <select value={form.projectId} onChange={update('projectId')} style={inputStyle}>
                  <option value="">Select your project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}, {p.state}</option>)}
                </select>
              </Field>
              <Field label="Resident tier">
                <select value={form.tier} onChange={update('tier')} style={inputStyle}>
                  <option value="Owner">Property Owner</option>
                  <option value="House Owner">House Owner (landed G&G)</option>
                </select>
              </Field>
            </div>
            {error && <div style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
            <button style={button('primary')} onClick={submitRegistration}>Continue</button>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0, color: C.navy }}>Step 2 — Upload proof of ownership</h3>
            <p style={{ color: C.textMuted, margin: 0 }}>
              Required document for <strong>{form.tier}</strong>: {docByTier[form.tier]}
            </p>
            <div style={{
              border: `2px dashed ${C.border}`, borderRadius: C.radius, padding: 32,
              textAlign: 'center', color: C.textMuted
            }}>
              📄 Drag & drop file here, or click to browse<br />
              <span style={{ fontSize: 12 }}>(demo — no real file is uploaded)</span>
            </div>

            <div style={{
              background: '#fffbeb', border: `1px solid #f59e0b`, borderRadius: C.radiusSm,
              padding: '12px 14px', fontSize: 13, color: '#92400e', lineHeight: 1.6
            }}>
              <strong>🔒 Data privacy notice</strong><br />
              Your document is used <strong>for verification purposes only</strong>. We do not store it permanently —
              it will be deleted within <strong>14 days</strong> of your application being reviewed.
              Only the assigned platform admin can access your document during this period.
              We do not share, sell, or retain your document beyond what is necessary to verify your residency.
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.text, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={docConsentChecked}
                onChange={e => setDocConsentChecked(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              I consent to my uploaded document being reviewed by a platform admin solely for residency
              verification, and I understand it will be permanently deleted within 14 days of review.
            </label>

            {error && <div style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
            <button
              style={{ ...button('primary'), opacity: docConsentChecked ? 1 : 0.5, cursor: docConsentChecked ? 'pointer' : 'not-allowed' }}
              disabled={!docConsentChecked}
              onClick={submitDocument}
            >
              Submit for review
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0, color: C.navy }}>Step 3 — Awaiting admin review</h3>
            <p style={{ color: C.textMuted, margin: 0 }}>
              Your application has been submitted. Admin verification target: <strong>within 24 hours</strong>.
            </p>
            <div style={{ ...card, padding: 16, background: C.blueLight, border: 'none' }}>
              <div><strong>{application?.name}</strong> — {application?.tier}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                Unit {application?.unit} · {projects.find(p => p.id === application?.projectId)?.name}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted }}>Document: {application?.document}</div>
              <div style={{ marginTop: 6 }}>{badgeFor('Pending')}</div>
            </div>

            <div style={{
              background: '#fffbeb', border: `1px solid #f59e0b`, borderRadius: C.radiusSm,
              padding: '12px 14px', fontSize: 12.5, color: '#92400e', lineHeight: 1.6
            }}>
              🔒 <strong>Your document is held for review only.</strong> It will be permanently deleted within 14 days of a decision being made.
              {consentTimestamp && (
                <div style={{ marginTop: 6, color: '#78350f' }}>
                  Consent recorded: {consentTimestamp.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>

            <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
              In a real deployment, a Platform Admin reviews this in the admin queue. For this demo, you can
              simulate that review — check the <strong>Admin Queue</strong> tab to approve it, or click below.
            </p>
            <button style={button('success')} onClick={simulateApproval}>Simulate admin approval</button>
            <button
              style={{ ...button('outline'), fontSize: 13 }}
              onClick={withdrawApplication}
            >
              Withdraw my application &amp; delete document
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gap: 14, textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <h3 style={{ margin: 0, color: C.navy }}>Access granted!</h3>
            <p style={{ color: C.textMuted, margin: 0 }}>
              You now have full community access for <strong>{projects.find(p => p.id === application?.projectId)?.name}</strong>.
              Your profile will show as <strong>{application?.unit?.split('-').slice(0, 2).join('-') || application?.unit}</strong> with a verified badge on all posts.
            </p>
            <a href={`/project/${application?.projectId}`}>
              <button style={button('primary')}>Go to community →</button>
            </a>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ ...card, padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', color: C.navy, fontSize: 16 }}>Required document</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            As a <strong>{form.tier}</strong>, you'll need to upload your <strong>{docByTier[form.tier]}</strong> to
            prove your connection to the property.
          </p>
        </div>

        <div style={{ ...card, padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', color: C.navy, fontSize: 16 }}>How it works</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
            <div><strong style={{ color: C.navy }}>1. Register</strong><br />Tell us who you are and which property you're connected to.</div>
            <div><strong style={{ color: C.navy }}>2. Upload proof</strong><br />Submit a document proving your ownership of the property.</div>
            <div><strong style={{ color: C.navy }}>3. Admin review</strong><br />A platform admin checks your document, usually within 24 hours.</div>
            <div><strong style={{ color: C.navy }}>4. Access granted</strong><br />Get a verified badge and full access to your community.</div>
          </div>
        </div>

        <div style={{ ...card, padding: 20, background: C.blueLight, border: 'none' }}>
          <h3 style={{ margin: '0 0 8px', color: C.navy, fontSize: 16 }}>Why verify?</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
            Verification keeps discussions trustworthy by ensuring everyone here is a verified
            property owner.
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: C.text, minWidth: 0 }}>
      {label}
      {children}
    </label>
  )
}

function badgeFor(status) {
  if (status === 'Pending') return <span style={badge(C.warning, C.warningBg)}>⏳ Pending review</span>
  if (status === 'Approved') return <span style={badge(C.success, C.successBg)}>✓ Approved</span>
  return <span style={badge(C.danger, C.dangerBg)}>✕ Rejected</span>
}

const inputStyle = {
  width: '100%',
  minWidth: 0,
  padding: '12px 14px',
  border: `1px solid ${C.border}`,
  borderRadius: C.radiusSm,
  fontSize: 15,
  fontWeight: 400
}
