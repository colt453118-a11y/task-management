# WorkManager — Master QA Engagement · Final Report

**Engagement:** Master system validation (security + concurrency + data-integrity)
**Branch:** `main` · **Report date:** 2026-08-12
**Companion document:** [`WORKMANAGER_DEFECTS.md`](./WORKMANAGER_DEFECTS.md) (full evidence log, per-defect reproduction, root cause, fix, and regression test)

---

## 1. Executive summary

A structured QA pass over WorkManager's backend surfaced **15 findings** (WM-001 … WM-015),
spanning concurrency/data-integrity races, authorization/RBAC gaps, SSRF, a realtime-stream
revocation bypass, an automation runaway vector, sanitization hardening, a test-coverage gap,
and DB-error-handling.

**All 15 are fixed/resolved and verified**; each shipped as its own PR through the full local gate
(typecheck → test → lint → build) and CI (Typecheck→Test→Lint, Security secrets+deps, E2E on
chromium/firefox/mobile-chrome, and the test matrix) — every fix PR squash-merged green.
Current suite on `main` (commit `eea3956`, 2026-08-13): **1591 unit tests + 8 real-DB integration
tests + the frontend a11y suite green across all 3 packages.**

**WM-002 — the real-DB integration harness — is now resolved** (PR #101): a live-Postgres
integration project asserts the concurrency fixes (WM-011/013/014) under genuine concurrency, run
in CI after migrations. On its first run it caught a real defect, **WM-015** (`isUniqueViolation`
missed Drizzle-wrapped errors, so raced-insert 409s silently returned 500) — now fixed. See §5/§10.

**No P0 (critical) defect was found.** Two properties that would have been P0 were explicitly
probed and **held**: multi-tenant isolation (cross-org reads/writes are denied) and
mass-assignment defense (`.strict()` Zod schemas reject injected `organizationId`/`status`/
`createdBy`). See §6.

### Severity distribution

| Severity | Count | IDs | Status |
|----------|-------|-----|--------|
| **P0** (critical) | 0 | — | — |
| **P1** (high) | 2 | WM-001, WM-002 | all fixed/resolved |
| **P2** (medium) | 10 | WM-003, 004, 005, 006, 007, 008, 009, 011, 013, 015 | all fixed |
| **P3** (low/hardening) | 3 | WM-010, 012, 014 | all fixed |
| **Total** | **15** | — | **15 fixed / 0 open** |

---

## 2. Findings matrix (WM-001 … WM-015)

| ID | Severity | Module | Title (short) | Status | PR |
|------|:--:|--------|---------------|--------|:--:|
| **WM-001** | P1 | Leave / Time Corrections | Approval/rejection & time-correction review not atomic → balance corruption + state-machine bypass under concurrency | ✅ Fixed + verified (live) | [#75](https://github.com/colt453118-a11y/task-management/pull/75) |
| **WM-002** | P1 | Test infrastructure | No real-DB integration tests — DB-level bugs structurally uncatchable | ✅ Resolved (harness built) | [#101](https://github.com/colt453118-a11y/task-management/pull/101) |
| **WM-003** | P2 | Cron / Automation | Scheduled endpoints fail **open** when `CRON_SECRET` unset | ✅ Fixed + verified | [#76](https://github.com/colt453118-a11y/task-management/pull/76) |
| **WM-004** | P2 | API error handling | RBAC / cross-org denials returned 500 instead of 403/401 | ✅ Fixed + verified (live) | [#77](https://github.com/colt453118-a11y/task-management/pull/77) |
| **WM-005** | P2 | Settings / Search | Slack integration + search reindex had **no permission check** | ✅ Fixed + verified | [#87](https://github.com/colt453118-a11y/task-management/pull/87) |
| **WM-006** | P2 | Auth wrapper | `withAuth` swallowed handler errors (missing `await`) → 500 instead of 401/403 | ✅ Fixed + verified | [#87](https://github.com/colt453118-a11y/task-management/pull/87) |
| **WM-007** | P2 | Webhooks | Outbound webhook URL is an **SSRF** vector (metadata/internal hosts) | ✅ Fixed + verified | [#88](https://github.com/colt453118-a11y/task-management/pull/88) |
| **WM-008** | P2 | Notifications (SSE) | Realtime stream never re-checks auth → **revocation bypass** | ✅ Fixed + verified | [#89](https://github.com/colt453118-a11y/task-management/pull/89) |
| **WM-009** | P2 | Automation | Engine has no runaway/loop guard → unbounded fan-out | ✅ Fixed + verified | [#90](https://github.com/colt453118-a11y/task-management/pull/90) |
| **WM-010** | P3 | Rich text / sanitize | XSS sweep (strong); DOM-clobbering `id` hardened | ✅ Fixed + verified | [#91](https://github.com/colt453118-a11y/task-management/pull/91) |
| **WM-011** | P2 | Time tracking | Timer "start" check-then-insert race → two running timers | ✅ Fixed + verified | [#92](https://github.com/colt453118-a11y/task-management/pull/92) |
| **WM-012** | P3 | Tasks / Teams | Raced duplicate inserts returned 500 instead of 409 | ✅ Fixed + verified | [#93](https://github.com/colt453118-a11y/task-management/pull/93) |
| **WM-013** | P2 | Tasks / dependencies | Dependencies can form **cycles** (no acyclicity check; TOCTOU) | ✅ Fixed + verified | [#93](https://github.com/colt453118-a11y/task-management/pull/93) |
| **WM-014** | P3 | Analytics / time | Task-hours recompute non-atomic SELECT-then-UPDATE (lost-update) | ✅ Fixed + verified | [#94](https://github.com/colt453118-a11y/task-management/pull/94) |
| **WM-015** | P2 | DB error handling | `isUniqueViolation` missed Drizzle-wrapped errors → raced-insert 409s silently returned 500 | ✅ Fixed + verified (real-DB) | [#101](https://github.com/colt453118-a11y/task-management/pull/101) |

*Fix commits on `main`: WM-001 `d352fe9` · WM-003 `23edaf0` · WM-004 `f66de4a` · WM-005/006 `e17bc50` · WM-007 `f49c9f1` · WM-008 `1b0d4f9` · WM-009 `07dc5c5` · WM-010 `822a2c0` · WM-011 `e24b01a` · WM-012/013 `10840c4` · WM-014 `4253b64` · WM-002/015 `eea3956`.*

---

## 3. Scope covered

The engagement targeted **backend correctness, authorization, and data integrity** on a live dev
server backed by real PostgreSQL 17. Categories exercised:

- **Concurrency / data-integrity races** — atomicity of check-then-act flows and lost-update
  windows under concurrent load. Findings: WM-001 (leave/corrections), WM-011 (timers),
  WM-013 (dependency cycles / TOCTOU), WM-012 (raced duplicates), WM-014 (hours recompute).
  Approach: `db.transaction` + conditional `UPDATE … WHERE … RETURNING`, atomic SQL math,
  DB-enforced partial-unique indexes, per-org advisory locks, single-statement recompute.
- **Authorization / RBAC / multi-tenant isolation** — permission gating and cross-org access on
  `[id]` routes and integration/maintenance endpoints. Findings: WM-004 (status-code mapping),
  WM-005 (Slack/reindex gating), WM-006 (auth-wrapper error propagation). Isolation &
  mass-assignment **verified holding** (§6).
- **Unauthenticated trigger surface** — scheduled/cron endpoints fail-closed posture. WM-003.
- **SSRF / outbound server requests** — user-supplied webhook URLs, at create/update **and**
  delivery time, plus redirect-following. WM-007.
- **Session / revocation lifecycle on long-lived connections** — the SSE notification stream.
  WM-008.
- **Resource-exhaustion / runaway execution** — automation rule/action fan-out and chain depth.
  WM-009.
- **XSS / injection / sanitization** — full rich-text → storage → render path; single render
  sink confirmed; sanitize-on-write confirmed; DOM-clobbering hardened. CSV formula-injection
  guard confirmed pre-existing. WM-010.
- **Error-handling hygiene** — accurate HTTP status codes (403/401/409/422 vs. blanket 500) to
  keep error monitoring signal clean. WM-004, WM-006, WM-012.

**Verification discipline:** every fix carries a regression test (unit) *and* passed the full
local gate + CI before squash-merge. Where a defect was live-reproducible (WM-001, WM-004), the
fix was re-verified against the live server with the original reproduction.

---

## 4. Not in scope (this engagement)

These were **not** assessed here and are candidate follow-on workstreams:

- **Load / stress / soak testing** — throughput and behavior under sustained concurrency at scale.
- **Dependency CVE deep-dive** — beyond CI's `Security (secrets + deps)` job.
- **Infrastructure / deployment / secrets management** — hosting, TLS, backups, email
  deliverability (SPF/DKIM/DMARC).

---

## 5. Residual risk

| # | Risk | Severity | Origin | Status / mitigation |
|---|------|:--:|--------|---------------------|
| R1 | **Concurrency fixes not asserted under real concurrency.** WM-011/013/014 relied on DB properties (partial-unique index, advisory lock, single-statement SQL) with **no live-DB regression test**. | P1 | WM-002 | **✅ Closed 2026-08-13 (WM-002).** Real-Postgres integration harness (`test:integration`, run in CI after migrations) now asserts these under genuine concurrency; it caught **WM-015** on its first run. Residual: grow the harness (leave-approval race, tenant isolation). See §10. |
| R2 | **SSRF via DNS rebinding.** WM-007 blocks *literal* private hosts and disables redirect-following, but a **public hostname that resolves to a private IP** is not blocked. | P2 (narrowed) | WM-007 note | **Mitigated, not eliminated.** Redirect-blocking narrows it; connect-time IP pinning is the tracked follow-up. |
| R3 | **Prod-mode behavior unverified.** Live checks ran against the dev server only. | Medium | Scope | **✅ Closed 2026-08-12** — production build smoked as `node .next/standalone/apps/web/server.js` (`NODE_ENV=production`): real login + task/project CRUD + WM-003 prod fail-closed + security headers + SSR/asset render all pass, no prod-only breakage. See §9. *(Residual: full browser/visual + a11y pass is R4.)* |
| R4 | **Frontend a11y / responsive / perf.** | Medium | Scope | **Mostly closed 2026-08-12/13.** Static + live axe/Lighthouse audit done; a11y fixes shipped (reduced-motion, skip-link, jsx-a11y gate, then labels/names/contrast) → axe **0 violations** across 21 pages (PRs #97/#98/#99). Responsive/landmarks verified sound. **Residual (open): LCP 3.8–4.9s** — architectural (client-fetch-after-mount → RSC/streaming), tracked separately. |
| R5 | **Automation limits are generous defaults**, not tuned to real workloads (`MAX_CHAIN_DEPTH=5`, `MAX_RULES_PER_EVENT=50`, `MAX_ACTIONS_PER_EVENT=100`). | Low | WM-009 | **Accepted** — every trip is logged; revisit if logs show legitimate configs tripping. |

---

## 6. Positive results (properties that held)

Not everything probed was broken. The following were explicitly tested and **passed**, and are
recorded so the assurance is on the record:

- **Multi-tenant isolation holds.** Org A admin requesting an Org B task row is **denied**
  (post-WM-004: correct `403 FORBIDDEN`; the row is never read or mutated). No cross-tenant leak
  observed.
- **Mass-assignment defense holds.** `.strict()` Zod schemas reject injected `organizationId` /
  `status` / `createdBy` with **400**, so privilege-relevant fields can't be set via the API body.
- **XSS posture is strong.** Exactly one `dangerouslySetInnerHTML` sink app-wide, rendering
  `sanitizeHtml()`; sanitize-on-write on task descriptions and comments; reputable `xss` library
  with tag/attr allow-list, scheme blocking, and 55 regression tests. Only a hardening nit
  (DOM-clobbering `id`) was found and fixed (WM-010).
- **CSV export** has a pre-existing formula-injection guard with its own test suite.
- **`check-overdue` cron** already failed closed in production (only the two peer cron routes did
  not — fixed in WM-003).

---

## 7. Recommendations (priority order)

1. ~~**Build the real-DB integration harness (WM-002 / R1)**~~ — ✅ **done 2026-08-13** (§10); it
   caught WM-015 on its first run. *Follow-up:* grow it with leave-approval-race and tenant-isolation
   tests.
2. ~~**Production-mode retest (R3)**~~ — ✅ **done 2026-08-12** (§9); no prod-only breakage found.
3. ~~**Frontend a11y audit (R4)**~~ — ✅ **done 2026-08-12/13**; axe 0 violations across 21 pages
   (#97/#98/#99). *Open:* **LCP perf** (3.8–4.9s) — architectural (RSC/streaming), tracked separately.
4. **SSRF connect-time IP pinning (R2)** — close the DNS-rebinding gap on outbound webhooks.

---

## 8. Verdict

WorkManager's **backend security and concurrency posture is materially stronger** than at the
start of this engagement: **15 confirmed defects fixed/resolved**, verified, and merged with
regression coverage and green CI, and **no critical (P0) defect found**. Multi-tenant isolation and
mass-assignment — the highest-blast-radius properties — were probed and hold.

**All four release gates raised during the engagement are now closed:** backend security +
concurrency (WM-001…014), the **production-mode retest** (§9, no prod-only breakage), the
**real-DB integration harness** (§10 — which caught WM-015), and the **frontend a11y audit**
(axe 0 violations across 21 pages). The concurrency fixes are no longer merely proven by
construction — they are exercised under real concurrency in CI.

**Verdict: release-ready from a QA standpoint**, with two **non-blocking** follow-ups tracked as
residual items — **LCP page-load performance** (3.8–4.9s; architectural) and **SSRF DNS-rebinding**
(connect-time IP pinning) — plus the standing out-of-scope areas in §4 (load testing, infra/secrets,
dependency CVE deep-dive). Growing the integration harness (leave-approval race, tenant isolation)
is a recommended fast-follow.

*Full per-defect evidence, reproduction steps, root causes, fixes, and regression tests:
[`WORKMANAGER_DEFECTS.md`](./WORKMANAGER_DEFECTS.md).*

---

## 9. Production-mode retest (2026-08-12)

**Method.** Applied the WM-011 partial-unique index to bring the dev DB schema to `main`, then ran
the real production build (`pnpm build`, `output: standalone`) and served it exactly as the
container does — `node .next/standalone/apps/web/server.js` with `NODE_ENV=production` (`next start`
does **not** work with standalone output) — against live Postgres 17 + Redis. All checks below are
against that production binary, not the dev server.

| Check | Result |
|-------|--------|
| Boot + `GET /api/health` | ✅ 200 — database + redis both `healthy` |
| Real login (`POST /api/auth/sign-in/email`) → session | ✅ 200, session cookie issued; `get-session` valid |
| Task CRUD | ✅ create 201 → read 200 → update 200 → delete 200 → confirm-gone 404 |
| Project CRUD | ✅ create 201 → delete 200 |
| Unauth API gating | ✅ `GET /api/tasks` (no session) → 307 → `/auth/login?redirect=…` (middleware) |
| **WM-003 in production** | ✅ cron with no configured secret **fails closed** → 401 (the prod-gated property) |
| Security headers (prod) | ✅ CSP, HSTS (`max-age=63072000; preload`), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy |
| SSR + static assets | ✅ `/auth/login` 200 HTML; authed `/tasks` 200 HTML with `/_next/static` chunks 200 |
| Server logs | ✅ no errors / unhandled rejections / 500s — only benign dev-secret warnings |

**Notes / non-blocking observations.**
- The dev `.env` ships `CRON_SECRET=` **empty** and a short, low-entropy `AUTH_SECRET`; Better Auth
  warns on the latter. Both are expected in dev — production must set a strong `AUTH_SECRET` and a
  real `CRON_SECRET` (already on the launch checklist; the empty-secret prod deny is WM-003 working
  as designed, i.e. the cron jobs stay disabled until the secret is set).
- `DELETE` on tasks/projects is a **soft delete** (row tombstoned, hidden from the app; API 404s it).
- **Not covered here (→ R4):** a real *browser/visual* render + a11y pass. The server returns
  populated HTML with assets, but the 2026-08-10 blank-page defect was a client-side (opacity)
  issue invisible to SSR/curl; it is fixed on `main` with an e2e regression guard, and a full
  visual pass belongs to the frontend audit.

**Environment left clean:** prod server stopped, throwaway smoke rows purged, WorkManager infra
brought back down; the unrelated co-tenant project on the host was not touched.

---

## 10. Real-DB integration harness (2026-08-13 — WM-002, closes R1)

**Why.** Every unit test mocked the database, so the concurrency fixes (WM-011/013/014) were proven
*by construction* but never exercised against a live database — a P1 coverage gap (WM-002). This
stands up a real-Postgres harness so those invariants are asserted under genuine concurrency in CI.

**Harness.** A separate Vitest project (`vitest.integration.config.ts`, node env, **no DB mock**,
single-fork/serial) runs `src/__integration__/**` via `pnpm test:integration`; helpers connect to
the real `DATABASE_URL`, truncate + seed fixtures per test, and **skip when no DB is configured**
(so the mocked suite is unaffected). CI's `ci` job now runs `db:migrate` + `test:integration`
against its Postgres service.

| Test (real Postgres 17) | Asserts |
|-------------------------|---------|
| **WM-011** | Two *concurrent* running-timer inserts → the partial unique index rejects one; exactly one running timer remains; manual entries are unconstrained. |
| **WM-014** | `recalcTaskHours` sums correctly, ignores null durations, and two racing recomputes converge (no stale write). |
| **WM-013** | `wouldCreateCycle` over a live `task_dependencies` graph detects a transitive cycle, allows a non-closing edge, and terminates on a stored cycle. |

**Bug caught on first run — WM-015 (P2).** `isUniqueViolation` read the SQLSTATE off the top-level
error, but Drizzle wraps the driver error on `.cause`, so a real raced insert returned `false` — the
WM-011/WM-012 "friendly 409" never fired and those raced inserts silently returned **500** (data
integrity always held; only the status code was wrong). Fixed by walking the bounded `.cause` chain.
The helper's unit tests only fed synthetic top-level errors, so they were green while the real path
was broken — precisely the failure mode WM-002 exists to surface.

**Result.** 8 integration tests green against real Postgres (locally on a throwaway DB and in CI);
`1591` unit tests green. **Follow-up:** grow the harness with a leave-approval-race test (WM-001) and
tenant-isolation/constraint tests.
