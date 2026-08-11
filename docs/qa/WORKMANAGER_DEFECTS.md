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

---

## [WM-005] RBAC gap — Slack integration + search reindex had no permission check

**Severity:** P2 (any org member could change an org-wide integration / trigger maintenance)
**Module:** Settings / Search · **Route:** `GET/POST/DELETE /api/settings/slack`, `POST /api/settings/slack/test`, `POST /api/settings/slack/preview`, `POST /api/search/reindex`

### Finding
These routes used only `withAuth` (authentication) with **no `requirePermission`**, unlike the peer `settings/ai` (`settings:view`/`settings:manage`) and `webhooks` (`integration:*`). So any authenticated org member — including a **`viewer`** — could create/update/delete the org's Slack webhook, send test/preview messages, or trigger a full Meilisearch reindex.

### Evidence (live, low-priv `viewer` user)
Controls behaved: `GET /api/tasks` → 200, gated `POST /api/departments` → 403. Gaps: `POST /api/settings/slack` → **400** (reached validation), `POST /api/search/reindex` → **500** (reached reindex logic) — both *past* authorization.

### Fix
Added `requirePermission(user.id, 'settings:manage')` to all mutating Slack routes + reindex, and `'settings:view'` to Slack GET. The Slack webhook was already restricted to `hooks.slack.com` (SSRF-safe). Post-fix: `viewer` → **403** on all; admin (has `settings:manage`) → 200.

### Verification — FIXED + VERIFIED (see also WM-006, required for the bubbled checks to return 403)

---

## [WM-006] `withAuth` swallowed handler-thrown errors → 500 instead of 401/403

**Severity:** P2 (authorization *worked* — wrong status; and it silently defeated WM-005-style checks placed before a route's own try)
**Module:** Auth wrapper · **File:** `apps/web/src/lib/auth/api-auth.ts`

### Finding
`withAuth` ran the handler via `return permissionStorage.run(async () => handler(...))` **without `await`**. Its `try/catch` — whose whole purpose is to map `AuthError → 401/403` — therefore never caught errors thrown *inside* the handler; they escaped as an unhandled rejection and surfaced as a generic **500**. Any `requirePermission`/`enforceOrgScope` that bubbled (rather than being caught locally by `handleApiError`) returned 500. Discovered while fixing WM-005: the new `requirePermission` calls in `search/reindex` + `settings/slack/{test,preview}` returned 500, and the dev log showed the `AuthError` was thrown but mis-mapped.

### Fix
`return await permissionStorage.run(...)` — one word, so the wrapper's `try/catch` catches handler errors and maps them correctly.

### Regression test
`apps/web/src/lib/auth/__tests__/with-auth.test.ts` — a handler throwing `AuthError(403)` → 403 (fails if `await` is removed); 401 case; success pass-through.

### Verification — FIXED + VERIFIED
Post-fix live: `viewer` → **403** on all four WM-005 endpoints; admin → 200; unauthenticated still blocked. `typecheck` + **1542 unit tests** + `build` + `lint` green.

---

## [WM-007] Outbound webhooks are an SSRF vector — no guard on the user-supplied URL

**Severity:** P2 (server-side request forgery; a low-priv target is the cloud metadata endpoint / internal services)
**Module:** Webhooks · **Files:** `apps/web/src/app/api/webhooks/route.ts`, `apps/web/src/lib/webhooks/deliver.ts`, `apps/web/src/lib/webhooks/url-guard.ts` (new)

### Finding
Webhook subscriptions store a user-supplied URL that the **server** later fetches. Create/update (`POST`/`PATCH /api/webhooks`) validated the URL only with `new URL(url)` — a syntax check that happily accepts `http://169.254.169.254/…` (cloud instance-metadata / IAM credentials), `http://127.0.0.1:9200/…` (internal Elasticsearch/admin), and RFC-1918 hosts. The delivery path (`deliver.ts`) then `fetch`ed that URL with default redirect-following, so even a public URL could 30x-redirect into the same internal targets. Classic SSRF: the app server becomes a proxy into the private network / metadata plane.

### Fix
New `isPublicWebhookUrl()` guard (`url-guard.ts`) rejects non-`http(s)` schemes and any host that is loopback, `0.0.0.0/8`, RFC-1918 (`10/8`, `172.16/12`, `192.168/16`), link-local `169.254/16` (incl. `169.254.169.254`), multicast/reserved, `localhost`/`*.localhost`, and IPv6 loopback/ULA/link-local. Applied at **create + update** (returns the specific reason as a 400 `VALIDATION_ERROR`) and **again at delivery time** (defense in depth — a subscription may predate the guard). Delivery now also sets `redirect: 'error'` so a 30x can't bounce into an internal target. Documented limitation: this blocks *literal* private hosts, not DNS-rebinding (public host that resolves to a private IP); redirect-blocking narrows that, and connect-time IP pinning is a tracked follow-up.

### Regression test
`apps/web/src/lib/webhooks/__tests__/url-guard.test.ts` — 21 cases: blocks localhost/`127.0.0.1`/`169.254.169.254`/all RFC-1918/`0.0.0.0`/`[::1]` and non-http(s) schemes (`ftp`/`file`/`gopher`); allows `hooks.slack.com`/`example.com`/`172.32.0.1` (just outside `172.16/12`); rejects empty/non-string.

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1563 unit tests** (21 new) + `lint` + `build` all green.
