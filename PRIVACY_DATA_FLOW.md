# Privacy & Data Flow — WorkManager

> **Date:** July 30, 2026  
> **Version:** 1.0

---

## Data Classification

| Category | Examples | Classification | Retention |
|----------|----------|---------------|-----------|
| **Personally Identifiable Information (PII)** | Email, name, phone, IP address | **Sensitive** | Indefinite (until account deletion) |
| **Authentication Secrets** | Password hash, session tokens, 2FA secret | **Critical** | Password: stored until changed. Sessions: 7 days. |
| **Authentication Metadata** | Last login IP, last login time | **Sensitive** | Indefinite (audit purposes) |
| **Organization Data** | Org name, settings, domain | **Business Confidential** | Indefinite (until org deletion) |
| **Task Data** | Title, description, comments, attachments | **Business Confidential** | Indefinite (until task deletion) |
| **Audit Logs** | User ID, action, timestamps, old/new values | **Sensitive** | Partitioned by month, retained per org policy |
| **Webhook Secrets** | HMAC signing keys | **Critical** | Until webhook is deleted |
| **API Keys** | Third-party service credentials | **Critical** | Until integration is deleted |

---

## Data Flow Diagrams

### 1. Authentication Flow

```
User Browser                  Next.js                     PostgreSQL
    │                           │                            │
    │  POST /api/auth/sign-in   │                            │
    │──────────────────────────▶│                            │
    │                           │  SELECT user by email      │
    │                           │───────────────────────────▶│
    │                           │  User record               │
    │                           │◀───────────────────────────│
    │                           │                            │
    │                           │  Verify bcrypt hash        │
    │                           │                            │
    │                           │  INSERT session            │
    │                           │───────────────────────────▶│
    │                           │  Session created           │
    │                           │◀───────────────────────────│
    │                           │                            │
    │  Set-Cookie: session_token│                            │
    │  (httpOnly, secure, samesite=lax)                      │
    │◀──────────────────────────│                            │
    │                           │                            │
```

**PII involved:** Email (POST body), IP address (logged in session)
**Storage:** Password hash → `users.password_hash`, Session → `sessions` table
**Encryption:** TLS in transit. Passwords bcrypt-hashed at rest.

### 2. Task CRUD Flow

```
User Browser                  Next.js                     PostgreSQL
    │                           │                            │
    │  POST /api/tasks          │                            │
    │  {title, description,     │                            │
    │   assignedTo, ...}        │                            │
    │──────────────────────────▶│                            │
    │                           │  requireAuth()             │
    │                           │  requirePermission()       │
    │                           │  Zod schema validation     │
    │                           │  sanitizeHtml(description) │
    │                           │                            │
    │                           │  INSERT task               │
    │                           │───────────────────────────▶│
    │                           │  Task created              │
    │                           │◀───────────────────────────│
    │                           │                            │
    │                           │  createAuditEntry()        │
    │                           │───────────────────────────▶│
    │                           │                            │
    │  201 { task }             │                            │
    │◀──────────────────────────│                            │
```

**PII involved:** User ID (created_by, assigned_to)
**Data at rest:** Task description (sanitized HTML), audit log entries
**Encryption:** TLS in transit

### 3. Email Notification Flow

```
Next.js App                   Resend API                 User Email
    │                           │                            │
    │  sendEmail({              │                            │
    │   to, subject, html })    │                            │
    │──────────────────────────▶│                            │
    │                           │  Send via SMTP/API         │
    │                           │───────────────────────────▶│
    │                           │                            │
    │  Delivery receipt         │                            │
    │◀──────────────────────────│                            │
```

**PII exposed:** Email address (to/from), user name (in email body)
**Data at rest:** Not stored locally (fire-and-forget)
**Note:** Email content is not stored in application database

### 4. File Upload Flow (S3/MinIO)

```
User Browser            Next.js                   S3/MinIO
    │                       │                        │
    │  Request upload URL   │                        │
    │──────────────────────▶│                        │
    │                       │  Generate presigned PUT│
    │                       │───────────────────────▶│
    │                       │  Presigned URL         │
    │                       │◀───────────────────────│
    │  Presigned URL        │                        │
    │◀──────────────────────│                        │
    │                       │                        │
    │  PUT file directly    │                        │
    │───────────────────────────────────────────────▶│
    │                       │                        │
    │  Confirm upload       │                        │
    │──────────────────────▶│                        │
    │                       │  INSERT attachment     │
    │                       │  record in DB          │
```

**PII involved:** File metadata (user_id, file_name)
**Data at rest:** File content in S3/MinIO, metadata in PostgreSQL
**Access control:** Presigned URLs (time-limited), RBAC for metadata

---

## Data Deletion

| Data | Deletion Mechanism | Cascade |
|------|-------------------|---------|
| User account (soft delete) | `users.deletedAt` set | Associated tasks orphaned (not deleted) |
| User account (hard delete) | Admin API | Fails if user has active tasks/projects |
| Task (soft delete) | `tasks.deletedAt` set | Comments, attachments, history preserved |
| Task (hard delete) | `DELETE` API | Cascades: comments, attachments, checklist, time entries, assignees, watchers, dependencies |
| Session | On logout or status change | Immediate |
| Audit logs | Monthly partition | Dropped per retention policy |
| Webhook subscriptions | Soft delete | Fail delivery gracefully |

---

## PII Access Points

| API Endpoint | PII Accessed | Auth Required | Permission Required |
|-------------|-------------|---------------|-------------------|
| `GET /api/users` | Name, email, phone, department | ✅ | `user:view` |
| `GET /api/users/[id]` | Name, email, phone, department | ✅ | `user:view` |
| `PATCH /api/users/[id]` | Name, email, phone | ✅ | `user:edit` |
| `GET /api/tasks` | User IDs (created_by, assigned_to) | ✅ | `task:view` |
| `GET /api/audit*` | User IDs, IP addresses, old/new values | ✅ | `audit:view` |
| `GET /api/export*` | Names, emails | ✅ | Varies by module |

---

## Compliance Considerations

### GDPR
- ✅ Right to access: `GET /api/users/me`
- ✅ Right to rectification: `PATCH /api/users/me`
- ✅ Right to erasure: Admin API for account deletion
- ✅ Right to data portability: Export endpoints
- ⚠️ Consent management: Not yet implemented (newsletter, marketing)
- ⚠️ Data Processing Agreement: Must be signed with Resend, Sentry

### SOC 2
- ✅ Access controls (RBAC)
- ✅ Audit logging
- ✅ Change management (Git + CI)
- ✅ Incident response (Sentry alerts)
- ⚠️ Formal backup restore testing needed
