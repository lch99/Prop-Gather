# Deployment

How to ship PropGather. Two deliverables, and the frontend now **depends on** the
backend.

| What | Where | How | Deployed today? |
|---|---|---|---|
| Frontend (`src/`) | GitHub Pages → https://lch99.github.io/Prop-Gather | `npm run deploy` | Yes (`gh-pages` branch exists) |
| Backend (`backend/`) | Ubuntu server (systemd + nginx) + MySQL 8 + Cloudflare R2 | Part 2 | Not yet |

**Deploy the backend first.** `src/api.js` is an HTTP client for it, so a frontend
without a reachable API shows empty pages and "we can't reach PropGather" —
there is no mock mode any more. That also means the frontend build needs to know
where the API lives (`VITE_API_URL`, baked in at build time) and the backend needs
to allow the frontend's origin through CORS. See Part 6.

The currently-live Pages demo predates this and still runs the old in-memory mock;
the next `npm run deploy` replaces it with a build that requires an API.

There is **no CI/CD** — no `.github/workflows/`. Every deploy is a command you
run by hand.

---

## Part 0 — Before you deploy anything: commit first

**This is currently a blocker.** Deployment on Ubuntu means `git clone` /
`git pull`, so anything not committed does not exist on the server.

Right now `git status` shows tracked route files **modified** alongside new
files that are **untracked**, and they depend on each other:

| Untracked (invisible to `git commit -a`) | Needed by |
|---|---|
| `backend/src/db/migrations/0003_content_edits.sql` | the `edited_at` column |
| `backend/src/db/migrations/0004_performance_indexes.sql` | every per-project listing |
| `backend/src/db/createAdmin.js` | making an admin on a clean database |
| `backend/src/middleware/sensitiveContent.js` | forum, chat, defects, petitions |
| `backend/src/util/sensitiveContent.js` | the middleware above |

[forum.js](backend/src/routes/forum.js), [chat.js](backend/src/routes/chat.js),
[defects.js](backend/src/routes/defects.js) and
[petitions.js](backend/src/routes/petitions.js) are all tracked, all modified,
and all import that middleware.

So **`git commit -am "..."` is a trap here**: `-a` stages modified tracked
files but never untracked ones. You'd push routes that `import` a module that
isn't in the repo, and the server would die on boot with
`ERR_MODULE_NOT_FOUND` — after a clean `npm ci`, with green tests locally.

```bash
git add -A                 # -A, not -a: includes the new files
git status                 # confirm the three files above are staged
git commit -m "..."
git push origin main
```

- [ ] `git status` is clean before you deploy
- [ ] `git ls-files backend/src/db/migrations/` lists **0001 through 0004**

---

## Part 1 — Frontend → GitHub Pages

### Prerequisites (one-time)

- Push access to `github.com/lch99/Prop-Gather`.
- GitHub → **Settings → Pages** → Source: *Deploy from a branch*, Branch:
  `gh-pages` / `(root)`. Already set — the site is live.
- `npm install` at the repo root (installs `gh-pages`).

### Deploy

```bash
npm install            # only if dependencies changed
VITE_API_URL=https://api.propgather.com/api npm run build   # see below
npm run deploy         # pushes dist/ to gh-pages
```

**`VITE_API_URL` is required for this deploy.** Pages is static hosting with no
API of its own, so the default same-origin `/api` would resolve to
`lch99.github.io/api` and every request would 404. Set it to a publicly reachable
backend origin. Because `npm run deploy` runs `predeploy` → `npm run build`
without that variable, either export it for the whole shell or put it in
`.env.production.local` so the rebuild picks it up:

```bash
echo 'VITE_API_URL=https://api.propgather.com/api' > .env.production.local
```

Then confirm the backend allows `https://lch99.github.io` in its CORS config, and
that the R2 bucket does too ([backend/infra/s3-cors.json](backend/infra/s3-cors.json)) —
otherwise the site loads but every document upload fails.

`npm run deploy` publishes **whatever is in your local `dist/`** to the
`gh-pages` branch. It does not read `main` on GitHub. So commit and push your
source first, then deploy — otherwise the live site and the repo drift apart.

Pages serves the new build within ~1 minute. Hard-refresh (Ctrl+Shift+R) — the
HTML is cached, hashed assets aren't.

### Verify

Open the site **on a phone, or at 360–414px width** (that's the real audience —
see CLAUDE.md):

- [ ] Landing page renders, no blank white screen
- [ ] Header logo and favicon load
- [ ] **The community directory lists projects** — if it's empty, the API isn't
      reachable from the browser (wrong `VITE_API_URL`, backend down, or CORS)
