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

### Fix — RESOLVED (harness stood up)
New opt-in integration project `vitest.integration.config.ts` (node env, no DB mock, single-fork/serial) running `src/__integration__/**/*.test.ts` via `pnpm test:integration`; helpers (`__integration__/helpers/db.ts`) connect to the real `DATABASE_URL`, truncate + seed fixtures per test, and skip when no DB is configured. CI's `ci` job now runs `db:migrate` + `test:integration` against its Postgres service. Tests assert the real invariants under genuine concurrency: **WM-011** (partial unique index rejects a second concurrent running timer), **WM-014** (`recalcTaskHours` atomic recompute + concurrent-recompute convergence), **WM-013** (`wouldCreateCycle` over a live dependency graph incl. termination on a stored cycle), **WM-001** (12 concurrent leave approvals → exactly one wins, balance deducted once — mirrors the route's conditional-UPDATE transaction), and **multi-tenant isolation** (org-scoped queries never cross tenants; the real `enforceOrgScope` denies a cross-org row and fails closed on null). **On its first run the harness caught a real bug — see WM-015.**

### Verification status
RESOLVED — harness + **13 integration tests** green against real Postgres 17; wired into CI. (Grown 2026-08-13 with the WM-001 leave-approval-race and multi-tenant-isolation tests.)

---

## [WM-015] `isUniqueViolation` missed Drizzle-wrapped errors — raced-insert 409s silently returned 500

