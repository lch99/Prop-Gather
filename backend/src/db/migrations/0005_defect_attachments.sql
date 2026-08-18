-- Photos on defect reports.
--
-- The frontend's report form has always offered a photo picker, and its list
-- view has always rendered `attachments` (see DefectsPanel.jsx) — but
-- POST /defects accepted no such field and there was nowhere to store one, so
-- every photo a resident attached was silently discarded on submit. A defect
-- report is evidence, and the photo is usually the strongest part of it: the
-- feature's whole point is turning individual complaints into documented proof
-- of a systemic defect.
--
-- TEXT holding a JSON array, matching forum_threads.attachments and
-- chat_messages.attachments. Deliberately not the native JSON type — mysql2
-- auto-parses that, which would break the explicit JSON.parse() in the routes.
--
-- Nullable rather than NOT NULL: MySQL cannot give a TEXT column a DEFAULT, so
-- NOT NULL would reject both the rows already in the table and seed.js's insert,
-- which doesn't name this column. The route reads NULL as [].
--
-- Guarded against information_schema for the same reason as 0002 and 0003:
-- MySQL 8 has no ADD COLUMN IF NOT EXISTS, and a file that fails partway is
-- retried from the top on the next boot.

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defects' AND COLUMN_NAME = 'attachments');
SET @s = IF(@c = 0, 'ALTER TABLE defects ADD COLUMN attachments TEXT NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
