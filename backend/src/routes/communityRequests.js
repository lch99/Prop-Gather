import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { id } from '../util/ids.js'
import { validate } from '../middleware/validate.js'

export const communityRequestsRouter = Router()

const schema = z.object({
  name: z.string().trim().min(1, 'Community name is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(120),
  state: z.string().trim().min(1, 'State is required').max(120),
  developer: z.string().trim().max(200).optional().default(''),
  note: z.string().trim().max(2000).optional().default('')
})

communityRequestsRouter.post('/', validate(schema), (req, res) => {
  const { name, city, state, developer, note } = req.body
  getDb().prepare(`
    INSERT INTO community_requests (id, name, email, project_name, city, state, message, created_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(id('creq'), name, name, city, state, [developer, note].filter(Boolean).join(' — '), new Date().toISOString())
  res.status(201).json({ ok: true })
})
