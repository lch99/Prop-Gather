# PropGather backend

Express + SQLite (better-sqlite3) API server implementing the same data contract as
the frontend's demo `src/api.js`, backed by real persistence, authentication and
per-community access control.

## Setup

```
npm install
cp .env.example .env   # optional — defaults work out of the box
npm run dev            # starts on http://localhost:4000, auto-seeds on first run
```

Seed / demo accounts (see `src/db/seed.js`):
- `resident@propgather.com` / `resident123` — verified Owner of The Lumina Residences (p1)
- `admin@propgather.com` / `admin123` — platform admin

## Data model

SQLite file at `DB_PATH` (default `./data.sqlite3`). Schema is built from ordered
`.sql` files in `src/db/migrations/`, applied automatically on `getDb()` (tracked in
a `migrations` table so each file only runs once) — run `npm run migrate` to apply
pending ones without starting the server. Seed data mirroring `src/demoData.js` is
in `src/db/seed.js`. Delete the `.sqlite3` file to reset local data — migrations and
the seed rerun on next start.

New schema changes go in a new `src/db/migrations/000N_description.sql` file
(never edit an already-applied one) — keep statements idempotent (`IF NOT EXISTS` /
`IF NOT EXISTS` column checks) where practical.

## File storage (S3)

Ownership-proof documents (`applications.document_file`) are never stored on this
server or in SQLite — only a small JSON reference (`{name, type, size, key}`)
is, where `key` is the object's path in an S3 bucket. This is what keeps the
sqlite file (and whatever disk quota the host gives you, e.g. Hostinger) from
bloating with base64 blobs of scanned SPAs/utility bills.

Flow (`src/util/s3.js`, `src/routes/applications.js`):
1. Client calls `POST /api/applications/upload-url` with `{fileName, fileType,
   fileSize}` → gets back `{key, uploadUrl}`, a presigned S3 `PUT` URL good for
   5 minutes.
2. Client `PUT`s the raw file bytes straight to `uploadUrl` (browser → S3
   directly, this server never sees the bytes).
3. Client calls `POST /api/applications` with `documentFile: {name, type,
   size, key}`. The server verifies the object actually exists (`HeadObject`)
   and isn't oversized before accepting the application.
4. Reads (`GET /mine`, `GET /` admin queue, decision responses) attach a
   short-lived presigned `GET` URL under `documentFile.dataUrl`, so a caller
   never gets a permanent public link to someone's ownership document.
5. Withdrawing a pending application (`DELETE /:id`) deletes the S3 object
   immediately. Decided (approved/rejected) applications are cleaned up by the
   bucket's lifecycle rule instead (see below) — matching the "deleted within
   14 days" promise shown in the frontend's registration flow.

**Required env vars** (`.env.example`): `AWS_REGION`, `AWS_S3_BUCKET`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, plus `S3_ENDPOINT` when the
bucket lives on a non-AWS S3-compatible provider (this project uses
**Cloudflare R2**). Without these, anything touching `/api/applications` that
needs storage will 500 — there's no in-memory/local-disk fallback by design,
so a misconfigured deployment fails loudly instead of silently writing files
somewhere that won't survive a redeploy.

**One-time bucket setup — Cloudflare R2** (dashboard/CLI — nothing here runs
automatically, and nothing in this repo has your Cloudflare credentials to do
it for you):
1. Cloudflare dashboard → R2 → **Create bucket**. Note the bucket name
   (`AWS_S3_BUCKET`) and your Account ID, which gives you the endpoint:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (`S3_ENDPOINT`).
   `AWS_REGION` stays `auto` — R2 has no real AWS regions.
2. R2 buckets are private and encrypted at rest by default — no equivalent of
   `s3-encryption.json`/`put-bucket-encryption` needed here (that step is
   AWS-S3-only).
3. CORS — bucket → **Settings → CORS Policy** in the dashboard, paste the
   rules from `infra/s3-cors.json` (edit `AllowedOrigins` to your actual
   GitHub Pages / Hostinger domain(s) first). R2 also exposes the S3-compatible
   `PutBucketCors` API if you'd rather script it with the AWS CLI pointed at
   the R2 endpoint:
   ```
   aws s3api put-bucket-cors --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
     --bucket <bucket> --cors-configuration file://infra/s3-cors.json
   ```
