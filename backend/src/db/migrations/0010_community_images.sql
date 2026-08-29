-- Profile picture and cover photo for a community.
--
-- Only the S3 object key is stored here, never the bytes: `GET /api/projects`
-- returns every community in the directory in one response, and inlining even a
-- modest data URL per row would turn the list every visitor loads first into a
-- multi-megabyte payload. Same reasoning as verification documents (see
-- backend/src/util/s3.js), for a different reason — those are private, these are
-- just large.
--
-- These live under the `community-images/` prefix, deliberately outside the
-- `verification-docs/` prefix the bucket's 14-day expiry rule matches
-- (backend/infra/s3-lifecycle.json). A community's photo is not personal data
-- on a retention clock; it is meant to stay until an admin replaces it.
--
-- NULL means "no photo" — the correct state for every community already on the
-- platform, and what the frontend's letter tile / gradient fallbacks render.
--
-- Guarded against information_schema for the same reason as 0002/0003: MySQL 8
-- has no ADD COLUMN IF NOT EXISTS, and migrations are not atomic here, so a
-- file that fails partway is retried from the top on the next boot.

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'logo_key');
SET @s = IF(@c = 0, 'ALTER TABLE projects ADD COLUMN logo_key VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'cover_key');
SET @s = IF(@c = 0, 'ALTER TABLE projects ADD COLUMN cover_key VARCHAR(255) NULL', 'DO 0');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
