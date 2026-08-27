import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { C, card, button, badge } from '../theme'
import Seo from '../seo'
import { useAttachments, AttachmentPicker, AttachmentList } from '../components/Attachments'

const steps = ['Register', 'Upload proof', 'Admin review', 'Access granted']

const docByTier = {
  Owner: 'SPA, utility bill, or property title',
  'House Owner': 'Sale & Purchase Agreement'
}

const MIN_PASSWORD = 8

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  // Someone already signed in is adding a second community, so step 1 skips
  // account creation entirely — their name and email come from the account, and
  // the server uses those for the application regardless of what a form says.
  const { user, signup, refresh } = useAuth()
  const [projects, setProjects] = useState([])
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', unit: '',
    projectId: searchParams.get('projectId') || '', tier: 'Owner'
  })
  const [application, setApplication] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tncAccepted, setTncAccepted] = useState(false)
  const [tncChecked, setTncChecked] = useState(false)
  const [docConsentChecked, setDocConsentChecked] = useState(false)
  const { attachments, addFiles, removeAttachment, error: uploadError, reset: resetAttachments } = useAttachments(1)

  useEffect(() => { api.getProjects().then(setProjects).catch(() => setProjects([])) }, [])

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const submitRegistration = async () => {
    // Names the fields that are actually missing — "fill in all fields" sent
    // people hunting through the form, and phone isn't required here anyway.
    const missing = [
      [!user && !form.name, 'your full name'],
      [!user && !form.email, 'your email'],
      [!user && !form.password, 'a password'],
      [!form.projectId, 'your property project'],
      [!form.unit, 'your unit / lot number']
    ].filter(([isMissing]) => isMissing).map(([, label]) => label)

    if (missing.length) {
      const list = missing.length === 1
        ? missing[0]
        : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`
      setError(`Please add ${list} to continue.`)
      return
    }
    if (!user && form.password.length < MIN_PASSWORD) {
      setError(`Please choose a password of at least ${MIN_PASSWORD} characters.`)
      return
    }
    setError('')

    // The account has to exist before the next step: uploading a document needs
    // an authenticated request, and the application is attributed to this user.
    if (!user) {
      setBusy(true)
      try {
        await signup({ name: form.name, email: form.email, password: form.password })
      } catch (e) {
        setError(
          e.status === 409
            ? 'An account with this email already exists. Please sign in first, then come back to add this community.'
            : e.message || "We couldn't create your account just now. Please try again."
        )
        return
      } finally {
        setBusy(false)
      }
    }
    setStep(1)
  }

  const submitDocument = async () => {
    setError('')
    // Both conditions are checked here rather than by disabling the button, so a
    // resident who taps it always learns what's still outstanding. The consent
    // check is also the real gate: PDPA requires explicit consent before the
    // document is submitted, so it must not depend on the button's disabled state.
    if (attachments.length === 0 && !docConsentChecked) {
      setError(`Please upload your ${docByTier[form.tier]} and tick the consent box to continue.`)
      return
    }
    if (attachments.length === 0) {
      setError(`Please upload your ${docByTier[form.tier]} to continue.`)
      return
    }
    if (!docConsentChecked) {
      setError('Please tick the consent box so we can review your document.')
      return
    }
    setBusy(true)
    try {
      // Uploads the file straight to secure storage, then submits the reference —
      // see api.submitApplication. Ticking the box above is what allows it.
      const app = await api.submitApplication({
        projectId: form.projectId,
        unit: form.unit,
        tier: form.tier,
        phone: form.phone,
        document: attachments[0].name,
        documentFile: attachments[0]
      })
      setApplication(app)
      setStep(2)
    } catch (e) {
      setError(e.message || "We couldn't submit your application just now. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  // Withdrawal is a real deletion server-side: the application row goes, and the
  // uploaded document is removed from storage rather than waiting for the 14-day
  // retention purge.
  const withdrawApplication = async () => {
    if (!application) return
    if (!window.confirm('Withdraw your application and delete the document you uploaded?')) return
    setBusy(true)
    setError('')
    try {
      await api.withdrawApplication(application.id)
      setApplication(null)
      setDocConsentChecked(false)
      resetAttachments()
      setStep(1)
    } catch (e) {
      setError(e.message || "We couldn't withdraw your application just now. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  // Only an admin can decide an application, so this checks for their decision
  // rather than standing in for it. refresh() re-reads the profile so the newly
  // granted membership unlocks the community's tabs without a reload.
  const checkStatus = async () => {
    if (!application) return
    setBusy(true)
    setError('')
    try {
      const mine = await api.myApplications()
      const latest = mine.find(a => a.id === application.id)
      if (!latest) {
        setError('This application is no longer on file. Please submit your document again.')
        setApplication(null)
        setStep(1)
        return
      }
      setApplication(latest)
      if (latest.status === 'Approved') {
        await refresh()
        setStep(3)
      } else if (latest.status === 'Pending') {
        setError('Your application is still waiting for review. Please check back shortly.')
      }
    } catch (e) {
      setError(e.message || "We couldn't check your application just now. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!tncAccepted) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 24px' }}>
        <Seo
          path="/register"
          title="Join your verified community"
          description="Verify your ownership with your Sale and Purchase Agreement, a recent utility bill, or your property title. An admin reviews it within 24 hours, then your building's private community opens up."
        />
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
            <p><strong>4. Data usage & document retention.</strong> Your personal information will be used solely to verify your connection to the property and to operate your community account. Any proof document you upload (e.g. SPA, utility bill, property title, Tenancy Agreement) will be used for verification purposes only and will <strong>not be stored permanently</strong>. Documents are deleted from our systems within 14 days of your application being reviewed, whether approved or rejected. We do not share your documents with third parties, other than the cloud storage provider we use to hold them securely — which may store data outside Malaysia. By submitting a document you consent to that transfer, which is necessary to provide the verification service.</p>
            <p><strong>5. Account integrity.</strong> Sharing your verified access with non-residents or misrepresenting your tier (Owner / House Owner) is prohibited and may lead to access being revoked.</p>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, fontSize: 13, color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={tncChecked} onChange={e => setTncChecked(e.target.checked)} style={{ marginTop: 2 }} />
            I have read and agree to the Terms & Conditions and{' '}
            <Link to="/privacy" style={{ color: C.blue }} onClick={e => e.stopPropagation()}>Privacy Policy</Link>.
          </label>

          {error && <div role="alert" style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}

          {/* Left clickable on purpose. A greyed-out button that silently does
              nothing is the worst outcome for the residents this is built for —
              tapping it should always explain what's missing. */}
          <button
            style={{ ...button('primary'), marginTop: 16 }}
            onClick={() => {
              if (!tncChecked) {
                setError('Please tick the box to confirm you have read and agree to the Terms & Conditions.')
                return
              }
              setError('')
              setTncAccepted(true)
            }}
          >
            Agree & continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 24px' }}>
      <Seo
        path="/register"
        title="Join your verified community"
        description="Verify your ownership with your Sale and Purchase Agreement, a recent utility bill, or your property title. An admin reviews it within 24 hours, then your building's private community opens up."
      />
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
            <h3 style={{ margin: 0, color: C.navy, fontSize: 19 }}>
              {user ? 'Step 1 — Which community?' : 'Step 1 — Create your account'}
            </h3>

            {user ? (
              <div style={{ ...card, padding: 14, background: C.blueLight, border: 'none', fontSize: 13.5, color: C.text }}>
                Signed in as <strong>{user.name}</strong> ({user.email}). Your application will be filed under
                this account — <Link to="/login" style={{ color: C.blue, fontWeight: 700 }}>use a different one</Link> if
                that isn't you.
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>
                Already have an account? <Link to="/login" style={{ color: C.blue, fontWeight: 700 }}>Sign in</Link> first
                and you can skip straight to uploading your proof.
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px 28px' }}>
              {!user && (
                <>
                  <Field label="Full name">
                    <input value={form.name} onChange={update('name')} style={inputStyle} placeholder="e.g. Alex Lim" autoComplete="name" />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.email} onChange={update('email')} style={inputStyle} placeholder="you@example.com" autoComplete="email" />
                  </Field>
                  <Field label="Password">
                    <input
                      type="password"
                      value={form.password}
                      onChange={update('password')}
                      style={inputStyle}
                      placeholder={`At least ${MIN_PASSWORD} characters`}
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              )}
              <Field label="Phone">
                <input value={form.phone} onChange={update('phone')} style={inputStyle} placeholder="+60 12-345 6789" autoComplete="tel" />
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
            {error && <div role="alert" style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
            <button
              style={{ ...button('primary'), opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
              disabled={busy}
              onClick={submitRegistration}
            >
              {busy ? 'Creating your account…' : 'Continue'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0, color: C.navy }}>Step 2 — Upload proof of ownership</h3>
            <p style={{ color: C.textMuted, margin: 0 }}>
              Required document for <strong>{form.tier}</strong>: {docByTier[form.tier]}
            </p>
            <AttachmentPicker
              attachments={attachments}
              addFiles={addFiles}
              removeAttachment={removeAttachment}
              error={uploadError}
              label={`Upload your ${docByTier[form.tier]}`}
              max={1}
            />

            <div style={{
              background: '#fffbeb', border: `1px solid #f59e0b`, borderRadius: C.radiusSm,
              padding: '12px 14px', fontSize: 13, color: '#92400e', lineHeight: 1.6
            }}>
              <strong>🔒 Data privacy notice</strong><br />
              Your document is used <strong>for verification purposes only</strong>. We do not store it permanently —
              it will be deleted within <strong>14 days</strong> of your application being reviewed.
              Only the assigned platform admin can access your document during this period.
              We do not share, sell, or retain your document beyond what is necessary to verify your residency.
              It is held in encrypted cloud storage that may be located outside Malaysia — see our{' '}
              <Link to="/privacy" style={{ color: '#92400e', fontWeight: 700 }} target="_blank">Privacy Policy</Link>.
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.text, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={docConsentChecked}
                onChange={e => setDocConsentChecked(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              I consent to my uploaded document being reviewed by a platform admin solely for residency
              verification, being stored on our cloud storage provider's servers (which may be located
              outside Malaysia), and I understand it will be permanently deleted within 14 days of review.
            </label>

            {error && <div role="alert" style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
            {/* Clickable even when incomplete — submitDocument names what's
                missing. See the note on the Terms & Conditions button above. */}
            <button
              style={{ ...button('primary'), opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
              disabled={busy}
              onClick={submitDocument}
            >
              {busy ? 'Uploading your document…' : 'Submit for review'}
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
              {application?.documentFile && (
                <AttachmentList attachments={[application.documentFile]} thumb={72} style={{ marginTop: 8 }} />
              )}
              <div style={{ marginTop: 6 }}>{badgeFor(application?.status || 'Pending')}</div>
            </div>

            <div style={{
              background: '#fffbeb', border: `1px solid #f59e0b`, borderRadius: C.radiusSm,
              padding: '12px 14px', fontSize: 12.5, color: '#92400e', lineHeight: 1.6
            }}>
              🔒 <strong>Your document is held for review only.</strong> It will be permanently deleted within 14 days of a decision being made.
              {application?.consentAcceptedAt && (
                <div style={{ marginTop: 6, color: '#78350f' }}>
                  Consent recorded: {new Date(application.consentAcceptedAt).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>

            {application?.status === 'Rejected' ? (
              <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
                A platform admin couldn't verify this document. You can withdraw this application and submit a
                clearer copy, or <Link to="/contact" style={{ color: C.blue, fontWeight: 700 }}>contact us</Link> if
                you think it was reviewed in error.
              </p>
            ) : (
              <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
                A platform admin reviews your document in the admin queue — you'll get access as soon as they
                approve it. Check back here any time.
              </p>
            )}

            {error && <div role="alert" style={{ color: C.danger, fontSize: 13 }}>{error}</div>}

            {application?.status !== 'Rejected' && (
              <button
                style={{ ...button('primary'), opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
                disabled={busy}
                onClick={checkStatus}
              >
                {busy ? 'Checking…' : 'Check my application status'}
              </button>
            )}
            <button
              style={{ ...button('outline'), fontSize: 13, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
              disabled={busy}
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
            {/* Link, not a bare <a href> — a full page load would drop the
                router's base path on the Pages build and 404. */}
            <Link to={`/project/${application?.projectId}`}>
              <button style={button('primary')}>Go to community →</button>
            </Link>
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
