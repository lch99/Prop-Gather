import { Router } from 'express'
import { getDb } from '../db/index.js'
import { requireAuth, requireMembership } from '../middleware/auth.js'
import { wrap } from '../util/asyncHandler.js'

export const feesRouter = Router({ mergeParams: true })

feesRouter.get('/', requireAuth, requireMembership, wrap(async (req, res) => {
  const db = getDb()
  const tracker = await db.get('SELECT * FROM fee_tracker WHERE project_id = ?', [req.params.projectId])
  if (!tracker) return res.json(null)

  const history = await db.all('SELECT month, amount FROM fee_history WHERE project_id = ? ORDER BY month', [req.params.projectId])
  const myPayments = await db.all(
    'SELECT month, amount, status FROM fee_payments WHERE project_id = ? AND user_id = ? ORDER BY month',
    [req.params.projectId, req.user.id]
  )

  res.json({
    sinkingFund: tracker.sinking_fund,
    monthlyFee: tracker.monthly_fee,
    previousYearFee: tracker.previous_year_fee,
    feeIncreaseFlag: !!tracker.fee_increase_flag,
    history,
    myPayments
  })
}))
