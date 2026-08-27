import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { redirectLegacyHashUrl } from './legacyHashRedirect.js'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import './index.css'

// Must run before the router reads window.location.
redirectLegacyHashUrl()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Real paths, not `#/...`, so each page is a URL Google can index. This
        needs the server to serve index.html for unknown paths or a deep link
        404s on refresh — nginx `try_files`, and dist/404.html on GitHub Pages
        (scripts/postbuild.mjs). See "SEO" in DEPLOYMENT.md. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
