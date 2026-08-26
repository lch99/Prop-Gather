import { C, card, button } from '../theme'

const Channel = ({ icon, title, children }) => (
  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24 }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      background: C.blueLight, color: C.blue,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
    }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <h2 style={{ color: C.navy, fontSize: 16, margin: '2px 0 5px' }}>{title}</h2>
      <div style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </div>
  </div>
)

export default function ContactPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(20px, 5vw, 40px) clamp(16px, 5vw, 28px)' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: C.blueLight, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 24
          }}>💬</div>
          <h1 style={{ color: C.navy, fontSize: 'clamp(22px, 5vw, 28px)', margin: 0, lineHeight: 1.2 }}>
            Contact Us
          </h1>
        </div>
        <p style={{ color: C.textMuted, fontSize: 14.5, margin: 0, lineHeight: 1.7, maxWidth: 520 }}>
          Have a question, found an issue, or need help with your account?
          Reach us through any of the channels below and we'll get back to you.
        </p>
      </div>

      {/* Channels card */}
      <div style={{ ...card, padding: 'clamp(18px, 5vw, 28px)' }}>
        <Channel icon="✉️" title="Email us">
          For general questions, account help, or to report a problem:<br />
          <a href="mailto:Supportpropgather@gmail.com" style={{ color: C.blue, fontWeight: 700 }}>
            Supportpropgather@gmail.com
          </a>
        </Channel>

        <Channel icon="🔒" title="Privacy & data requests">
          For anything about your personal data or document removal:<br />
          <a href="mailto:infopropgather@gmail.com" style={{ color: C.blue, fontWeight: 700 }}>
            infopropgather@gmail.com
          </a>
        </Channel>

        <Channel icon="🏢" title="Verification & community access">
          Trouble joining your community or getting verified? Email us with your project
          name and unit/lot number.<br />
          <a href="mailto:Supportpropgather@gmail.com" style={{ color: C.blue, fontWeight: 700 }}>
            Supportpropgather@gmail.com
          </a>
        </Channel>

        <Channel icon="⏱️" title="Response time">
          We aim to reply within <strong>2 business days</strong>. Include as much detail
          as you can so we can help you faster.
        </Channel>

        <a href="mailto:support@propgather.com" style={{ display: 'block', marginTop: 8 }}>
          <button style={{ ...button('primary'), width: '100%', padding: '13px 18px', fontSize: 15 }}>
            ✉️&nbsp; Email our support team
          </button>
        </a>
      </div>
    </div>
  )
}
