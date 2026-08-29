# PropGather backend

Express + MySQL 8 (mysql2) API server implementing the same data contract as
the frontend's demo `src/api.js`, backed by real persistence, authentication and
per-community access control.

## Setup

```
npm install
cp .env.example .env   # sets SEED_DEMO_DATA=true, which you want locally
npm run dev            # starts on http://localhost:4000
```

Seed / demo accounts (see `src/db/seed.js`):
- `resident@propgather.com` / `resident123` — verified Owner of The Lumina Residences (p1)
- `admin@propgather.com` / `admin123` — platform admin

**Demo data is opt-in.** The server seeds only when `SEED_DEMO_DATA=true`
(`.env.example` sets it; `npm run seed` does it on demand for an existing
database). Without it you get schema and nothing else — which is the point: a
production database must not start life holding six fictional projects and
accounts whose passwords are printed above. Migrations run at boot either way.

That leaves a clean database with **no admin**, and no way to make one through
the API — `POST /api/auth/register` always creates a `resident` and there's no
password-change endpoint. `npm run create-admin` is the bootstrap:

```
ADMIN_PASSWORD='<a real password>' npm run create-admin -- \
  --email=you@example.com --name="Your Name"
```

It creates the account or promotes an existing one (register normally, then
promote yourself), refuses passwords under 12 characters and the ones published
in this README, and records `user.admin_created` / `user.admin_granted` in the
audit log. Pass the password via `ADMIN_PASSWORD` rather than `--password` to
keep it out of shell history.

## Data model

**MySQL 8**, connected via `mysql2` (see `MYSQL_*` in `.env.example`). Schema is
built from ordered `.sql` files in `src/db/migrations/`, tracked in a
`migrations` table so each file only runs once. `src/index.js` awaits
`runMigrations()` before listening, so a broken migration fails the boot rather
than one endpoint later; `npm run migrate` applies pending ones without starting
the server. Seed data is in `src/db/seed.js`.

To reset local data: `DROP DATABASE propgather; CREATE DATABASE propgather;`
then restart — migrations and (with `SEED_DEMO_DATA=true`) the seed rerun.

### Every query is asynchronous

`mysql2` returns promises, so every query is awaited and every function
containing one is `async`. `src/db/index.js` exposes a small surface over the
pool:

```js
await db.get(sql, params)   // one row, or undefined
await db.all(sql, params)   // rows
await db.run(sql, params)   // { changes, insertId }
await withTransaction(async (tx) => { … })   // all queries pinned to one connection
```

