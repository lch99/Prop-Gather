import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { C, card, button, badge } from '../theme'
import Seo from '../seo'
import { useAttachments, AttachmentPicker, AttachmentList } from '../components/Attachments'
import ProofSample from '../components/ProofSample'
import { msg, useI18n } from '../i18n'

const steps = [msg('Register'), msg('Upload proof'), msg('Admin review'), msg('Access granted')]

const docByTier = {
  Owner: msg('SPA, utility bill, or property title'),
  'House Owner': msg('Sale & Purchase Agreement')
}

const MIN_PASSWORD = 8

// Loose on purpose — just enough to catch "forgot the @" before a round trip to
// the server, not to second-guess the backend's real (zod) email validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const { t, formatDate } = useI18n()
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

  const doc = t(docByTier[form.tier])
  const tierLabel = t(form.tier)

  const submitRegistration = async () => {
    // Names the fields that are actually missing — "fill in all fields" sent
    // people hunting through the form, and phone isn't required here anyway.
    // Trimmed, so a name or unit of pure whitespace still counts as missing
    // rather than silently becoming the stored value.
    const missing = [
      [!user && !form.name.trim(), t('your full name')],
      [!user && !form.email.trim(), t('your email')],
      [!user && !form.password, t('a password')],
      [!form.projectId, t('your property project')],
      [!form.unit.trim(), t('your unit / lot number')]
    ].filter(([isMissing]) => isMissing).map(([, label]) => label)

    if (missing.length) {
      const list = missing.length === 1
        ? missing[0]
        : t('{list} and {last}', { list: missing.slice(0, -1).join(t(', ')), last: missing[missing.length - 1] })
      setError(t('Please add {list} to continue.', { list }))
      return
    }
    if (!user && !EMAIL_RE.test(form.email.trim())) {
      setError(t('Please enter a valid email address.'))
      return
    }
    if (!user && form.password.length < MIN_PASSWORD) {
      setError(t('Please choose a password of at least {n} characters.', { n: MIN_PASSWORD }))
      return
    }
    setError('')

    // The account has to exist before the next step: uploading a document needs
    // an authenticated request, and the application is attributed to this user.
    if (!user) {
      setBusy(true)
      try {
        await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      } catch (e) {
        setError(
          e.status === 409
            ? t('An account with this email already exists. Please sign in first, then come back to add this community.')
            : e.message || t("We couldn't create your account just now. Please try again.")
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
      setError(t('Please upload your {doc} and tick the consent box to continue.', { doc }))
      return
    }
    if (attachments.length === 0) {
      setError(t('Please upload your {doc} to continue.', { doc }))
      return
    }
    if (!docConsentChecked) {
      setError(t('Please tick the consent box so we can review your document.'))
      return
    }
    setBusy(true)
    try {
      // Uploads the file straight to secure storage, then submits the reference —
      // see api.submitApplication. Ticking the box above is what allows it.
      const app = await api.submitApplication({
        projectId: form.projectId,
        unit: form.unit.trim(),
        tier: form.tier,
        phone: form.phone,
        document: attachments[0].name,
        documentFile: attachments[0]
      })
      setApplication(app)
      setStep(2)
    } catch (e) {
      setError(e.message || t("We couldn't submit your application just now. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  // Withdrawal is a real deletion server-side: the application row goes, and the
  // uploaded document is removed from storage rather than waiting for the 14-day
  // retention purge.
  const withdrawApplication = async () => {
    if (!application) return
    if (!window.confirm(t('Withdraw your application and delete the document you uploaded?'))) return
    setBusy(true)
    setError('')
    try {
      await api.withdrawApplication(application.id)
      setApplication(null)
      setDocConsentChecked(false)
      resetAttachments()
      setStep(1)
    } catch (e) {
      setError(e.message || t("We couldn't withdraw your application just now. Please try again."))
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
        setError(t('This application is no longer on file. Please submit your document again.'))
        setApplication(null)
        setStep(1)
        return
      }
      setApplication(latest)
      if (latest.status === 'Approved') {
        await refresh()
        setStep(3)
      } else if (latest.status === 'Pending') {
        setError(t('Your application is still waiting for review. Please check back shortly.'))
      }
    } catch (e) {
      setError(e.message || t("We couldn't check your application just now. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  const seo = (
    <Seo
      path="/register"
      title={t('Join your verified community')}
      description={t("Verify your ownership with your Sale and Purchase Agreement, a recent utility bill, or your property title. An admin reviews it within 24 hours, then your building's private community opens up.")}
    />
  )

  if (!tncAccepted) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 24px' }}>
        {seo}
        <h1 style={{ color: C.navy, marginBottom: 6, fontSize: 28 }}>{t('Before you continue')}</h1>
        <p style={{ color: C.textMuted, marginTop: 0, marginBottom: 16, fontSize: 15 }}>
          {t('Please read and accept our Terms & Conditions before starting your community verification.')}
        </p>

        <div style={{ ...card, padding: 28 }}>
          <h3 style={{ margin: '0 0 12px', color: C.navy, fontSize: 19 }}>{t('Terms & Conditions')}</h3>
          <div style={{
            border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: 16,
            maxHeight: 240, overflowY: 'auto', fontSize: 13, color: C.textMuted, lineHeight: 1.7
          }}>
            <p><strong>{t('1. Accurate information.')}</strong> {t('You confirm that all details and documents submitted are true, accurate, and belong to you.')}</p>
            <p><strong>{t('2. Verification process.')}</strong> {t('Your application, including any uploaded documents, will be reviewed by a Platform Admin. False or fraudulent submissions may result in rejection or permanent suspension.')}</p>
            <p><strong>{t('3. Community conduct.')}</strong> {t('Once verified, you agree to engage respectfully with other residents and to use shared community channels for legitimate property-related discussion only.')}</p>
            <p>
              <strong>{t('4. Data usage & document retention.')}</strong>{' '}
              {t('Your personal information will be used solely to verify your connection to the property and to operate your community account. Any proof document you upload (e.g. SPA, utility bill, property title, Tenancy Agreement) will be used for verification purposes only and will {notStored}. Documents are deleted from our systems within 14 days of your application being reviewed, whether approved or rejected. We do not share your documents with third parties, other than the cloud storage provider we use to hold them securely — which may store data outside Malaysia. By submitting a document you consent to that transfer, which is necessary to provide the verification service.', {
                notStored: <strong>{t('not be stored permanently')}</strong>
              })}
            </p>
            <p><strong>{t('5. Account integrity.')}</strong> {t('Sharing your verified access with non-residents or misrepresenting your tier (Owner / House Owner) is prohibited and may lead to access being revoked.')}</p>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, fontSize: 13, color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={tncChecked} onChange={e => setTncChecked(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              {t('I have read and agree to the Terms & Conditions and {link}.', {
                link: <Link to="/privacy" style={{ color: C.blue }} onClick={e => e.stopPropagation()}>{t('Privacy Policy')}</Link>
              })}
            </span>
          </label>

          {error && <div role="alert" style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}

          {/* Left clickable on purpose. A greyed-out button that silently does
              nothing is the worst outcome for the residents this is built for —
              tapping it should always explain what's missing. */}
          <button
            style={{ ...button('primary'), marginTop: 16 }}
            onClick={() => {
              if (!tncChecked) {
                setError(t('Please tick the box to confirm you have read and agree to the Terms & Conditions.'))
                return
              }
              setError('')
              setTncAccepted(true)
            }}
          >
            {t('Agree & continue')}
          </button>
        </div>
      </div>
    )
  }

  const projectName = projects.find(p => p.id === application?.projectId)?.name

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 24px' }}>
      {seo}
      <h1 style={{ color: C.navy, marginBottom: 6, fontSize: 28 }}>{t('Join your verified community')}</h1>
      <p style={{ color: C.textMuted, marginTop: 0, marginBottom: 16, fontSize: 15 }}>
        {t('Every resident must prove their connection to the property before accessing the community — this protects discussion quality for everyone.')}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <div key={s} style={{
            ...badge(i <= step ? C.blue : C.textFaint, i <= step ? C.blueLight : C.neutralBg),
            padding: '8px 14px', fontSize: 14
          }}>
            {i + 1}. {t(s)}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'start' }}>
      <div style={{ ...card, padding: 28 }}>
        {step === 0 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0, color: C.navy, fontSize: 19 }}>
              {user ? t('Step 1 — Which community?') : t('Step 1 — Create your account')}
            </h3>

            {user ? (
              <div style={{ ...card, padding: 14, background: C.blueLight, border: 'none', fontSize: 13.5, color: C.text }}>
                {t("Signed in as {name} ({email}). Your application will be filed under this account — {link} if that isn't you.", {
                  name: <strong>{user.name}</strong>,
                  email: user.email,
                  link: (
                    <Link to={`/login?switch=1&next=${encodeURIComponent('/register')}`} style={{ color: C.blue, fontWeight: 700 }}>
                      {t('use a different one')}
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: C.textMuted, lineHeight: 1.6 }}>
                {t('Already have an account? {link} first and you can skip straight to uploading your proof.', {
                  link: <Link to="/login" style={{ color: C.blue, fontWeight: 700 }}>{t('Sign in')}</Link>
                })}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px 28px' }}>
              {!user && (
                <>
                  <Field label={t('Full name')}>
                    <input value={form.name} onChange={update('name')} style={inputStyle} placeholder={t('e.g. Alex Lim')} autoComplete="name" />
                  </Field>
                  <Field label={t('Email')}>
                    <input type="email" value={form.email} onChange={update('email')} style={inputStyle} placeholder="you@example.com" autoComplete="email" />
                  </Field>
                  <Field label={t('Password')}>
                    <input
                      type="password"
                      value={form.password}
                      onChange={update('password')}
                      style={inputStyle}
                      placeholder={t('At least {n} characters', { n: MIN_PASSWORD })}
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              )}
              <Field label={t('Phone')}>
                <input value={form.phone} onChange={update('phone')} style={inputStyle} placeholder="+60 12-345 6789" autoComplete="tel" />
              </Field>
              <Field label={t('Unit / lot number')}>
                <input value={form.unit} onChange={update('unit')} style={inputStyle} placeholder={t('e.g. B-21-03')} />
              </Field>
              <Field label={t('Property project')}>
                <select value={form.projectId} onChange={update('projectId')} style={inputStyle}>
                  <option value="">{t('Select your project...')}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}, {p.state}</option>)}
                </select>
              </Field>
              <Field label={t('Resident tier')}>
                <select value={form.tier} onChange={update('tier')} style={inputStyle}>
                  <option value="Owner">{t('Property Owner')}</option>
                  <option value="House Owner">{t('House Owner (landed G&G)')}</option>
                </select>
              </Field>
            </div>
            {error && <div role="alert" style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
            <button
              style={{ ...button('primary'), opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
              disabled={busy}
              onClick={submitRegistration}
            >
              {busy ? t('Creating your account…') : t('Continue')}
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0, color: C.navy }}>{t('Step 2 — Upload proof of ownership')}</h3>
            <p style={{ color: C.textMuted, margin: 0 }}>
              {t('Required document for {tier}: {doc}', { tier: <strong>{tierLabel}</strong>, doc })}
            </p>

            {/* Shown before the picker, not after: the point is to change which
                file someone chooses, and how much of it they leave readable. */}
            <ProofSample tier={form.tier} />

            <AttachmentPicker
              attachments={attachments}
              addFiles={addFiles}
              removeAttachment={removeAttachment}
              error={uploadError}
              label={t('Upload your {doc}', { doc })}
              max={1}
            />

            <div style={{
              background: '#fffbeb', border: `1px solid #f59e0b`, borderRadius: C.radiusSm,
              padding: '12px 14px', fontSize: 13, color: '#92400e', lineHeight: 1.6
            }}>
              <strong>🔒 {t('Data privacy notice')}</strong><br />
              {t('Your document is used {purpose}. We do not store it permanently — it will be deleted within {days} of your application being reviewed. Only the assigned platform admin can access your document during this period. We do not share, sell, or retain your document beyond what is necessary to verify your residency. It is held in encrypted cloud storage that may be located outside Malaysia — see our {link}.', {
                purpose: <strong>{t('for verification purposes only')}</strong>,
                days: <strong>{t('14 days')}</strong>,
                link: <Link to="/privacy" style={{ color: '#92400e', fontWeight: 700 }} target="_blank">{t('Privacy Policy')}</Link>
              })}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.text, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={docConsentChecked}
                onChange={e => setDocConsentChecked(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              {t("I consent to my uploaded document being reviewed by a platform admin solely for residency verification, being stored on our cloud storage provider's servers (which may be located outside Malaysia), and I understand it will be permanently deleted within 14 days of review.")}
            </label>

            {error && <div role="alert" style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
            {/* Clickable even when incomplete — submitDocument names what's
                missing. See the note on the Terms & Conditions button above. */}
            <button
              style={{ ...button('primary'), opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
              disabled={busy}
              onClick={submitDocument}
            >
              {busy ? t('Uploading your document…') : t('Submit for review')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0, color: C.navy }}>{t('Step 3 — Awaiting admin review')}</h3>
            <p style={{ color: C.textMuted, margin: 0 }}>
              {t('Your application has been submitted. Admin verification target: {target}.', {
                target: <strong>{t('within 24 hours')}</strong>
              })}
            </p>
            <div style={{ ...card, padding: 16, background: C.blueLight, border: 'none' }}>
              <div><strong>{application?.name}</strong> — {t(application?.tier)}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                {t('Unit {unit}', { unit: application?.unit })} · {projectName}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{t('Document: {name}', { name: application?.document })}</div>
              {application?.documentFile && (
                <AttachmentList attachments={[application.documentFile]} thumb={72} style={{ marginTop: 8 }} />
              )}
              <div style={{ marginTop: 6 }}><StatusBadge status={application?.status || 'Pending'} /></div>
            </div>

            <div style={{
              background: '#fffbeb', border: `1px solid #f59e0b`, borderRadius: C.radiusSm,
              padding: '12px 14px', fontSize: 12.5, color: '#92400e', lineHeight: 1.6
            }}>
              🔒 <strong>{t('Your document is held for review only.')}</strong>{' '}
              {t('It will be permanently deleted within 14 days of a decision being made.')}
              {application?.consentAcceptedAt && (
                <div style={{ marginTop: 6, color: '#78350f' }}>
                  {t('Consent recorded: {date}', {
                    date: formatDate(application.consentAcceptedAt, { dateStyle: 'medium', timeStyle: 'short' })
                  })}
                </div>
              )}
            </div>

            {application?.status === 'Rejected' ? (
              <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
                {t("A platform admin couldn't verify this document. You can withdraw this application and submit a clearer copy, or {link} if you think it was reviewed in error.", {
                  link: <Link to="/contact" style={{ color: C.blue, fontWeight: 700 }}>{t('contact us')}</Link>
                })}
              </p>
            ) : (
              <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
                {t("A platform admin reviews your document in the admin queue — you'll get access as soon as they approve it. Check back here any time.")}
              </p>
            )}

            {error && <div role="alert" style={{ color: C.danger, fontSize: 13 }}>{error}</div>}

            {application?.status !== 'Rejected' && (
              <button
                style={{ ...button('primary'), opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
                disabled={busy}
                onClick={checkStatus}
              >
                {busy ? t('Checking…') : t('Check my application status')}
              </button>
            )}
            <button
              style={{ ...button('outline'), fontSize: 13, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
              disabled={busy}
              onClick={withdrawApplication}
            >
              {t('Withdraw my application & delete document')}
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gap: 14, textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <h3 style={{ margin: 0, color: C.navy }}>{t('Access granted!')}</h3>
            <p style={{ color: C.textMuted, margin: 0 }}>
              {t('You now have full community access for {project}. Your profile will show as {unit} with a verified badge on all posts.', {
                project: <strong>{projectName}</strong>,
                unit: <strong>{application?.unit?.split('-').slice(0, 2).join('-') || application?.unit}</strong>
              })}
            </p>
            {/* Link, not a bare <a href> — a full page load would drop the
                router's base path on the Pages build and 404. */}
            <Link to={`/project/${application?.projectId}`}>
              <button style={button('primary')}>{t('Go to community →')}</button>
            </Link>
          </div>
        )}
      </div>

      <div className="pg-register-aside" style={{ display: 'grid', gap: 16 }}>
        <div style={{ ...card, padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', color: C.navy, fontSize: 16 }}>{t('Required document')}</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            {t("As a {tier}, you'll need to upload your {doc} to prove your connection to the property.", {
              tier: <strong>{tierLabel}</strong>,
              doc: <strong>{doc}</strong>
            })}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            {t('Just one page — the one with your name and the address. Your IC number, the price and any bank details can be blacked out first; step 2 shows an example.')}
          </p>
        </div>

        <div style={{ ...card, padding: 20 }}>
          <h3 style={{ margin: '0 0 10px', color: C.navy, fontSize: 16 }}>{t('How it works')}</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
            <div><strong style={{ color: C.navy }}>1. {t('Register')}</strong><br />{t("Tell us who you are and which property you're connected to.")}</div>
            <div><strong style={{ color: C.navy }}>2. {t('Upload proof')}</strong><br />{t('One page showing your name and the address — black out anything else.')}</div>
            <div><strong style={{ color: C.navy }}>3. {t('Admin review')}</strong><br />{t('A platform admin checks your document, usually within 24 hours.')}</div>
            <div><strong style={{ color: C.navy }}>4. {t('Access granted')}</strong><br />{t('Get a verified badge and full access to your community.')}</div>
          </div>
        </div>

        <div style={{ ...card, padding: 20, background: C.blueLight, border: 'none' }}>
          <h3 style={{ margin: '0 0 8px', color: C.navy, fontSize: 16 }}>{t('Why verify?')}</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
            {t('Verification keeps discussions trustworthy by ensuring everyone here is a verified property owner.')}
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

function StatusBadge({ status }) {
  const { t } = useI18n()
  if (status === 'Pending') return <span style={badge(C.warning, C.warningBg)}>⏳ {t('Pending review')}</span>
  if (status === 'Approved') return <span style={badge(C.success, C.successBg)}>✓ {t('Approved')}</span>
  return <span style={badge(C.danger, C.dangerBg)}>✕ {t('Rejected')}</span>
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
