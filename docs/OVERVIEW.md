# WorkManager — Project Overview

> Enterprise work & task-management platform — a self-hostable, multi-tenant **Jira/Linear alternative**.

A single organization runs its entire operation in WorkManager: planning work, tracking tasks across
teams, managing people and time-off, tracking time, and reporting on productivity — with real-time
updates, role-based access control, automation, AI assistance, and a premium dark UI.

---

## 1. Architecture & stack

**Monorepo** (pnpm 10 + Turbo):

| Package | Purpose |
|---|---|
| `apps/web` | Next.js 15 app (App Router, RSC) — UI + ~90 API route handlers |
| `packages/database` | Drizzle ORM schema, migrations, query helpers (PostgreSQL) |
| `packages/shared` | Shared TypeScript types, Zod validations, constants, utils |

**Technologies**

- **Frontend:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS v4, Framer Motion,
  Recharts (charts), TipTap (rich text), dnd-kit (kanban), Zustand + TanStack Query (state/data).
- **Backend:** Next.js route handlers → Drizzle ORM → **PostgreSQL 17**; **Better Auth** (sessions);
  **Redis** (rate-limiting/cache); **MinIO** (S3-style attachment storage); **Meilisearch** (search);
  **Mailpit/SMTP** (email); **Sentry** (errors).
- **Multi-tenant:** every record is scoped by `organizationId`.

**Data model — 38 tables**, incl. `organizations, users, roles, permissions, role_permissions,
user_roles, teams, team_members, departments, projects, tasks, task_assignees, task_comments,
task_attachments, task_checklist_items, task_dependencies, task_watchers, task_history,
task_templates, milestones, time_entries, time_correction_requests, leave_types, leave_requests,
leave_balances, automation_rules, automation_logs, notifications, saved_searches, report_snapshots,
audit_logs, login_history, slack_integrations, webhook_subscriptions, webhook_delivery_logs,
accounts, sessions, verification_tokens`.

---

## 2. Feature areas

### Tasks (core)
Rich work items: title, rich-text description, **status** (draft → open → assigned → in_progress →
blocked → under_review → approved → completed → closed, plus on_hold/rejected/cancelled/archived/
reopened) governed by an enforced **transition state-machine**; **priority** (none → critical);
assignees, labels, tags, category, start/due dates, estimated/actual hours. Each task has
**checklists, threaded comments, file attachments (MinIO), dependencies (blocks / blocked-by graph),
watchers, and a full change-history timeline**.

- **List** (`/tasks`) — filterable/sortable table, status & priority chips, avatars, pagination,
  bulk actions, export.
- **Board** — kanban (drag-drop, swimlanes by assignee/priority, WIP limits, column counts).
- **Detail** (`/tasks/[id]`), **Create** (`/tasks/new`), **Quick-create** (⌘T).
- **Templates** (`/task-templates`) — reusable task presets (incl. a default template).

### Projects, teams & org structure
- **Projects** (`/projects`) — progress %, owner, code, dates, status.
- **Teams & Departments** (`/teams`, `/teams/[id]`, `/teams/departments/[id]`).
- **People** (`/users`) — directory, invite (welcome email), deactivate, role assignment.
- **Milestones** (`/milestones`) — key dates across projects; timeline + list views.

### Access control (RBAC)
Better Auth sessions + a full roles/permissions system (**6 roles, 64 permissions**). Every API route
enforces `requirePermission` and org scoping; first user auto-bootstraps as admin. Auth flows:
login / register / forgot-password / reset-password (single-use email tokens).

### Time & leave
- **Time Tracking** (`/timer`) — start/stop timers or log time manually against tasks.
- **Time Corrections** (`/corrections`) — request → approve/reject time-entry adjustments.
- **Leave / Time-Off** (`/leave`, `/leave/new`, `/leave/balances`) — leave types, request →
  approve/reject, per-user balances.

### Planning & visualization
- **Calendar** (`/calendar`) — deadlines & milestones (month/week).
- **Gantt** (`/gantt`) — drag bars to reschedule projects, milestones, tasks.