Named parameters use `:name` (mysql2's `namedPlaceholders`). Express 4 doesn't
observe promises returned from handlers, so async
route handlers are wrapped in `wrap()` from `src/util/asyncHandler.js` —
otherwise a rejection hangs the request instead of reaching the error middleware.

### Writing migrations

New schema changes go in a new `src/db/migrations/000N_description.sql` file —
never edit an already-applied one.

**Every statement must be safely re-runnable.** MySQL implicitly commits around
DDL, so a migration is *not* atomic: a file that fails partway leaves its earlier
statements applied, and the runner retries it from the top on the next boot.
`CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE` suffice on their own;
`ADD COLUMN`, `ADD CONSTRAINT` and `CREATE INDEX` need an `information_schema`
guard, because MySQL 8 (unlike MariaDB) has no `IF NOT EXISTS` for them — copy
the `SET @c = (SELECT COUNT(*) …)` / `PREPARE` / `EXECUTE` pattern from 0002.

Migrations contain **schema only, never rows**. Anything that inserts data
belongs in `seed.js` (demo) or a CLI like `createAdmin.js` (operational), so
that applying migrations to a production database can never introduce content.

Type choices that are load-bearing, not incidental:

- ids are `VARCHAR(64)` — MySQL can't index `TEXT` without a prefix length, and
  FK columns must match the referenced type exactly
- timestamps are `VARCHAR(40)` ISO strings, not `DATETIME` — the retention purge
  compares them as text and routes serialize them straight to JSON
- JSON-bearing columns are `TEXT`, not `JSON` — mysql2 auto-parses the `JSON`
  type, which would break the explicit `JSON.parse()` in the routes
- `rating` is `DOUBLE`, not `DECIMAL` — mysql2 returns `DECIMAL` as a string

`0004_performance_indexes.sql` covers the queries the routes and jobs actually
run. It's small because **InnoDB auto-indexes every FK column**; what remains is
the composites that also answer an `ORDER BY`,
`forum_upvotes(user_id)` (the one user column with no FK), and the retention
purge's filter. `community_memberships` is deliberately absent — the app's
hottest query is already served by its `UNIQUE(user_id, project_id)` index.
Check any new query with `EXPLAIN` before adding an index for it.

## File storage (S3)

Ownership-proof documents (`applications.document_file`) are never stored on this
server or in the database — only a small JSON reference (`{name, type, size, key}`)
is, where `key` is the object's path in an S3 bucket. This is what keeps the
database (and whatever disk quota the host gives you) from
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

### Community photos

The same bucket, a different prefix (`community-images/`), and deliberately
different rules — see `src/routes/projects.js`. A community's profile picture
and cover photo (`projects.logo_key` / `projects.cover_key`) are public images
on a public directory, not personal data on a retention clock:

1. Admin calls `POST /api/projects/:id/images/upload-url` with `{kind, fileName,
   fileType, fileSize}` (`kind` is `logo` or `cover`) → `{key, uploadUrl}`.
2. Browser `PUT`s the bytes straight to `uploadUrl`, as above.
3. Admin calls `PUT /api/projects/:id/images/:kind` with `{key}`. The server
   `HeadObject`s it, and rejects any key not minted for this community and this
   slot — without that check an admin could point a community at a resident's
   ownership document, which step 4 would then publish.
4. `GET /api/projects/:id/images/:kind` is **public** and answers `302` to a
   freshly presigned `GET`, cacheable for 15 minutes. That gives a stable URL an
   `<img>`, a CDN and an `og:image` can all use; the version token on it
   (`?v=`) changes whenever the photo is replaced, so caches miss on the new one.
   Every project the API serialises carries `logoUrl`/`coverUrl` pointing here.
5. Replacing or removing a photo deletes the object it displaced. There is no
   lifecycle rule over this prefix, and there should not be one.

Only admins can write these (`requireRole('admin')`), the same rule as creating
a community — a community's photos are its shared identity in the directory,
not something one of its residents should be able to change for everyone.

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

### Sharing a community (deliberately unauthenticated)

Three routes exist so a resident can hand their community to someone who has no
account, which is the whole point of a share:

| Route | Auth | What it does |
|---|---|---|
| `POST /api/projects/:id/share` | none | Counts a share, `{ channel }` from a fixed list (whatsapp, telegram, facebook, x, email, copy, native) |
| `POST /api/projects/:id/share-visit` | none | Counts an arrival on a shared link |
| `GET /api/projects/share-stats` | admin | Shares sent vs. links opened, per community |
| `GET /s/:id` | none | Not under `/api` — HTML with that community's Open Graph tags, then a redirect into the app |

The counters live in `community_shares`, one row per (community, channel),
upserted in place — see the `0009` migration for why an append-only event log
would be the wrong shape for a public endpoint, and why no user id, IP or user
agent is stored (it keeps the whole feature outside PDPA scope).

Two asymmetries worth keeping:

- **`visit` is reserved.** It isn't in the channel list, so a client can't post
  it, which is what keeps "shared 40 times, opened 6 times" two honest numbers
  rather than one.
- **The arrival is counted from the app, not from `/s/:id`.** That URL is fetched
  by WhatsApp's and Facebook's crawlers to build the preview card; counting those
  would report bots as visitors. The app posts `share-visit` when it sees
  `?from=share`, which only a browser running JavaScript ever does.

`GET /s/:id` needs one nginx `location` block to actually receive the request in
production — without it the static frontend answers and links preview as the
generic site card. DEPLOYMENT.md 2.8b.

### Adding communities

`POST /api/projects` is **admin-only** and adds a community to the directory
immediately — no request or approval step. It's the counterpart to the public
`POST /api/community-requests`, which is what a resident submits when their
community isn't on the platform yet; an admin reads those back with
`GET /api/community-requests` and adds the community here.

Only `name`, `type`, `state`, `city` and `address` are required — `ownerCount`,
`activityLevel`, `units`, `blocks` and `floorsPerBlock` default to empty and can
be filled in later. `type` is deliberately free text, not an enum: Malaysian
developments don't fit a fixed list (serviced apartment, SoHo, townhouse, mixed
strata), and adding a real community shouldn't need a schema change.