**Severity:** P2 (wrong status code under a concurrent-duplicate race; the fix for WM-011/WM-012's friendly 409 never actually fired)
**Module:** DB error handling · **File:** `apps/web/src/lib/db-errors.ts`
**Found by:** the WM-002 integration harness (first run)

### Finding
`isUniqueViolation(err, constraint)` read the SQLSTATE `code`/`constraint_name` off the **top level** of the error. But Drizzle throws a `DrizzleQueryError` that wraps the raw postgres.js error on **`.cause`** — so for a real raced insert, `err.code` is `undefined` and the check returns **false**. The WM-011 timer route and the WM-012 dependency/watcher/team-member routes all rely on this helper to map a raced unique-violation to a friendly **409**; because it never matched, those raced inserts fell through to `handleApiError` and returned a generic **500** instead. Data integrity was still protected (the unique index holds), but the intended status code was wrong. The helper's unit tests only fed it *synthetic* top-level errors (`{ code: '23505', … }`), so they passed while the real path was broken — exactly the gap WM-002 exists to close.

### Evidence
Integration test (`__integration__/running-timer.test.ts`): two concurrent running-timer inserts → the loser's `reason` had keys `['query','params','cause']`, `code: undefined`, and `cause.code === '23505'` / `cause.constraint_name === 'idx_time_entries_one_running_timer'`. `isUniqueViolation(reason, …)` returned `false`.

### Fix
`isUniqueViolation` now walks the (bounded, depth ≤ 5) `.cause` chain, matching the `23505` (and optional constraint name) wherever it appears — raw driver error or Drizzle-wrapped. Restores the intended 409 mapping for WM-011 and WM-012 without any route changes.

### Regression test
Integration test above (real raced insert → `isUniqueViolation` true, 1 running timer) + a unit case in `lib/__tests__/db-errors.test.ts` asserting a `{ cause: { code:'23505', constraint_name } }` wrapper matches.

### Verification — FIXED + VERIFIED
`typecheck` + unit suite + **8 real-DB integration tests** green; the running-timer race now maps correctly.

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

---

## [WM-008] SSE notification stream never re-checks auth — revoked/expired/deactivated users keep receiving live events

**Severity:** P2 (revocation bypass — session invalidation / account deactivation does not terminate an open stream)
**Module:** Notifications (real-time) · **Files:** `apps/web/src/app/api/notifications/sse/route.ts`, `apps/web/src/lib/notifications/stream-auth.ts` (new), `apps/web/src/lib/auth/api-auth.ts` (export `getUserStatus`)

### Finding
`GET /api/notifications/sse` authenticated **once** at the handshake (`getCurrentSession()`), then held the connection open indefinitely (15s heartbeat, 60s poll, LISTEN/NOTIFY push) with **no re-validation**. So after a user logs out (Better Auth deletes the session row), the session expires, or an admin deactivates the account (`DELETE /api/users/[id]` → `deletedAt`/`isActive:false`), an already-open browser tab **kept receiving that user's live notifications** until the tab happened to close — a server restart was the only other stop. Two gaps: (a) no mid-stream re-check; (b) the handshake only checked *session presence*, so a deactivated-but-still-logged-in user could even open a **fresh** stream.

### Fix
- New `revalidateStreamAuth(sessionId, userId)` (`lib/notifications/stream-auth.ts`): (1) session row still exists (missing ⇒ logged out/revoked), (2) not past `expiresAt`, (3) account still active — delegates to the now-exported canonical `getUserStatus` (soft-delete/suspend/deactivate). Fails closed on a session-lookup error (drop → client reconnects & re-auths).
- SSE route now (a) rejects the **handshake** with 403 if the account is inactive, and (b) runs `revalidateStreamAuth` on a **30s interval**; on any invalid result it emits an `expired` event and tears the stream down. Teardown refactored into one idempotent `cleanup()` (disposer array) shared by disconnect/enqueue-failure/revocation. Bounded revocation window ≤30s; after teardown the browser reconnects and is rejected at the handshake (401/403) → EventSource backoff → poll fallback.

### Regression test
`apps/web/src/lib/notifications/__tests__/stream-auth.test.ts` — 7 cases: valid; `session_revoked` (row gone); `session_expired`; `account_disabled` for soft-deleted / suspended / `isActive:false`; fail-closed on session-lookup throw.

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1570 unit tests** (7 new) + `lint` + `build` all green. Existing SSE tests (notification-listener 25, dashboard-sse-integration 8) still pass.

---

## [WM-009] Automation engine has no runaway/loop guard — one event can fan out to unbounded rule/action execution

**Severity:** P2 (resource-exhaustion amplification via misconfigured or malicious admin rules; latent infinite-loop risk)
**Module:** Automation · **File:** `apps/web/src/lib/automation/engine.ts`

### Finding
`evaluateAutomationRules(event, context)` runs **every** enabled rule matching a trigger, and each rule runs **all** of its actions — with **no cap** on rules-per-event, actions-per-event, or any trigger-chain depth. So one cheap task edit (`PATCH /api/tasks/[id]` fires automation fire-and-forget) can fan out to arbitrarily many DB writes / notifications / emails, bounded only by how many rules/actions an admin configured. There is **no infinite loop today** — the action implementations (`change_status`, `assign`, `escalate`, …) write **straight to the DB** rather than through the event-emitting API layer, so they don't re-trigger the engine — but that safety is accidental: the moment an action is (correctly) routed through the task-update path so downstream consumers fire, mutual/self-referential rules would loop forever with nothing to stop them.

### Fix
Added bounded execution to the engine (exported constants for testability):
- `MAX_CHAIN_DEPTH` (5) — `AutomationContext` now carries an optional `chainDepth`; the engine refuses (logs + returns `[]`, before any DB access) once depth exceeds the limit, and passes `chainDepth + 1` into `executeAction`, so any future event an action emits is depth-bounded → **no infinite loops even if actions start re-emitting**.
- `MAX_RULES_PER_EVENT` (50) — caps rule fan-out per event (logs when it trips).
- `MAX_ACTIONS_PER_EVENT` (100) — running budget across all rules in the event; excess actions are skipped and recorded as failed (`Skipped: action budget exceeded`), with a single warning.
Generous limits — only clearly-abnormal configs trip them, and every trip is logged.

### Regression test
`apps/web/src/lib/automation/__tests__/engine-loop-guard.test.ts` — 5 cases: hard-stop past `MAX_CHAIN_DEPTH` (DB never touched); runs at the boundary depth; rule fan-out capped at `MAX_RULES_PER_EVENT`; action budget caps at `MAX_ACTIONS_PER_EVENT` with the rest marked skipped; `executeAction` receives `chainDepth + 1`.

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1575 unit tests** (5 new) + `lint` + `build` all green.

---

## [WM-010] Rich-text (TipTap) XSS sweep — defenses verified strong; DOM-clobbering hardened

**Severity:** P3 (hardening — no exploitable hole found)
**Module:** Rich text / sanitization · **File:** `apps/web/src/lib/sanitize.ts`

### Sweep result (what was audited)
Full sweep of the rich-text → storage → render path. **The XSS posture is strong:**
- **One render sink app-wide.** The only `dangerouslySetInnerHTML` in the entire repo is `components/tasks/rich-text-editor.tsx`, and it renders `sanitizeHtml(content)`. Every other surface (emails via `@react-email` JSX, notifications, search results) renders content as escaped React text. CSV export has its own formula-injection guard (`__tests__/security/csv-sanitization.test.ts`).
- **Sanitize-on-write (defense in depth).** Task description (`POST`/`PATCH /api/tasks`) and comment create (`POST /api/tasks/[id]/comments`) run `sanitizeRichText` before storage. There is no comment-edit route; task-template descriptions are plain capped strings.
- **Reputable sanitizer.** `sanitizeHtml` uses the `xss` (js-xss) library with a tag/attr allow-list, `stripIgnoreTagBody` for `script/style/iframe/object/...`, `javascript:`/`vbscript:`/`data:` scheme blocking on `href`/`src`, and a CSS-property allow-list. Backed by 51 existing regression tests (script/iframe/object/embed/style/form removal, event-handler stripping, dangerous URI schemes, nested-tag bypass, SVG `onload`, CSS filtering, comment cases).

### Finding + fix (the one real hardening)
The wildcard attribute allow-list permitted a user-controlled **`id`** on every tag (`'*': ['class', 'id']`) — a **DOM-clobbering** vector (an element `id="attributes"`/`id="body"` can shadow real DOM/JS properties and, with a gadget, escalate). TipTap never emits `id`, so removed it — allow-list is now `'*': ['class']` (styling preserved). `name` was already disallowed.

### Regression test
Extended `apps/web/src/__tests__/security/sanitize.test.ts` (+4): `id` stripped from a paragraph and from a clobbering anchor (href preserved); `name` not allowed; `class` preserved.

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1579 unit tests** (4 new; 55 in the sanitize suite) + `lint` + `build` all green.

---

## [WM-011] Timer "start" is a check-then-insert race — a user can end up with two running timers

**Severity:** P2 (data-integrity race — corrupts time tracking; same class as WM-001)
**Module:** Time tracking · **Files:** `apps/web/src/app/api/tasks/[id]/time-entries/route.ts`, `packages/database/src/schema/tasks.ts` (+ migration `0003`), `apps/web/src/lib/db-errors.ts` (new)

### Finding
Starting a timer (`POST /api/tasks/[id]/time-entries`, `entryType: 'timer'`) did a **check-then-act**: `SELECT` for a running entry (`end_time IS NULL`), reject if one exists, then `INSERT` a new running row. The check and the insert are separate statements with no atomicity, so two concurrent "start" requests both pass the check (neither sees the other's uncommitted row) and both insert → the user has **two running timers**, silently double-counting time. (`INSERT … WHERE NOT EXISTS` would not fix this under READ COMMITTED either — the subquery can't see the concurrent uncommitted insert.) Same non-atomic-invariant class as WM-001.

### Fix
DB-enforced invariant: a **partial unique index** `idx_time_entries_one_running_timer` on `time_entries(user_id) WHERE end_time IS NULL AND entry_type = 'timer'` (schema + generated migration `0003_add_running_timer_unique_index.sql`) makes "at most one running timer per user" impossible to violate, regardless of concurrency or which code path inserts. The route keeps its pre-check for the friendly common-case message and now catches the unique-violation from a raced insert — new `isUniqueViolation(err, constraint)` helper (`lib/db-errors.ts`, postgres.js SQLSTATE `23505` + `constraint_name`) → same `409 CONFLICT` ("You already have a running timer") instead of a 500. Only `timer` entries are constrained, so open manual entries are unaffected.

### Regression test
`apps/web/src/lib/__tests__/db-errors.test.ts` — 4 cases (matches `23505` with/without a named constraint; ignores other SQLSTATEs; safe on non-object input). The invariant itself is enforced by Postgres and applied in CI via `db:migrate` (the E2E DB). Note the standing WM-002 gap: a true concurrent-burst assertion needs the real-DB integration harness.

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1583 unit tests** (4 new) + `lint` + `build` all green; migration generates cleanly (single `CREATE UNIQUE INDEX`).

---

## [WM-012] Raced duplicate inserts return 500 instead of 409 (dependencies / watchers / team members)

**Severity:** P3 (hygiene — data integrity already safe; wrong status code + error-monitor noise under a concurrent-duplicate race)
**Module:** Tasks / Teams · **Files:** `apps/web/src/app/api/tasks/[id]/dependencies/route.ts`, `.../tasks/[id]/watchers/route.ts`, `.../teams/[id]/members/route.ts`

### Finding
Three "add a relationship" routes follow the same check-then-insert shape as WM-011 — `SELECT` for an existing row, reject with a friendly **409** if found, else `INSERT`. Unlike the timer, **data integrity here was never at risk**: each table already has a unique index (`idx_task_deps_unique`, `idx_task_watchers_unique`, `idx_team_members_unique`), so a raced duplicate can't create a duplicate row. But the losing insert throws a unique-violation the route didn't catch, so it surfaced as a generic **500** (via `handleApiError`) instead of the same 409 the non-raced path returns — a status-code wart that also pollutes error monitoring (same spirit as WM-004).

### Fix
Wrapped each insert and mapped the specific unique-violation to the route's existing 409, reusing the WM-011 helper `isUniqueViolation(err, <indexName>)`. Non-unique errors still rethrow to `handleApiError`. No behavior change on the common path.

### Regression test
Covered by `isUniqueViolation` unit tests (WM-011). The wiring is uniform 4-line try/catch per route; a true raced-duplicate assertion needs the real-DB harness (WM-002).

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1583 unit tests** + `lint` + `build` all green.

---

## [WM-013] Task dependencies can form cycles — no acyclicity check on add (deadlocks the graph)

**Severity:** P2 (data/graph integrity — a cycle deadlocks scheduling/gantt; also a TOCTOU under concurrency)
**Module:** Tasks / dependencies · **Files:** `apps/web/src/app/api/tasks/[id]/dependencies/route.ts`, `apps/web/src/lib/api/dependency-cycle.ts` (new)

### Finding
`POST /api/tasks/[id]/dependencies` blocked only self-dependencies (`A depends on A`) — it never checked the wider graph. A user could add `A depends on B` and then `B depends on A` (or any longer chain) to create a **cycle**, leaving tasks that mutually block each other, which deadlocks dependency-aware scheduling/gantt. The `dependencies/deep` route only *reports* `hasCycle` after the fact; nothing *prevented* creating one. Even with a check, concurrent adds are a TOCTOU: two complementary edges added at once each pass an independent check and together close a loop.

### Fix
- New pure, testable helper `wouldCreateCycle(source, dependsOn, fetchDeps)` (`lib/api/dependency-cycle.ts`): adding `source → dependsOn` closes a loop iff `dependsOn` already transitively depends on `source`; it walks the depends-on graph breadth-first from `dependsOn` (batched via `fetchDeps`, with a visited-set so pre-existing cycles can't hang it).
- The route now runs the cycle check **and** the insert inside a `db().transaction`, guarded by a per-org Postgres advisory lock (`pg_advisory_xact_lock(hashtext('taskdeps:'+orgId))`) so concurrent dependency mutations for an org are serialized — closing the TOCTOU (same atomicity approach as WM-001). A would-be cycle returns **422** (`This dependency would create a circular dependency`); the raced-duplicate 409 mapping (WM-012) is preserved.

### Regression test
`apps/web/src/lib/api/__tests__/dependency-cycle.test.ts` — 7 cases: self-loop; direct reverse edge; transitive cycle (B→C→A); non-closing edge allowed; empty graph; termination on a pre-existing stored cycle; batched frontier lookups (one query per BFS level).

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1590 unit tests** (7 new) + `lint` + `build` all green.

---

## [WM-014] Task-hours recompute is a non-atomic SELECT-then-UPDATE (lost-update under concurrency)

**Severity:** P3 (derived analytics value can go stale under concurrency; self-heals on next recompute)
**Module:** Analytics / time tracking · **File:** `apps/web/src/lib/api/db.ts` (`recalcTaskHours`)

### Finding
`recalcTaskHours(taskId)` recomputed a task's cached `actualHours` by **`SELECT`ing all time entries, summing in JS, then `UPDATE`ing** — two separate statements. It correctly recomputes from scratch (no incremental read-modify-write), but the SELECT and UPDATE aren't atomic, so two concurrent recomputes can lost-update: recalc-A reads the entries (missing a just-committed entry), recalc-B reads all + writes the correct total, then recalc-A writes its **stale** total last. `actualHours` is then wrong until the next time entry triggers another recompute. It's called after every time-entry create/update and correction approval, so overlap is plausible.

### Fix
Collapsed to a single atomic statement: `UPDATE tasks SET actual_hours = ROUND(COALESCE((SELECT SUM(duration_minutes) FROM time_entries WHERE task_id = $1 AND duration_minutes IS NOT NULL), 0) / 60.0, 2) …`. The SUM is re-read at UPDATE time, so the write always reflects committed entries regardless of interleaving — no stale-read window. Same "recompute atomically in SQL" spirit as the WM-001 balance math. Behavior/format unchanged (2-decimal string); returns the new value via `RETURNING`.

### Regression test
Covered indirectly by the time-corrections suite (which mocks `recalcTaskHours`). The atomicity is a single-statement DB property; a true concurrent assertion needs the real-DB harness (WM-002).

### Verification — FIXED + VERIFIED
`typecheck` (3 pkgs) + **1590 unit tests** + `lint` + `build` all green.