4. Retention — this app's own `src/jobs/purgeApplications.js` (14 days after
   a decision) is the primary deletion path regardless of provider; treat
   `infra/s3-lifecycle.json` as an optional backstop. R2 has its own
   dashboard **Object Lifecycle Rules** (bucket → Settings) if you want one —
   point it at the `verification-docs/` prefix, delete after 14 days.
5. Credentials — Cloudflare dashboard → R2 → **Manage R2 API Tokens** →
   create a token scoped to **this bucket only**, permission **Object Read &
   Write** (R2's equivalent of `infra/s3-iam-policy.json`'s least-privilege
   IAM policy — that file is the AWS-S3 reference version, not used for R2).
   The token gives you an Access Key ID / Secret Access Key pair — put those
   in `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` wherever this server
   actually runs (Hostinger's Node app environment variables panel, or your
   `.env` locally — loaded via `--env-file-if-exists=.env` in the `dev`/
   `start` scripts).

(If you ever point this at real AWS S3 instead: omit `S3_ENDPOINT`, set
`AWS_REGION` to the bucket's actual region, and follow `infra/README.md`'s
`aws s3api` commands as written — `s3.js` supports both.)

Tests never touch real storage — `test/setup.js` mocks `src/util/s3.js` so the
whole suite runs offline.

## Auth model

JWT bearer tokens (`Authorization: Bearer <token>`). A user only gets read/write
access to a project's forum/chat/vendors/petitions/polls/defects/documents/
references/fees once they have a **verified community membership** for that
project — granted by an admin approving their join application
(`POST /api/applications` → `POST /api/applications/:id/decision`). Admins bypass
the membership check everywhere.

## PDPA compliance (identity-document handling)

Ownership-proof documents (`applications.document_file`) are the one place this
app collects sensitive identity/financial documents, so they get dedicated
handling — see `src/pages/PrivacyPage.jsx` on the frontend for the policy this
implements:

- **Storage** — files live in S3 behind short-lived presigned URLs (`src/util/s3.js`),
  never as blobs in SQLite. See `backend/infra/README.md` for the bucket
  lifecycle/encryption/CORS/IAM setup.
- **Consent** — `POST /api/applications` requires `consent: true` and records
  `consent_accepted_at` server-side.
- **Accountability** — application decisions record `decided_by` (the admin's
  user id); serialized responses include `decidedBy`/`decidedByName`.
- **Audit trail** — `src/util/audit.js`'s `recordAudit()` logs every submit,
  admin queue view, decision, withdrawal, and retention purge to the
  `audit_log` table, readable via `GET /api/audit-log` (admin-only).
- **Retention** — `src/jobs/purgeApplications.js` strips `document_file` (and
  deletes the S3 object) from any decided application 14+ days past
  `decided_at`. Runs daily in-process from `src/index.js` (disable with
  `ENABLE_RETENTION_JOB=false`) and is also exposed as `npm run purge` for an
  external cron. The S3 bucket lifecycle rule is a backstop, not the primary
  mechanism.

## Testing

```
npm test
```

163 tests (vitest + supertest) covering every route's positive and negative paths:
auth, validation errors, 401/403/404/409 access control, idempotent
upvote/sign/vote endpoints, the full register → apply → admin-approve →
gated-access flow, audit-log coverage of every application lifecycle event,
the document-retention purge job, and (`fullUserJourney.test.js`) an
end-to-end run of one verified resident through every gated resource plus a
full 401/403 sweep for an unauthenticated caller and a non-member stranger.
Tests run against an isolated in-memory SQLite database
(`DB_PATH=:memory:`, reset per test) — no shared state, no real file touched,
and no real AWS calls (`test/setup.js` mocks `src/util/s3.js`).

Password hashing cost is lowered via `BCRYPT_ROUNDS=4` in `vitest.config.js` purely
for test speed; production always uses the real cost factor (10).

## Not yet wired up

The frontend (`src/api.js`) still runs entirely in-memory and does not call this
server. Pointing it at these endpoints (swapping `api.js`'s in-memory store for
`fetch` calls, adding the JWT to `auth.jsx`) is a separate follow-up.
