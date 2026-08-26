-- Bootstrap admin accounts for the production database.
--
-- A clean production database has no admin at all: seed() is demo-only (gated
-- behind SEED_DEMO_DATA and skipped in production), POST /api/auth/register
-- hardcodes role 'resident', and there is no password-change endpoint. The
-- sanctioned tool is backend/src/db/createAdmin.js, but it needs the MYSQL_*
-- connection vars present in the shell, and on this deploy those live in
-- systemd's EnvironmentFile (/etc/propgather.env) rather than a backend/.env —
-- so running it by hand connects to nothing. A migration runs at boot with that
-- env already loaded, against the right database, which is why the first admins
-- are created here.
--
-- Trade-off, stated on the record: this commits a bcrypt hash (cost 10, the
-- production factor) to version control, and the app exposes no endpoint to
-- rotate it. Treat these as fixed bootstrap logins. To change a password, add a
-- later migration or run create-admin once the env is sorted — never edit this
-- file after it has been applied (migrate.js records it by name and will not
-- re-run it; editing it would silently diverge deployments).
--
-- ON DUPLICATE KEY UPDATE, not INSERT IGNORE: `email` is UNIQUE, so if either
-- address already exists as a resident, this promotes it to admin and sets the
-- password — matching what create-admin does — instead of silently skipping it.
-- It is a single statement, so it either applies wholly or not at all, and a
-- retry after a half-applied file re-asserts the same values (a no-op). The ids
-- are hand-written slugs that cannot collide with the 'usr_<generated>' tokens
-- id('usr') produces.
INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES
  ('usr_admin_primary',   'Platform Admin',   'admin@propgather.com.my',  '$2a$10$xWDj3DnAsFZIOc6pLeqdqOEtZxKfVzpF7rwOJHdmyQOOcPZnPkosK', 'admin', '2026-08-26T00:00:00.000Z'),
  ('usr_admin_secondary', 'Platform Admin 2', 'admin2@propgather.com.my', '$2a$10$dfgTppP1TgXnUwIcqDmz9eFn.k8A8k2xnmetOeJsuzaJwcSmzJG0G', 'admin', '2026-08-26T00:00:00.000Z')
ON DUPLICATE KEY UPDATE
  role          = 'admin',
  password_hash = VALUES(password_hash);
