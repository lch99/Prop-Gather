-- Indexes for the queries the API actually runs.
--
-- SQLite creates a backing index for PRIMARY KEY and UNIQUE constraints but
-- NOT for foreign-key columns, so every per-project listing added in 0001 was
-- a full table scan. That's invisible at seed scale and stops being invisible
-- at a few thousand rows per community — which is one active condo.
--
-- Every index below names the query it serves. Composite column order follows
-- each query's WHERE-then-ORDER BY shape so one index satisfies both. Adding
-- an index costs write throughput and disk, so nothing speculative is here:
-- if no route or job runs the query, there's no index for it.
--
-- Deliberately NOT indexed:
--   community_memberships(user_id, project_id) — the hottest query in the app
--     (middleware/auth.js gating every request) is already covered by the
--     UNIQUE(user_id, project_id) constraint's index.
--   fee_payments(project_id, user_id) — covered by the composite primary key.
--   vendors — routes/vendors.js reads the whole table and filters in JS; it's
--     a small global directory, not per-project.

-- Per-project listings ------------------------------------------------------
-- GET /api/projects/:projectId/forum       (routes/forum.js:88, sorted in JS)
CREATE INDEX IF NOT EXISTS idx_forum_threads_project
  ON forum_threads(project_id);

-- GET .../chat/:channel/messages           (routes/chat.js:58)
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_channel
  ON chat_messages(project_id, channel, created_at);

-- GET .../defects                          (routes/defects.js:60)
CREATE INDEX IF NOT EXISTS idx_defects_project
  ON defects(project_id, reported_at);

-- GET .../petitions                        (routes/petitions.js:40)
CREATE INDEX IF NOT EXISTS idx_petitions_project
  ON petitions(project_id, created_at);

-- GET .../documents                        (routes/documents.js:11)
CREATE INDEX IF NOT EXISTS idx_documents_project
  ON documents(project_id, date);

-- GET .../references                       (routes/references.js:32)
CREATE INDEX IF NOT EXISTS idx_references_project
  ON references_(project_id, date);

-- GET .../polls                            (routes/polls.js:29)
CREATE INDEX IF NOT EXISTS idx_polls_project
  ON polls(project_id);

-- Poll option fan-out, read once per poll on every list request
-- (routes/polls.js:12, routes/forum.js:57)
CREATE INDEX IF NOT EXISTS idx_poll_options_poll
  ON poll_options(poll_id, position);
CREATE INDEX IF NOT EXISTS idx_thread_poll_options_poll
  ON thread_poll_options(poll_id, position);

-- Applications --------------------------------------------------------------
-- Duplicate-application check on submit    (routes/applications.js:93)
-- Also covers the WHERE user_id = ? lookups during erasure (auth.js:148,182).
CREATE INDEX IF NOT EXISTS idx_applications_user_project
  ON applications(user_id, project_id);

-- The 14-day retention purge               (jobs/purgeApplications.js:24-31)
-- Partial: only rows that still hold a document can ever be due, so the index
-- covers exactly the working set and shrinks as documents are purged.
CREATE INDEX IF NOT EXISTS idx_applications_purge_due
  ON applications(decided_at)
  WHERE document_file IS NOT NULL;

-- Audit log -----------------------------------------------------------------
-- GET /api/audit-log?action=...            (routes/auditLog.js:20-24)
-- created_at is part of the index, not just action, so the query's
-- `ORDER BY created_at DESC LIMIT 200` is answered by walking the index
-- backwards instead of sorting the matches in a temp B-tree.
-- (target_type/target_id and bare created_at were already indexed in 0002.)
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON audit_log(action, created_at);

-- Account erasure -----------------------------------------------------------
-- DELETE /api/auth/users/:id walks every table referencing the user
-- (routes/auth.js:154-182). Without these each erasure is a full scan per
-- table; they also serve the "delete my own post" paths.
CREATE INDEX IF NOT EXISTS idx_forum_threads_author
  ON forum_threads(author_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
  ON chat_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_defects_reporter
  ON defects(reported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_petitions_creator
  ON petitions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_forum_upvotes_user
  ON forum_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_user
  ON fee_payments(user_id);
