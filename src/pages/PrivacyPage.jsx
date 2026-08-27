import { useState } from 'react'
import { C, card } from '../theme'
import Seo from '../seo'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <h2 style={{ color: C.navy, fontSize: 17, margin: '0 0 10px' }}>{title}</h2>
    <div style={{ color: C.textMuted, fontSize: 13.5, lineHeight: 1.8 }}>{children}</div>
  </div>
)

// PDPA's Notice and Choice Principle requires this notice in both English and
// Bahasa Malaysia. The Bahasa Malaysia text below is a good-faith translation,
// not a certified legal one — have it reviewed by a native/legal BM speaker
// before relying on it. If the two versions ever disagree, the English
// version + independent legal review should be treated as authoritative.
function EnglishContent() {
  return (
    <>
      <Section title="1. Who we are">
        PropGather.com.my is a verified property community platform for Malaysian residents.
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
        <p style={{ margin: '10px 0 0' }}>
          All of this is collected directly from you, at registration and document upload — we don't buy or
          receive your data from any third-party source.
        </p>
      </Section>

      <Section title="3. Why we collect it, and is it mandatory?">
        <p style={{ margin: '0 0 8px' }}>
          We collect only what is necessary to:
        </p>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>Verify that you are a genuine resident or owner of the stated property</li>
          <li>Assign you the correct community access tier</li>
          <li>Maintain a verified, trustworthy community environment</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>
          Providing your name, contact details, and proof document is <strong>mandatory</strong> to complete
          registration — without them we can't verify you, and your application can't proceed. We do{' '}
          <strong>not</strong> use your data for marketing, advertising, profiling, or sale to third parties.
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

      <Section title="5. Who sees your document, and who else we work with">
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>Only the platform admin assigned to review your application can view or download it</li>
          <li>Our cloud storage provider holds the encrypted file on our behalf but does not view, use, or share it — see "Cross-border data transfer" below</li>
          <li>No other users, residents, or third parties can access your document at any time</li>
        </ul>
        <p style={{ margin: '10px 0 0' }}>
          The only class of third party your data is disclosed to is our cloud storage provider, acting
          strictly as a processor on our instructions — never for their own purposes.
        </p>
      </Section>

      <Section title="6. Cross-border data transfer">
        <p style={{ margin: '0 0 8px' }}>
          Your document is stored using a third-party cloud storage provider, which may process or store
          data on servers located outside Malaysia. This transfer is necessary to provide the verification
          service — we don't operate our own data centres.
        </p>
        <p style={{ margin: 0 }}>
          By submitting a document for verification, you give explicit consent to this transfer, as
          permitted under Section 129 of Malaysia's Personal Data Protection Act 2010. If you don't wish
          to consent, you can decline at the upload step — your application just can't proceed without a
          verified document.
        </p>
      </Section>

      <Section title="7. Your rights (PDPA 2010, as amended)">
        <p style={{ margin: '0 0 8px' }}>Under Malaysia's Personal Data Protection Act 2010, you have the right to:</p>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
          <li><strong>Correction</strong> — request correction of inaccurate data</li>
          <li><strong>Data portability</strong> — request your data in a portable format, where applicable</li>
          <li><strong>Withdrawal of consent</strong> — withdraw your application and request deletion of your submitted document before a review decision is made</li>
          <li><strong>Complaint</strong> — lodge a complaint with the Department of Personal Data Protection Malaysia</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:infopropgather@gmail.com" style={{ color: C.blue }}>infopropgather@gmail.com</a>.
          We handle these requests manually and will respond within a reasonable time.
        </p>
      </Section>

      <Section title="8. Children's data">
        PropGather is intended for adult property owners and residents. We do not knowingly collect
        personal data from anyone under 18. If you believe a minor has submitted data to us, contact{' '}
        <a href="mailto:infopropgather@gmail.com" style={{ color: C.blue }}>infopropgather@gmail.com</a> and
        we'll remove it.
      </Section>

      <Section title="9. Security">
        All data is transmitted over encrypted HTTPS connections.
        Proof documents are stored in access-controlled, encrypted storage and are accessible only via
        authenticated, time-limited links. Admin access is logged and audited.
      </Section>

      <Section title="10. Changes to this policy">
        We will notify registered users of any material changes to this policy.
        Continued use of the platform after notification constitutes acceptance of the updated policy.
      </Section>
    </>
  )
}

