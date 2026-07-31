---
name: project-workmanager
description: "WorkManager — task-management app (Next.js/Turbo monorepo); architecture, test baseline, PR history, operational facts"
metadata:
  node_type: memory
  type: project
---

WorkManager is a full-stack task-management platform (PTO/leave tracking, Gantt
charts, automation emails, reports, teams, kanban, calendar, dashboard). Repo:
`github.com/colt453118-a11y/workmanager`. Local path: `/home/Colt_45/workmanager`.
Monorepo: pnpm + Turbo; `apps/web` (Next.js App Router + Tailwind + Radix UI),
alert-service, drizzle ORM + Postgres.

## Current baseline (post PR #46, 2026-07-31)

- **E2E (Playwright):** 266 tests — 266 passed · 0 failed · 0 skipped · 0 flaky
  (chromium; firefox + Mobile Chrome also green in CI)
- **Unit tests:** full suite green (typecheck 3/3 packages, 0 errors; lint clean)
- **Branch workflow:** everything ships via PR + squash-merge; CI gates are
  Typecheck → Test → Lint, then E2E on chromium/firefox/mobile-chrome.
  Direct pushes to `main` are off-limits.

## PR history

| PR | Squash SHA | Shipped |
|---|---|---|
| #45 | `bac9311` | Three quick-create E2E tests (submit via Create click, POST-500 inline error path, Enter-submit) taking the palette spec to 9 tests. Plus: fixed `e2e.yml` Playwright browser cache key (was shared across the matrix → a chromium-populated cache skipped `playwright install firefox`, failing every firefox test with "Executable doesn't exist"; key now includes `matrix.install`), and bumped palette nav `toHaveURL` timeouts 5s→15s for cold-firefox route compilation. Also created `docs/memory/` project memory. |
| #44 | `8b39676` | Global Command Palette (⌘K): nav commands, actions (New Task, Keyboard Shortcuts, theme toggle), cross-entity search (tasks/projects/people); reset-on-open; AbortController guard. 6-test E2E spec + search-mocks helper. Fixed 7 E2E regressions (dashboard Team Activity feed, reports aiSummary, calendar date-boundary). Lint cleanup (logger swaps, dead eslint-disable). Screenshots → `os.tmpdir()` + orphaned PNGs removed + `.gitignore` guard on `__tests__/e2e/screenshots/`. |
| #28 | `cb1c919` | Test coverage, Node.js version fix, UI polish. |
| (earlier) | — | PTO module (3 tables, 6 routes, 4 pages), Gantt drag-to-reschedule, automation send-email action, EOD scheduling prefs, AI summary reports. |

## Operational facts / do-not-relearn

- **Command palette:** opens via ⌘K (or Ctrl+K) and via the topbar search button
  (mobile — no keyboard). Query + selection reset to clean state on every open.
  Search hits the `/api/search` endpoint (mocked in E2E via `search-mocks.ts`).
- **E2E screenshots:** `responsive-email-preview.spec.ts` writes diagnostics to
  `os.tmpdir()/workmanager-email-preview-screenshots` — never to the repo. The
  git-tracked `__tests__/e2e/screenshots/` dir is gitignored; do not commit PNGs
  there. Playwright visual baselines live in `*-snapshots/` dirs (committed).
- **Typecheck race:** running `pnpm typecheck` concurrently with the dev server
  can tear a generated `.next` file (`validator.ts`) and produce a false
  failure; regenerate via `next typegen` or run after the dev server stops.
- **E2E count parity:** the "262" baseline is deterministic; new specs must land
  green with 0 flaky/retries before merge.
