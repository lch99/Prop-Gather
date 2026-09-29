import { C, card } from '../theme'
import Seo from '../seo'
import { LANGUAGES, useI18n } from '../i18n'

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
          We only need to read <strong>your name</strong> and <strong>the property address</strong> on that
          document. You are encouraged to black out everything else — your IC/NRIC number, the purchase
          price, loan and bank details, and signatures — before you upload it. Registration shows an
          example of a correctly covered page.
        </p>
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
          Kami hanya perlu membaca <strong>nama anda</strong> dan <strong>alamat hartanah</strong> pada
          dokumen tersebut. Anda digalakkan menutup (black out) semua maklumat lain — nombor IC/NRIC,
          harga belian, butiran pinjaman dan bank, serta tandatangan — sebelum memuat naiknya. Halaman
          pendaftaran menunjukkan contoh halaman yang ditutup dengan betul.
        </p>
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

// A courtesy translation for Chinese-reading residents. PDPA requires the notice
// in English and Bahasa Malaysia; this one is extra, and says in-page that
// those two are the versions that count.
//
// Keep each sentence on one source line: JSX turns a line break inside text
// into a space, which English and Malay need and Chinese must not have.
function ChineseContent() {
  return (
    <>
      <Section title="1. 我们是谁">
        PropGather.com.my 是一个为马来西亚居民而设的已验证房产社区平台。我们收集个人资料，只是为了验证您与某项房产的关系，以及运作您的社区账户。
      </Section>

      <Section title="2. 我们收集什么">
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>您的姓名、电邮、电话号码及单位／地段号码</li>
          <li>您所选的房产项目及业主类别（业主／有地住宅业主）</li>
          <li>
            一份证明文件，以下任何一种：
            <ul style={{ marginTop: 4 }}>
              <li>买卖合约（SPA）</li>
              <li>近期的水电账单</li>
              <li>房产地契副本</li>
            </ul>
          </li>
          <li>您在上传文件时明确表示同意的时间戳记及记录</li>
        </ul>
        <p style={{ margin: '10px 0 0' }}>
          我们只需要看到文件上的<strong>您的姓名</strong>和<strong>房产地址</strong>。我们鼓励您在上传前遮盖其他所有资料——您的身份证号码、购买价格、贷款及银行资料，以及签名。注册页面会展示一个正确遮盖的示例。
        </p>
        <p style={{ margin: '10px 0 0' }}>
          以上所有资料都是在注册及上传文件时直接向您收集的——我们不会向任何第三方购买或接收您的资料。
        </p>
      </Section>

      <Section title="3. 我们为何收集，是否必须提供？">
        <p style={{ margin: '0 0 8px' }}>
          我们只收集以下用途所必需的资料：
        </p>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>验证您确实是所填房产的居民或业主</li>
          <li>为您分配正确的社区访问类别</li>
          <li>维持一个经过验证、值得信赖的社区环境</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>
          提供您的姓名、联络资料及证明文件是完成注册的<strong>必要条件</strong>——缺少这些，我们便无法验证您的身份，您的申请也无法继续。我们<strong>不会</strong>将您的资料用于营销、广告、用户画像，或出售给第三方。
        </p>
      </Section>

      <Section title="4. 文件保留——我们的承诺">
        <div style={{
          background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '12px 14px', color: '#92400e', marginBottom: 10
        }}>
          <strong>您的证明文件不会被永久保存。</strong>
        </div>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>在审核期间，只有被指派的平台管理员可以查看您的文件。</li>
          <li>在您的申请审核完毕（批准或拒绝）后 <strong>14 天</strong>内，文件将被删除。</li>
          <li>删除后不会保留任何副本。我们只保留一份不可逆的记录，表明某份文件已通过验证。</li>
          <li>在作出决定之前，您可以撤回申请，要求提早删除文件。</li>
        </ul>
      </Section>

      <Section title="5. 谁会看到您的文件，以及我们与谁合作">
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li>只有被指派审核您申请的平台管理员可以查看或下载该文件</li>
          <li>我们的云端储存服务商代我们保存加密文件，但不会查看、使用或分享该文件——请参阅下方的「跨境资料传输」</li>
          <li>其他用户、居民或第三方在任何时候都无法取得您的文件</li>
        </ul>
        <p style={{ margin: '10px 0 0' }}>
          唯一会接收您资料的第三方类别，是我们的云端储存服务商；它严格按照我们的指示担任资料处理者，绝不作其自身用途。
        </p>
      </Section>

      <Section title="6. 跨境资料传输">
        <p style={{ margin: '0 0 8px' }}>
          您的文件由第三方云端储存服务商保存，该服务商可能会在马来西亚境外的服务器处理或储存资料。此传输是提供验证服务所必需的——我们并没有自己的数据中心。
        </p>
        <p style={{ margin: 0 }}>
          提交文件以供验证，即表示您根据马来西亚《2010年个人资料保护法令》第129条，明确同意此项传输。若您不同意，可以在上传步骤中拒绝——只是没有经过验证的文件，您的申请便无法继续。
        </p>
      </Section>

      <Section title="7. 您的权利（2010年个人资料保护法令，经修订）">
        <p style={{ margin: '0 0 8px' }}>根据马来西亚《2010年个人资料保护法令》，您有权：</p>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li><strong>查阅</strong>——索取我们所持有关于您的个人资料副本</li>
          <li><strong>更正</strong>——要求更正不准确的资料</li>
          <li><strong>资料可携</strong>——在适用情况下，以可携格式索取您的资料</li>
          <li><strong>撤回同意</strong>——在审核决定作出前撤回申请，并要求删除您已提交的文件</li>
          <li><strong>投诉</strong>——向马来西亚个人资料保护局提出投诉</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>
          如需行使上述任何权利，请联络{' '}
          <a href="mailto:infopropgather@gmail.com" style={{ color: C.blue }}>infopropgather@gmail.com</a>。我们以人工方式处理这些请求，并会在合理时间内回复。
        </p>
      </Section>

      <Section title="8. 儿童资料">
        PropGather 的对象是成年业主及居民。我们不会在知情的情况下收集任何 18 岁以下人士的个人资料。若您认为有未成年人向我们提交了资料，请联络{' '}
        <a href="mailto:infopropgather@gmail.com" style={{ color: C.blue }}>infopropgather@gmail.com</a>，我们会将其删除。
      </Section>

      <Section title="9. 安全">
        所有资料均通过加密的 HTTPS 连接传输。证明文件保存在设有访问控制的加密储存空间，只能通过经身份验证、有时限的链接取得。管理员的访问均会被记录及审计。
      </Section>

      <Section title="10. 本政策的更改">
        若本政策有任何重大更改，我们会通知已注册用户。在收到通知后继续使用本平台，即表示接受更新后的政策。
      </Section>
    </>
  )
}

