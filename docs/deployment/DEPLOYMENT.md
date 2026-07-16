# Deployment — WorkManager

## Quick Deploy (Render — Free Tier)

The easiest free deployment uses **Render** with the `render.yaml` blueprint.

### What You Get for Free

| Resource          | Free Tier                                                                       |
| ----------------- | ------------------------------------------------------------------------------- |
| **Web service**   | 1 instance, Docker-based, auto-deployed from GitHub                             |
| **PostgreSQL**    | 1GB managed database (auto-deletes after 90 days)                               |
| **Custom domain** | ✅ with managed SSL                                                             |
| **Sleep policy**  | Spins down after 15 min of inactivity, wakes on first request (~30s cold start) |

### Limitations (Free Tier)

- ❌ **No managed Redis** — rate limiting will fail-open (graceful degradation).
- ❌ **No S3/MinIO** — file uploads require an external S3-compatible provider.
- ❌ **No Meilisearch** — search indexing won't run; client-side filtering still works.
- ⏰ Postgres auto-deletes after 90 days. Upgrade to a paid plan for persistent storage.

### 1. Fork & Connect

1. Push your repo to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com)
3. Click **New +** → **Blueprint** → select your repo
4. Render reads `render.yaml` and creates:
   - A **Web Service** (Docker) with health checks
   - A **PostgreSQL** database (free)

### 2. Set Secrets in Render Dashboard

After the blueprint deploys, you'll see a "Needs Action" badge. Click into your web service and add these as **Secret Files** or **Environment Variables**:

| Variable               | How to Generate                            |
| ---------------------- | ------------------------------------------ |
| `AUTH_SECRET`          | `openssl rand -base64 32` in your terminal |
| `S3_ACCESS_KEY_ID`     | _(skip unless you need file uploads)_      |
| `S3_SECRET_ACCESS_KEY` | _(skip unless you need file uploads)_      |

### 3. Run Database Seed

Render's Blueprint auto-deploy will run migrations (`npx drizzle-kit migrate`) via the `preDeployCommand`. But you still need to seed the initial data:

```bash
# Install the Render CLI
npm install -g @render/cli

# Open a Render Shell for your web service
render shell

# Run the seed script
corepack enable && corepack prepare pnpm@10 --activate && pnpm db:seed
```

Or use the Render Dashboard → your web service → **Shell** tab.

### 4. Open Your App

Your app will be at `https://workmanager.onrender.com` (or whatever name you chose).

---

## CI/CD Pipeline

The project uses GitHub Actions for CI/CD:

### CI (`.github/workflows/ci.yml`)

Runs on every push/PR:

- TypeScript type check
- Lint
- Build
- Tests (170+ passing)
- Docker security scan (Trivy)

### Deploy (`.github/workflows/deploy.yml`)

Runs on push to `main`:

1. Runs quality gates (typecheck, lint, test, Docker build)
2. Triggers Render's auto-deploy via webhook

**Required secrets:**

- `RENDER_DEPLOY_HOOK` — Found in Render dashboard → your web service → **Settings** → **Deploy Hooks**

### Auto-Deploy Without GitHub Actions

Render also supports direct GitHub integration:

- Connect repo → pick `main` branch → **Auto-Deploy: Yes**
- Every push to `main` automatically triggers a new deploy
- No GitHub Actions or webhooks needed

---

## Manual Docker Deployment

```bash
# Build
docker build -t workmanager:latest .

# Run with docker-compose (all services)
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml --profile migrate run migrate

# Seed database
docker compose exec web pnpm db:seed
```

---

## Infrastructure Design

### Container Architecture

```
┌─────────────┐     ┌─────────────┐
│  Web App     │────▶│  Postgres   │
│  (Next.js)   │     │  (Managed)  │
│  Port 3000   │     │             │
└─────────────┘     └─────────────┘
       │
       ├── S3/MinIO (external, optional)
       ├── Meilisearch (external, optional)
       └── Redis (external, optional)
```

### Health Checks

`GET /api/health` probes available dependencies:

- **Database**: `SELECT 1` via Drizzle ORM
- **Redis**: `PING` via redis client (skips if Redis URL not configured)

Returns `200 OK` if database is healthy, `503 Service Unavailable` if database is down.

---

## Monitoring

### Sentry (Error Tracking)

- Set `SENTRY_DSN` env var to enable
- Set `SENTRY_ENVIRONMENT` to `production`

### Structured Logging

- Uses **pino** for JSON structured logs
- Log level: `LOG_LEVEL=info` (default: `info` in production)
- Development: `pino-pretty` for readable output
- Request IDs auto-generated for log correlation

### Audit Logging

- All mutations logged to `audit_logs` table
- Tracks: who did what, when, old/new values

---

## Security

### Headers

- Content-Security-Policy
- HSTS (2 years, preload)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (no camera, mic, geolocation)
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-origin

### CSRF Protection

- SameSite=Lax session cookies
- Origin/Referer header validation on mutations
- Configurable trusted origins via `CSRF_TRUSTED_ORIGINS`

### Rate Limiting

- Redis-backed sliding window
- Per-route config (login: 5/min, mutations: 30-60/min)
- Fail-open if Redis is unavailable (graceful degradation on free tier)

---

## Scaling Strategy

| Stage      | Users    | Infrastructure                                |
| ---------- | -------- | --------------------------------------------- |
| **Launch** | 1,000    | 1 web instance, 1 Postgres                    |
| **Growth** | 10,000   | 2+ web instances, Postgres upgrade, add Redis |
| **Scale**  | 100,000+ | Auto-scaling, read replicas, ElastiCache      |

---

## Environment Variables

See `.env.production.example` for the complete list with descriptions.
