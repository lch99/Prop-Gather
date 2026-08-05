import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'

export const feesRouter = Router({ mergeParams: true })

feesRouter.get('/', requireAuth, requireMembership, (req, res) => {
  const db = getDb()
  const tracker = db.prepare('SELECT * FROM fee_tracker WHERE project_id = ?').get(req.params.projectId)
  if (!tracker) return res.json(null)

  const history = db.prepare('SELECT month, amount FROM fee_history WHERE project_id = ? ORDER BY month').all(req.params.projectId)
  const myPayments = db.prepare('SELECT month, amount, status FROM fee_payments WHERE project_id = ? AND user_id = ? ORDER BY month').all(req.params.projectId, req.user.id)

  res.json({
    sinkingFund: tracker.sinking_fund,
    monthlyFee: tracker.monthly_fee,
    previousYearFee: tracker.previous_year_fee,
    feeIncreaseFlag: !!tracker.fee_increase_flag,
    history,
    myPayments
  })
})