const CONTENT = { en: EnglishContent, ms: BahasaContent, zh: ChineseContent }

const linkButton = { border: 'none', background: 'none', color: C.blue, cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }

// Follows the site language (header picker). The buttons here switch it too, so
// the notice stays one tap from English and Bahasa Malaysia — the two versions
// PDPA's Notice and Choice Principle requires.
export default function PrivacyPage() {
  const { lang, setLang, t } = useI18n()
  const Content = CONTENT[lang] || EnglishContent

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px clamp(16px, 5vw, 24px)' }}>
      <Seo
        path="/privacy"
        title={t('Privacy policy')}
        description={t("How PropGather collects, uses, and deletes your personal data under Malaysia's Personal Data Protection Act 2010 — including the 14-day deletion of ownership-proof documents.")}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: C.navy, fontSize: 28, margin: 0 }}>
            {t('Privacy Policy')}
          </h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            {t('Last updated: August 2026')} · PropGather.com.my
          </p>
        </div>
        <div role="group" aria-label="Language · Bahasa · 语言" style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: C.radiusSm, overflow: 'hidden', flexShrink: 0 }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              lang={l.htmlLang}
              style={{
                border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13, fontWeight: 700,
                background: lang === l.code ? C.blue : '#fff', color: lang === l.code ? '#fff' : C.text
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {lang === 'ms' && (
        <p style={{ fontSize: 11.5, color: C.textFaint, fontStyle: 'italic', margin: '10px 0 0' }}>
          Terjemahan ini disediakan dengan suci hati dan belum disemak oleh guaman. Sekiranya terdapat
          percanggahan, versi{' '}
          <button onClick={() => setLang('en')} style={linkButton}>
            Bahasa Inggeris
          </button>{' '}
          adalah rujukan utama.
        </p>
      )}

      {lang === 'zh' && (
        <p style={{ fontSize: 11.5, color: C.textFaint, fontStyle: 'italic', margin: '10px 0 0' }}>
          {/* No line breaks between these pieces: JSX would turn each into a
              space, and Chinese text has none. */}
          此中文译本仅供参考，由我们善意提供，未经法律审阅。本政策以<button onClick={() => setLang('en')} style={linkButton}>英文版</button>及<button onClick={() => setLang('ms')} style={linkButton}>马来文版</button>为准；如有任何歧义，以英文版为最终依据。
        </p>
      )}

      <div style={{ ...card, padding: 'clamp(18px, 5vw, 28px)', marginTop: 20 }}>
        <Content />
      </div>

      <p style={{ fontSize: 12, color: C.textFaint, marginTop: 20, textAlign: 'center' }}>
        PropGather.com.my · {t("Malaysia's Verified Property Community")}
      </p>
    </div>
  )
}
