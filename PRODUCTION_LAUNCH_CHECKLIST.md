# Production Launch Checklist — WorkManager

> **Date:** July 30, 2026

---

## Pre-Launch (Must Have)

- [x] **Authentication & Authorization**
  - [x] Better Auth configured with session management
  - [x] Rate limiting on login (5 req/min/IP)
  - [x] RBAC with `requirePermission()` on all API routes
  - [x] Pre-login deactivation/suspension check
  - [x] Session revocation on account status change

- [x] **API Security**
  - [x] CSRF protection (Origin/Referer validation + SameSite cookies)
  - [x] Zod input validation with `.strict()` on all routes
  - [x] HTML sanitization on all rich text fields
  - [x] Consistent structured error responses

- [x] **Infrastructure**
  - [x] Docker multi-stage build with non-root user
  - [x] All base images pinned to specific versions
  - [x] Internal service isolation (no host port exposure)
  - [x] Resource limits on all containers
  - [x] Health check endpoint (`GET /api/health`)

- [x] **Security Headers**
  - [x] Content-Security-Policy (with `report-uri`)
  - [x] Strict-Transport-Security (max-age=63072000; includeSubDomains; preload)
  - [x] X-Frame-Options: DENY
  - [x] X-Content-Type-Options: nosniff
  - [x] Referrer-Policy: strict-origin-when-cross-origin
  - [x] Permissions-Policy (no camera, mic, geolocation)
  - [x] Cross-Origin-Opener-Policy: same-origin
  - [x] Cross-Origin-Resource-Policy: same-origin

- [x] **Testing**
  - [x] 571 E2E tests passing (0 failed)
  - [x] 208 security regression tests passing
  - [x] TypeScript zero errors (`tsc --noEmit`)
  - [x] Dependency audit (0 critical, 0 high remaining)
  - [x] CI pipeline with typecheck → test → lint gates

- [ ] **Deployment Configuration**
  - [ ] Set `AUTH_SECRET` (generate with `openssl rand -base64 32`)
  - [ ] Set `ENCRYPTION_KEY` for webhook secret storage
  - [ ] Set `CRON_SECRET` (**required in production** — cron/EOD/overdue endpoints fail closed without it, per WM-003)
  - [ ] Set `SENTRY_DSN` for error monitoring
  - [ ] Set `RESEND_API_KEY` for email notifications
  - [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
  - [ ] Configure production PostgreSQL connection string
  - [ ] Configure production Redis URL (optional but recommended)
  - [ ] Configure S3/MinIO for file uploads

---

## Launch Day

- [ ] **DNS & SSL**
  - [ ] Configure custom domain DNS records
  - [ ] Verify TLS certificate auto-provisioning
  - [ ] Verify HSTS preload submission

- [ ] **Database**
  - [ ] Run migrations (`pnpm db:migrate`)
  - [ ] Run seed (`pnpm db:seed`)
  - [ ] Verify database connection from web service
  - [ ] Take initial backup

- [ ] **Monitoring**
  - [ ] Verify Sentry error capture working
  - [ ] Verify health check endpoint returns 200
  - [ ] Set up uptime monitoring (e.g., UptimeRobot, Better Uptime)
  - [ ] Set up CSP violation report collection

- [ ] **Verification**
  - [ ] Smoke test: Register new user
  - [ ] Smoke test: Create a task
  - [ ] Smoke test: Invite team member
  - [ ] Smoke test: Password reset flow
  - [ ] Smoke test: File upload/download
  - [ ] Verify email notifications work

---

## Post-Launch (First Week)

- [ ] Monitor error rates in Sentry
- [ ] Monitor response times and API latency
- [ ] Verify rate limiting working (review logs)
- [ ] Verify audit logs being populated
- [ ] Review CSP violation reports
- [ ] Review webhook delivery logs
- [ ] Verify backup jobs ran successfully
