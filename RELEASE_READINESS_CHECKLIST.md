# Release Readiness Checklist — WorkManager

> **Original:** July 30, 2026 (`chore/cleanup-dead-code-css-deps`, PR #44)
> **Re-verified:** 2026-08-21 on `main` `f815ef9` (see update below)

---

## Update — 2026-08-21 (harden re-verify on current `main`)

Verified fresh end-to-end this pass (`cross-check` green):

- **Tests:** unit **1618/1618**, integration **15/15** (real DB, org-isolation +
  concurrency invariants), E2E green in CI across chromium/firefox/mobile.
- **Build:** prod build clean; all dashboard routes server-render.
- **Live-smoke:** authed walk of every page + a real DB mutation round-trip → **0
  console/page errors**.
- **Perf:** the LCP-RSC rollout is **complete** — every `(dashboard)` page now
  server-renders its initial data (LCP ~160–260 ms, down from 0.7–2.0 s;
  full write-up `docs/perf/LCP-RSC-ROLLOUT.md`).
- **Security hardening since the QA engagement:** SSRF guard now IP-pins outbound
  webhook/Slack fetches at connect time (DNS-rebind) **and** decodes IPv4-in-IPv6
  bypasses (`::ffff:169.254.169.254`, NAT64) + CGNAT (PRs #145/#158).
- **P1 fixed this pass:** the deploy blueprint set `AUTH_SECRET` but Better Auth
  read only `BETTER_AUTH_SECRET` → prod login would have 500'd on day one. Now
  honors either (PR #160), **proven** with an AUTH_SECRET-only prod boot.

Multi-tenant (org) isolation is **proven** (cross-org denied, tested under
concurrency) — the July "no `tenant_id`" caveat is superseded; org scoping exists.
Still operational-only (configure at `go-live`, not code blockers): **prod secrets,
DB backups proven, data-retention policy.**

---

## 1. Code Quality

| Criteria | Status | Notes |
|----------|--------|-------|
| TypeScript compilation | ✅ 0 errors | `tsc --noEmit` clean across all packages |
| Lint | ✅ Pass | ESLint configured with `typescript-eslint` |
| Unit tests | ✅ 208 security tests passing | Coverage: CSRF, rate limiting, sanitization, auth negative, CSV |
| Integration tests | ✅ Pass | Database tests with PostgreSQL service container |
| E2E tests | ✅ 571 passed, 0 failed | Chromium, Firefox, Mobile Chrome — 47 skipped (baseline) |
| No dead code | ✅ | Dead components/libs removed in PR #44 |
| No commented-out code | ✅ | Cleaned up in PR #44 |

## 2. Security

| Criteria | Status | Notes |
|----------|--------|-------|
| Dependency vulnerabilities | ✅ 0 critical, 1 high (accepted) | Fixed: next@16.2.11, postcss@8.5.25. Accepted: sharp/libvips CVEs transitive through next, mitigated by file upload validation |
| Authentication | ✅ | Better Auth, httpOnly session cookies, rate-limited login |
| Authorization (RBAC) | ✅ | Permission checks on all API routes |
| CSRF protection | ✅ | 3 layers: SameSite cookies, Origin/Referer validation, CSP |
| XSS prevention | ✅ | Whitelist-based HTML sanitization (server + client) |
| SQL injection prevention | ✅ | Parameterized queries via Drizzle ORM |
| Security headers | ✅ | CSP, HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy, COOP, CORP |
| Container hardening | ✅ | Non-root user, pinned images, internal networking |
| Rate limiting | ✅ | Redis-backed sliding window, fail-open graceful degradation |
| Audit logging | ✅ | All mutations logged with who/what/when |
| CSP violation reporting | ✅ | `report-uri /api/csp-violation` configured |

## 3. Infrastructure

| Criteria | Status | Notes |
|----------|--------|-------|
| Docker build | ✅ | Multi-stage, non-root user, standalone Next.js output |
| Docker compose (dev) | ✅ | PostgreSQL, Redis, MinIO, Meilisearch, Mailpit |
| Docker compose (prod) | ✅ | Internal networking, resource limits, health checks |
| Render.com blueprint | ✅ | `render.yaml` configured |
| Railway config | ✅ | `railway.json` configured |
| Resource limits | ✅ | Memory and CPU limits on all containers |
| Health checks | ✅ | Web, PostgreSQL, Redis, MinIO, Meilisearch |
| Migration strategy | ✅ | Drizzle Kit migrations, separate migrate service |

## 4. CI/CD

| Criteria | Status | Notes |
|----------|--------|-------|
| CI pipeline | ✅ | GitHub Actions: typecheck → test → lint |
| E2E pipeline | ✅ | Playwright across 3 browsers with PostgreSQL |
| Deploy pipeline | ✅ | Quality gates → Docker build → Render deployment |
| Dependabot | ✅ | Weekly scans for npm, Docker, GitHub Actions |
| Trivy scanning | ⚠️ Not in CI | Pending post-launch; manual scan available |

## 5. Monitoring & Observability

| Criteria | Status | Notes |
|----------|--------|-------|
| Error tracking | ✅ | Sentry configured (DSN required at deploy time) |
| Structured logging | ✅ | pino with JSON output |
| Audit logging | ✅ | All mutations tracked in `audit_logs` table |
| Health endpoint | ✅ | `GET /api/health` with DB + Redis probes |
| Rate limit headers | ✅ | `X-RateLimit-*` headers on all responses |

## 6. Data

| Criteria | Status | Notes |
|----------|--------|-------|
| Database backups | ⚠️ Not configured | Pending `go-live` setup |
| Encryption at rest | ✅ | AES-256-GCM for webhook secrets; bcrypt for passwords |
| Encryption in transit | ✅ | TLS in production |
| Soft delete | ✅ | Critical tables have `deleted_at` |
| Data retention | ⚠️ Not documented | Pending policy definition |

## 7. Operational Readiness

| Criteria | Status | Notes |
|----------|--------|-------|
| Runbook | ✅ | RUNBOOK_DR.md created |
| Incident response | ⚠️ Partial | Sentry alerts configured; no formal IR plan |
| Backup strategy | ⚠️ Not configured | Pending `go-live` |
| DNS & SSL | ✅ | Render provides managed TLS |
| Secrets management | ✅ | Environment variables + encryption.ts for DB secrets |

---

## Overall Verdict

**✅ GO for internal / single-org (or few trusted orgs) launch** after the
operational steps below — code is release-ready (QA verdict release-ready, no P0;
LCP + SSRF hardening done; the one P1 this pass, `AUTH_SECRET`, is fixed in #160):
1. Configuring production secrets (`AUTH_SECRET`, `ENCRYPTION_KEY`, `SENTRY_DSN`, `RESEND_API_KEY`)
2. Running database migrations and seed
3. Verifying health checks + a login in production (confirms the secret is set)
4. **Backups proven** (not just configured) — and, on a free-tier DB that
   auto-deletes after 90 days, a plan for persistent storage
5. Merging PR #160 first (so the blueprint's `AUTH_SECRET` actually works)

**❌ NO-GO for public multi-tenant SaaS** until:
1. Per-tenant rate limiting + usage quotas (limits are currently per-user/IP)
2. Billing / plan enforcement
3. Formal vulnerability-disclosure policy
   _(Org-level data isolation itself is present and proven — cross-org access is
   denied, tested under concurrency — so this is about SaaS commercial controls,
   not data-leak risk.)_
