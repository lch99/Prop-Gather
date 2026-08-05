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

- **`src/`** — the React frontend. This is what actually ships (GitHub
  Pages demo). It runs against `src/api.js`, an in-memory mock API seeded
  from `src/demoData.js`. All mutations (upvotes, posts, votes, verification
  decisions) live only in memory and reset on page refresh.
- **`backend/`** — an Express + better-sqlite3 server implementing the same
  data contract with real persistence, JWT auth, and per-community access
  control. **The frontend does not call it yet.** Treat the two as separate
  efforts unless a task explicitly asks to wire them together.

When adding a feature to `src/api.js`, check whether `backend/src/routes/`
has (or should get) the matching endpoint — they're meant to stay in sync so
the eventual swap-over is mechanical. Don't assume changes need to happen in
both places unless the task is about that integration.

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
- **Auth**: `src/auth.jsx` is demo-only — two fixed accounts
  (`resident@propgather.com`, `admin@propgather.com`) plus "any other email is
  treated as a resident, no password check" so the prototype stays easy to
  explore. Don't add real password/security logic here; that belongs in
  `backend/`.
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
- SQLite file at `DB_PATH` (default `./data.sqlite3`); delete it to reset —
  migrations and the seed rerun on next start. Schema is built from ordered
  `.sql` files in `backend/src/db/migrations/` (tracked in a `migrations`
  table so each runs once), applied automatically via `getDb()` or manually
  with `npm run migrate`. New schema changes go in a new
  `NNNN_description.sql` file — never edit an already-applied one.
- Tests (`backend/test/`, vitest + supertest) run against an isolated
  in-memory DB (`DB_PATH=:memory:`) with lowered bcrypt cost
  (`BCRYPT_ROUNDS=4`) for speed — never lower the real cost factor (10) used
  outside tests.
- One route file per resource in `backend/src/routes/`, mirrored by one test
  file per resource in `backend/test/` covering positive paths, validation
  errors, and 401/403/404/409 access control. Follow that pairing for new
  resources.
- Sensitive documents (currently just verification uploads) live in S3, never
  as blobs in SQLite — see `backend/src/util/s3.js` for the presigned
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
cd backend && npm test        # backend test suite
```

There is currently no frontend test suite — verify UI changes by running
the dev server and checking the affected page(s) at mobile width.
