# Deployment — WorkManager

## Quick Deploy (Railway)

The fastest path to production is **Railway**, which supports Docker Compose deployments with managed Postgres and Redis.

### 1. Prerequisites

- [Railway account](https://railway.app)
- A registered domain (optional — Railway provides a `.railway.app` subdomain)

### 2. Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Log in
railway login

# Link your project
railway link
```

### 3. Environment Variables

Set these in the Railway dashboard:

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Railway managed Postgres |
| `REDIS_URL` | Railway managed Redis |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` |
| `AUTH_URL` | `https://yourdomain.com` |
| `S3_ACCESS_KEY_ID` | Your S3-compatible provider |
| `S3_SECRET_ACCESS_KEY` | Your S3-compatible provider |
| `S3_BUCKET` | `workmanagement-files` |
| `MEILISEARCH_API_KEY` | Your Meilisearch API key |

### 4. Deploy

```bash
railway up
```

Or connect your GitHub repo for auto-deploy on push.

### 5. Run Migrations

```bash
railway run pnpm db:migrate
```

### 6. Seed Database

```bash
railway run pnpm db:seed
```

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
1. Builds Docker image
2. Pushes to GitHub Container Registry (ghcr.io)
3. Deploys to Railway via CLI

**Required secrets:**
- `RAILWAY_TOKEN` — Railway deployment token

---

## Manual Docker Deployment

```bash
# Build
docker build -t workmanager:latest .

# Run with docker-compose
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml --profile migrate run migrate
```

---

## Infrastructure Design

### Container Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Web App     │────▶│  Postgres   │     │  Redis      │
│  (Next.js)   │     │  (Primary)  │     │  (Cache/Rate│
│  Port 3000   │     │  Port 5432  │     │   Limiter)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │
       ▼                    ▼
┌─────────────┐     ┌─────────────┐
│  MinIO/S3   │     │ Meilisearch │
│  (File      │     │ (Search)    │
│   Storage)  │     │ Port 7700   │
└─────────────┘     └─────────────┘
```

### Resource Limits

| Service | CPU | Memory | Replicas |
|---------|-----|--------|----------|
| Web App | 2.0 | 1GB | 2 (min) |
| Postgres | 1.0 | 1GB | 1 |
| Redis | 0.5 | 256MB | 1 |
| MinIO | 1.0 | 512MB | 1 |
| Meilisearch | 1.0 | 512MB | 1 |

### Health Checks

`GET /api/health` probes all dependencies:
- **Database**: `SELECT 1` via Drizzle ORM
- **Redis**: `PING` via redis client

Returns `200 OK` if all healthy, `503 Service Unavailable` if any dependency is down.

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
- Fail-open if Redis is unavailable

---

## Scaling Strategy

| Stage | Users | Infrastructure |
|-------|-------|---------------|
| **Launch** | 1,000 | 2 web replicas, 1 Postgres, 1 Redis |
| **Growth** | 10,000 | 3-5 web replicas, read replicas |
| **Scale** | 100,000+ | Auto-scaling, Aurora, ElastiCache cluster |

---

## Environment Variables

See `.env.production.example` for the complete list with descriptions.
