import { id } from './ids.js'

// Records one audit-trail event. Fire-and-forget from the caller's perspective —
// callers should still `await` it so it's captured in the same transaction/request
// lifecycle, but a logging failure should never be allowed to mask the real error.
export function recordAudit(db, { actorUserId = null, actorRole, action, targetType, targetId, projectId = null, metadata = {} }) {
  db.prepare(`
    INSERT INTO audit_log (id, actor_user_id, actor_role, action, target_type, target_id, project_id, metadata, created_at)
    VALUES (@id, @actorUserId, @actorRole, @action, @targetType, @targetId, @projectId, @metadata, @createdAt)
  `).run({
    id: id('aud'),
    actorUserId,
    actorRole,
    action,
    targetType,
    targetId,
    projectId,
    metadata: JSON.stringify(metadata),
    createdAt: new Date().toISOString()
  })
}
