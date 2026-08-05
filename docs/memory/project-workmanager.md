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

## Current baseline (post #57/#58, 2026-08-05)

- **E2E (Playwright):** 311 tests — 311 passed · 0 failed · 0 skipped · 0 flaky
  (chromium; firefox + Mobile Chrome also green in CI; +17 slack-settings spec)
- **Unit tests:** full suite green (typecheck 3/3 packages, 0 errors; lint clean).
  Web package baseline now **1526 tests** (Slack integration coverage added).
- **Branch workflow:** everything ships via PR + squash-merge; CI gates are
  Typecheck → Test → Lint, then E2E on chromium/firefox/mobile-chrome.
  Direct pushes to `main` are off-limits.

## Slack integration — shipped (#55, 2026-08-05)

Slack Incoming-Webhook integration is **live**:

- `slack_integrations` table (migration `0001_add_slack_integrations.sql`, hand-written
  — matches `drizzle-kit check`), `packages/database/src/schema/slack.ts`.
- API: `GET/POST/DELETE /api/settings/slack`, `POST /api/settings/slack/test`,
  `POST /api/settings/slack/preview`; lib `apps/web/src/lib/slack/webhook.ts`
  (`sendSlackNotification` no-ops without an active integration).
- Settings page: new **Slack tab** (tab key `5`, notifications moved to `7`),
  `slackConnected` badge on the Notifications tab, Slack channel + per-event
  toggles; `notifications.ts` gains `shouldSendSlackForType` + fire-and-forget
  Slack send alongside email.
- **Critical fix shipped:** `api/users/me/preferences` Zod schema previously
  stripped `channels.slack` and `typeChannels[*].slack` (unknown-key strip),
  silently dropping Slack prefs on every save. Added `slack` to both schemas;
  regression tests added (`preferences-api.test.ts`).
- Settings page PATCH replaces `channels` wholesale (defaults fill absent keys) —
  the settings UI always sends the full channel set, so this is safe; documented
  in a code comment. Slack toggle is disabled until an integration is connected.
- 26-test E2E spec `notification-preferences.spec.ts` (channel toggles, Slack
  status badges, Configure navigation, save flow, digest, keyboard shortcuts).
- Also shipped: MinIO dev image pinned to `latest` (dated RELEASE tags get pruned
  on Docker Hub), `preview.html` + Slack screenshots 31/32.

## Slack settings tab E2E — shipped (#57, 2026-08-05)

17-test spec `slack-settings.spec.ts` covering the Slack tab itself (complements
`notification-preferences.spec.ts`): Connect flow (setup form, instructions,
Test/Connect disabled-until-URL, test success/failure, connect save → active
card, invalid-URL error state + Retry), connected state (Active/Disabled badges,
last-used/last-error indicators), Send Preview success/failure, Disconnect modal
(open/cancel/confirm/failure), keyboard shortcut 5. New `mockSlackSettingsApis()`
helper + `MOCK_SLACK_INTEGRATION` fixture in `settings-mocks.ts`; aria-label on
the disconnect trash button (was unlabeled). E2E baseline 294→311. Verified
locally 51/51 across chromium/firefox/mobile-chrome before CI.

## Resend production email config — shipped (#58, 2026-08-05)

Email path is 100% Resend (`lib/email/send.tsx`, `resend@6.17.2`); `sendEmail`
no-ops when `RESEND_API_KEY` is unset. Configured: `render.yaml` (RESEND_API_KEY
`sync:false` + EMAIL_FROM/EMAIL_FROM_NAME/EMAIL_UNSUBSCRIBE_URL),
`docker-compose.prod.yml` (dead SMTP_* vars replaced), `.env.production.example`
(Resend section), and `scripts/send-test-email.mjs` (dependency-free live
verification: sends via Resend API + polls delivery status; links built from
`NEXT_PUBLIC_APP_URL`). **Live-verified:** test email delivered to the
account-owner inbox via sandbox sender `onboarding@resend.dev`. The real key
lives only in the gitignored `.env` (set in the Render dashboard at go-live).
**Deployment pending** — `app.workmanager.com` has no DNS record and the app is
not deployed, so email links don't resolve yet. Resend account: only domain
`mindhives.co` (status `failed`); `workmanager.com` not registered → verify a
domain before real multi-recipient sending.

## Delivery audit + missing-feature tables — shipped (2026-08-05)

Full pre-delivery audit (typecheck/lint green, 1526 unit tests, full E2E
885 passed / 0 failed on chromium/firefox/mobile-chrome, live API smoke):

