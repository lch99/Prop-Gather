-- PDPA compliance: admin accountability, consent capture, document
-- retention/purge tracking, and an audit trail for identity-document access.
--
-- document_file needs to become nullable (the retention purge job clears it
-- once a decided application is past the 14-day window) but SQLite has no
-- ALTER COLUMN, so the table is rebuilt rather than altered in place.

CREATE TABLE applications_new (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id),
  project_id          TEXT NOT NULL REFERENCES projects(id),
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  unit                TEXT NOT NULL,
  tier                TEXT NOT NULL CHECK (tier IN ('Owner','House Owner')),
  document            TEXT NOT NULL,
  document_file       TEXT, -- JSON {name, type, size, key} — NULL once purged by the retention job
  status              TEXT NOT NULL CHECK (status IN ('Pending','Approved','Rejected')) DEFAULT 'Pending',
  submitted_at        TEXT NOT NULL,
  decided_at          TEXT,
  decided_by          TEXT REFERENCES users(id),
  consent_accepted_at TEXT,
  document_purged_at  TEXT
);

INSERT INTO applications_new (id, user_id, project_id, name, email, phone, unit, tier, document, document_file, status, submitted_at, decided_at)
SELECT id, user_id, project_id, name, email, phone, unit, tier, document, document_file, status, submitted_at, decided_at FROM applications;

DROP TABLE applications;
ALTER TABLE applications_new RENAME TO applications;

CREATE TABLE IF NOT EXISTS audit_log (
  id             TEXT PRIMARY KEY,
  actor_user_id  TEXT REFERENCES users(id),
  actor_role     TEXT NOT NULL,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  project_id     TEXT REFERENCES projects(id),
  metadata       TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
