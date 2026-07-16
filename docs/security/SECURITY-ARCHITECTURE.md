# Security Architecture — Enterprise Work Management Platform

## Security Philosophy

- **Defense in depth** — Multiple security layers, no single point of failure
- **Zero Trust** — Verify every request, regardless of origin
- **Least privilege** — Minimum permissions required for each operation
- **OWASP Top 10 compliance** — Proactive protection against all OWASP categories

---

## Security Layers

```
Layer 1: INFRASTRUCTURE
├── WAF (Cloudflare/AWS WAF)
├── DDoS Protection
├── TLS 1.3 (HTTPS everywhere)
├── Security Headers (HSTS, CSP, X-Frame-Options)
└── Network Isolation (VPC, private subnets)

Layer 2: APPLICATION
├── Authentication (Better Auth)
├── Authorization (RBAC)
├── Input Validation (Zod)
├── CSRF Protection
├── Rate Limiting
├── Session Management
└── API Security (API keys, webhooks)

Layer 3: DATA
├── Encryption at Rest (PostgreSQL TDE)
├── Encryption in Transit (TLS)
├── Parameterized Queries (SQL injection prevention)
├── Row-Level Security (Multi-tenant isolation)
└── Secrets Management (environment variables, vault)

Layer 4: OPERATIONS
├── Audit Logging
├── Monitoring & Alerting
├── Vulnerability Scanning
├── Dependency Scanning
├── Penetration Testing
└── Incident Response Plan
```

---

## 1. Authentication Architecture

```typescript
// Authentication Flow
┌─────────┐     ┌──────────┐     ┌───────────┐     ┌────────────┐
│ Browser │────▶│ Next.js  │────▶│ Better Auth│────▶│ PostgreSQL │
│         │     │ Middleware│     │            │     │            │
└─────────┘     └──────────┘     └───────────┘     └────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ Session Token │
              │ (httpOnly     │
              │  cookie)      │
              └──────────────┘
```

### Authentication Methods

| Method           | Implementation                         | Status     |
| ---------------- | -------------------------------------- | ---------- |
| Email & Password | Better Auth with bcrypt/scrypt hashing | ✅ Primary |
| Google OAuth     | Better Auth OAuth plugin               | ✅ Phase 1 |
| Microsoft OAuth  | Better Auth OAuth plugin               | ✅ Phase 1 |
| Magic Link       | Better Auth magic link plugin          | ✅ Phase 2 |
| SSO (SAML/OIDC)  | Better Auth SSO plugin                 | 🔄 Phase 3 |
| Two-Factor Auth  | Better Auth 2FA plugin (TOTP)          | ✅ Phase 2 |

### Session Security

```typescript
// Session configuration
{
  session: {
    strategy: 'jwt' | 'database',     // JWT for stateless, DB for revocation
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    updateAge: 24 * 60 * 60 * 1000,    // Refresh every 24 hours

    cookie: {
      name: 'session_token',
      httpOnly: true,                   // Not accessible via JS
      secure: true,                     // HTTPS only
      sameSite: 'lax',                  // CSRF protection
      path: '/',
    },
  },
}
```

### Password Policies

```typescript
{
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    historyCheck: 5,                    // Prevent reuse of last 5 passwords
    maxAge: 90 * 24 * 60 * 60 * 1000,  // Force reset every 90 days
    lockoutThreshold: 5,                // Lock after 5 failed attempts
    lockoutDuration: 15 * 60 * 1000,    // 15 minute lockout
  }
}
```

---

## 2. Authorization (RBAC)

### Permission Check Flow