- **Migrations were stale vs the schema.** `drizzle-kit generate` reported "no
  changes" (meta snapshots already claimed the full schema) but the hand-written
  SQL (0000/0001) created only ~27 tables — leave_*, time_correction_requests,
  webhooks, automation_*, notifications, task_templates, saved_searches were
  missing → 500s on those features (and would have on a fresh Render DB too).
  Added `0002_add_missing_domain_tables.sql` (11 tables / 36 indexes / 34 FKs,
  generated from pg_dump of the pushed schema) + journal entry + snapshot.
  Verified: fresh Postgres migrate 0000→0002 → all 38 tables; seed; create-admin.
- **seed.ts missing permission codes** the routes require: milestone:*,
  integration:*, settings:view/settings:manage, role:assign, report:create,
  team:manage, org:settings → now 64 permissions (admin: all; manager subset;
  every role gets milestone:view).
- **activity-feed 500**: audit-logs select had an empty `sql` fragment → SQL
  syntax error (`, ,`); now `NULL`.
- **analytics 500**: overdue query interpolated a raw `Date` into a `sql`
  template (postgres driver rejects Date); now `now.toISOString()`.
- **tasks POST**: malformed/empty body → 400 INVALID_JSON (was 500).
- Live smoke: all core GETs 200; project/task/leave-request/webhook creates
  201; cron endpoints 200; no-auth blocked.

## In-flight (uncommitted, working tree)

Nothing — tree clean as of #60. Outstanding operational items (not code):
- **Deploy the app (go-live)** so email/notification links resolve; set
  RESEND_API_KEY + EMAIL_FROM* in the Render dashboard; verify a Resend sending
  domain (DNS: SPF/DKIM).

## PR history

| PR | Squash SHA | Shipped |
|---|---|---|
| #58 | `269e8e8` | Resend production email provider config + verification tool: render.yaml email env vars (RESEND_API_KEY `sync:false`), docker-compose.prod.yml SMTP→Resend swap, .env.production.example Resend section, `scripts/send-test-email.mjs` (live verify + delivery polling, links from NEXT_PUBLIC_APP_URL). Live email delivered via Resend sandbox — proven outside Mailpit. |
| #57 | `b6cc3f6` | Slack settings tab E2E spec — 17 tests (connect → test → preview → disconnect + keyboard-5 nav); `mockSlackSettingsApis` helper + `MOCK_SLACK_INTEGRATION`; aria-label on disconnect button. Baseline 294→311. |
| #55 | `5fa01e0` | Slack Incoming-Webhook integration + Slack notification channel: `slack_integrations` table + migration 0001; `/api/settings/slack` CRUD + test/preview; Slack settings tab (key 5, notifications → 7); per-event Slack toggles; `shouldSendSlackForType`; critical fix — preferences Zod schema no longer strips `channels.slack`/`typeChannels[*].slack`; 8 new unit test files (web baseline 1526); 26-test E2E spec (baseline 268→294); MinIO dev pin → latest; preview.html + screenshots 31/32. CI green on chromium/firefox/mobile-chrome. |
| #47 | `983f0f6` | Topbar Quick button E2E test (12th palette test — clicks the topbar Quick button, viewport-aware regex locator matching desktop "Quick ⌘T" and mobile "Quick create task (⌘T)", fills title, submits with Enter, verifies POST + navigation). Memory baseline bump 266→268. |
| #46 | `da771f1` | ⌘T quick-create shortcut E2E test (10th palette test — opens dialog via Control+KeyT, shortcuts-provider dispatch + topbar keydown, no palette involved). Memory record for PR #45 and baseline bump 265→266. |
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
- **GitHub push protection:** blocks any commit containing `hooks.slack.com`
  token segments — even fake placeholder webhook URLs (e.g.
  `services/T00000000/B00000000/XXXXXXXX`). Use hyphens in placeholders
  (`services/not-a-real-token/...`) so the secret pattern can't match.
- **Branch must be up-to-date before squash-merge:** if a PR is BEHIND after a
  sibling PR merges, run `gh pr update-branch <n>`, wait for CI, then merge with
  `gh pr merge <n> --squash --delete-branch --auto` (auto-merges once green).
- **Parallel gh CLI on a shared checkout:** `gh pr create` infers the branch from
  the checked-out working tree — running two in parallel can create a PR for the
  wrong branch. Run gh commands sequentially.
- **Email (Resend):** RESEND_API_KEY lives only in the gitignored `.env`; prod
  sets it in the Render dashboard. Live test:
  `node scripts/send-test-email.mjs --to <inbox>` (override sender via
  `EMAIL_FROM=...` env). App links come from NEXT_PUBLIC_APP_URL; unsubscribe
  from EMAIL_UNSUBSCRIBE_URL.