function BahasaContent() {
  return (
    <>
      <Section title="1. Siapa kami">
        PropGather.com.my ialah platform komuniti hartanah disahkan untuk penduduk Malaysia.
        Kami mengumpul maklumat peribadi hanya untuk mengesahkan hubungan anda dengan sesuatu hartanah dan untuk mengendalikan akaun komuniti anda.
      </Section>

      <Section title="2. Apa yang kami kumpul">
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>Nama, e-mel, nombor telefon, dan nombor unit/lot anda</li>
          <li>Pilihan projek hartanah dan tahap pemilik anda (Pemilik / Pemilik Rumah)</li>
          <li>
            Dokumen bukti — salah satu daripada:
            <ul style={{ marginTop: 4 }}>
              <li>Perjanjian Jual Beli (SPA)</li>
              <li>Bil utiliti terkini</li>
              <li>Salinan geran hartanah</li>
            </ul>
          </li>
          <li>Cap masa dan rekod persetujuan eksplisit anda pada ketika muat naik dokumen</li>
        </ul>
        <p style={{ margin: '10px 0 0' }}>
          Semua ini dikumpul secara langsung daripada anda, semasa pendaftaran dan muat naik dokumen —
          kami tidak membeli atau menerima data anda daripada mana-mana sumber pihak ketiga.
        </p>
      </Section>

      <Section title="3. Mengapa kami mengumpulnya, dan adakah ia wajib?">
        <p style={{ margin: '0 0 8px' }}>
          Kami hanya mengumpul apa yang perlu untuk:
        </p>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>Mengesahkan bahawa anda benar-benar penduduk atau pemilik hartanah yang dinyatakan</li>
          <li>Menetapkan tahap akses komuniti yang betul untuk anda</li>
          <li>Mengekalkan persekitaran komuniti yang disahkan dan boleh dipercayai</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>
          Memberikan nama, butiran hubungan, dan dokumen bukti anda adalah <strong>wajib</strong> untuk
          melengkapkan pendaftaran — tanpanya kami tidak dapat mengesahkan anda, dan permohonan anda tidak
          dapat diteruskan. Kami <strong>tidak</strong> menggunakan data anda untuk pemasaran, pengiklanan,
          pemprofilan, atau jualan kepada pihak ketiga.
        </p>
      </Section>

      <Section title="4. Penyimpanan dokumen — komitmen kami">
        <div style={{
          background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '12px 14px', color: '#92400e', marginBottom: 10
        }}>
          <strong>Dokumen bukti anda tidak disimpan secara kekal.</strong>
        </div>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>Dokumen anda hanya boleh diakses oleh admin platform yang ditugaskan semasa tempoh semakan.</li>
          <li>Ia dipadamkan dalam tempoh <strong>14 hari</strong> selepas permohonan anda disemak (diluluskan atau ditolak).</li>
          <li>Tiada salinan disimpan selepas pemadaman. Kami hanya menyimpan rekod tidak boleh diterbalikkan bahawa sesuatu dokumen telah disahkan.</li>
          <li>Anda boleh meminta pemadaman awal dengan menarik balik permohonan anda sebelum sebarang keputusan dibuat.</li>
        </ul>
      </Section>

      <Section title="5. Siapa yang melihat dokumen anda, dan siapa lagi yang kami bekerjasama">
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>Hanya admin platform yang ditugaskan untuk menyemak permohonan anda boleh melihat atau memuat turun dokumen tersebut</li>
          <li>Penyedia storan awan kami menyimpan fail yang disulitkan bagi pihak kami tetapi tidak melihat, menggunakan, atau berkongsi dokumen tersebut — lihat "Pemindahan data merentasi sempadan" di bawah</li>
          <li>Tiada pengguna, penduduk, atau pihak ketiga lain boleh mengakses dokumen anda pada bila-bila masa</li>
        </ul>
        <p style={{ margin: '10px 0 0' }}>
          Satu-satunya golongan pihak ketiga yang menerima data anda ialah penyedia storan awan kami,
          yang bertindak semata-mata sebagai pemproses atas arahan kami — bukan untuk tujuan mereka sendiri.
        </p>
      </Section>

      <Section title="6. Pemindahan data merentasi sempadan">
        <p style={{ margin: '0 0 8px' }}>
          Dokumen anda disimpan menggunakan penyedia storan awan pihak ketiga, yang mungkin memproses atau
          menyimpan data pada pelayan yang terletak di luar Malaysia. Pemindahan ini perlu untuk menyediakan
          perkhidmatan pengesahan — kami tidak mengendalikan pusat data kami sendiri.
        </p>
        <p style={{ margin: 0 }}>
          Dengan menghantar dokumen untuk pengesahan, anda memberikan persetujuan eksplisit kepada
          pemindahan ini, sebagaimana dibenarkan di bawah Seksyen 129 Akta Perlindungan Data Peribadi 2010
          Malaysia. Jika anda tidak mahu bersetuju, anda boleh menolak pada langkah muat naik — permohonan
          anda hanya tidak dapat diteruskan tanpa dokumen yang disahkan.
        </p>
      </Section>

      <Section title="7. Hak anda (PDPA 2010, sebagaimana dipinda)">
        <p style={{ margin: '0 0 8px' }}>Di bawah Akta Perlindungan Data Peribadi 2010 Malaysia, anda mempunyai hak untuk:</p>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li><strong>Akses</strong> — meminta salinan data peribadi yang kami simpan tentang anda</li>
          <li><strong>Pembetulan</strong> — meminta pembetulan data yang tidak tepat</li>
          <li><strong>Kemudahalihan data</strong> — meminta data anda dalam format mudah alih, jika berkenaan</li>
          <li><strong>Penarikan balik persetujuan</strong> — menarik balik permohonan anda dan meminta pemadaman dokumen yang dihantar sebelum keputusan semakan dibuat</li>
          <li><strong>Aduan</strong> — mengemukakan aduan kepada Jabatan Perlindungan Data Peribadi Malaysia</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>
          Untuk menggunakan mana-mana hak ini, hubungi kami di{' '}
          <a href="mailto:infopropgather@gmail.com" style={{ color: C.blue }}>infopropgather@gmail.com</a>.
          Kami mengendalikan permintaan ini secara manual dan akan memberi respons dalam tempoh yang munasabah.
        </p>
      </Section>

      <Section title="8. Data kanak-kanak">
        PropGather ditujukan untuk pemilik dan penduduk hartanah yang berusia dewasa. Kami tidak secara
        sengaja mengumpul data peribadi daripada sesiapa yang berusia bawah 18 tahun. Jika anda percaya
        seorang kanak-kanak telah menghantar data kepada kami, hubungi{' '}
        <a href="mailto:infopropgather@gmail.com" style={{ color: C.blue }}>infopropgather@gmail.com</a> dan
        kami akan memadamkannya.
      </Section>

      <Section title="9. Keselamatan">
        Semua data dihantar melalui sambungan HTTPS yang disulitkan. Dokumen bukti disimpan dalam storan
        yang disulitkan dan terkawal akses, serta hanya boleh diakses melalui pautan yang disahkan dan
        terhad masa. Akses admin direkod dan diaudit.
      </Section>

      <Section title="10. Perubahan kepada dasar ini">
        Kami akan memaklumkan pengguna berdaftar tentang sebarang perubahan penting kepada dasar ini.
        Penggunaan berterusan platform selepas pemberitahuan tersebut membawa maksud penerimaan terhadap
        dasar yang dikemas kini.
      </Section>
    </>
  )
}

