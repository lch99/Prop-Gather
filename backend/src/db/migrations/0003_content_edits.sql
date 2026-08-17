-- One-time edit window for resident-authored content.
--
-- Residents can correct a post exactly once. `edited_at` doubles as both the
-- "has this been edited" flag the routes check to enforce the single edit and
-- the timestamp the UI shows as "(edited)" — silently changing a post other
-- people have already replied to would be worse than not allowing edits at all,
-- so the fact of an edit is always visible alongside the content.
--
-- Nullable with no default: NULL means "never edited", which is the correct
-- state for every row that already exists.
--
-- Guarded against information_schema for the same reason as 0002: MySQL 8 has
-- no ADD COLUMN IF NOT EXISTS, and a failed file is retried from the top.

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'forum_threads' AND COLUMN_NAME = 'edited_at');
SET @s = IF(@c = 0, 'ALTER TABLE forum_threads ADD COLUMN edited_at VARCHAR(40) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_messages' AND COLUMN_NAME = 'edited_at');
SET @s = IF(@c = 0, 'ALTER TABLE chat_messages ADD COLUMN edited_at VARCHAR(40) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'petitions' AND COLUMN_NAME = 'edited_at');
SET @s = IF(@c = 0, 'ALTER TABLE petitions ADD COLUMN edited_at VARCHAR(40) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defects' AND COLUMN_NAME = 'edited_at');
SET @s = IF(@c = 0, 'ALTER TABLE defects ADD COLUMN edited_at VARCHAR(40) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
