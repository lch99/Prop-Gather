# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

PropGather — a property community platform for Malaysia. Verified residents
of a condo/landed project get access to a private per-project space: forum,
chat, vendor directory, petitions, polls, defect reporting, documents,
reference contacts, and a fee tracker. Registration requires uploading an
ownership proof document, which an admin approves before granting access.

Ownership-proof documents are personal/financial identity documents, so
that flow (`applications` table, `backend/src/routes/applications.js`) is
built to Malaysia's PDPA 2010: explicit consent capture, an admin-decision
audit trail, and a 14-day document-retention purge — see "PDPA compliance"
in `backend/README.md`. Any change to that flow should preserve those three
properties, not just the feature itself. `PDPA_COMPLIANCE_CHECKLIST.md` at
the repo root tracks what's done vs. still outstanding (mostly
organizational/legal items code can't close — DPO appointment, registration
status, breach-runbook ownership) — check it before telling a user their
setup is "compliant."

## Two codebases, one contract

- **`src/`** — the React frontend. `src/api.js` is an HTTP client for the
  backend; `src/apiClient.js` under it owns the base URL, the bearer token,
  and turning error responses into `ApiError`. There is **no mock mode** — the
  app needs the backend and a MySQL server running to show anything.
- **`backend/`** — the Express + MySQL 8 (`mysql2`) server. It is the single
  source of truth for data, auth, and access control.

They are wired together, so a feature usually lands in both: an endpoint in
`backend/src/routes/` (plus its test file) and a method in `src/api.js`. When
you change a response shape on one side, grep the other for the field —
serialization lives in `backend/src/util/serialize.js` and the per-route
`serialize()` helpers.

Two rules the wiring depends on:

- **The client never asserts identity or role.** Authorship, the deciding
  admin, and `uploadedBy` all come from the JWT server-side. Don't reintroduce
  an `actor` argument into `src/api.js` — the `role` arguments that remain
  (`getVerificationQueue`, `getAuditLog`, `createProject`) are UX
  short-circuits to skip a doomed round trip, never the access boundary.
- **Loading states must survive a failed request.** Several pages use
  `null`/`undefined` state as "still loading" and render skeletons, so a
  rejected fetch has to land on a concrete empty value or the skeleton never
  resolves.

## Frontend conventions

- **Styling**: no CSS framework. Components use inline style objects built
  from tokens in `src/theme.js` (`C`, `card`, `button()`, `badge()`,
  `chipColor()`). Global/animation/responsive-breakpoint CSS lives in
  `src/index.css` using `.pg-*` utility classes — reach for those instead of
  reinventing hover/fade/skeleton animations.
- **Mobile-first**: the whole app is used on phones by residents across
  Malaysia. Design and test every page at ~360–414px width first, then
  check tablet/desktop. Look at existing `@media` blocks in `index.css`
  (e.g. `.pg-forum-grid`, `.pg-discover-search`) for the pattern used to
  reflow layouts at breakpoints.
- **Senior-accessible & joyful**: cheerful gradients/colors are intentional
  (see brand colors below) but contrast must stay high — chip/badge text
  colors in `theme.js` are deliberately deepened past their tint's raw hue to
  clear WCAG AA (4.5:1). Keep that bar when adding new chip/badge colors.
- **Reduced motion**: decorative animation classes (`pg-float`,
  `pg-hero-anim`, `pg-gradient-text`, `pg-shine`, `pg-pop`, `pg-fade-in`,
  `pg-skel`) are disabled under `prefers-reduced-motion: reduce` in
  `index.css` — new decorative animations should be added to that same
  media query.
- **Brand colors**: primary blue `#4081C6`, primary red/accent `#C74B54`
  (from the PropGather.com logo). Don't introduce off-brand hues for primary
  actions; use `chipPalette` for varied category/type chips instead.