```typescript
// Middleware-level check
// middleware.ts
export async function middleware(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return redirect('/login');

  // Check route-level permission
  const pathPermissions = getPathPermissions(request.nextUrl.pathname);
  if (pathPermissions && !hasPermission(session, pathPermissions)) {
    return redirect('/403');
  }
}

// Service-level check
// task.service.ts
async function updateTaskStatus(taskId: string, newStatus: string, userId: string) {
  const permission = await checkPermission(userId, 'task:update');
  if (!permission.allowed) {
    auditLog.warn('PERMISSION_DENIED', { userId, action: 'task:update', taskId });
    throw new AuthorizationError(permission.reason);
  }
  // ... proceed
}

// Row-level check (RLS)
// PostgreSQL Row-Level Security
CREATE POLICY task_access ON tasks
  USING (
    organization_id = current_setting('app.current_org_id')::UUID
    AND (
      assigned_to = current_setting('app.current_user_id')::UUID
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = current_setting('app.current_user_id')::UUID
        AND p.code IN ('task:view_all', 'admin')
      )
    )
  );
```

---

## 3. Input Validation & Sanitization

### Validation (Zod)

Every API route validates input through Zod schemas with `.strict()` mass-assignment protection. Schemas exist for all entity types (tasks, projects, teams, departments, roles, users, comments, attachments, time entries). Update schemas use optional fields so clients can send partial updates.

### HTML Sanitization (DOMPurify)

Rich text content (task descriptions) is sanitized using `isomorphic-dompurify` on both server (before storage) and client (before render).

```typescript
// lib/sanitize.ts — Server-safe HTML sanitization
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'pre',
      'code',
      'blockquote',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'img',
      'figure',
      'figcaption',
      'hr',
      'span',
      'div',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'colspan', 'rowspan'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeRichText(content: string | null | undefined): string | null {
  if (content === null || content === undefined) return null;
  const sanitized = sanitizeHtml(content);
  return sanitized || null;
}
```

### Application in API routes

Task descriptions are sanitized before storage in both `POST /api/tasks` and `PATCH /api/tasks/[id]`. The update route preserves the `undefined` sentinel — only sanitizing when `description` is explicitly provided in the request body, so unrelated field updates don't inadvertently clear the description.

### Client-side defense-in-depth

The `RichTextViewer` component also sanitizes before rendering with `dangerouslySetInnerHTML`, providing a second layer of protection if content bypasses server-side sanitization.

---

## 4. CSRF Protection

```typescript
// Next.js Server Actions have built-in CSRF protection
// For API routes, use double-submit cookie pattern
import { csrf } from '@/lib/csrf';

export async function POST(request: Request) {
  // Validate CSRF token
  await csrf.validate(request);

  // Proceed with request
}
```

---

## 5. Rate Limiting

### Implementation

Redis-backed sliding-window rate limiting using `INCR` + `EXPIRE`. The rate limit module is at `lib/api/rate-limit.ts` and is integrated into:

- **`withAuth` middleware** — accepts optional rate limit config per route (user-based key by default)
- **`withRateLimit` wrapper** — for unauthenticated endpoints (login, register) — IP-based key
- **Standalone `checkRateLimit`** — for the public health endpoint (IP-based, 60 req/min)

### Presets

| Preset      | Rate    | Window | Key Strategy |
| ----------- | ------- | ------ | ------------ |
| `login`     | 5 req   | 60s    | IP           |
| `create`    | 30 req  | 60s    | User         |
| `mutate`    | 60 req  | 60s    | User         |
| `comment`   | 20 req  | 60s    | User         |
| `read`      | 100 req | 60s    | User         |
| `sensitive` | 20 req  | 60s    | User         |
| `health`    | 60 req  | 60s    | IP           |

### Design decisions

- **Fail-open**: Requests proceed if Redis is unavailable (availability > strict rate limiting)
- **Auto-reconnecting Redis client**: Built-in reconnection loop (redis@4) — logged but not nulled
- **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` on 429 responses
- **Fail-safe `Retry-After`**: Ensures minimum 1-second retry delay

---

## 6. File Upload Security

```typescript
// lib/storage/virus-scanner.ts
// Configuration for secure file uploads
{
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // .xlsx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'text/plain', 'text/csv',
    'application/zip',                                                 // For project exports
  ],
  maxFileSize: 50 * 1024 * 1024,    // 50 MB
  virusScanEnabled: true,            // ClamAV integration
  scanBeforeStorage: true,           // Block upload if infected
  thumbnailGeneration: true,         // For images
}
```

---

## 7. Audit Logging

Every security-relevant action is logged:

```typescript
// Audit events
AUTH_EVENTS = [
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'auth.token.refresh',
  'auth.mfa.enabled',
  'auth.mfa.disabled',
  'auth.password.changed',
  'auth.password.reset',
  'auth.session.revoked',
];

