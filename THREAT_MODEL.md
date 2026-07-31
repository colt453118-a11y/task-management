# Threat Model — WorkManager

> **Version:** 1.0  
> **Date:** July 30, 2026  
> **Applies to:** WorkManager task management platform (pre-launch)

---

## System Architecture Overview

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Browser     │────▶│   Next.js App   │────▶│  PostgreSQL   │
│  (Client)     │     │  (Server/API)    │     │  (Database)   │
└──────────────┘     └─────────────────┘     └──────────────┘
                           │        │                │
                           ▼        ▼                ▼
                    ┌──────────┐ ┌──────────┐  ┌──────────┐
                    │   Redis   │ │   S3     │  │  Sentry  │
                    │(Rate Lim)│ │(Files)   │  │(Monitoring)│
                    └──────────┘ └──────────┘  └──────────┘
                           │
                    ┌──────────┐
                    │Meilisearch│
                    │ (Search)  │
                    └──────────┘
```

---

## Trust Boundaries

| Boundary | Description | Trust Level |
|----------|-------------|-------------|
| **Browser ↔ Next.js** | Public internet. TLS encrypted. | Low |
| **Next.js ↔ PostgreSQL** | Docker internal network. No TLS between services. | High (internal) |
| **Next.js ↔ Redis** | Docker internal network. No auth by default. | High (internal) |
| **Next.js ↔ S3/MinIO** | Internal or VPC. Presigned URLs for uploads. | Medium |
| **Next.js ↔ Sentry** | Outbound HTTPS. DSN embedded in client bundle. | Medium |
| **Next.js ↔ Meilisearch** | Docker internal network. API key protected. | High (internal) |

---

## Assets

| Asset | Sensitivity | Storage | Encryption |
|-------|-------------|---------|------------|
| User passwords | **Critical** | PostgreSQL (bcrypt/scrypt via Better Auth) | Hashed (one-way) |
| Session tokens | **High** | PostgreSQL (sessions table) | httpOnly cookie, TLS |
| PII (name, email, phone) | **High** | PostgreSQL (users table) | TLS in transit |
| API keys (webhooks) | **High** | PostgreSQL (encrypted at rest) | AES-256-GCM via `encryption.ts` |
| Task data | **Medium** | PostgreSQL | TLS in transit |
| File uploads | **Medium** | S3/MinIO | SSE-S3 or server-side |
| Audit logs | **Medium** | PostgreSQL (partitioned) | TLS in transit |
| Reset tokens | **High** | PostgreSQL (verification_tokens) | Hashed by Better Auth |

---

## Threat Actors

| Actor | Access Level | Motivation |
|-------|-------------|------------|
| **Anonymous user** | Public pages only | Recon, information gathering |
| **Authenticated user (member)** | Own org data, own tasks | Data access beyond own scope (IDOR) |
| **Authenticated user (admin)** | Full org access | Privilege escalation |
| **External attacker** | Network-level | Exploit vulnerabilities, data exfiltration |
| **Malicious insider** | Valid credentials | Data theft, sabotage |
| **Third-party service** | API/webhook access | Compromise via integration |

---

## Threat Scenarios

### T1: Unauthenticated Access to Protected Routes
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Low |
| **Mitigation** | `proxy.ts` middleware redirects unauthenticated users. `withAuth()` middleware on all API routes returns 401. Session cookie is `httpOnly`. |
| **Residual Risk** | Low |

### T2: Cross-Organization Data Access (IDOR)
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Low |
| **Mitigation** | All queries enforce `WHERE organization_id = ?`. `requirePermission()` checks before any data access. `enforceOrgScope()` validates record org matches user org. |
| **Residual Risk** | Low |

### T3: Cross-Site Request Forgery (CSRF)
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Low |
| **Mitigation** | SameSite=Lax cookies block cross-site session cookies. Origin/Referer validation on all mutations. `form-action 'self'` CSP directive. |
| **Residual Risk** | Low |

### T4: Stored XSS via Rich Text
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Low |
| **Mitigation** | Server-side sanitization with `xss` library on all rich text fields. Client-side defense-in-depth in `RichTextViewer`. Blocked tags: script, iframe, object, embed, style, form, input. Blocked schemes: javascript:, data:, vbscript: |
| **Residual Risk** | Low |

### T5: Brute Force / Credential Stuffing
| Property | Value |
|----------|-------|
| **Risk** | Medium |
| **Likelihood** | Medium |
| **Mitigation** | Rate limiting: 5 req/min/IP for login, 3 req/min/IP for registration. Better Auth bcrypt/scrypt password hashing. |
| **Residual Risk** | Low |

### T6: Session Hijacking
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Low |
| **Mitigation** | httpOnly cookies (not accessible via JS). `secure` flag in production. SameSite=Lax. TLS everywhere. Session expires after 7 days, refreshes every 24h. Session revocation on deactivation/suspension. |
| **Residual Risk** | Low |

### T7: Privilege Escalation
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Low |
| **Mitigation** | `requirePermission()` checks at every API route. `requirePermission('role:assign')` for role changes. `requirePermission('user:deactivate')` for user status changes. Self-deactivation prevention. |
| **Residual Risk** | Low |

### T8: SQL Injection
| Property | Value |
|----------|-------|
| **Risk** | Critical |
| **Likelihood** | Low |
| **Mitigation** | Parameterized queries via Drizzle ORM. Zod input validation with `.strict()` on all API routes. No raw SQL strings. |
| **Residual Risk** | Low |

### T9: Dependency Vulnerability
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Medium |
| **Mitigation** | Dependabot weekly scans. pnpm overrides for transitive vulns. Regular `pnpm audit` runs. Pinned Docker base image tags. |
| **Residual Risk** | Low (post-fix) |

### T10: SSRF via Webhooks
| Property | Value |
|----------|-------|
| **Risk** | Medium |
| **Likelihood** | Low |
| **Mitigation** | Webhook URLs are user-configured. `dispatchWebhookEvent()` uses `fetch()` with `AbortController` (10s timeout). Internal services isolated via Docker network (no host port exposure). |
| **Residual Risk** | Medium — webhook destination URLs are not validated against allowlist |

### T11: Supply Chain via Docker Images
| Property | Value |
|----------|-------|
| **Risk** | High |
| **Likelihood** | Low |
| **Mitigation** | All base images pinned to specific digests/versions. Non-root user in runner. Multi-stage build (minimal prod image). |
| **Residual Risk** | Low |

### T12: Information Disclosure via Error Messages
| Property | Value |
|----------|-------|
| **Risk** | Medium |
| **Likelihood** | Low |
| **Mitigation** | Structured error responses (no stack traces). Health endpoint uses generic messages ("Caching service not configured" not "REDIS_URL not configured"). Auth errors don't reveal user existence. |
| **Residual Risk** | Low |

---

## Risk Matrix

| # | Threat | Impact | Likelihood | Risk | Mitigated |
|---|--------|--------|------------|------|-----------|
| T1 | Unauthenticated access | High | Low | Medium | ✅ |
| T2 | IDOR | High | Low | Medium | ✅ |
| T3 | CSRF | High | Low | Medium | ✅ |
| T4 | Stored XSS | High | Low | Medium | ✅ |
| T5 | Brute force | Medium | Medium | Medium | ✅ |
| T6 | Session hijacking | High | Low | Medium | ✅ |
| T7 | Privilege escalation | High | Low | Medium | ✅ |
| T8 | SQL injection | Critical | Low | Medium | ✅ |
| T9 | Dependency vuln | High | Medium | High | ✅ (fixed) |
| T10 | SSRF via webhooks | Medium | Low | Low | ⚠️ Partial |
| T11 | Supply chain | High | Low | Medium | ✅ |
| T12 | Info disclosure | Medium | Low | Low | ✅ |

---

## Attack Surface Map

```
Public (no auth required)
├── /auth/login, /auth/register, /auth/forgot-password, /auth/reset-password
├── /api/auth/* (Better Auth handler)
├── /api/health
└── /api/email/preview

Authenticated
├── /api/tasks/* (task CRUD)
├── /api/projects/* (project CRUD)
├── /api/users/* (user management)
├── /api/teams/* (team CRUD)
├── /api/departments/* (department CRUD)
├── /api/roles/* (role CRUD)
├── /api/permissions (permission listing)
├── /api/reports/* (report CRUD)
├── /api/webhooks/* (webhook management)
├── /dashboard/* (UI routes)
└── /api/notifications/* (notification management)

Admin-only
├── /api/users/[id]/status (deactivate/suspend)
├── /api/roles/* (role/permission management)
├── /api/settings/* (system settings)
└── /api/audit/* (audit log access)
```
