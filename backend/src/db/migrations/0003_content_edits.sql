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

ALTER TABLE forum_threads ADD COLUMN edited_at TEXT;
ALTER TABLE chat_messages ADD COLUMN edited_at TEXT;
ALTER TABLE petitions     ADD COLUMN edited_at TEXT;
ALTER TABLE defects       ADD COLUMN edited_at TEXT;
