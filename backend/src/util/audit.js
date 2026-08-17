import { id } from './ids.js'

// Records one audit-trail event. Callers must await it: on MySQL the insert is a
// round trip, and a caller that forgets loses the audit entry whenever the
// response finishes first — the trail would develop silent gaps exactly under
// load, which is when it matters most.
//
// `db` is the pool wrapper from db/index.js, or a transaction-scoped one. Passing
// the transaction's handle keeps the audit row in the same transaction as the
// change it records, so neither can land without the other.
export async function recordAudit(db, { actorUserId = null, actorRole, action, targetType, targetId, projectId = null, metadata = {} }) {
  await db.run(
    `INSERT INTO audit_log (id, actor_user_id, actor_role, action, target_type, target_id, project_id, metadata, created_at)
     VALUES (:id, :actorUserId, :actorRole, :action, :targetType, :targetId, :projectId, :metadata, :createdAt)`,
    {
      id: id('aud'),
      actorUserId,
      actorRole,
      action,
      targetType,
      targetId,
      projectId,
      metadata: JSON.stringify(metadata),
      createdAt: new Date().toISOString()
    }
  )
}
