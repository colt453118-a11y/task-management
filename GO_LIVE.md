# WorkManager — GO-LIVE Runbook

> One step at a time. Confirm each step before the next. Nothing here is
> reversible by pressing undo — the app will hold real data once it's public.
> Anyone following this should keep this doc open and tick steps off as they go.

**Target stack (already decided):** Render (free tier for now) · managed
Postgres (free) · custom domain `app.workmanager.com` · Resend for email.

**Where the DNS lives (verified 2026-08-05):** `workmanager.com` is registered
at **NameBright.com** but its nameservers point at **Cloudflare**
(`dexter.ns.cloudflare.com` / `grannbo.ns.cloudflare.com`). You need login
access to the Cloudflare account that hosts the `workmanager.com` zone (and
the NameBright account as a fallback).

---

## Prereqs (things to have ready)

| Thing | Where | Notes |
|---|---|---|
| GitHub account | github.com | Must own/access `colt453118-a11y/task-management` |
| Render account | dashboard.render.com | Connect the GitHub repo during Step 2 |
| Cloudflare (or NameBright) access | cloudflare.com | Control over the `workmanager.com` zone |
| Resend account | resend.com | API key already used locally (in gitignored `.env`) |
| An inbox you own | — | For the live email test (must be the Resend account owner's email for sandbox sends) |
| A password manager | — | Store every secret generated below |

---

## Step 0 — Ship the deploy-prep PR

This branch (`chore/go-live-deploy-prep`) fixes everything that would have
broken the first deploy:

- `Dockerfile` — ships `packages/database` (schema + migration SQL) + pinned
  migration toolchain inside the image, so Render's preDeploy can migrate.
- `render.yaml` — working `preDeployCommand` (`drizzle-kit migrate` + idempotent
  `tsx seed`), plus the missing `ENCRYPTION_KEY` and `CRON_SECRET` vars.
- `scripts/create-admin.ts` / `fix-password.ts` — credentials come from env now
  (`ADMIN_EMAIL`, `ADMIN_PASSWORD`); no committed password.

Ship it: branch → PR → CI green → squash-merge. **Do not start Step 2 until
this is merged to `main`** — Render will deploy whatever is on `main`.

## Step 1 — Fresh production secrets (never reuse dev values)

Generate and store all of these in your password manager now:

```bash
# Auth session secret
openssl rand -base64 32

# Secret-encryption key (Slack webhook secrets — AES-256-GCM)
openssl rand -base64 32

# Cron bearer token (overdue checks, EOD snapshots)
openssl rand -hex 32

# Resend API key → already exists in your gitignored .env — reuse it
# (do NOT commit it; it goes in the Render dashboard only)
```

Secrets to set in Render (Step 2): `AUTH_SECRET`, `ENCRYPTION_KEY`,
`CRON_SECRET`, `RESEND_API_KEY`.

## Step 2 — Create the Render Blueprint

1. Log in at dashboard.render.com.
2. **New → Blueprint** → connect `github.com/colt453118-a11y/task-management`.
3. Render reads `render.yaml` and proposes: web service `workmanager` +
   Postgres `workmanager-db` (both free). Accept.
4. In the **workmanager web service → Environment** tab, set (sync:false vars):
   - `AUTH_SECRET` = value from Step 1
   - `ENCRYPTION_KEY` = value from Step 1
   - `CRON_SECRET` = value from Step 1
   - `RESEND_API_KEY` = `re_...` (the key from your local `.env`)
5. `EMAIL_FROM` / `EMAIL_FROM_NAME` / `EMAIL_UNSUBSCRIBE_URL` come from the
   blueprint already (`noreply@workmanager.com` / `WorkManager` /
   `https://app.workmanager.com/settings/notifications`). Leave them for now —
   real sends only work after Step 6 verifies the domain.

**Expected:** first deploy starts automatically. The preDeploy step runs
migrations + the idempotent seed (default org, roles, permissions). Health
check hits `/api/health`.

**Verify:** service shows `Live` and the deploy log shows
`preDeploy: ✓ … drizzle-kit migrate ✓ … seed ✓` with no errors.

> ⚠️ Free tier notes: the web service sleeps after ~15 min idle (cold start
> on the next request) and the free Postgres auto-deletes after **90 days**
> with no backups. Set a calendar reminder now: *"Export WM DB + upgrade or
> relaunch"* — see Step 8.

## Step 3 — Admin bootstrap (first login)

The seed ran automatically, but no admin user exists yet. From your local
checkout of this repo:

```bash
# 1. Copy the "External Connection String" from Render → workmanager-db →
#    Info (the one that is reachable from outside Render)
export DATABASE_URL='postgres://wmuser:...@...:5432/workmanager'

# 2. Create the admin with a fresh random password
export ADMIN_PASSWORD="$(openssl rand -base64 18)"
pnpm --filter @workmanagement/database exec tsx ../../scripts/create-admin.ts
#   → prints "✅ Admin user created" (never prints the password)
```

Save `ADMIN_PASSWORD` in your password manager. Don't lose it — it's the only
admin credential.

> If Render's free Postgres won't accept external connections (the "External
> Connection String" in the DB → Info panel won't connect from your machine),
> make the DB reachable first: Render → workmanager-db → Info → check the
> connection settings (free instances accept external connections by default).
> The admin script must run from a machine that can reach the DB — it can't
> run inside the web service image.

## Step 4 — DNS: point app.workmanager.com at Render

1. Open the web service → **Settings → Custom Domains** → add
   `app.workmanager.com`. Render shows the target hostname (e.g.
   `workmanager.onrender.com`).
2. In the **Cloudflare zone for workmanager.com** add:

   | Type | Name | Value | Proxy |
   |---|---|---|---|
   | CNAME | `app` | `workmanager.onrender.com` | DNS only (grey cloud) |

3. Verify: `dig +short app.workmanager.com` → your Render hostname. HTTPS
   certificate auto-provisions; wait a few minutes, then open
   `https://app.workmanager.com/api/health` (expect JSON `ok`).

**Then override the app URL** (Render dashboard → web service → Environment):
set both `NEXT_PUBLIC_APP_URL` and `AUTH_URL` to **`https://app.workmanager.com`**
(replace the auto-`*.onrender.com` value). This is what makes email links,
auth trust, and CSRF origin checks use the real domain.

Also set **`BUILDARG_NEXT_PUBLIC_APP_URL`** to the same value — the client-side
auth base URL is baked into the bundle at build time, so a redeploy is needed
for the browser to call the custom domain. Save → deploy.

## Step 5 — Verify the running app

- [ ] `https://app.workmanager.com/api/health` → 200
- [ ] `https://app.workmanager.com/auth/login` loads; log in as the admin from
      Step 3 (a successful login also proves the client-side auth base URL was
      baked correctly at build time — if the login form POSTs to
      `localhost:3000` or fails, the `BUILDARG_NEXT_PUBLIC_APP_URL` override
      from Step 4 didn't reach the build; fix it and redeploy)
- [ ] Create a task, then check the dashboard
- [ ] Unauthenticated API is blocked: `curl -i https://app.workmanager.com/api/tasks`
      → 401 (not 200)
- [ ] The `*.onrender.com` URL redirects or behaves the same (TLS valid)

## Step 6 — Resend sending domain (real email)

Resend currently has only `mindhives.co` (status: failed) and `workmanager.com`
is **not** registered there — this must be fixed before any real
multi-recipient email.

1. resend.com → **Domains → Add Domain** → `workmanager.com`.
2. Resend lists DNS records to add in the Cloudflare zone:
   - one **SPF** TXT record (e.g. `v=spf1 include:amazonses.com ~all`)
   - three **DKIM** CNAME records (the `send` + `_domainkey` + `_dmarc` ones)
3. In Cloudflare: DNS → add those records → back in Resend click **Verify**.
4. Confirm status shows **Verified** (DNS can take a few minutes to propagate).
5. Set `EMAIL_FROM=noreply@workmanager.com` in the Render dashboard (already
   the blueprint value — double-check it).

**Live test** (from the repo root, key from `.env`):

```bash
# Still-on-sandbox fallback (only delivers to the account-owner's inbox):
EMAIL_FROM=onboarding@resend.dev node scripts/send-test-email.mjs --to <your-inbox>

# After the domain verifies + DNS override from Step 4 is deployed:
NEXT_PUBLIC_APP_URL=https://app.workmanager.com \
  node scripts/send-test-email.mjs --to <your-inbox>
```

Both must print `✅ SUCCESS — real email delivered … via Resend`. Click the
link in the second email — it must land on `https://app.workmanager.com`.

## Step 7 — Scheduled automation (cron)

The app exposes authenticated cron endpoints (bearer = `CRON_SECRET`):

| Job | Endpoint | Schedule |
|---|---|---|
| Overdue-task check | `POST /api/automation/check-overdue` | every 30 min |
| Deadline reminders | `POST /api/cron/check-deadlines` | daily (e.g. 08:00) |
| EOD snapshot + AI summary | `POST /api/cron/generate-eod-snapshot` | daily (e.g. 17:00) |

Option A — **cron-job.org (free):** create one job per endpoint with header
`Authorization: Bearer <CRON_SECRET>` and the schedule above.

Option B — **GitHub Actions:** a scheduled workflow in this repo POSTing to the
endpoints with `CRON_SECRET` as a repo secret.

> ⚠️ Free tier sleeps: a job that fires while the service is cold can take
> 30–60 s. If a run fails with a timeout, cron-job.org retries — or upgrade the
> web service to Starter when this matters.

## Step 8 — Backups (do NOT skip — free tier has none)

Render free Postgres has **no automated backups** and **auto-deletes after 90
days**. Until you upgrade, the DB survives only if you export it:

```bash
# Weekly (cron-job.org or crontab), from a machine with access:
pg_dump "$PROD_DB_URL" | gzip > "wm-$(date +%F).sql.gz"
# then copy the file off-box (cloud drive / object storage), encrypted if it
# contains anything sensitive
```

**Prove a restore once before relying on it:**
```bash
docker run -d --name wm-restore-test -e POSTGRES_DB=workmanager \
  -e POSTGRES_USER=wmuser -e POSTGRES_PASSWORD=wmtest \
  -p 55433:5432 postgres:17.10-alpine
gunzip -c wm-2026-08-05.sql.gz | \
  PGPASSWORD=wmtest psql -h localhost -p 55433 -U wmuser -d workmanager
# query the restored DB (e.g. count users/tasks), then tear it down
docker rm -f wm-restore-test
```

Untested backup = no backup. This is the last gate before pointing real users
at the URL.

## Step 9 — Rotate the leaked admin password

`Colt@180731` was previously hardcoded in `scripts/create-admin.ts` and
`scripts/fix-password.ts` and is in this repo's git history. Treat it as
compromised:

1. If that string is (or was) your password anywhere else — email, other apps —
   change it everywhere. It's very likely to be probed by credential-stuffing.
2. In WorkManager, rotate the admin account to a fresh value:

```bash
export ADMIN_PASSWORD="$(openssl rand -base64 18)"   # store in password manager
pnpm --filter @workmanagement/database exec tsx ../../scripts/fix-password.ts
```

## Step 10 — Post-launch checks (first week)

- [ ] Watch Render logs for errors; check `/api/health` probes
- [ ] Confirm the EOD snapshot + overdue jobs ran and emailed
- [ ] Confirm SPF/DKIM pass in email headers (or via Resend dashboard)
- [ ] Re-run the Step 6 live test after any DNS/env change
- [ ] Calendar reminder: free DB **90-day auto-delete** → export + upgrade or
      relaunch before the deadline

---

## Quick reference — env vars the app reads

| Var | Required? | Purpose |
|---|---|---|
| `AUTH_SECRET` | ✅ | Better Auth sessions |
| `ENCRYPTION_KEY` | ✅ | AES-256-GCM for Slack/webhook secrets (`encrypt()` throws without it) |
| `CRON_SECRET` | ✅ | Bearer auth for cron endpoints |
| `DATABASE_URL` | ✅ | Postgres (auto-injected) |
| `RESEND_API_KEY` | ✅ | Email via Resend (`sendEmail` no-ops without it) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Link target in emails + CSRF origin + auth base |
| `AUTH_URL` | ✅ | Auth callback trust |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` / `EMAIL_UNSUBSCRIBE_URL` | ⚠️ | Defaults set; use verified domain after Step 6 |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | ⛔ optional | Error monitoring; app runs without it |
| `S3_*` / `MEILISEARCH_*` / AI keys | ⛔ optional | Feature-specific |