- [ ] Open a project, then **reload on that URL** — must still work
- [ ] Sign in with a real account from the deployed database (the seeded demo
      accounts won't exist unless that database was seeded)
- [ ] No 404s or CORS errors in the browser console

### Two things that are deliberately the way they are

**The base path is set per deploy target, not in the working tree.**
[vite.config.js](vite.config.js) declares `base: '/'` because the live site
serves the app from a domain root. GitHub Pages serves from a subpath, so
`predeploy` overrides it with `vite build --base=/Prop-Gather/` — nothing to
edit by hand for either target.

Vite rewrites asset URLs at build time (`/favicon.png` →
`/Prop-Gather/favicon.png` for Pages). 404s on CSS/JS after a deploy trace back
here; check `dist/index.html`. Runtime asset references must use
`` import.meta.env.BASE_URL `` (as
[Layout.jsx:55](src/components/Layout.jsx#L55) does), never a bare `/brand/...`,
so they stay correct under both bases.

**`HashRouter`** in [main.jsx:3](src/main.jsx#L3) — URLs look like
`/Prop-Gather/#/projects/p1`. Pages has no server-side rewrite, so a
`BrowserRouter` deep link would 404 on refresh. Don't "fix" this without adding
a `404.html` SPA fallback, or you break every shared link.

### Custom domain (e.g. propgather.com), when you get there

1. Add `public/CNAME` containing just `propgather.com`.
2. Nothing to change — `base` is already `'/'`, which is what an apex domain
   needs. Build with `npm run build` rather than `npm run deploy`, since the
   latter targets the Pages subpath.
3. Point DNS at Pages → Settings → Pages → Custom domain → **Enforce HTTPS**.
4. Update `AllowedOrigins` in
   [backend/infra/s3-cors.json](backend/infra/s3-cors.json) and the backend's
   CORS config (Part 4) to the new origin.

### Rollback

```bash
git checkout <last-good-commit>
npm run deploy
```

---

## Part 2 — Backend → Ubuntu server

Target: **Ubuntu 22.04 or 24.04 LTS**, systemd for the process, nginx for TLS,
Cloudflare R2 for documents.

New VPS? Start with **[VPS_SETUP.md](VPS_SETUP.md)** (day-one machine setup),
then come back here at 2.2.

Layout used throughout (code and data deliberately separate, so a redeploy can
never touch the database):

| Path | Contents |
|---|---|
| `/opt/propgather` | the git checkout |
| `/var/lib/mysql` | MySQL's data directory (owned by MySQL, not this app) |
| `/etc/propgather.env` | secrets, `0600` |
| `/var/backups/propgather` | nightly backups |

### 2.0 Sizing the VPS

**Recommended: 2 vCPU / 4 GB RAM / 40 GB SSD, Singapore region.** Roughly
USD 24/month on DigitalOcean, Vultr or Linode; less on Hostinger or Contabo.

| Tier | Spec | Verdict |
|---|---|---|
| Too small | 1 vCPU / 1 GB | MySQL and Node fighting over 1 GB. Avoid. |
| Minimum | 1 vCPU / 2 GB / 25 GB | Works with `innodb_buffer_pool_size` tuned down (see 2.4). Add 2 GB swap. |
| **Recommended** | **2 vCPU / 4 GB / 40 GB** | Comfortable defaults, no tuning needed to stay off swap. |
| Overkill | 4 vCPU / 16 GB+ | Nothing here can use it — see below. |

**`mysqld` is what drives these numbers** — a second daemon that wants memory of
its own. Its default `innodb_buffer_pool_size` alone is 128 MB, and a realistic
resident set is 400–600 MB. The Node process idles at **54 MB RSS**. Budget
roughly:

```
4 GB VPS
├── mysqld      ~600 MB   (buffer pool + per-connection buffers)
├── node         ~150 MB   under load
├── nginx         ~20 MB
└── OS + headroom
```

**Storage is a non-issue.** 20,000 chat messages plus 2,000 forum threads with
realistic bodies come to roughly **12 MB** under InnoDB, plus the indexes in
`0004`. A busy 500-unit community still generates only tens of MB a year.
`node_modules` is ~57 MB. The disk is really for Ubuntu (~3 GB), MySQL's data
directory, backups and logs: 25 GB is ample, 40 GB is comfortable.

**No native compilation.** `mysql2` is pure JavaScript, so there is no node-gyp
step to run out of memory on a small VPS — swap is prudence, not a prerequisite.

**CPU is the one real constraint, and more cores won't fix it.** Password
hashing uses `bcryptjs` — pure JavaScript, and called **synchronously**
([util/auth.js:12-17](backend/src/util/auth.js#L12-L17)). Measured at cost
factor 10: **157 ms to hash, 187 ms to verify**, on a dev laptop; expect
250–400 ms on a typical VPS vCPU. Because it's synchronous, a login blocks the
entire event loop for that whole time — every other request waits.

That caps the server at roughly **3–5 logins per second**, and a second vCPU
doesn't raise it: one Node process, one thread doing the blocking work. A
higher clock speed helps; more cores don't.

Normal traffic never approaches that. The case that does is **onboarding a whole
condo at once** — 200 residents registering on launch day is 200 × ~0.3 s of
blocked event loop. It'll complete, but the app feels stalled throughout. If you
plan that kind of launch, either stagger it or replace `bcryptjs` with the native
`bcrypt` package, which is 5–10× faster for identical hashes. That's a
one-dependency swap, not a rewrite, and the stored hash format is compatible.

The second vCPU in the recommended tier isn't for throughput — it's so that
`npm ci`'s native compile, a backup, and the retention job can run without
competing with request handling.

**Region: Singapore.** ~5–15 ms from Peninsular Malaysia. DigitalOcean SGP1,
Vultr Singapore, Linode Singapore, AWS ap-southeast-1 and Hostinger Singapore
all qualify. A Malaysian provider (Exabytes, ServerFreak) is also reasonable if
you prefer local data residency for optics — PDPA doesn't require it given the
cross-border consent and s.129 transfer record already in place, but it's a
defensible choice. Set your R2 bucket's location hint to **APAC** either way.

**Two things to buy or enable at the provider:**

- **Snapshots/backups** (~20% surcharge) — worth it, but not a substitute for
  the logical backup in 2.10. A snapshot restores a whole machine; what
  you'll usually want back is just the database.
- **An external uptime check** on `/api/health` (UptimeRobot's free tier does
  it). Nothing in this stack notices if the process wedges — `Restart=always`
  handles a crash, not a hang.

### 2.1 Provision the server

On a brand-new VPS, work through **[VPS_SETUP.md](VPS_SETUP.md)** first — it
covers the machine end to end: sudo user, key-only SSH, swap, Node 22 and the
compiler toolchain, ufw, fail2ban, unattended upgrades, capped logs, and DNS,
each with a check to confirm before moving on.

That document ends exactly where 2.2 begins. The rest of Part 2 assumes it's
done and describes only the app.

### 2.2 Service user and directories

```bash
sudo useradd --system --home /opt/propgather --shell /usr/sbin/nologin propgather

sudo mkdir -p /opt/propgather /var/backups/propgather
sudo chown -R propgather:propgather /opt/propgather /var/backups/propgather
sudo chmod 750 /var/backups/propgather
```

A dedicated non-login user means a compromised Node process can't read the rest
of the box. (There's no `/var/lib/propgather` any more — MySQL owns the data
now, under `/var/lib/mysql`.)

### 2.3 Clone and install

```bash
sudo -u propgather git clone -b production https://github.com/lch99/Prop-Gather.git /opt/propgather
cd /opt/propgather/backend
sudo -u propgather npm ci --omit=dev
```

`--omit=dev` skips vitest/supertest — the server never runs tests. Run those
locally before pushing. (The suite needs a MySQL server, so running it here
means pointing `MYSQL_TEST_DATABASE` at a scratch database on this box.)

### 2.4 Install and secure MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation      # set a root password, remove anon users/test DB
```

Create the database and an application user scoped to it — the app must never
connect as root:

```bash
sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS propgather
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'propgather'@'localhost'
  IDENTIFIED BY 'a-strong-password-you-generate';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON propgather.* TO 'propgather'@'localhost';
FLUSH PRIVILEGES;
SQL
```

`CREATE, ALTER, INDEX, REFERENCES` are needed because the app applies its own
migrations at boot. `DROP` is deliberately withheld: nothing in
`src/db/migrations/` drops a table, so granting it would only widen what a
compromised app process could destroy.

**Bind to localhost only.** Ubuntu's package already does, but confirm — this is
what keeps port 3306 off the internet:

```bash
grep -r "^bind-address" /etc/mysql/    # expect 127.0.0.1
sudo ss -tlnp | grep 3306              # expect 127.0.0.1:3306, never 0.0.0.0
```

**On a 2 GB VPS, turn the buffer pool down** or MySQL and Node will fight over
memory. Create `/etc/mysql/mysql.conf.d/propgather.cnf`:

```ini
[mysqld]
innodb_buffer_pool_size = 256M
max_connections = 50
```

Then `sudo systemctl restart mysql`. On 4 GB the 128 MB default is fine and you
can leave this out; the app's own pool is 10 connections
(`MYSQL_POOL_SIZE`), so `max_connections` mostly guards against runaway clients.

### 2.5 Provision Cloudflare R2 (one-time)

Ownership-proof documents never touch this server's disk or the database — they
go browser → R2 via presigned URLs ([util/s3.js](backend/src/util/s3.js)). With
storage unconfigured, every upload returns 500. That's deliberate: a
misconfigured deployment fails loudly instead of writing files somewhere that
won't survive a redeploy.

Full walkthrough: **"File storage (S3)"** in
[backend/README.md](backend/README.md). Short version:

1. Cloudflare → R2 → **Create bucket**. Note the name and your Account ID.
2. Bucket → **Settings → CORS Policy** → paste
   [backend/infra/s3-cors.json](backend/infra/s3-cors.json) with
   `AllowedOrigins` set to your **actual** frontend origin(s). Miss this and
   browser uploads fail CORS with nothing useful in the server log.
3. Bucket → **Settings → Object Lifecycle Rules** → delete under
   `verification-docs/` after 14 days. A backstop — the app's purge job (2.9)
   is the primary path — but it guarantees deletion even if that job never runs.
4. **Manage R2 API Tokens** → new token **scoped to this bucket only**,
   permission **Object Read & Write**. Copy the Access Key ID / Secret.

R2 is private and encrypted at rest by default, so there's no encryption step.
`s3-encryption.json` and `s3-iam-policy.json` in
[backend/infra/](backend/infra/) are AWS-S3-only references, unused for R2.

### 2.6 Environment file

```bash
sudo install -o propgather -g propgather -m 600 /dev/null /etc/propgather.env
sudo -u propgather nano /etc/propgather.env
```

```ini
NODE_ENV=production
PORT=4000

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=propgather
MYSQL_PASSWORD=<the password you set in 2.4>
MYSQL_DATABASE=propgather
MYSQL_POOL_SIZE=10

# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<32-random-bytes-hex>

# Whichever origin serves the frontend. Without this the browser blocks every
# request and the app looks empty; the boot log prints what took effect.
CORS_ORIGINS=https://propgather.com

AWS_REGION=auto
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_S3_BUCKET=propgather-verification-docs
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret>
```

| Variable | Required | Default if unset | Notes |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | `dev-secret-do-not-use-in-production` | Signs every auth token. The fallback is a public string in this repo — unset means **anyone can forge an admin token**. Rotating it logs everyone out. |
| `MYSQL_HOST` / `MYSQL_PORT` | No | `127.0.0.1` / `3306` | Keep it loopback; MySQL should not listen on a public interface. |
| `MYSQL_USER` / `MYSQL_PASSWORD` | **Yes** | `root` / empty | The scoped user from 2.4, never root. |
| `MYSQL_DATABASE` | **Yes** | `propgather` | Created in 2.4, or auto-created if the user has CREATE. |
| `MYSQL_POOL_SIZE` | No | `10` | Ceiling on concurrent queries. Raising it past MySQL's `max_connections` just moves the queue. |
| `PORT` | No | `4000` | Must match the nginx `proxy_pass`. |
| `CORS_ORIGINS` | **Yes** | `http://localhost:5173` (dev only) | Comma-separated browser origins allowed to call the API. Unset on a server means the deployed frontend is **blocked** — empty pages, CORS errors in the console. `*` allows everything. |
| `AWS_S3_BUCKET` | **Yes** | — | R2 bucket name. |
| `S3_ENDPOINT` | Yes (R2) | — | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Omit for real AWS S3. |
| `AWS_REGION` | **Yes** | `auto` when `S3_ENDPOINT` set | `auto` for R2; a real region for AWS. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | **Yes** | — | From the R2 token. Never commit. |
| `ENABLE_RETENTION_JOB` | No | enabled | Set `false` **only** if using external cron (2.9). |
| `SEED_DEMO_DATA` | No | **off** | Inserts the demo projects and published-password accounts. **Never set it on a server** — that's the "no dirty data" switch. |
| `BCRYPT_ROUNDS` | No | `10` | Tests lower it to 4 for speed. **Never set in production.** |

`.env` is gitignored in both trees — but here secrets live in
`/etc/propgather.env`, outside the checkout entirely, so a stray `git add` can't
reach them.

### 2.7 systemd service

```bash
sudo nano /etc/systemd/system/propgather.service
```

```ini
[Unit]
Description=PropGather backend
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=propgather
Group=propgather
WorkingDirectory=/opt/propgather/backend
EnvironmentFile=/etc/propgather.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes

[Install]
WantedBy=multi-user.target
```

`Requires=mysql.service` plus `After=` matters: the app runs migrations before it
listens, so starting before MySQL is up means the boot fails. With `Restart=always`
it would recover, but you'd see a confusing crash loop in the logs on every reboot.

`ProtectSystem=strict` makes the whole filesystem read-only for this service.
There's no `ReadWritePaths` — the app writes nothing to disk, since MySQL owns
the data.

`ExecStart` calls `node` directly rather than `npm start`, so there's no npm
wrapper process between systemd and the app, and no reliance on
`--env-file-if-exists=.env` (systemd supplies the environment).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now propgather
sudo systemctl status propgather
journalctl -u propgather -f          # watch the boot; expect the migrate lines
```

### 2.8 First boot — migrations, then your first admin

On first start you should see, in `journalctl`:

```
[migrate] applied 0001_init_schema.sql
[migrate] applied 0002_pdpa_compliance.sql
[migrate] applied 0003_content_edits.sql
[migrate] applied 0004_performance_indexes.sql
PropGather backend listening on http://localhost:4000
```

**There must be no `Database seeded.` line.** If you see one, `SEED_DEMO_DATA`
is set in `/etc/propgather.env` — unset it and start over from an empty
database, because six fictional projects and a set of published-password
accounts just landed in production. See Part 4.

A clean database has **no admin**, and no way to make one through the API:
`POST /api/auth/register` always creates a `resident`
([auth.js:67](backend/src/routes/auth.js#L67)) and there's no password-change
endpoint. So nothing works until you bootstrap one:

```bash
cd /opt/propgather/backend
sudo -u propgather env $(grep -v '^#' /etc/propgather.env | xargs) \
  ADMIN_PASSWORD='<a real password>' \
  npm run create-admin -- --email=you@propgather.com --name="Your Name"
```

The `env $(grep …)` prefix loads the MySQL credentials from the systemd
environment file — that file reaches the service, not your SSH session, so
without it the script would try to connect as `root` with no password and fail.

Pass the password via `ADMIN_PASSWORD`, not `--password` — a flag lands in your
shell history and is visible in `ps` while the command runs. Prefix the command
with a space to keep it out of history entirely.

The script refuses passwords under 12 characters and rejects the ones published
in this repo. Run it again on the same email to reset the password or promote an
existing account; it records `user.admin_created` / `user.admin_granted` in the
audit log either way, so the first admin's creation is itself accountable.

Verify before moving on:

```bash
curl -X POST https://api.propgather.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@propgather.com","password":"<a real password>"}'
# 200, "role":"admin"
```

### 2.8 nginx + TLS

```bash
sudo nano /etc/nginx/sites-available/propgather
```

```nginx
server {
    listen 80;
    server_name api.propgather.com;      # your API hostname

    client_max_body_size 16m;            # matches express.json's 15mb limit

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/propgather /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.propgather.com     # also sets up auto-renewal
```

Documents upload browser → R2 directly, so they don't pass through nginx; the
16m limit only needs to cover JSON request bodies.

### 2.9 Document retention (PDPA — not optional)

[purgeApplications.js](backend/src/jobs/purgeApplications.js) strips
`document_file` and deletes the R2 object for any decided application 14+ days
past its decision. This is the mechanism behind the "deleted within 14 days"
promise shown to residents at registration, so it has to actually run.

It runs **in-process on startup and then daily**
([index.js:19-27](backend/src/index.js#L19-L27)) — nothing to configure. Under
systemd with `Restart=always` the process is long-lived, so this is sufficient.

If you'd rather drive it externally, set `ENABLE_RETENTION_JOB=false` and:

```bash
sudo crontab -u propgather -e
```
```
0 3 * * *  cd /opt/propgather/backend && /usr/bin/node src/jobs/purge.cli.js >> /var/log/propgather-purge.log 2>&1
```

Cron gets no systemd `EnvironmentFile`, so the command must load
`/etc/propgather.env` itself — otherwise it connects as `root` with no password
and fails, or worse, reaches a different database.

- [ ] Within 24h of launch, confirm the purge ran — `GET /api/audit-log` or the
      log above.

### 2.10 Backups

`mysqldump` with `--single-transaction` takes a consistent snapshot without
locking the tables, because every table here is InnoDB.

Give root's credentials to the client rather than the command line, so they
never appear in `ps`:

```bash
sudo install -m 600 /dev/null /root/.my.cnf
sudo tee /root/.my.cnf >/dev/null <<'CNF'
[mysqldump]
user = root
password = <your mysql root password>
CNF
```

```bash
sudo crontab -e
```
```
30 2 * * *  /usr/bin/mysqldump --single-transaction --routines --triggers propgather | gzip > /var/backups/propgather/propgather-$(date +\%F).sql.gz
```

(`%` must be escaped as `\%` in crontab.) Prune old files, and copy them **off
the server** — a backup on the same disk isn't one.

Restore:

```bash
gunzip < /var/backups/propgather/propgather-2026-08-16.sql.gz | sudo mysql propgather
```

Backups contain personal data (names, emails, phone numbers, unit numbers).
Encrypt them at rest and apply the same retention discipline as production.
Test a restore at least once; an untested backup isn't a backup.

### 2.10b Inspecting production with MySQL Workbench

**Do not open port 3306.** MySQL stays bound to `127.0.0.1` (2.4); Workbench
reaches it over your existing SSH access instead, which needs no firewall change
and no extra credentials exposed to the internet.

In Workbench: **Database → Manage Connections → New**, then

| Field | Value |
|---|---|
| Connection Method | **Standard TCP/IP over SSH** |
| SSH Hostname | `api.propgather.com:22` (or the IP) |
| SSH Username | your sudo user (`chee`) |
| SSH Key File | your private key (the one from VPS_SETUP step 2) |
| MySQL Hostname | `127.0.0.1` — resolved *on the server*, not locally |
| MySQL Server Port | `3306` |
| Username / Password | `propgather` / the password from 2.4 |

The tunnel means MySQL still only ever accepts loopback connections. If you
disabled SSH password auth (VPS_SETUP step 3, which you should have), Workbench
needs the key file — it will not prompt for a password.

Treat it as read-mostly. Anything that changes schema belongs in a migration
file, not a Workbench edit: a hand-applied `ALTER` leaves the `migrations` table
disagreeing with reality, and the next deploy either fails or silently diverges
from what a fresh database would get.

### 2.11 Verify

```bash
curl https://api.propgather.com/api/health
# {"ok":true}

curl -X POST https://api.propgather.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@propgather.com","password":"<your-new-password>"}'
```

- [ ] `/api/health` returns `{"ok":true}` over **HTTPS**
- [ ] plain `http://` redirects to https, and `http://<ip>:4000` is unreachable
- [ ] admin login works with the rotated password, **fails with `admin123`**
- [ ] `POST /api/applications/upload-url` (bearer token) returns an `uploadUrl` —
      proves R2 works. A 500 means the S3 env vars are wrong.
- [ ] `GET /api/audit-log` (admin token) returns entries
- [ ] `sudo systemctl restart propgather` → data still there (MySQL persistence)
- [ ] `sudo reboot` → service comes back on its own (`enable` check)

### 2.12 Updating a deployed server

```bash
cd /opt/propgather
sudo -u propgather git pull origin main
cd backend
sudo -u propgather npm ci --omit=dev
sudo systemctl restart propgather
journalctl -u propgather -n 50        # confirm migrations + clean boot
```

Migrations apply automatically on start. **Back up first** (2.10) if the release
contains one. To apply migrations without restarting the service:

```bash
sudo -u propgather env $(grep -v '^#' /etc/propgather.env | xargs) npm run migrate
```

### 2.13 Rollback

```bash
cd /opt/propgather
sudo -u propgather git checkout <last-good-commit>
cd backend && sudo -u propgather npm ci --omit=dev
sudo systemctl restart propgather
```

Code rolls back cleanly. **Migrations do not** — see Part 3.

---

## Part 3 — Migrations

### Current state (verified 2026-08-14)

Four files in [backend/src/db/migrations/](backend/src/db/migrations/). None of
them insert a single row — the schema is pure structure, and the demo data that
used to arrive with it comes from `seed()`, which is now opt-in (Part 4).

| File | Adds | Tracked in git? |
|---|---|---|
| `0001_init_schema.sql` | 23 tables — users, projects, memberships, applications, forum, chat, vendors, petitions, polls, defects, documents, references, fees, community requests | Yes |
| `0002_pdpa_compliance.sql` | rebuilds `applications` (nullable `document_file`, `decided_by`, `consent_accepted_at`, `document_purged_at`); adds `audit_log` + 2 indexes | Yes |
| `0003_content_edits.sql` | `edited_at` on `forum_threads`, `chat_messages`, `petitions`, `defects` | **No — see Part 0** |
| `0004_performance_indexes.sql` | 18 indexes covering every per-project listing, the duplicate-application check, the retention purge, audit-log filtering, and the erasure cascade | **No — see Part 0** |

Applied to an empty MySQL 8 database, all four run clean and leave **nothing
behind but the schema**:

```
[migrate] applied 0001_init_schema.sql
[migrate] applied 0002_pdpa_compliance.sql
[migrate] applied 0003_content_edits.sql
[migrate] applied 0004_performance_indexes.sql

tables: 25    explicit indexes: 13    foreign keys: 31
```

`migrations` holds the runner's own bookkeeping — one row per applied file — so
that's the only table with contents on a fresh production database. Everything
else is empty.

The full suite — **294 tests across 20 files** — passes against a real MySQL
database, not a stand-in. (`backend/README.md` still says 163; that number is
stale.)

### ⚠️ Migrations are not atomic

This is the single most important constraint on how you write them.

**MySQL implicitly commits before and after every DDL statement**, so
`ALTER TABLE` cannot be rolled back. A file that fails on its third statement
leaves the first two applied.

The runner's defence is that it records a migration only after the *whole* file
succeeds — so the next boot retries it from the top. That only works if
re-running the already-applied parts is a no-op, which is why every statement in
`migrations/` is written to be safely re-runnable:

- `CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`
- `ALTER TABLE … MODIFY` (idempotent by nature)
- every `ADD COLUMN` / `ADD CONSTRAINT` / `CREATE INDEX` guarded against
  `information_schema`, because MySQL 8 has no `IF NOT EXISTS` for those
  (MariaDB does; MySQL doesn't)

I verified this rather than assuming it: deleting the `migrations` rows for
0002–0004 and re-running against an already-migrated database succeeds, with
`edited_at` present on exactly 4 tables and no duplicated index. **If you write a
migration whose retry isn't a no-op, a partial failure becomes a boot loop the
service can't escape.**

### Other MySQL-specific gotchas baked into these files

- **`VARCHAR(64)` ids, not `TEXT`** — MySQL can't index a `TEXT` column without a
  prefix length, and FK columns must match the referenced type exactly.
- **Timestamps are `VARCHAR(40)` ISO strings, not `DATETIME`.** The retention
  purge compares `decided_at <= ?` against an ISO cutoff and routes serialize
  them straight to JSON. Keep writing ISO strings.
- **JSON-bearing columns are `TEXT`, not MySQL's `JSON` type** — mysql2 parses
  `JSON` columns into objects automatically, which would break the explicit
  `JSON.parse()` the routes do.
- **`rating` is `DOUBLE`, not `DECIMAL`** — mysql2 returns `DECIMAL` as a string,
  which would turn `4.6` into `"4.60"` in API responses.
- **InnoDB auto-indexes every FK column**, which is why 0004 is small — a
  single-column index on an FK would duplicate what the constraint already
  creates.
- **No partial indexes.** MySQL has no `… WHERE document_file IS NOT NULL`
  equivalent, so the purge index is a `(status, decided_at)` composite.
- **`SET @x := …` collides with named placeholders.** mysql2's
  `namedPlaceholders` parser reads `:=` as a `:name` parameter, so the migration
  connection turns that option off explicitly. If a future migration mysteriously
  fails to parse, this is why.

So the schema is deployment-ready. The outstanding item is **committing it**
(Part 0).

### How the runner works

[migrate.js](backend/src/db/migrate.js) reads every `*.sql` in the directory,
sorts by **filename**, skips any already recorded in the `migrations` table, and
applies the rest — each inside its own transaction. It's invoked automatically
from `getDb()`, so **starting the server migrates it**; `npm run migrate`
([migrate.cli.js](backend/src/db/migrate.cli.js)) just calls `getDb()` and exits.

Consequences worth knowing before you write one:

- **Filename order is apply order.** `0004_x.sql` runs after `0003_y.sql`. Keep
  the zero-padded prefix.
- **Applied files are never re-read.** Editing one that already ran changes
  nothing on any existing database — including production — while silently
  changing what a *fresh* database gets. That's how two environments diverge
  without any error. Never edit an applied migration; add a new one.
- **A migration is NOT one transaction** — see the warning above. This is the
  rule that most changes how you write them.
- **A broken migration is an outage, not a warning.** The server runs migrations
  before it listens, so a failure means it won't start. That's the right failure
  mode, but combined with `Restart=always` it presents as a crash loop.
- **There are no down-migrations.** Rolling back code across a migration leaves
  the schema forward. Usually harmless (older code ignores a new column); across
  a *destructive* migration it needs a restore from backup. Back up before
  deploying any migration that drops or rewrites a column.

### Adding one

1. `backend/src/db/migrations/0005_short_description.sql`, next number up.
2. Header comment explaining **why** — the existing four do this, and it's
   what makes the schema legible a year later.
3. **Make every statement safely re-runnable.** `CREATE TABLE IF NOT EXISTS` and
   `INSERT IGNORE` are enough on their own; `ADD COLUMN`, `ADD CONSTRAINT` and
   `CREATE INDEX` need an `information_schema` guard, because MySQL 8 has no
   `IF NOT EXISTS` for them. Copy the `SET @c = (SELECT COUNT(*) …)` /
   `PREPARE` / `EXECUTE` pattern from 0002 or 0004 verbatim.
4. Test against a scratch database *and* a production-shaped one:
   ```bash
   cd backend
   MYSQL_DATABASE=pg_scratch npm run migrate      # from empty
   
   # then against real-shaped data restored from a backup
   sudo mysql -e "CREATE DATABASE pg_rehearse"
   gunzip < /var/backups/propgather/latest.sql.gz | sudo mysql pg_rehearse
   MYSQL_DATABASE=pg_rehearse npm run migrate
   ```
   The second run is the one that catches real problems — an empty database
   never violates a constraint.
5. **Test the retry path too**, since it's now load-bearing: delete your new
   file's row from `migrations` and run again. It must succeed, not error.
6. `npm test`, then **`git add` the file explicitly** (Part 0).

---

## Part 4 — Demo data is opt-in

This is the "no dirty data" guarantee, and it's a behaviour change from how the
server used to boot.

**Previously** [index.js](backend/src/index.js) called `seed()` unconditionally.
It's guarded — [seed.js:150-151](backend/src/db/seed.js#L150-L151) exits early
if any project rows exist — but **a fresh production database is exactly the
case that guard doesn't cover**, so a first boot inserted:

- `admin@propgather.com` / `admin123` — **role `admin`**
  ([seed.js:199](backend/src/db/seed.js#L199))
- demo residents with published passwords (`resident123`, …)
- six fictional projects, vendors, forum threads, polls, defects, fee records

Those credentials are in the public README. Anyone could have signed in as
platform admin and read the verification-document queue.

**Now** seeding requires `SEED_DEMO_DATA=true`. Production leaves it unset and
starts empty; migrations still run at boot either way, so a broken migration
fails loudly at startup instead of 500ing one endpoint later.

| Environment | `SEED_DEMO_DATA` | Result |
|---|---|---|
| Production | unset | schema only — every table empty except `migrations` |
| Local dev | `true` in `.env` | demo projects and accounts, as before |
| Tests | n/a | unaffected — `freshApp()` calls `seed()` directly ([test/helpers.js:15](backend/test/helpers.js#L15)) |

An existing dev database keeps its data. A dev starting fresh either sets the
flag or runs `npm run seed` once.

### Getting an admin without the seed

`seed()` was the only thing that ever created an admin, so a clean database has
none — and the API can't make one (`register` hardcodes `resident`, no
password-change endpoint exists). [createAdmin.js](backend/src/db/createAdmin.js)
fills that gap:

```bash
cd backend
ADMIN_PASSWORD='<a real password>' npm run create-admin -- \
  --email=you@propgather.com --name="Your Name"
```

- Creates the account, or **promotes an existing one** — so the natural flow is
  to register through the normal signup form, then promote yourself.
- Rejects passwords under 12 characters and the ones published in this repo.
- Never echoes the password, since this output lands in deploy logs.
- Records `user.admin_created` / `user.admin_granted` in `audit_log`, so the
  first admin's creation is itself accountable.
- Re-running it on an existing admin without a password is a no-op.

Prefer `ADMIN_PASSWORD` over `--password`: a flag is captured in shell history
and visible in `ps` for the life of the command.

Before exposing the port:

- [ ] `journalctl` shows **no** `Database seeded.` line
- [ ] `GET /api/projects` returns `[]`
- [ ] logging in as `admin@propgather.com` / `admin123` returns **401**
- [ ] logging in as your real admin returns 200 with `"role":"admin"`

---

## Part 5 — Hardening before real residents use this

Open items, not bugs — but they should close before the first real ownership
document is uploaded.

- **CORS is restricted — but you must set `CORS_ORIGINS`.** Unset, only the local
  dev origins are allowed ([middleware/cors.js](backend/src/middleware/cors.js)),
  which on a server means the deployed frontend is blocked and every page renders
  empty. Set it to your frontend origin(s), comma-separated, and check the boot
  log line (`CORS: allowing …`) to confirm what took effect.
- **`JWT_SECRET` must be set** (2.5). The fallback is public.
- **Rate limiting is per-process and in-memory**
  ([rateLimit.js](backend/src/middleware/rateLimit.js)). It resets on restart
  and isn't shared between processes — so `Restart=always` after a crash also
  resets the login throttle. Fine for one process; run more than one and the
  effective limit multiplies by instance count.
- **Request body limit is 15mb** ([app.js:24](backend/src/app.js#L24)). Files go
  direct to R2, so lower it if you want a tighter ceiling.
- **No monitoring or alerting exists.** Nothing pages anyone on a suspicious
  pattern; someone has to read `GET /api/audit-log`. PDPA's 72-hour breach
  clock depends on detection — see
  [PDPA_COMPLIANCE_CHECKLIST.md](PDPA_COMPLIANCE_CHECKLIST.md).
- **InnoDB samples statistics automatically**, so there's no `ANALYZE` step to
  schedule. If a query plan ever looks wrong after a large data change,
  `ANALYZE TABLE <name>;` refreshes it by hand.
- **MySQL's own hardening** is now part of your surface area: keep it bound to
  `127.0.0.1` (2.4), keep the app user off `root`, and let
  `unattended-upgrades` patch `mysql-server` along with everything else.

---

## Part 6 — Wiring the frontend to the backend

**Done.** `src/api.js` calls the backend over HTTP and [src/auth.jsx](src/auth.jsx)
stores a real JWT. Consequences that now apply to every deploy:

- **The frontend is no longer independently deployable.** A broken or unreachable
  backend is a broken site — there is no mock fallback to fall back to.
- **`VITE_API_URL` is baked in at build time**, so pointing the frontend at a
  different API means a rebuild and redeploy, not a config edit. It defaults to
  `/api` (same origin) in a production build, which is what you want when nginx
  serves the frontend and proxies `/api`; set it explicitly for any split
  deployment, including GitHub Pages:

  ```bash
  VITE_API_URL=https://api.propgather.com/api npm run build
  ```

- **The backend's `CORS_ORIGINS` must list the frontend's origin.** It defaults to
  the local dev origins only, so a server without it blocks the deployed frontend
  outright (Part 5).
- **R2's CORS `AllowedOrigins` must list it too**, or document uploads fail at
  the browser → R2 `PUT`. See [backend/infra/s3-cors.json](backend/infra/s3-cors.json).
- **`VITE_SHOW_DEMO_LOGINS` must stay unset/false** for a real deployment. It
  prints the seeded demo credentials on the login page; it's off by default in
  production builds.
- **`JWT_SECRET` matters more than ever** (2.5) — it's now the only thing standing
  between a request and an admin session.

---

## Part 7 — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ERR_MODULE_NOT_FOUND` on boot, clean local tests | untracked file never committed | Part 0 — `git add -A` |
| Pages site blank / 404s on JS and CSS | `base` mismatch | Check `base` vs. the URL; inspect `dist/index.html` |
| Deployed site doesn't match the repo | `deploy` published a stale local `dist/` | Push `main`, rebuild, redeploy |
| Every page empty, "can't reach PropGather" | backend down, or `VITE_API_URL` wrong/stale in the build | `curl https://<api>/api/health`; rebuild with the right `VITE_API_URL` |
| Login works, then everything 401s | `JWT_SECRET` changed between requests, or unset across restarts | Set it explicitly and keep it stable (2.5) |
| Pages/browser console shows CORS errors on `/api` | `CORS_ORIGINS` doesn't list the frontend origin | Set it, restart, check the `CORS: allowing …` boot log |
| Document upload fails at the `PUT`, app itself fine | R2 bucket CORS missing the frontend origin | `backend/infra/s3-cors.json` |
| `ER_ACCESS_DENIED_ERROR` on boot | wrong `MYSQL_USER`/`MYSQL_PASSWORD`, or the user isn't `@localhost` | Re-check the GRANT in 2.4 |
| `ER_BAD_DB_ERROR` on boot | database missing and the app user lacks CREATE | Create it by hand (2.4) |
| Crash loop on every reboot | app started before MySQL was ready | `Requires=mysql.service` + `After=` in the unit (2.7) |
| Migration fails, then fails again forever | a statement in it isn't re-runnable | See "Migrations are no longer atomic" in Part 3 — add the `information_schema` guard |
| `Named query contains placeholders…` | SQL uses `:=` and hit the named-placeholder parser | Use `=` in `SET`, or run it on the migration connection |
| Emoji or accented names come back mangled | table or column not `utf8mb4` | `SHOW CREATE TABLE` — 0001 sets `utf8mb4`/`utf8mb4_unicode_ci` throughout |
| Uploads 500 on `/api/applications/upload-url` | R2 env vars missing/wrong | Check all five in 2.5; there's no local-disk fallback by design |
| Browser upload fails CORS, server logs nothing | R2 bucket CORS missing your origin | Apply [s3-cors.json](backend/infra/s3-cors.json) with the right origins |
| Everyone logged out after a deploy | `JWT_SECRET` changed or unset | Set it explicitly, keep it stable |
| Login returns 429 | 10 attempts / 15 min per account | Wait, or restart (in-memory state) |
| Demo projects appear in production | `SEED_DEMO_DATA=true` leaked into the server env | Unset it, drop the database, restart, re-run `create-admin` — Part 4 |
| Clean DB but nobody can log in | no admin exists yet on an unseeded database | `npm run create-admin` — Part 2.7 |
| Local dev DB is suddenly empty | seeding is opt-in now | `SEED_DEMO_DATA=true` in `backend/.env`, or `npm run seed` |
| Server reachable on `:4000` directly | `ufw` not enabled | [VPS_SETUP.md](VPS_SETUP.md) step 7 — the app binds all interfaces |
| Locked out of SSH after hardening | an override in `/etc/ssh/sshd_config.d/` won | [VPS_SETUP.md](VPS_SETUP.md) step 3 — use the provider's web console to fix |
| Migration failed, service won't start | one bad `.sql`; transaction rolled back | Read `journalctl -u propgather`, fix the file, redeploy. Restore from backup if it was destructive |

---

## Part 8 — Not deployable by any command

Launch blockers no script closes. Full status in
[PDPA_COMPLIANCE_CHECKLIST.md](PDPA_COMPLIANCE_CHECKLIST.md) — read it before
telling anyone the deployment is "compliant."

- [ ] Appoint a Data Protection Officer and notify the Commissioner (required
      since 1 June 2025)
- [ ] Confirm with a Malaysia-qualified lawyer whether PropGather must register
      as a data controller
- [ ] Fill the `[ FILL IN ]` placeholders and assign a named owner in
      [backend/docs/BREACH_RESPONSE.md](backend/docs/BREACH_RESPONSE.md)
- [ ] Legal review of the Privacy Policy and its Bahasa Malaysia translation
- [ ] Real breach monitoring/alerting (Part 5)
- [ ] Business registration status

---

## Quick reference

```bash
# Frontend (local)
npm run build                  # build to dist/
npm run preview                # serve the production build locally
npm run deploy                 # build + publish to gh-pages

# Backend (local)
cd backend
npm test                       # 282 tests, fully offline
npm run migrate                # apply pending migrations, don't start server
npm run seed                   # demo data on demand (dev only)
npm run create-admin -- --email=… --name="…"   # first admin, ADMIN_PASSWORD in env
npm run purge                  # one-off 14-day retention purge

# Backend (server)
sudo systemctl status propgather
sudo systemctl restart propgather
journalctl -u propgather -f
journalctl -u propgather -n 100 --no-pager
sudo mysql propgather -e "SHOW TABLES"
sudo mysql propgather -e "SELECT name, applied_at FROM migrations"
sudo systemctl status mysql
```
