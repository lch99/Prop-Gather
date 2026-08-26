-- Blank the misfiled submitter name on pre-contact-capture community requests.
--
-- POST /api/community-requests used to hardcode `email` to NULL and write the
-- *community* name into both `name` and `project_name`. `name` is the submitter
-- column, so reading those rows back now would present the building's name as
-- the person who asked for it — worse than showing nothing, because an admin
-- would try to reply to it.
--
-- No data is lost: for exactly these rows `name` duplicates `project_name`,
-- which is untouched. The WHERE clause is what makes this safe and re-runnable
-- (migrations here are not atomic — see ../migrate.js):
--
--   * `email IS NULL` restricts it to rows the old route wrote; anything
--     submitted after contact capture always has an address.
--   * `name = project_name` is the duplication signature itself, so a row where
--     a real submitter name happens to sit beside a NULL email is left alone.
--
-- Re-running matches nothing, because the first run set `name` to NULL and
-- NULL = project_name is never true.
UPDATE community_requests
   SET name = NULL
 WHERE email IS NULL
   AND name IS NOT NULL
   AND name = project_name;
