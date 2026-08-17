import { getDb } from '../db/index.js'
import { deleteObject } from '../util/s3.js'
import { recordAudit } from '../util/audit.js'

export const RETENTION_DAYS = 14

// Applications this many days past their decision (approve/reject) that still
// have a document attached are due for purge — matches the "deleted within 14
// days of review" promise in src/pages/PrivacyPage.jsx and RegisterPage.jsx.
function cutoffIso(now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  return cutoff.toISOString()
}

// Deletes the S3 object (defense-in-depth alongside the bucket lifecycle rule
// in backend/infra/s3-lifecycle.json) and strips document_file from the row,
// leaving the rest of the application — the "non-reversible record that a
// document was verified" the privacy policy promises — untouched.
//
// decided_at is compared as a string against an ISO cutoff, which is why 0001
// keeps these columns as VARCHAR holding ISO-8601 rather than DATETIME.
export async function purgeApplications({ now = new Date() } = {}) {
  const db = getDb()
  const cutoff = cutoffIso(now)

  const due = await db.all(`
    SELECT * FROM applications
    WHERE status IN ('Approved', 'Rejected')
      AND decided_at IS NOT NULL
      AND decided_at <= ?
      AND document_purged_at IS NULL
      AND document_file IS NOT NULL
  `, [cutoff])

  let purged = 0
  for (const app of due) {
    const documentFile = app.document_file ? JSON.parse(app.document_file) : null
    if (documentFile?.key) {
      await deleteObject(documentFile.key).catch(err => {
        // eslint-disable-next-line no-console
        console.error(`Failed to delete S3 object ${documentFile.key} during retention purge`, err)
      })
    }

    const purgedAt = new Date().toISOString()
    await db.run('UPDATE applications SET document_file = NULL, document_purged_at = ? WHERE id = ?', [purgedAt, app.id])
    await recordAudit(db, {
      actorRole: 'system',
      action: 'application.document_purged',
      targetType: 'application',
      targetId: app.id,
      projectId: app.project_id,
      metadata: { decidedAt: app.decided_at, retentionDays: RETENTION_DAYS }
    })
    purged += 1
  }

  return { checked: due.length, purged }
}
