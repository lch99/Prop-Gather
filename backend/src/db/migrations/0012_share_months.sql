-- The time dimension the share counters never had.
--
-- 0009 stores one row per (community, channel) and increments it forever, which
-- answers "how often has this community been shared" but not "how often this
-- month" — and the admin dashboard's whole frame is a calendar month. Rather
-- than reshape the existing table (and rewrite every reader of it), this adds a
-- second counter alongside it: same key, plus the month the increment landed in.
--
-- Division of labour, so the two never disagree about what they mean:
--   * community_shares       — all-time totals, plus first/last shared timestamps.
--   * community_share_months — windowed questions only ("this month", "last six").
-- Both are written in one transaction by bumpShareCounter() in routes/projects.js.
-- Counts recorded before this migration exist only in the lifetime table, so for
-- the first month after deploy the all-time total legitimately exceeds the sum of
-- the months. Nothing reads them as equal.
--
-- `month` is 'YYYY-MM' in Malaysian local time (UTC+8, no DST), computed in JS by
-- util/months.js. It is not derived in SQL because CONVERT_TZ needs MySQL's
-- timezone tables loaded, which a stock install does not have, and because the
-- timestamps elsewhere in this schema are ISO-8601 *strings* rather than DATETIME
-- columns. CHAR(7) sorts lexicographically in calendar order, which is what the
-- range queries rely on.
--
-- Growth is bounded per month rather than absolutely — at most
-- (communities x channels) new rows a month, and only for communities actually
-- shared. A directory of 500 communities tops out around 4k rows a month; if that
-- ever matters, months older than the dashboard's window can simply be deleted,
-- because the lifetime totals above are not derived from this table.
--
-- Still anonymous: no user id, no IP, no user agent, for the same PDPA reason
-- spelled out in 0009. A month is not a person.
CREATE TABLE IF NOT EXISTS community_share_months (
  project_id  VARCHAR(64)  NOT NULL,
  channel     VARCHAR(32)  NOT NULL,
  month       CHAR(7)      NOT NULL,
  share_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, channel, month),
  -- The dashboard asks "every community, one month" far more often than it asks
  -- about one community, and the primary key is no help in that direction.
  KEY idx_share_months_month (month),
  -- ON DELETE CASCADE, matching community_shares: a counter for a community that
  -- no longer exists has no meaning and must not block its deletion.
  CONSTRAINT fk_share_months_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
