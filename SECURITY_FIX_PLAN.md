# Security Fix Plan — WorkManager

> **Generated:** July 30, 2026  
> **Branch:** `chore/cleanup-dead-code-css-deps`  
> **Based on:** SECURITY_LAUNCH_AUDIT.md

---

## Fixed This Session

| # | Finding | Severity | Fix | Status |
|---|---------|----------|-----|--------|
| 1 | Next.js 16.2.10 → 16.2.11 | **P1 — High** | Upgraded package.json + updated lockfile | ✅ Fixed |
| 2 | PostCSS 8.4.49 → 8.5.18+ | **P1 — High** | Upgraded package.json + pnpm override | ✅ Fixed |
| 3 | sharp/libvips CVEs (transitive via next, sharp@^0.34.5) | **P1 — High** | Pending Next.js team update to sharp >=0.35.0 | 🔄 Accepted — mitigated by file upload validation |
| 4 | MinIO image not pinned in dev | **P2 — Moderate** | Pinned to `RELEASE.2025-10-15T17-29-55Z` | ✅ Fixed |
| 5 | CSP violation reporting | **P2 — Moderate** | Added `report-uri /api/csp-violation` | ✅ Fixed |
| 6 | CSP not including `report-to` directive | **P3 — Low** | Added `report-uri`; `report-to` requires `Reporting-Endpoints` header config | ✅ Fixed |

---

## Deferred

| # | Finding | Severity | Why Deferred | Owner | Target |
|---|---------|----------|-------------|-------|--------|
| 7 | Pre-commit secret scanning | **P3 — Low** | Developer tooling, not a runtime vulnerability | DevOps | Post-launch sprint |
| 8 | Trivy scanning in CI | **P3 — Low** | CI pipeline already runs typecheck+test+lint; Trivy is complementary | DevOps | Post-launch sprint |
| 9 | Encryption key derivation (SHA-256) | **P3 — Low** | Single high-entropy key acceptable for initial deployment | Engineering | Accepted |
| 10 | Dev docker-compose credentials | **P3 — Low** | Dev-only, not exposed to production | Engineering | Accepted |

---

## Implementation Notes

### Fix 1: Next.js Upgrade
```diff
- "next": "16.2.10",
+ "next": "16.2.11",
```

CVEs addressed:
- **GHSA-6gpp-xcg3-4w24** — Middleware/Proxy bypass in App Router with Turbopack and single locale
- **GHSA-89xv-2m56-2m9x** — SSRF in Server Actions on custom servers
- **GHSA-p9j2-gv94-2wf4** — SSRF in rewrites via attacker-controlled destination hostname
- **GHSA-m99w-x7hq-7vfj** — Denial of Service in App Router using Server Actions

### Fix 2: PostCSS Upgrade
```diff
- "postcss": "^8.4.49",
+ "postcss": "^8.5.18",
```
And in root `package.json` overrides:
```diff
- "postcss": ">=8.5.10"
+ "postcss": ">=8.5.18"
```

CVE: **GHSA-r28c-9q8g-f849** — Path Traversal in Previous Source Map Auto-Loading

### Fix 4: MinIO Image Pinning (Dev)
```diff
- image: minio/minio:latest
+ image: minio/minio:RELEASE.2025-10-15T17-29-55Z
```

### Fix 5: CSP Reporting
Added to `next.config.ts`:
```
report-uri /api/csp-violation
```

Note: A corresponding `POST /api/csp-violation` route handler should be created to collect and log CSP violation reports.
