import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { RequireAuth } from './auth'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'
import LandingPage from './pages/LandingPage'
import DiscoverPage from './pages/DiscoverPage'
import MyCommunitiesPage from './pages/MyCommunitiesPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import ProjectPage from './pages/ProjectPage'
import NotFoundPage from './pages/NotFoundPage'
import PrivacyPage from './pages/PrivacyPage'
import ContactPage from './pages/ContactPage'

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
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/my-communities" element={<RequireAuth><MyCommunitiesPage /></RequireAuth>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
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
    </Layout>
  )
}
