-- The paginated forum list                (routes/forum.js)
--   WHERE project_id = ? [AND category = ?]
--   ORDER BY pinned DESC, created_at DESC, id DESC LIMIT n
--
-- The list used to load every thread and sort them in JavaScript. Now it reads
-- one page, and (project_id, pinned, created_at) — plus the primary key InnoDB
-- appends to every secondary index — lets that page be read in index order
-- instead of filesorting every thread a community has ever had. The FK index on
-- project_id alone (see the header of 0004) cannot answer the ORDER BY.
--
-- Guarded against information_schema.STATISTICS for the same reason as 0004:
-- MySQL 8 has no CREATE INDEX IF NOT EXISTS, and a failed file is retried from
-- the top.
SET @c = (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'forum_threads' AND INDEX_NAME = 'idx_forum_threads_project_pinned_created');
SET @s = IF(@c = 0, 'CREATE INDEX idx_forum_threads_project_pinned_created ON forum_threads (project_id, pinned, created_at)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
