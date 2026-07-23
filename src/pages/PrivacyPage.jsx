import { C, card } from '../theme'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <h2 style={{ color: C.navy, fontSize: 17, margin: '0 0 10px' }}>{title}</h2>
    <div style={{ color: C.textMuted, fontSize: 13.5, lineHeight: 1.8 }}>{children}</div>
  </div>
)

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ color: C.navy, fontSize: 28, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: C.textMuted, fontSize: 13, marginTop: 0, marginBottom: 28 }}>
        Last updated: June 2025 · PropGather.com
      </p>

      <div style={{ ...card, padding: 28 }}>
        <Section title="1. Who we are">
          PropGather.com is a verified property community platform for Malaysian residents.
          We collect personal information only to verify your connection to a property and to operate your community account.
        </Section>

        <Section title="2. What we collect">
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Your name, email, phone number, and unit/lot number</li>
            <li>Your property project selection and owner tier (Owner / House Owner)</li>
            <li>
              A proof document — one of:
              <ul style={{ marginTop: 4 }}>
                <li>Sale &amp; Purchase Agreement (SPA)</li>
                <li>A recent utility bill</li>
                <li>A copy of the property title</li>
              </ul>
            </li>
            <li>Timestamp and record of your explicit consent at the point of document upload</li>
          </ul>
        </Section>

        <Section title="3. Why we collect it">
          <p style={{ margin: '0 0 8px' }}>
            We collect only what is necessary to:
          </p>
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Verify that you are a genuine resident or owner of the stated property</li>
            <li>Assign you the correct community access tier</li>
            <li>Maintain a verified, trustworthy community environment</li>
          </ul>
          <p style={{ margin: '8px 0 0' }}>
            We do <strong>not</strong> use your data for marketing, advertising, profiling, or sale to third parties.
          </p>
        </Section>

        <Section title="4. Document retention — our commitment">
          <div style={{
            background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8,
            padding: '12px 14px', color: '#92400e', marginBottom: 10
          }}>
            <strong>Your proof document is not stored permanently.</strong>
          </div>
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Your document is accessible only to the assigned platform admin during the review period.</li>
            <li>It is deleted within <strong>14 days</strong> of your application being reviewed (approved or rejected).</li>
            <li>No copy is retained after deletion. We keep only a non-reversible record that a document was verified.</li>
            <li>You may request early deletion by withdrawing your application before a decision is made.</li>
          </ul>
        </Section>

        <Section title="5. Who sees your document">
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Only the platform admin assigned to review your application</li>
            <li>No other users, residents, or third parties can access your document at any time</li>
          </ul>
        </Section>

        <Section title="6. Your rights (PDPA 2010)">
          <p style={{ margin: '0 0 8px' }}>Under Malaysia's Personal Data Protection Act 2010, you have the right to:</p>
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Correction</strong> — request correction of inaccurate data</li>
            <li><strong>Withdrawal of consent</strong> — withdraw your application and request deletion of your submitted document before a review decision is made</li>
            <li><strong>Complaint</strong> — lodge a complaint with the Department of Personal Data Protection Malaysia</li>
          </ul>
          <p style={{ margin: '8px 0 0' }}>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@propgather.com" style={{ color: C.blue }}>privacy@propgather.com</a>.
          </p>
        </Section>

        <Section title="7. Security">
          All data is transmitted over encrypted HTTPS connections.
          Proof documents are stored in access-controlled, encrypted storage and are accessible only via
          authenticated, time-limited links. Admin access is logged and audited.
        </Section>

        <Section title="8. Changes to this policy">
          We will notify registered users of any material changes to this policy.
          Continued use of the platform after notification constitutes acceptance of the updated policy.
        </Section>
      </div>

      <p style={{ fontSize: 12, color: C.textFaint, marginTop: 20, textAlign: 'center' }}>
        PropGather.com · Malaysia's Verified Property Community
      </p>
    </div>
  )
}