- **Auth**: `src/auth.jsx` is real — `login`/`signup` call the backend and store
  the returned JWT via `apiClient.js`, honouring the "keep me signed in" choice
  (localStorage vs sessionStorage). It caches the user profile alongside the
  token only to avoid a logged-out flicker on first paint; the token is the
  credential, and `refresh()` re-reads the profile from `/auth/me` (call it
  after anything that changes memberships). A 401 on a request that carried a
  token clears the session. `DEMO_ACCOUNTS` are the backend's seeded dev
  accounts and are only rendered when `SHOW_DEMO_LOGINS` is on — dev-only by
  default. Password rules and rate limiting belong in `backend/`, not here.
- **File attachments**: use the shared `useAttachments` / `AttachmentPicker` /
  `AttachmentList` from `src/components/Attachments.jsx` (used by forum,
  chat, defect reports, and registration) rather than building a new
  upload widget — it already handles size/count limits and data-URL reads.

## Backend conventions

- Auth is JWT bearer tokens. A user gets read/write access to a project's
  forum/chat/vendors/petitions/polls/defects/documents/references/fees only
  after a **verified community membership** for that project (granted via
  `POST /api/applications` → `POST /api/applications/:id/decision`). Admins
  bypass the membership check everywhere. See `backend/src/middleware/`.
- **Every DB call is async.** `src/db/index.js` exposes `db.get/all/run` plus
  `withTransaction(async tx => …)` over a `mysql2` pool. Named params are
  `:name`. Async route handlers must be wrapped in
  `wrap()` (`src/util/asyncHandler.js`) or Express 4 swallows the rejection and
  the request hangs.
- MySQL 8 via `MYSQL_*` env vars. Schema is built from ordered `.sql` files in
  `backend/src/db/migrations/` (tracked in a `migrations` table so each runs
  once), applied by `runMigrations()` at boot or `npm run migrate`. New schema
  changes go in a new `NNNN_description.sql` file — never edit an applied one.
  **Migrations are not atomic** (MySQL commits around DDL), so every statement
  must be safely re-runnable: `IF NOT EXISTS`/`INSERT IGNORE`, or an
  `information_schema` guard for `ADD COLUMN`/`ADD CONSTRAINT`/`CREATE INDEX`,
  which MySQL 8 has no `IF NOT EXISTS` for. A retry that isn't a no-op becomes
  a boot loop.
- Tests (`backend/test/`, vitest + supertest) need a **real MySQL** —
  `propgather_test`, emptied and reseeded before each test by `freshApp()`.
  There's no `:memory:` equivalent, and testing on a different engine than you
  deploy would hide dialect bugs. `fileParallelism` is off because every file
  shares that database. Bcrypt cost is lowered (`BCRYPT_ROUNDS=4`) for speed —
  never lower the real cost factor (10) used outside tests.
- One route file per resource in `backend/src/routes/`, mirrored by one test
  file per resource in `backend/test/` covering positive paths, validation
  errors, and 401/403/404/409 access control. Follow that pairing for new
  resources.
- Sensitive documents (currently just verification uploads) live in S3, never
  as blobs in the database — see `backend/src/util/s3.js` for the presigned
  upload/download URL pattern and `backend/infra/` for the bucket config.
  Any admin action that touches personal data should call
  `recordAudit()` (`backend/src/util/audit.js`) so it shows up in
  `GET /api/audit-log`; recurring cleanup (e.g. the document-retention purge)
  goes in `backend/src/jobs/` as a plain async function, wired to both an
  `npm run` script and an in-process scheduler in `src/index.js`.

## Commands

```
npm run dev            # frontend dev server (root)
npm run build           # frontend production build (root)
cd backend && npm run dev    # backend dev server
cd backend && npm test        # backend test suite (needs local MySQL)
```

There is currently no frontend test suite — verify UI changes by running
the dev server and checking the affected page(s) at mobile width. The backend
(and its MySQL) has to be running too, or every page loads empty. `VITE_API_URL`
points the frontend somewhere other than `http://localhost:4000/api`; it's
inlined at build time, so changing it needs a restart/rebuild.
