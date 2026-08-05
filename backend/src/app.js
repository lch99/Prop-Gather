import express from 'express'
import cors from 'cors'
import { optionalAuth } from './middleware/auth.js'
import { requireProjectExists } from './middleware/project.js'
import { authRouter } from './routes/auth.js'
import { projectsRouter } from './routes/projects.js'
import { applicationsRouter } from './routes/applications.js'
import { auditLogRouter } from './routes/auditLog.js'
import { communityRequestsRouter } from './routes/communityRequests.js'
import { forumRouter } from './routes/forum.js'
import { chatRouter } from './routes/chat.js'
import { vendorsRouter } from './routes/vendors.js'
import { petitionsRouter } from './routes/petitions.js'
import { pollsRouter } from './routes/polls.js'
import { defectsRouter } from './routes/defects.js'
import { documentsRouter } from './routes/documents.js'
import { referencesRouter } from './routes/references.js'
import { feesRouter } from './routes/fees.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '15mb' }))
  app.use(optionalAuth)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/auth', authRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/applications', applicationsRouter)
  app.use('/api/audit-log', auditLogRouter)
  app.use('/api/community-requests', communityRequestsRouter)

  app.use('/api/projects/:projectId/forum', requireProjectExists, forumRouter)
  app.use('/api/projects/:projectId/chat', requireProjectExists, chatRouter)
  app.use('/api/projects/:projectId/vendors', requireProjectExists, vendorsRouter)
  app.use('/api/projects/:projectId/petitions', requireProjectExists, petitionsRouter)
  app.use('/api/projects/:projectId/polls', requireProjectExists, pollsRouter)
  app.use('/api/projects/:projectId/defects', requireProjectExists, defectsRouter)
  app.use('/api/projects/:projectId/documents', requireProjectExists, documentsRouter)
  app.use('/api/projects/:projectId/references', requireProjectExists, referencesRouter)
  app.use('/api/projects/:projectId/fees', requireProjectExists, feesRouter)

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(err)
    }
    res.status(status).json({
      error: err.message || 'Internal server error',
      ...(err.details ? { details: err.details } : {})
    })
  })

  return app
}
