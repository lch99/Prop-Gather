# PropGather

Malaysia's verified property community platform — residents of a condo/landed
project verify their ownership, then get access to a private per-project space:
forum, chat, vendor directory, petitions, polls, defect reporting, shared
documents, reference contacts, and a fee tracker.

Live demo: https://lch99.github.io/Prop-Gather

## Status

The frontend and backend are **wired together**. `src/api.js` is an HTTP client
for the Express + MySQL API in `backend/` — real JWT auth, real persistence, and
per-community access control enforced server-side. **Running the app now requires
the backend and a MySQL server**; there is no offline mock mode.

## Tech stack

**Frontend** — React 18, React Router 6, Vite. No CSS framework — components
use inline styles from `src/theme.js` (design tokens) plus a small global
stylesheet (`src/index.css`) for animations and responsive breakpoints.

**Backend** — Express, MySQL 8 via `mysql2`, JWT auth (`jsonwebtoken` + `bcryptjs`),
`zod` for request validation, tested with vitest + supertest.

## Getting started (frontend)

Start the backend first (next section) — the frontend has nothing to read without
it.

```
npm install
cp .env.example .env.local   # optional; the default points at localhost:4000
npm run dev                   # http://localhost:5173
```

Sign-in is real: accounts live in the database and passwords are bcrypt-hashed.
With `SEED_DEMO_DATA=true` you get the seeded accounts from
`backend/src/db/seed.js` — `resident@propgather.com` / `resident123` and
`admin@propgather.com` / `admin123`. The login page lists them only in dev builds
(see `VITE_SHOW_DEMO_LOGINS` in `.env.example`). Any other account has to be
registered, and a fresh production database starts with no accounts at all —
create the first admin with `npm run create-admin` in `backend/`.

Configuration (`.env.example`, inlined at build time — rebuild to change):
- `VITE_API_URL` — API base URL including `/api`. Defaults to
  `http://localhost:4000/api` in dev and `/api` in a production build, the latter
  being correct when a reverse proxy serves both from one origin.
- `VITE_SHOW_DEMO_LOGINS` — show the seeded demo credentials on the login page.
  Dev-only by default.

Other scripts:
```
npm run build      # production build to dist/
npm run preview    # preview the production build locally
npm run deploy      # build + publish dist/ to GitHub Pages
```

Note on the GitHub Pages demo: Pages serves static files only, so that build
needs `VITE_API_URL` pointing at a publicly reachable API origin, and that
origin's CORS and the S3 bucket's CORS (`backend/infra/s3-cors.json`) must both
allow `https://lch99.github.io`.

## Getting started (backend — required)

Needs a local **MySQL 8**. Create the two databases first (the app's, and a
scratch one for tests — the suite empties it before every test):

```
CREATE DATABASE propgather      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE propgather_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```
cd backend
npm install
cp .env.example .env    # set MYSQL_USER / MYSQL_PASSWORD to match your server
npm run dev             # http://localhost:4000, migrates on boot
npm test                # 294 vitest + supertest tests (against propgather_test)
npm run purge            # one-off run of the 14-day document-retention job
```

See `backend/README.md` for the data model, auth model, seed accounts, and
the PDPA compliance section (consent capture, audit logging, document
retention) for the identity-document upload flow.

## Project structure

```
src/
  api.js                 HTTP client for the backend REST API
  apiClient.js            fetch plumbing: base URL, bearer token, error mapping
  auth.jsx                 auth context (JWT), RequireAuth route guard
  theme.js                 design tokens (colors, buttons, badges, chips)
  components/               shared UI (Layout, Attachments, PollView, Badges…)
  pages/                    top-level routed pages
  pages/project/            per-project tabs (forum, chat, vendors, tools)
  pages/project/tools/       per-project tool panels (defects, docs, fees, petitions, polls)

backend/
  src/app.js               Express app + route mounting
  src/routes/               one file per resource (auth, projects, forum, chat, …)
  src/db/                   migrations/*.sql, seed.js, mysql2 pool + helpers
  src/middleware/           auth, per-project membership gating, validation
  src/util/                 s3.js (presigned upload/download URLs), audit.js (audit_log)
  src/jobs/                 purgeApplications.js — 14-day document retention
  infra/                    S3 bucket lifecycle/CORS/encryption/IAM reference configs
  test/                     vitest + supertest, one file per resource
```

## Design principles

- **Mobile-first**: most residents use this on a phone; every page targets
  ~360–414px widths first, then scales up (see breakpoints in `src/index.css`).
- **Senior-accessible**: cheerful, warm visuals but high-contrast and legible —
  chip/badge text colors are checked against WCAG AA on their background tint.
- **Respect reduced motion**: decorative animations are disabled under
  `prefers-reduced-motion: reduce`.
