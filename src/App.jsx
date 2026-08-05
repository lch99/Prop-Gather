import { Routes, Route } from 'react-router-dom'
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
        <Route path="/admin/verification" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
        <Route path="/admin/references" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
        <Route path="/admin/activity" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
        <Route path="/project/:id/*" element={<ProjectPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}
