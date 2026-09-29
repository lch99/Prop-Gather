import { Link } from 'react-router-dom'
import { C, button } from '../theme'
import Seo from '../seo'
import { useT } from '../i18n'

export default function NotFoundPage() {
  const t = useT()
  return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 16px', textAlign: 'center', color: C.textMuted }}>
      {/* A client-routed SPA answers 200 for every URL, so this tag is the only
          way to tell a crawler the page is not real content. */}
      <Seo title={t('Page not found')} noindex />
      <h1 style={{ color: C.navy }}>{t('404 — Page not found')}</h1>
      <p>{t("The page you're looking for doesn't exist in current phase yet.")}</p>
      <p>
        {t("Need help? {link} and we'll sort it out.", {
          link: <Link to="/contact" style={{ color: C.blue, fontWeight: 700 }}>{t('Contact us')}</Link>
        })}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <Link to="/discover"><button style={button('primary')}>{t('Back to Discover')}</button></Link>
        <Link to="/contact"><button style={button('outline')}>{t('Contact Us')}</button></Link>
      </div>
    </div>
  )
}
