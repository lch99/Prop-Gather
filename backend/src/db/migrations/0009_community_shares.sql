-- Share counters behind the "Share community" sheet (src/components/Share.jsx).
--
-- Bounded by design: one row per (community, channel), incremented in place.
-- POST /api/projects/:id/share is public and unauthenticated — it has to be,
-- because the whole point is that a resident hands the link to someone who has
-- never signed in — so an append-only event log here would be an open invitation
-- to grow a table without limit. An upsert on the composite primary key caps
-- this at (communities x channels) rows however often the endpoint is hit.
--
-- No user id, no IP, no user agent. Who shared what is not needed to answer the
-- question this table exists for — which communities pull visitors in, and from
-- which app — and not collecting it keeps the counter out of PDPA scope
-- entirely (see PDPA_COMPLIANCE_CHECKLIST.md).
--
-- `channel` is validated against a fixed list in routes/projects.js rather than
-- being an ENUM here: adding a share destination should not need a migration,
-- and the route is the only writer. One value is reserved — 'visit' counts
-- arrivals on a share link rather than shares sent, which is what turns this
-- from a vanity counter into the click-through side of the loop.
--
-- CREATE TABLE IF NOT EXISTS keeps the file re-runnable: migrations are not
-- atomic (see ../migrate.js), so a file that fails partway is retried from the
-- top on the next boot.
CREATE TABLE IF NOT EXISTS community_shares (
  project_id      VARCHAR(64)  NOT NULL,
  channel         VARCHAR(32)  NOT NULL,
  share_count     INT UNSIGNED NOT NULL DEFAULT 0,
  first_shared_at VARCHAR(40)  NOT NULL,
  last_shared_at  VARCHAR(40)  NOT NULL,
  PRIMARY KEY (project_id, channel),
  -- ON DELETE CASCADE, unlike the older foreign keys in 0001: a counter for a
  -- community that no longer exists has no meaning, and nothing in it is worth
  -- blocking a deletion over.
  CONSTRAINT fk_community_shares_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