export default function PrivacyPage() {
  const [lang, setLang] = useState('en')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <Seo
        path="/privacy"
        title="Privacy policy"
        description="How PropGather collects, uses, and deletes your personal data under Malaysia's Personal Data Protection Act 2010 — including the 14-day deletion of ownership-proof documents."
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: C.navy, fontSize: 28, margin: 0 }}>
            {lang === 'en' ? 'Privacy Policy' : 'Dasar Privasi'}
          </h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            {lang === 'en' ? 'Last updated: August 2026 · PropGather.com.my' : 'Terakhir dikemas kini: Ogos 2026 · PropGather.com.my'}
          </p>
        </div>
        <div role="group" aria-label="Language / Bahasa" style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, overflow: 'hidden', flexShrink: 0 }}>
          {[['en', 'English'], ['bm', 'Bahasa Malaysia']].map(([code, label]) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              style={{
                border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13, fontWeight: 700,
                background: lang === code ? C.blue : '#fff', color: lang === code ? '#fff' : C.text
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {lang === 'bm' && (
        <p style={{ fontSize: 11.5, color: C.textFaint, fontStyle: 'italic', margin: '10px 0 0' }}>
          Terjemahan ini disediakan dengan suci hati dan belum disemak oleh guaman. Sekiranya terdapat
          percanggahan, versi{' '}
          <button onClick={() => setLang('en')} style={{ border: 'none', background: 'none', color: C.blue, cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>
            Bahasa Inggeris
          </button>{' '}
          adalah rujukan utama.
        </p>
      )}

      <div style={{ ...card, padding: 28, marginTop: 20 }}>
        {lang === 'en' ? <EnglishContent /> : <BahasaContent />}
      </div>

      <p style={{ fontSize: 12, color: C.textFaint, marginTop: 20, textAlign: 'center' }}>
        PropGather.com.my · {lang === 'en' ? "Malaysia's Verified Property Community" : 'Komuniti Hartanah Disahkan Malaysia'}
      </p>
    </div>
  )
}
