-- PropGather backend schema (SQLite) — initial migration.
-- Every statement is idempotent (IF NOT EXISTS) so this is safe to replay
-- against a database that already has these tables.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('resident','admin')) DEFAULT 'resident',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL,
  state              TEXT NOT NULL,
  city               TEXT NOT NULL,
  address            TEXT NOT NULL,
  owner_count        INTEGER NOT NULL DEFAULT 0,
  activity_level     TEXT NOT NULL DEFAULT 'Low',
  units              INTEGER NOT NULL DEFAULT 0,
  blocks             TEXT NOT NULL DEFAULT '[]',
  floors_per_block   INTEGER NOT NULL DEFAULT 0,
  latest_thread      TEXT,
  active_offer_banner INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS community_memberships (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  project_id   TEXT NOT NULL REFERENCES projects(id),
  tier         TEXT NOT NULL CHECK (tier IN ('Owner','House Owner')),
  unit         TEXT NOT NULL,
  verified_at  TEXT NOT NULL,
  UNIQUE(user_id, project_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  project_id   TEXT NOT NULL REFERENCES projects(id),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  unit         TEXT NOT NULL,
  tier         TEXT NOT NULL CHECK (tier IN ('Owner','House Owner')),
  document     TEXT NOT NULL,
  document_file TEXT NOT NULL, -- JSON {name, type, size, dataUrl} — the actual uploaded proof file
  status       TEXT NOT NULL CHECK (status IN ('Pending','Approved','Rejected')) DEFAULT 'Pending',
  submitted_at TEXT NOT NULL,
  decided_at   TEXT
);

CREATE TABLE IF NOT EXISTS forum_threads (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  author_user_id  TEXT NOT NULL REFERENCES users(id),
  pinned          INTEGER NOT NULL DEFAULT 0,
  replies         INTEGER NOT NULL DEFAULT 0,
  attachments     TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL
);

-- user_id intentionally has no FK to users(id): seed data fabricates
-- anonymous historical voter ids to match demo vote counts without a real
-- identity per vote. Real votes from the API always use a real user id;
-- the composite primary key still enforces one-vote-per-user.
CREATE TABLE IF NOT EXISTS forum_upvotes (
  thread_id TEXT NOT NULL REFERENCES forum_threads(id),
  user_id   TEXT NOT NULL,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS thread_polls (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL UNIQUE REFERENCES forum_threads(id),
  question   TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS thread_poll_options (
  id       TEXT PRIMARY KEY,
  poll_id  TEXT NOT NULL REFERENCES thread_polls(id),
  label    TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS thread_poll_votes (
  poll_id   TEXT NOT NULL REFERENCES thread_polls(id),
  user_id   TEXT NOT NULL,
  option_id TEXT NOT NULL REFERENCES thread_poll_options(id),
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  channel         TEXT NOT NULL,
  sender_user_id  TEXT NOT NULL REFERENCES users(id),
  text            TEXT NOT NULL,
  attachments     TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  state              TEXT NOT NULL,
  districts          TEXT NOT NULL DEFAULT '[]',
  tier               TEXT NOT NULL,
  rating             REAL NOT NULL DEFAULT 0,
  reviews            INTEGER NOT NULL DEFAULT 0,
  ssm_verified       INTEGER NOT NULL DEFAULT 0,
  owner_recommended  INTEGER NOT NULL DEFAULT 0,
  description        TEXT NOT NULL,
  offer              TEXT
);

CREATE TABLE IF NOT EXISTS petitions (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  target              INTEGER NOT NULL,
  created_by_user_id  TEXT NOT NULL REFERENCES users(id),
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS petition_signatures (
  petition_id TEXT NOT NULL REFERENCES petitions(id),
  user_id     TEXT NOT NULL,
  PRIMARY KEY (petition_id, user_id)
);

CREATE TABLE IF NOT EXISTS polls (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  question   TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS poll_options (
  id       TEXT PRIMARY KEY,
  poll_id  TEXT NOT NULL REFERENCES polls(id),
  label    TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id   TEXT NOT NULL REFERENCES polls(id),
  user_id   TEXT NOT NULL,
  option_id TEXT NOT NULL REFERENCES poll_options(id),
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS defects (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id),
  title            TEXT NOT NULL,
  block            TEXT NOT NULL DEFAULT '-',
  floor_range      TEXT NOT NULL DEFAULT '-',
  unit             TEXT NOT NULL DEFAULT '-',
  category         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Open',
  reported_by_user_id TEXT NOT NULL REFERENCES users(id),
  reported_at      TEXT NOT NULL,
  matching_units   INTEGER NOT NULL DEFAULT 1,
  description      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  date        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS references_ (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  date        TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  progress    INTEGER,
  attachments TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS fee_tracker (
  project_id         TEXT PRIMARY KEY REFERENCES projects(id),
  sinking_fund       INTEGER NOT NULL,
  monthly_fee        INTEGER NOT NULL,
  previous_year_fee  INTEGER NOT NULL,
  fee_increase_flag  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fee_history (
  project_id TEXT NOT NULL REFERENCES projects(id),
  month      TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  PRIMARY KEY (project_id, month)
);

CREATE TABLE IF NOT EXISTS fee_payments (
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  month      TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('Paid','Pending')),
  PRIMARY KEY (project_id, user_id, month)
);

CREATE TABLE IF NOT EXISTS community_requests (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  email       TEXT,
  project_name TEXT,
  city        TEXT,
  state       TEXT,
  message     TEXT,
  created_at  TEXT NOT NULL
);
