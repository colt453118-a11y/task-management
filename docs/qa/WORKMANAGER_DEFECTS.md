# WorkManager — Master QA Defect Log

Evidence-based defect log from the master system validation (branch: `main`).
Living document — appended as findings are confirmed. Severity: P0 (critical) →
P3 (cosmetic). See `../../.claude/plans/workmanager-master-dazzling-key.md` for scope.

---

## [WM-001] Leave approval/rejection & time-correction review are not atomic (balance corruption + state-machine bypass under concurrency)

**Severity:** P1
**Module:** Leave / Time Corrections
**Route:** `POST /api/leave-requests/[id]/approve`, `POST /api/leave-requests/[id]/reject`, `PATCH /api/time-corrections`
**Role:** manager (`time:manage`)
**Tenant:** any org
**Environment:** dev server + real PostgreSQL 17

### Preconditions
A pending leave request (`daysCount = 5`) with a matching `leave_balances` row (`used_days = 0`, `pending_days = 5`).

### Reproduction
Fire 15 concurrent `POST …/approve` for the same pending request.

### Expected
Exactly **one** approval succeeds (1×200, 14×400 `INVALID_STATE`); `used_days = 5` (single deduction).

### Actual (before fix — reproduced live)
```
status tally:  12 × 200   3 × 400
leave_balances: used_days = 15   pending_days = 0
```
→ the single request was **approved 12 times** (state-machine bypass) and the balance was **over-deducted 3×** (15 vs 5). Time-corrections shared the same check-then-act pattern (non-atomic entry-update → status-update; duplicate notifications).

### Root cause
Check-then-act with no atomicity: `SELECT … status='pending'` (check) followed by an **unconditional** `UPDATE … SET status='approved'` (act), plus a **non-atomic read-modify-write** on the balance (`usedDays: balance.usedDays + daysCount`). No `db.transaction`. Concurrent requests all pass the guard before any commits.

### Fix
Wrap each review in `db.transaction` and make the transition an **atomic conditional UPDATE** (`… WHERE id = ? AND status = 'pending' RETURNING *`) — under Postgres row locking only one concurrent caller matches a row; the rest get 0 rows → `INVALID_STATE`. Balance math uses **atomic SQL** (`used_days + n`, `GREATEST(0, pending_days - n)`), so increments can't be lost. Time-corrections: conditional transition + entry update in one transaction; `recalcTaskHours`/notifications run post-commit.
Files: `apps/web/src/app/api/leave-requests/[id]/{approve,reject}/route.ts`, `apps/web/src/app/api/time-corrections/route.ts`.

### Regression test
`apps/web/src/app/api/leave-requests/[id]/approve/__tests__/route.test.ts` — asserts the conditional-update contract (race-lost → 400 with **no** balance mutation; winner → 200 + balance moved; 404; already-reviewed). Existing time-corrections mocked tests updated for the transactional flow.

### Verification — FIXED + VERIFIED
Post-fix live burst: **1×200, 14×400, `used_days = 5`**. `typecheck` + **1530 unit tests** + `build` green.

---

## [WM-002] No real-database integration tests — DB-level bugs are structurally uncatchable (coverage gap)

**Severity:** P1 (test-integrity / process)
**Module:** Test infrastructure

### Finding
Every one of the ~1530 unit tests **mocks the database** (`vi.mock('@/lib/api/db')` / `@workmanagement/database`), including files named `*-integration*` and `*-e2e*`. No test exercises a real PostgreSQL connection. Consequently the suite cannot catch DB-level defects: race conditions (see WM-001), transaction/rollback behavior, constraint/FK violations, cascade behavior, or actual query correctness. "1530 tests pass" therefore overstates confidence in data-layer behavior.

### Evidence
`grep -rL "vi.mock.*(api/db|database)"` over tests importing `getDb`/`@workmanagement/database` → **0 real-DB tests**. WM-001 (a P1 data-corruption bug) passed the entire suite green.

