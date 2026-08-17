-- PropGather backend schema (MySQL 8) — initial migration.
--
-- Every statement is idempotent (IF NOT EXISTS) so this is safe to replay. That
-- matters more on MySQL than it did on SQLite: DDL implicitly commits, so a file
-- that fails halfway cannot roll back and will be retried from the top on the
-- next boot (see the note in ../migrate.js).
--
-- Type choices carried over from the SQLite original:
--   * ids are VARCHAR(64), not TEXT — MySQL cannot index a TEXT column without a
--     prefix length, and every id here is a short generated token ('usr_ab12…').
--     Foreign keys must match the referenced type exactly, hence VARCHAR(64)
--     throughout.
--   * Timestamps stay VARCHAR(40) holding ISO-8601 strings rather than DATETIME.
--     The app compares them as text (the retention purge does `decided_at <= ?`
--     against an ISO cutoff) and serializes them straight to JSON; converting to
--     DATETIME would change both. Keep writing ISO strings.
--   * JSON-bearing columns (attachments, blocks, document_file, metadata) stay
--     TEXT rather than MySQL's JSON type. mysql2 parses JSON columns into objects
--     automatically, which would break the explicit JSON.parse() the routes do.
--   * `rating` is DOUBLE, not DECIMAL: mysql2 returns DECIMAL as a string to
--     avoid precision loss, which would turn `4.6` into `"4.60"` in API output.
--   * Booleans are TINYINT(1) holding 0/1, matching what the app already writes.

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('resident','admin') NOT NULL DEFAULT 'resident',
  created_at    VARCHAR(40)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id                  VARCHAR(64)  NOT NULL PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  type                VARCHAR(60)  NOT NULL,
  state               VARCHAR(120) NOT NULL,
  city                VARCHAR(120) NOT NULL,
  address             VARCHAR(300) NOT NULL,
  owner_count         INT          NOT NULL DEFAULT 0,
  activity_level      VARCHAR(20)  NOT NULL DEFAULT 'Low',
  units               INT          NOT NULL DEFAULT 0,
  blocks              TEXT         NOT NULL,
  floors_per_block    INT          NOT NULL DEFAULT 0,
  latest_thread       TEXT         NULL,
  active_offer_banner TINYINT(1)   NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_memberships (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(64)  NOT NULL,
  project_id  VARCHAR(64)  NOT NULL,
  tier        ENUM('Owner','House Owner') NOT NULL,
  unit        VARCHAR(60)  NOT NULL,
  verified_at VARCHAR(40)  NOT NULL,
  UNIQUE KEY uniq_membership_user_project (user_id, project_id),
  CONSTRAINT fk_membership_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_membership_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS applications (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id       VARCHAR(64)  NOT NULL,
  project_id    VARCHAR(64)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  phone         VARCHAR(40)  NULL,
  unit          VARCHAR(60)  NOT NULL,
  tier          ENUM('Owner','House Owner') NOT NULL,
  document      VARCHAR(190) NOT NULL,
  -- JSON {name, type, size, key} — the reference to the object in S3/R2.
  document_file TEXT         NOT NULL,
  status        ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  submitted_at  VARCHAR(40)  NOT NULL,
  decided_at    VARCHAR(40)  NULL,
  CONSTRAINT fk_application_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_application_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS forum_threads (
  id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  project_id     VARCHAR(64)  NOT NULL,
  category       VARCHAR(80)  NOT NULL,
  title          VARCHAR(300) NOT NULL,
  body           TEXT         NOT NULL,
  author_user_id VARCHAR(64)  NOT NULL,
  pinned         TINYINT(1)   NOT NULL DEFAULT 0,
  replies        INT          NOT NULL DEFAULT 0,
  attachments    TEXT         NOT NULL,
  created_at     VARCHAR(40)  NOT NULL,
  CONSTRAINT fk_thread_project FOREIGN KEY (project_id)     REFERENCES projects(id),
  CONSTRAINT fk_thread_author  FOREIGN KEY (author_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_id intentionally has no FK to users(id): seed data fabricates anonymous
-- historical voter ids to match demo vote counts without a real identity per
-- vote. Real votes from the API always use a real user id; the composite
-- primary key still enforces one-vote-per-user.
CREATE TABLE IF NOT EXISTS forum_upvotes (
  thread_id VARCHAR(64) NOT NULL,
  user_id   VARCHAR(64) NOT NULL,
  PRIMARY KEY (thread_id, user_id),
  CONSTRAINT fk_upvote_thread FOREIGN KEY (thread_id) REFERENCES forum_threads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS thread_polls (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  thread_id  VARCHAR(64)  NOT NULL UNIQUE,
  question   VARCHAR(300) NOT NULL,
  expires_at VARCHAR(40)  NULL,
  CONSTRAINT fk_threadpoll_thread FOREIGN KEY (thread_id) REFERENCES forum_threads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS thread_poll_options (
  id       VARCHAR(64)  NOT NULL PRIMARY KEY,
  poll_id  VARCHAR(64)  NOT NULL,
  label    VARCHAR(200) NOT NULL,
  position INT          NOT NULL,
  CONSTRAINT fk_threadpollopt_poll FOREIGN KEY (poll_id) REFERENCES thread_polls(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS thread_poll_votes (
  poll_id   VARCHAR(64) NOT NULL,
  user_id   VARCHAR(64) NOT NULL,
  option_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (poll_id, user_id),
  CONSTRAINT fk_threadpollvote_poll   FOREIGN KEY (poll_id)   REFERENCES thread_polls(id),
  CONSTRAINT fk_threadpollvote_option FOREIGN KEY (option_id) REFERENCES thread_poll_options(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  project_id     VARCHAR(64) NOT NULL,
  channel        VARCHAR(80) NOT NULL,
  sender_user_id VARCHAR(64) NOT NULL,
  text           TEXT        NOT NULL,
  attachments    TEXT        NOT NULL,
  created_at     VARCHAR(40) NOT NULL,
  CONSTRAINT fk_chat_project FOREIGN KEY (project_id)     REFERENCES projects(id),
  CONSTRAINT fk_chat_sender  FOREIGN KEY (sender_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendors (
  id                VARCHAR(64)  NOT NULL PRIMARY KEY,
  name              VARCHAR(200) NOT NULL,
  category          VARCHAR(120) NOT NULL,
  state             VARCHAR(120) NOT NULL,
  districts         TEXT         NOT NULL,
  tier              VARCHAR(40)  NOT NULL,
  rating            DOUBLE       NOT NULL DEFAULT 0,
  reviews           INT          NOT NULL DEFAULT 0,
  ssm_verified      TINYINT(1)   NOT NULL DEFAULT 0,
  owner_recommended TINYINT(1)   NOT NULL DEFAULT 0,
  description       TEXT         NOT NULL,
  offer             TEXT         NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS petitions (
  id                 VARCHAR(64)  NOT NULL PRIMARY KEY,
  project_id         VARCHAR(64)  NOT NULL,
  title              VARCHAR(300) NOT NULL,
  description        TEXT         NOT NULL,
  target             INT          NOT NULL,
  created_by_user_id VARCHAR(64)  NOT NULL,
  created_at         VARCHAR(40)  NOT NULL,
  CONSTRAINT fk_petition_project FOREIGN KEY (project_id)         REFERENCES projects(id),
  CONSTRAINT fk_petition_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS petition_signatures (
  petition_id VARCHAR(64) NOT NULL,
  user_id     VARCHAR(64) NOT NULL,
  PRIMARY KEY (petition_id, user_id),
  CONSTRAINT fk_signature_petition FOREIGN KEY (petition_id) REFERENCES petitions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS polls (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  project_id VARCHAR(64)  NOT NULL,
  question   VARCHAR(300) NOT NULL,
  expires_at VARCHAR(40)  NULL,
  CONSTRAINT fk_poll_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_options (
  id       VARCHAR(64)  NOT NULL PRIMARY KEY,
  poll_id  VARCHAR(64)  NOT NULL,
  label    VARCHAR(200) NOT NULL,
  position INT          NOT NULL,
  CONSTRAINT fk_polloption_poll FOREIGN KEY (poll_id) REFERENCES polls(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id   VARCHAR(64) NOT NULL,
  user_id   VARCHAR(64) NOT NULL,
  option_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (poll_id, user_id),
  CONSTRAINT fk_pollvote_poll   FOREIGN KEY (poll_id)   REFERENCES polls(id),
  CONSTRAINT fk_pollvote_option FOREIGN KEY (option_id) REFERENCES poll_options(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS defects (
  id                  VARCHAR(64)  NOT NULL PRIMARY KEY,
  project_id          VARCHAR(64)  NOT NULL,
  title               VARCHAR(300) NOT NULL,
  block               VARCHAR(60)  NOT NULL DEFAULT '-',
  floor_range         VARCHAR(60)  NOT NULL DEFAULT '-',
  unit                VARCHAR(60)  NOT NULL DEFAULT '-',
  category            VARCHAR(80)  NOT NULL,
  status              VARCHAR(40)  NOT NULL DEFAULT 'Open',
  reported_by_user_id VARCHAR(64)  NOT NULL,
  reported_at         VARCHAR(40)  NOT NULL,
  matching_units      INT          NOT NULL DEFAULT 1,
  description         TEXT         NOT NULL,
  CONSTRAINT fk_defect_project  FOREIGN KEY (project_id)          REFERENCES projects(id),
  CONSTRAINT fk_defect_reporter FOREIGN KEY (reported_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  project_id  VARCHAR(64)  NOT NULL,
  title       VARCHAR(300) NOT NULL,
  category    VARCHAR(80)  NOT NULL,
  uploaded_by VARCHAR(120) NOT NULL,
  date        VARCHAR(40)  NOT NULL,
  CONSTRAINT fk_document_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS references_ (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  project_id  VARCHAR(64)  NOT NULL,
  type        VARCHAR(80)  NOT NULL,
  title       VARCHAR(300) NOT NULL,
  description TEXT         NOT NULL,
  date        VARCHAR(40)  NOT NULL,
  uploaded_by VARCHAR(120) NOT NULL,
  progress    INT          NULL,
  attachments TEXT         NOT NULL,
  CONSTRAINT fk_reference_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_tracker (
  project_id        VARCHAR(64) NOT NULL PRIMARY KEY,
  sinking_fund      INT         NOT NULL,
  monthly_fee       INT         NOT NULL,
  previous_year_fee INT         NOT NULL,
  fee_increase_flag TINYINT(1)  NOT NULL DEFAULT 0,
  CONSTRAINT fk_feetracker_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_history (
  project_id VARCHAR(64) NOT NULL,
  month      VARCHAR(20) NOT NULL,
  amount     INT         NOT NULL,
  PRIMARY KEY (project_id, month),
  CONSTRAINT fk_feehistory_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_payments (
  project_id VARCHAR(64) NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  month      VARCHAR(20) NOT NULL,
  amount     INT         NOT NULL,
  status     ENUM('Paid','Pending') NOT NULL,
  PRIMARY KEY (project_id, user_id, month),
  CONSTRAINT fk_feepayment_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_feepayment_user    FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_requests (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  name         VARCHAR(120) NULL,
  email        VARCHAR(190) NULL,
  project_name VARCHAR(200) NULL,
  city         VARCHAR(120) NULL,
  state        VARCHAR(120) NULL,
  message      TEXT         NULL,
  created_at   VARCHAR(40)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
