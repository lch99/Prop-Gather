-- PDPA compliance: admin accountability, consent capture, document
-- retention/purge tracking, and an audit trail for identity-document access.
--
-- The SQLite original rebuilt the whole `applications` table here, because
-- SQLite has no ALTER COLUMN and document_file had to become nullable (the
-- retention purge clears it once a decided application passes 14 days). MySQL
-- supports MODIFY COLUMN directly, so the rebuild is gone.
--
-- MySQL 8 has no `ADD COLUMN IF NOT EXISTS` (that's MariaDB), and DDL here
-- cannot roll back, so each ADD is guarded against information_schema. A
-- half-applied file is retried from the top on the next boot — the guards are
-- what make that retry a no-op instead of a permanent failure.

-- document_file becomes nullable. Re-running MODIFY is harmless.
ALTER TABLE applications MODIFY COLUMN document_file TEXT NULL;

-- decided_by: which admin decided this application.
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'decided_by');
SET @s = IF(@c = 0, 'ALTER TABLE applications ADD COLUMN decided_by VARCHAR(64) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND CONSTRAINT_NAME = 'fk_application_decided_by');
SET @s = IF(@c = 0, 'ALTER TABLE applications ADD CONSTRAINT fk_application_decided_by FOREIGN KEY (decided_by) REFERENCES users(id)', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- consent_accepted_at: when the applicant accepted the data-processing notice.
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'consent_accepted_at');
SET @s = IF(@c = 0, 'ALTER TABLE applications ADD COLUMN consent_accepted_at VARCHAR(40) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- document_purged_at: when the retention job cleared document_file.
SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'document_purged_at');
SET @s = IF(@c = 0, 'ALTER TABLE applications ADD COLUMN document_purged_at VARCHAR(40) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS audit_log (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  actor_user_id VARCHAR(64)  NULL,
  actor_role    VARCHAR(40)  NOT NULL,
  action        VARCHAR(80)  NOT NULL,
  target_type   VARCHAR(60)  NOT NULL,
  target_id     VARCHAR(64)  NOT NULL,
  project_id    VARCHAR(64)  NULL,
  metadata      TEXT         NOT NULL,
  created_at    VARCHAR(40)  NOT NULL,
  KEY idx_audit_log_target (target_type, target_id),
  KEY idx_audit_log_created_at (created_at),
  CONSTRAINT fk_audit_actor   FOREIGN KEY (actor_user_id) REFERENCES users(id),
  CONSTRAINT fk_audit_project FOREIGN KEY (project_id)    REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