The same name in the same city is a **409**, not a second community — two rows
for one building would split its residents across two private spaces, each
invisible to the other. The same name in a different city is fine.

Creation is written to `audit_log` as `project.created`. A new community starts
with no members, so nobody but an admin can see inside it until the first
application is approved; chat channels are the same fixed list every project
gets (`CHANNELS` in `src/routes/chat.js`), so it's usable from the moment the
first resident is verified.

### Editing: one correction per post

Resident-authored content (forum threads, chat messages, petitions, defect
reports) can be edited **exactly once, by its author**. `edited_at` (added in
`0003_content_edits.sql`) is both the "allowance spent" flag the routes check and
the timestamp returned as `editedAt` — a changed post always renders as
"(edited)", because silently rewriting something people have already replied to
would be worse than not allowing edits at all. A second attempt gets a 409.

- **Author only, never admins.** An admin quietly rewriting a resident's words is
  worse than removing the post: a deletion is obvious, an edit isn't. Admins keep
  DELETE for moderation.
- **Petitions can't be edited once signed** (`editable: false` in the response so
  the UI can hide the control). A signature endorses specific wording; letting
  the text change afterwards would re-attribute everyone's support to something
  they never read. `target` is fixed for the same reason.
- **Defect *status* is exempt** — it's a workflow field, not wording, so it stays
  changeable without limit by the reporter or an admin. The same `PATCH` carries
  both, applying each rule separately.
- Category, polls and attachments aren't editable: they're what people voted on
  and filtered by.
- Edits re-run the sensitive-content check, so editing can't be used as a way
  around it. A rejected edit does **not** consume the allowance.

### Who can delete what

Resident-authored content (forum threads, chat messages, petitions, defects) is
deletable by **its author or an admin**. Management-published content
(references, documents, polls) is **admin-only** — there is no resident author
who could reasonably own it. Every delete is written to `audit_log` with a
`deletedBySelf` flag so admin action on someone else's content is visible.

Two things are intentionally undeletable:

- **`audit_log` entries** — append-only. Nothing, including an admin, can remove
  one; that's what makes the trail worth keeping.
- **The acting admin's own account** — `DELETE /api/auth/users/:id` refuses
  self-deletion, which would revoke the caller's access mid-request and could
  strand the platform with no admin at all.

The **vendor directory is global**, not per-project: `GET /api/projects/:projectId/vendors`
only *filters* the shared table by the project's state/city. Vendor management is
therefore mounted separately at `/api/vendors` (admin-only), so a delete never
looks project-scoped while actually removing the vendor for every community.

## PDPA compliance (identity-document handling)

Ownership-proof documents (`applications.document_file`) are the one place this
app collects sensitive identity/financial documents, so they get dedicated
handling — see `src/pages/PrivacyPage.jsx` on the frontend for the policy this
implements:

- **Storage** — files live in S3 behind short-lived presigned URLs (`src/util/s3.js`),
  never as blobs in the database. See `backend/infra/README.md` for the bucket
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
- **Erasure** — `DELETE /api/auth/users/:id` (admin-only) removes a user and
  every row referencing them, in dependency order: no FK in the schema uses
  `ON DELETE CASCADE` and `foreign_keys = ON` is set, so the cascade is explicit
  in `src/routes/auth.js`. `DELETE /api/applications/:id` additionally lets an
  admin erase a *decided* application (residents can still only withdraw while
  `Pending`) — the retention job clears only `document_file`, so without this
  the applicant's name/email/phone/unit had no removal path at all. Audited as
  `user.erased` / `application.erased`.
  - Two exceptions to erasure, both intentional: `audit_log` rows are
    **anonymised** (`actor_user_id` → NULL), not deleted — erasing the
    accountability record to satisfy an erasure request would defeat the point
    of having one. And applications the erased user *decided as an admin* keep
    the row and lose only `decided_by`, since that record is a different
    person's data.

