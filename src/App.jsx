import { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { RequireAuth } from './auth'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'
import { lazyPage, PageErrorBoundary, PageLoading } from './components/LazyPage'

// One chunk per page instead of one bundle for the whole site. With a single
// bundle, a resident opening a shared community link on their phone downloaded
// and parsed the admin dashboard, the registration flow and the privacy policy
// before the page they came for could render. Layout stays in the main bundle,
// so the header paints straight away while a page's chunk arrives.
const LandingPage = lazyPage(() => import('./pages/LandingPage'))
const DiscoverPage = lazyPage(() => import('./pages/DiscoverPage'))
const MyCommunitiesPage = lazyPage(() => import('./pages/MyCommunitiesPage'))
const RegisterPage = lazyPage(() => import('./pages/RegisterPage'))
const LoginPage = lazyPage(() => import('./pages/LoginPage'))
const AdminPage = lazyPage(() => import('./pages/AdminPage'))
const ProjectPage = lazyPage(() => import('./pages/ProjectPage'))
const NotFoundPage = lazyPage(() => import('./pages/NotFoundPage'))
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'))
const ContactPage = lazyPage(() => import('./pages/ContactPage'))

// The short link the share sheet hands out (components/Share.jsx).
//
// In production nginx can route /s/ to the backend, which answers it with
// per-community Open Graph tags so the link previews as a card in WhatsApp and
// Facebook, then redirects here (see backend/src/routes/sharePreview.js). This
// route is what catches the link when it doesn't — the visitor still lands on
// the right community, they just saw the generic preview card.
//
// ?from=share is what ProjectPage watches to count the arrival.
function ShareLinkRedirect() {
  const { id } = useParams()
  return <Navigate to={`/project/${id}?from=share`} replace />
}

export default function App() {
  const { pathname } = useLocation()

  return (
    <Layout>
      <ScrollToTop />
      <PageErrorBoundary resetKey={pathname}>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/my-communities" element={<RequireAuth><MyCommunitiesPage /></RequireAuth>} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
            <Route path="/admin/dashboard" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
            <Route path="/admin/overview" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
            <Route path="/admin/verification" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
            <Route path="/admin/requests" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
            <Route path="/admin/references" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
            <Route path="/admin/activity" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
            <Route path="/s/:id" element={<ShareLinkRedirect />} />
            <Route path="/project/:id/*" element={<ProjectPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </PageErrorBoundary>
    </Layout>
  )
}