ADMIN_EVENTS = [
  'admin.user.created',
  'admin.user.deactivated',
  'admin.user.suspended',
  'admin.user.archived',
  'admin.user.role.changed',
  'admin.role.created',
  'admin.role.modified',
  'admin.settings.changed',
];

DATA_EVENTS = [
  'task.created',
  'task.deleted',
  'project.created',
  'project.deleted',
  'task.assigned',
  'task.status.changed',
  'task.closed',
  'task.reopened',
];
```

---

## 8. API Security

```typescript
// API middleware chain
export const apiMiddleware = [
  rateLimiter,              // Rate limiting
  authenticate,             // JWT/Bearer token validation
  csrfProtection,           // CSRF for state-changing requests
  requestValidation,        // Zod schema validation
  auditLogger,              // Log the request
];

// API Key authentication for webhooks
POST /api/v1/webhooks/task-updates
Authorization: Bearer whsec_xxxxxxxxxxxxx
```

---

## 9. Security Headers

```typescript
// next.config.ts
{
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; connect-src 'self' https://api.openai.com;" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
}
```

---

## 10. Secrets Management

```env
# .env.example — NEVER commit actual secrets
# Development: .env.local
# Production: Secrets Manager / Vault

# Database
DATABASE_URL="postgres://user:pass@host:5432/db"

# Auth
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
AUTH_MICROSOFT_ID=""
AUTH_MICROSOFT_SECRET=""

# Redis
REDIS_URL="redis://:password@host:6379"

# Storage
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_BUCKET=""
S3_REGION="us-east-1"

# AI
OPENAI_API_KEY=""

# Email
RESEND_API_KEY=""

# Search
MEILISEARCH_API_KEY=""

# Monitoring
SENTRY_DSN=""
```

---

## 11. OWASP Top 10 Compliance

| OWASP Category                     | Mitigation                                                               |
| ---------------------------------- | ------------------------------------------------------------------------ |
| **A01: Broken Access Control**     | RBAC + RLS + permission middleware                                       |
| **A02: Cryptographic Failures**    | TLS 1.3, bcrypt for passwords, AES-256 for data at rest                  |
| **A03: Injection**                 | Parameterized queries (Drizzle), Zod input validation, HTML sanitization |
| **A04: Insecure Design**           | Rate limiting, audit logs, secure defaults                               |
| **A05: Security Misconfiguration** | Security headers, CSP, automated config scanning                         |
| **A06: Vulnerable Components**     | Dependabot, `npm audit`, Snyk scanning in CI                             |
| **A07: Auth Failures**             | Better Auth with MFA, session management, password policies              |
| **A08: Data Integrity Failures**   | Signed webhooks, checksums for files, audit trail                        |
| **A09: Logging Failures**          | Comprehensive audit logging, Sentry alerts                               |
| **A10: SSRF**                      | Outbound request allowlisting, URL validation                            |

---

## 12. Backup & Disaster Recovery

```yaml
# Backup Strategy
database:
  schedule: Every 6 hours
  retention: 30 daily + 12 monthly
  type: pg_dump + WAL archiving
  encryption: AES-256-GCM
  storage: S3 (separate region)

files:
  schedule: Continuous (S3 versioning)
  retention: 90 days

recovery:
  rpo: 6 hours (point-in-time recovery)
  rto: 2 hours (database restore)
  rto: 4 hours (full system restore)
```

---

## 13. Compliance Readiness

- **SOC 2** — Audit logs, access controls, change management
- **GDPR** — Data deletion, export, consent management
- **HIPAA** — (Future) BAA required, encryption, audit trail
- **ISO 27001** — Information security management system
