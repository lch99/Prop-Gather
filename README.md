# PropGather

Malaysia's verified property community platform — residents of a condo/landed
project verify their ownership, then get access to a private per-project space:
forum, chat, vendor directory, petitions, polls, defect reporting, shared
documents, reference contacts, and a fee tracker.

Live demo: https://lch99.github.io/Prop-Gather

## Status

The **frontend is a fully working demo** — it runs entirely against an
in-memory mock API (`src/api.js` + `src/demoData.js`), no server required.

A **real backend** (`backend/`) exists in parallel — Express + MySQL with
real auth, persistence, and per-community access control — but the frontend
does not call it yet. Wiring `src/api.js` up to `backend`'s REST endpoints is
the next major step (see `backend/README.md` → "Not yet wired up").

## Tech stack

**Frontend** — React 18, React Router 6, Vite. No CSS framework — components
use inline styles from `src/theme.js` (design tokens) plus a small global
stylesheet (`src/index.css`) for animations and responsive breakpoints.

**Backend** — Express, MySQL 8 via `mysql2`, JWT auth (`jsonwebtoken` + `bcryptjs`),
`zod` for request validation, tested with vitest + supertest.

## Getting started (frontend)

```
npm install
npm run dev       # http://localhost:5173
```

Demo accounts (see `src/auth.jsx`):
- `resident@propgather.com` / `resident123` — verified resident
- `admin@propgather.com` / `admin123` — platform admin
- any other email — accepted as a resident, no password check, to keep the demo easy to explore

Other scripts:
```
npm run build      # production build to dist/
npm run preview    # preview the production build locally
npm run deploy      # build + publish dist/ to GitHub Pages
```

## Getting started (backend — optional, not yet wired to the frontend)

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
  api.js                 in-memory demo API (mirrors backend's REST contract)
  demoData.js             seed data for the demo API
  auth.jsx                 demo auth context, RequireAuth route guard
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