### Insights & reporting
- **Dashboard** (`/`) — role-aware **Executive / Manager / Employee** views; KPI StatCards,
  task-distribution donut, task-overview bars, team-activity feed, workload-by-assignee, quick actions.
- **Analytics** (`/analytics`) — burndown, velocity, completion/overdue rates, status distribution,
  avg completion time (7/30/90/all periods).
- **Reports** (`/reports`, `/reports/snapshots/[id]`) — productivity KPIs, scheduled **EOD snapshots**,
  AI summaries, export.

### Automation, notifications & AI
- **Automation** (`/automation`) — rules: **trigger → conditions → actions** (e.g. `task.overdue`
  → notify/assign/escalate) + a run/audit log.
- **Notifications** (`/notifications`) — **real-time via SSE**; unread badges, mark-read/dismiss.
- **AI** (OpenAI-compatible, configurable) — summarize, suggest-priority, predict-risk,
  detect-duplicates, EOD summaries, writing assistant. Degrades to a clean 503 with no key.

### Search & integrations
- **Search** (`/search` + ⌘K palette) — cross-entity via Meilisearch; **saved searches**.
- **Settings** (`/settings`) — General (org), Roles & Permissions, AI provider, Webhooks
  (subscriptions + delivery logs), Slack, Security, Notifications, EOD schedule.
- **Audit & security** — `audit_logs`, `login_history`, Redis rate-limiting, Sentry.

---

## 3. Design system (UI)

A **dark-only "god-mode"** system: deep-slate `#0a0b10` canvas + electric-violet `#8a78ff`, **Sora**
display headings + **Inter** body, glass cards, gradient buttons with subtle glow, token-driven
status/priority **chip** pills, premium **StatCard** KPIs, a grouped **Work / Team / Insights /
System** sidebar, glassy topbar with ⌘K search + quick-create, keyboard shortcuts, and purposeful
motion.

Theming is **deterministic dark-only** — the app forces the dark theme (`ThemeProvider forcedTheme`)
and the color tokens are driven by base semantic classes over the `@theme` scale. (The legacy
media-query `dark:` variant is neutralized in `globals.css`; the ~1,050 inverted `dark:` overrides
that once caused dark-on-dark text have been removed.)

Shared UI primitives live in `apps/web/src/components/ui/*` — `Button, Card, Input, Textarea, Badge,
Chip (StatusChip/PriorityChip), PageHeader, StatCard, Dialog, Tabs, DropdownMenu, EmptyState`, etc.

---

## 4. Engineering & operations

- **Quality gates:** ~1,526 unit tests (Vitest) + Playwright e2e; strict `tsc`, ESLint, production
  build — all green. CI adds gitleaks + `pnpm audit` gates.
- **Local infra:** `docker compose up -d` → Postgres, Redis, MinIO, Meilisearch, Mailpit.
- **Run:** `pnpm db:push && pnpm db:seed` (org + roles/permissions + admin), then `pnpm dev`.
- **Verify suite:** `pnpm typecheck && pnpm test && pnpm lint && pnpm build`.
- **Deploy target:** Render (`render.yaml`, `GO_LIVE.md`). Not yet live.

---

## 5. Page map (~31 routes)

```
/                       Dashboard (Executive/Manager/Employee)
/tasks  /tasks/new  /tasks/[id]  /task-templates
/projects
/teams  /teams/[id]  /teams/departments/[id]  /users
/milestones  /dependencies/[id]
/timer  /corrections  /leave  /leave/new  /leave/[id]  /leave/balances
/calendar  /gantt
/analytics  /reports  /reports/snapshots/[id]
/automation  /notifications  /search  /settings
/auth/login  /auth/register  /auth/forgot-password  /auth/reset-password
```

---

_In one line: a full **Jira/Linear-class work OS** — tasks, projects, teams, kanban/gantt/calendar,
time & leave, RBAC, analytics/reports, automation, AI, real-time notifications, search and
integrations — in a premium dark UI on a Next.js 15 + PostgreSQL + Drizzle stack._