### Recommended fix
Add a real-Postgres integration harness (the CI `test` job already provisions a Postgres service) that applies migrations to a throwaway DB and runs a small set of **data-integrity** integration tests — starting with concurrent leave/time-correction approvals, then tenant-isolation and constraint tests. Track as its own workstream.

### Verification status
OPEN (recommendation; not yet implemented).

---

## [WM-003] Cron/scheduled endpoints fail OPEN when `CRON_SECRET` is unset

**Severity:** P2 (unauthenticated trigger of scheduled work; no data disclosure)
**Module:** Cron / Automation
**Route:** `POST /api/cron/check-deadlines`, `POST /api/cron/generate-eod-snapshot`, `POST /api/automation/check-overdue`

### Finding
Two of the three scheduled endpoints guarded with `if (CRON_SECRET && authHeader !== CRON_SECRET && queryToken !== CRON_SECRET)`. When `CRON_SECRET` is **unset** (falsy) the whole condition is false, so the guard is skipped and the endpoint is **publicly triggerable — including in production**. An operator who forgets to set `CRON_SECRET` (it is not in the launch checklist) leaves deadline-notification, overdue-automation, and EOD-snapshot jobs open to anonymous triggering → notification/email spam, duplicate EOD snapshots, DoS. `check-overdue` already failed closed in production; the two cron routes did not.

### Evidence
`grep` of the guards (fail-open `&&` form) in `check-deadlines`/`generate-eod-snapshot`; `check-overdue` used the correct `!CRON_SECRET → dev-only` form.

### Fix
New shared gate `apps/web/src/lib/api/cron-auth.ts` → `isCronAuthorized(request)` that **fails closed**: no secret ⇒ allowed only outside production; configured ⇒ requires `Authorization: Bearer <secret>` or `?token=`/`?secret=`. All three routes now use it. Added `CRON_SECRET` to the production launch checklist.

### Regression test
`apps/web/src/lib/api/__tests__/cron-auth.test.ts` — 6 cases incl. "no secret + production → deny" and "secret set but none provided → deny".

### Verification — FIXED + VERIFIED
Unit tests 6/6; `typecheck`/`lint` green; live: dev endpoint still callable without a secret (dev path preserved) → 200.

---

## [WM-004] RBAC / cross-org denials returned 500 instead of 403/401

**Severity:** P2 (access is correctly denied — wrong status code, poor hygiene, pollutes error monitoring)
**Module:** API error handling (all routes)
**Route:** every `[id]` route using `enforceOrgScope`, and every route calling `requirePermission` inside its own `try`

### Finding
`handleApiError(error, message)` ignored the error type and always returned its default 500. `requirePermission` and `enforceOrgScope` throw `AuthError(…, 403)` (and `requireAuth` → 401); when these are thrown inside a route's own `try/catch` (rather than bubbling to the `withAuth` wrapper, which does handle them) they were masked as **500 INTERNAL_ERROR**. So a permission-denied or cross-org request returned 500 instead of 403.

### Evidence (live)
Org A admin → `GET /api/tasks/{Org B task}` returned **`500 {"code":"INTERNAL_ERROR"}`** (access was still denied and the row unchanged — no data leak). Mass-assignment (`organizationId`/`status`/`createdBy` injected) was correctly rejected **400** by the `.strict()` schema.

### Fix
`handleApiError` now re-maps `AuthError`-shaped errors (duck-typed on `name === 'AuthError'` + numeric `status`, to avoid a circular import) to their real status/code. Fixes it for all routes at once.

### Regression test
`apps/web/src/lib/api/__tests__/handle-api-error.test.ts` — AuthError 403 → 403, 401 → 401, generic Error → 500 with a generic (non-leaking) message.

### Verification — FIXED + VERIFIED
Post-fix live: cross-org `GET`/`DELETE` → **403 FORBIDDEN** ("Cross-organization access denied"). `typecheck` + **1539 unit tests** + `lint` green.

### Note — positive P0 result
Multi-tenant isolation (tasks) and mass-assignment defenses **hold**: cross-org access is denied and the `.strict()` Zod schemas reject injected fields. This WM-004 was a status-code/hygiene defect, not an isolation bypass.
