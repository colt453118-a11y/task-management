# Negative Test Plan — WorkManager

> **Date:** July 30, 2026  
> **Status:** 208 security regression tests already passing; this plan documents coverage gaps for additional scenarios.

---

## Scope

This document describes negative/abuse test scenarios beyond the existing 208 automated security tests. Tests are organized by attack surface.

---

## Existing Coverage (208 tests)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `csrf.test.ts` | 21 | Origin/referer validation, error responses |
| `rate-limit.test.ts` | 20 | IP extraction, key building, fail-open, headers |
| `sanitize.test.ts` | 38 | HTML sanitization, dangerous tags, event handlers, URI schemes |
| `auth-negative.test.ts` | 10 | Login rate limiting, user status, AuthError |
| `csv-sanitization.test.ts` | 24 | Formula injection prevention |
| `validation.test.ts` | 70 | Task transitions, file upload, mass assignment |
| `task-visibility.test.ts` | 25 | Permission scoping, role-aware access |
| **Total** | **208** | |

---

## Negative Test Scenarios to Add

### API Authentication & Authorization

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N1 | Call authenticated endpoint without session cookie | 401 | P1 | `auth-negative.test.ts` |
| N2 | Call authenticated endpoint with expired session | 401 | P1 | `auth-negative.test.ts` |
| N3 | Call authenticated endpoint with tampered session token | 401 | P1 | `auth-negative.test.ts` |
| N4 | Access another org's task by ID (IDOR) | 403 or empty | P1 | `task-visibility.test.ts` |
| N5 | Suspended user calls any API | 403 | P1 | `auth-negative.test.ts` |
| N6 | Deactivated user calls any API | 403 | P1 | `auth-negative.test.ts` |
| N7 | User without `task:create` calls POST /api/tasks | 403 | P1 | New |
| N8 | User without `user:deactivate` calls PATCH user status | 403 | P1 | New |
| N9 | User deactivates own account | 403 | P1 | New |

### Rate Limiting Abuse

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N10 | Exceed login rate limit (6th request in 60s) | 429 | P1 | Existing |
| N11 | Exceed registration rate limit (4th in 60s) | 429 | P1 | New |
| N12 | Exceed task creation rate limit (31st in 60s) | 429 | P2 | New |
| N13 | Exceed comment rate limit (21st in 60s) | 429 | P2 | New |
| N14 | Rapid concurrent login attempts from different IPs | Each IP limited separately | P2 | New |

### CSRF & Request Forgery

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N15 | POST with malicious Origin header | 403 | P1 | Existing |
| N16 | POST from subdomain not in trusted origins | 403 | P1 | Existing |
| N17 | GET with malicious Origin (should not block) | 200 | P2 | Existing |
| N18 | Mutation with missing both Origin and Referer | 401 (auth layer catches) | P2 | New |

### Input Validation & XSS

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N19 | Task description with nested script tag | Script stripped | P1 | Existing |
| N20 | Task description with polyglot XSS (SVG+onload) | Onload stripped | P1 | Existing |
| N21 | Comment with `javascript:` URL in href | URL sanitized | P1 | Existing |
| N22 | Task creation with `__proto__` mass assignment | Fields outside schema rejected | P1 | Existing (Zod strict) |
| N23 | File upload with double extension attack | Rejected by extension check | P1 | Existing |

### Session Management

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N24 | Use session from deactivated user | Rejected at auth middleware | P1 | Existing |
| N25 | Reuse reset-password token after password changed | Invalid token | P2 | New |
| N26 | Submit request with missing/invalid CSRF token (if applicable) | 403 | P2 | New |
| N27 | Submit password reset with expired token | 400 | P2 | New |

### Webhook Security

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N28 | Deliver webhook to non-existent URL | Logged as failure, no crash | P2 | New |
| N29 | Deliver webhook with invalid HMAC signature | Recipient rejects | P2 | New |
| N30 | Webhook delivery timeout (slow endpoint) | Aborted after 10s | P2 | New |
| N31 | Webhook delivery to internal IP (SSRF) | Should be blocked | P2 | New |

### Data Integrity

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N32 | Update task with non-existent status value | 400 (Zod validation) | P2 | New |
| N33 | Delete task that doesn't exist | 404 | P2 | New |
| N34 | Create task with future date in the past (impossible) | Zod accepts valid range | P3 | New |
| N35 | Concurrent task status update (race condition) | Last-write-wins (acceptable) | P3 | New |

### Infrastructure

| # | Scenario | Expected | Priority | Test File |
|---|----------|----------|----------|-----------|
| N36 | Health check when database is down | 503, specific error | P2 | New |
| N37 | Rate limiting when Redis is unavailable | Fail-open (200) | P2 | Existing |
| N38 | Request with oversized body (>5MB) | 413 | P2 | New |
| N39 | Request with malicious User-Agent | Logged, request processed | P3 | New |

---

## Priority Summary

| Priority | Count | Must-have before launch |
|----------|-------|------------------------|
| **P1** | 14 | ✅ Covered by existing tests (N1-N9, N10, N15-N23) |
| **P2** | 16 | ⚠️ Partial coverage — next sprint |
| **P3** | 4 | 🔄 Deferred |
| **Total** | **34** | |

---

## Test Implementation Notes

### API Integration Test Pattern
```typescript
// Pattern for testing authenticated endpoints without session
it('returns 401 without session cookie', async () => {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'test' }),
  });
  expect(res.status).toBe(401);
});

// Pattern for testing permission denied
it('returns 403 for unauthorized action', async () => {
  const { token } = await createUserWithRole('viewer');
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `better-auth.session_token=${token}`,
    },
    body: JSON.stringify({ title: 'test' }),
  });
  expect(res.status).toBe(403);
});
```