## Content restrictions (community-visible posts)

Forum threads, chat messages, defect reports and petitions are visible to every
verified member of the project and have **no edit endpoint** — once posted, the
only remedy is deletion. `src/middleware/sensitiveContent.js` therefore rejects
posts (400) containing:

- a **Malaysian NRIC**, validated by birth-date plausibility *and* an issued
  birthplace code, so ordinary 12-digit numbers don't trip it;
- a **payment card number**, validated by Luhn checksum.

Phone numbers and email addresses are deliberately **not** blocked — sharing a
contractor's number is a core use of the Marketplace and "Contractors &
Services" categories, and blocking it would break the product to prevent
something residents are choosing to disclose about themselves.

The 400 response names the *kind* of identifier found but never echoes the
matched value, which would otherwise copy it into logs and error trackers.
Detection lives in `src/util/sensitiveContent.js` and is unit-tested
independently of the routes in `test/sensitiveContent.test.js`.

The frontend carries a **deliberate mirror** of this logic in
`src/sensitiveContent.js` so a resident is warned while typing rather than
losing their post to a server rejection. The two share no code — keep them in
step when changing the rules. The backend is the enforcing copy.

## Testing

```
npm test
```

294 tests (vitest + supertest) covering every route's positive and negative paths:
auth, validation errors, 401/403/404/409 access control, idempotent
upvote/sign/vote endpoints, the full register → apply → admin-approve →
gated-access flow, audit-log coverage of every application lifecycle event,
the document-retention purge job, and (`fullUserJourney.test.js`) an
end-to-end run of one verified resident through every gated resource plus a
full 401/403 sweep for an unauthenticated caller and a non-member stranger.

**Tests need a running MySQL.** There is no `:memory:` equivalent, and using a
different engine for tests than for production would hide exactly the dialect
bugs worth catching. They run against `MYSQL_TEST_DATABASE` (default
`propgather_test`) using the `MYSQL_*` settings from `vitest.config.js`:

```
CREATE DATABASE propgather_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`freshApp()` empties every table and reseeds before each test, so **point this at
a scratch database, never your dev one**. `fileParallelism` is off because all
files share that single database. No real AWS calls either way — `test/setup.js`
mocks `src/util/s3.js`.

Password hashing cost is lowered via `BCRYPT_ROUNDS=4` in `vitest.config.js`
purely for test speed — it dominates otherwise (measured: ~2.9s of a 4.2s seed at
the real cost factor). Production always uses 10.

## Wired up to the frontend

The frontend calls this server: `src/api.js` is an HTTP client over these
endpoints, `src/apiClient.js` holds the base URL and bearer token, and
`src/auth.jsx` stores the JWT from `/api/auth/login` and `/api/auth/register`.

Two things to keep in mind when changing routes here:

- **CORS is an allowlist** (`CORS_ORIGINS`, see `src/middleware/cors.js`). Unset,
  only the local dev origins are allowed — so a deployment that doesn't set it
  blocks its own frontend. The effective list is printed at boot.
- **Response shapes are a contract.** Renaming a serialized field breaks the
  frontend silently — the tests here won't catch it, since there is no frontend
  test suite. Grep `src/` for the field name before renaming.

### Endpoints with no frontend yet

These work and are tested, but nothing in the UI calls them — worth knowing
before assuming a capability is missing rather than just unexposed:

| Endpoint | What's missing in the UI |
|---|---|
| `PATCH /projects/:id/defects/:defectId` | No way to change a defect's status, so reports stay `Open` forever |
| `DELETE` on defects / petitions / polls / documents | No moderation or clean-up controls |
| `PATCH /projects/:id/petitions/:petitionId` | Petition editing (creator, before any signature) |
| `GET`/`DELETE /community-requests` | "Add my community" submissions are write-only — nothing reads them back |
| `GET`/`DELETE /vendors` | No vendor-directory admin screen |
| `DELETE /auth/users/:id` | PDPA erasure has no admin control; it's API-only |
