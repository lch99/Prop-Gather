-- Indexes for the queries the API actually runs.
--
-- This migration is much smaller on MySQL than the SQLite version it replaces,
-- for one reason: InnoDB automatically creates an index for every FOREIGN KEY
-- column, which SQLite does not. So the single-column indexes that were the bulk
-- of the SQLite file — forum_threads(project_id), polls(project_id),
-- forum_threads(author_user_id), chat_messages(sender_user_id),
-- defects(reported_by_user_id), petitions(created_by_user_id),
-- fee_payments(user_id) — already exist as a side effect of the constraints in
-- 0001 and would be pure duplication here.
--
-- What remains is what InnoDB does NOT give for free:
--   * composite indexes whose extra column answers an ORDER BY, so the sort is
--     read off the index instead of a filesort;
--   * forum_upvotes(user_id), which has no FK (see the note in 0001) and so is
--     genuinely unindexed;
--   * the retention purge's filter.
--
-- MySQL 8 has no CREATE INDEX IF NOT EXISTS, so each is guarded against
-- information_schema.STATISTICS — same reasoning as 0002/0003: DDL cannot roll
-- back, and a failed file is retried from the top.

-- GET .../chat/:channel/messages           (routes/chat.js)
--   WHERE project_id = ? AND channel = ? ORDER BY created_at
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_messages' AND INDEX_NAME = 'idx_chat_messages_project_channel');
SET @s = IF(@c = 0, 'CREATE INDEX idx_chat_messages_project_channel ON chat_messages (project_id, channel, created_at)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GET .../defects                          (routes/defects.js)
--   WHERE project_id = ? ORDER BY reported_at DESC
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defects' AND INDEX_NAME = 'idx_defects_project_reported');
SET @s = IF(@c = 0, 'CREATE INDEX idx_defects_project_reported ON defects (project_id, reported_at)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GET .../petitions                        (routes/petitions.js)
--   WHERE project_id = ? ORDER BY created_at DESC
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'petitions' AND INDEX_NAME = 'idx_petitions_project_created');
SET @s = IF(@c = 0, 'CREATE INDEX idx_petitions_project_created ON petitions (project_id, created_at)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GET .../documents                        (routes/documents.js)
--   WHERE project_id = ? ORDER BY date DESC
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND INDEX_NAME = 'idx_documents_project_date');
SET @s = IF(@c = 0, 'CREATE INDEX idx_documents_project_date ON documents (project_id, date)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GET .../references                       (routes/references.js)
--   WHERE project_id = ? ORDER BY date DESC
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'references_' AND INDEX_NAME = 'idx_references_project_date');
SET @s = IF(@c = 0, 'CREATE INDEX idx_references_project_date ON references_ (project_id, date)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Poll option fan-out, read once per poll on every list request
-- (routes/polls.js, routes/forum.js): WHERE poll_id = ? ORDER BY position
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'poll_options' AND INDEX_NAME = 'idx_poll_options_poll_position');
SET @s = IF(@c = 0, 'CREATE INDEX idx_poll_options_poll_position ON poll_options (poll_id, position)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thread_poll_options' AND INDEX_NAME = 'idx_thread_poll_options_poll_position');
SET @s = IF(@c = 0, 'CREATE INDEX idx_thread_poll_options_poll_position ON thread_poll_options (poll_id, position)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Duplicate-application check on submit    (routes/applications.js)
--   WHERE user_id = ? AND project_id = ? AND status = 'Pending'
-- The FK on user_id already gives a single-column index; this composite lets
-- both equality predicates be satisfied from one lookup.
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND INDEX_NAME = 'idx_applications_user_project');
SET @s = IF(@c = 0, 'CREATE INDEX idx_applications_user_project ON applications (user_id, project_id)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- The 14-day retention purge               (jobs/purgeApplications.js)
--   WHERE status IN ('Approved','Rejected') AND decided_at <= ? AND …
-- The SQLite version used a partial index (… WHERE document_file IS NOT NULL),
-- which MySQL has no equivalent for. A composite on (status, decided_at) serves
-- the IN plus the range scan instead; the remaining IS NULL / IS NOT NULL
-- predicates filter the much smaller result.
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND INDEX_NAME = 'idx_applications_status_decided');
SET @s = IF(@c = 0, 'CREATE INDEX idx_applications_status_decided ON applications (status, decided_at)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GET /api/audit-log?action=...            (routes/auditLog.js)
-- created_at is in the index so `ORDER BY created_at DESC LIMIT 200` is read
-- from it rather than sorted in a filesort.
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_log' AND INDEX_NAME = 'idx_audit_log_action_created');
SET @s = IF(@c = 0, 'CREATE INDEX idx_audit_log_action_created ON audit_log (action, created_at)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Account erasure walks forum_upvotes by user (routes/auth.js). Unlike every
-- other user-referencing column, this one has no FK — so InnoDB gave it no
-- index, and the composite PK starts with thread_id, not user_id.
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'forum_upvotes' AND INDEX_NAME = 'idx_forum_upvotes_user');
SET @s = IF(@c = 0, 'CREATE INDEX idx_forum_upvotes_user ON forum_upvotes (user_id)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
