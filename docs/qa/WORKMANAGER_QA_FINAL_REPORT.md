# WorkManager — Master QA Engagement · Final Report

**Engagement:** Master system validation (security + concurrency + data-integrity)
**Branch:** `main` · **Report date:** 2026-08-12
**Companion document:** [`WORKMANAGER_DEFECTS.md`](./WORKMANAGER_DEFECTS.md) (full evidence log, per-defect reproduction, root cause, fix, and regression test)

---

## 1. Executive summary

A structured QA pass over WorkManager's backend surfaced **14 findings** (WM-001 … WM-014),
spanning concurrency/data-integrity races, authorization/RBAC gaps, SSRF, a realtime-stream
revocation bypass, an automation runaway vector, and sanitization hardening.

**13 of 14 are fixed and verified**; each shipped as its own PR through the full local gate
(typecheck → test → lint → build) and CI (Typecheck→Test→Lint, Security secrets+deps, E2E on
chromium/firefox/mobile-chrome, and the test matrix) — **all 11 fix PRs squash-merged green**.
Current suite on `main` (commit `4253b64`, re-run 2026-08-12): **1590 unit tests passing across
87 files, all 3 packages green** (~63 of those tests were added by this engagement's fixes).

**1 finding remains open** — **WM-002**, the absence of a real-database integration harness.
It is a process/coverage gap, not a live defect, but it is the single most important residual
item: several concurrency fixes are correct-by-construction (DB constraints / single-statement
atomicity) but are **not** asserted against a live database under real concurrency.

**No P0 (critical) defect was found.** Two properties that would have been P0 were explicitly
probed and **held**: multi-tenant isolation (cross-org reads/writes are denied) and
mass-assignment defense (`.strict()` Zod schemas reject injected `organizationId`/`status`/
`createdBy`). See §6.

### Severity distribution

| Severity | Count | IDs | Status |
|----------|-------|-----|--------|
| **P0** (critical) | 0 | — | — |
| **P1** (high) | 2 | WM-001, WM-002 | 1 fixed, **1 open** (WM-002) |
| **P2** (medium) | 9 | WM-003, 004, 005, 006, 007, 008, 009, 011, 013 | all fixed |
| **P3** (low/hardening) | 3 | WM-010, 012, 014 | all fixed |
| **Total** | **14** | — | **13 fixed / 1 open** |

---

## 2. Findings matrix (WM-001 … WM-014)

| ID | Severity | Module | Title (short) | Status | PR |
|------|:--:|--------|---------------|--------|:--:|
| **WM-001** | P1 | Leave / Time Corrections | Approval/rejection & time-correction review not atomic → balance corruption + state-machine bypass under concurrency | ✅ Fixed + verified (live) | [#75](https://github.com/colt453118-a11y/task-management/pull/75) |
| **WM-002** | P1 | Test infrastructure | No real-DB integration tests — DB-level bugs structurally uncatchable | 🔴 **Open** (recommendation) | — |
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

*Fix commits on `main`: WM-001 `d352fe9` · WM-003 `23edaf0` · WM-004 `f66de4a` · WM-005/006 `e17bc50` · WM-007 `f49c9f1` · WM-008 `1b0d4f9` · WM-009 `07dc5c5` · WM-010 `822a2c0` · WM-011 `e24b01a` · WM-012/013 `10840c4` · WM-014 `4253b64`.*

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

- **Real-DB integration testing** — see WM-002 (open) and §5.
- **Production-mode retest** — all live verification used the dev server; prod-only breakage
  (`output: standalone` server entry, session-cookie/login under prod build) is unverified.
- **Frontend audit** — responsive/layout, accessibility (a11y), and client performance.
- **Load / stress / soak testing** — throughput and behavior under sustained concurrency at scale.
- **Dependency CVE deep-dive** — beyond CI's `Security (secrets + deps)` job.
- **Infrastructure / deployment / secrets management** — hosting, TLS, backups, email
  deliverability (SPF/DKIM/DMARC).

---

## 5. Residual risk

| # | Risk | Severity | Origin | Status / mitigation |
|---|------|:--:|--------|---------------------|
| R1 | **Concurrency fixes not asserted under real concurrency.** WM-011/013/014 rely on DB properties (partial-unique index, advisory lock, single-statement SQL) that are correct-by-construction but have **no live-DB regression test**. A future refactor could silently regress them and the suite would stay green. | P1 | WM-002 | **Open.** Stand up the real-Postgres integration harness (CI `test` job already provisions Postgres). Start with concurrent leave/timer/dependency asserts. |
| R2 | **SSRF via DNS rebinding.** WM-007 blocks *literal* private hosts and disables redirect-following, but a **public hostname that resolves to a private IP** is not blocked. | P2 (narrowed) | WM-007 note | **Mitigated, not eliminated.** Redirect-blocking narrows it; connect-time IP pinning is the tracked follow-up. |
| R3 | **Prod-mode behavior unverified.** Live checks ran against the dev server only. | Medium | Scope | **Open** — master-plan item: build the prod image and smoke real login + key CRUD. |
| R4 | **Frontend a11y / responsive / perf unassessed.** | Medium | Scope | **Open** — master-plan item; surface findings for review before any mass UI edit. |
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

1. **Build the real-DB integration harness (WM-002 / R1)** — highest-value residual work. Assert
   the concurrency invariants (leave approval, single running timer, dependency acyclicity,
   hours recompute) against a live throwaway Postgres, plus tenant-isolation and constraint tests.
2. **Production-mode retest (R3)** — build the prod image and smoke real login + key CRUD to catch
   prod-only breakage before real users.
3. **Frontend responsive / a11y / perf audit (R4)** — open-ended; surface findings for review
   before mass UI edits (subjective changes need owner sign-off).
4. **SSRF connect-time IP pinning (R2)** — close the DNS-rebinding gap on outbound webhooks.

---

## 8. Verdict

WorkManager's **backend security and concurrency posture is materially stronger** than at the
start of this engagement: 13 confirmed defects fixed, verified, and merged with regression
coverage and green CI, and no critical (P0) defect found. Multi-tenant isolation and
mass-assignment — the highest-blast-radius properties — were probed and hold.

**Not yet release-signed-off**, because: (1) the real-DB integration harness (WM-002) is still
open, so the concurrency fixes are proven by construction but not under live concurrency; and
(2) no production-mode retest or frontend audit has been performed. Those three items are the
gate to a full go/no-go sign-off.

*Full per-defect evidence, reproduction steps, root causes, fixes, and regression tests:
[`WORKMANAGER_DEFECTS.md`](./WORKMANAGER_DEFECTS.md).*
