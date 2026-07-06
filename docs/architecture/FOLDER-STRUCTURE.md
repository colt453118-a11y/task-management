# Project Folder Structure — Enterprise Work Management Platform

## Monorepo Structure (pnpm workspaces)

```
workmanagement/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                       # Lint, typecheck, test, build
│   │   ├── cd.yml                       # Deploy to staging/production
│   │   ├── db-migrate.yml               # Database migration pipeline
│   │   └── security-scan.yml            # Dependency & code security scan
│   └── CODEOWNERS
│
├── apps/
│   └── web/                             # Next.js application
│       ├── public/
│       │   ├── fonts/                   # Premium typography (Inter, JetBrains Mono)
│       │   ├── images/
│       │   │   ├── empty-states/        # Beautiful empty state illustrations
│       │   │   ├── logos/
│       │   │   └── icons/
│       │   └── manifest.json
│       │
│       ├── src/
│       │   ├── app/                     # Next.js App Router
│       │   │   ├── (auth)/              # Auth route group
│       │   │   │   ├── login/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── login-form.tsx
│       │   │   │   │   └── actions.ts
│       │   │   │   ├── register/
│       │   │   │   ├── forgot-password/
│       │   │   │   ├── magic-link/
│       │   │   │   └── oauth-callback/
│       │   │   │
│       │   │   ├── (dashboard)/         # Authenticated route group
│       │   │   │   ├── layout.tsx       # Dashboard shell (sidebar, header)
│       │   │   │   ├── page.tsx         # Dashboard home / redirect
│       │   │   │   │
│       │   │   │   ├── dashboard/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── components/
│       │   │   │   │       ├── kpi-cards.tsx
│       │   │   │   │       ├── task-health-chart.tsx
│       │   │   │   │       ├── productivity-chart.tsx
│       │   │   │   │       ├── workload-summary.tsx
│       │   │   │   │       ├── recent-activity.tsx
│       │   │   │   │       └── quick-actions.tsx
│       │   │   │   │
│       │   │   │   ├── projects/
│       │   │   │   │   ├── page.tsx        # Project list
│       │   │   │   │   ├── [projectId]/
│       │   │   │   │   │   ├── page.tsx    # Project detail
│       │   │   │   │   │   ├── tasks/
│       │   │   │   │   │   ├── milestones/
│       │   │   │   │   │   ├── files/
│       │   │   │   │   │   └── settings/
│       │   │   │   │   └── new/
│       │   │   │   │       └── page.tsx
│       │   │   │   │
│       │   │   │   ├── tasks/
│       │   │   │   │   ├── page.tsx        # Task list / board view
│       │   │   │   │   ├── [taskId]/
│       │   │   │   │   │   ├── page.tsx    # Task detail
│       │   │   │   │   │   └── components/
│       │   │   │   │   │       ├── task-header.tsx
│       │   │   │   │   │       ├── task-description.tsx
│       │   │   │   │   │       ├── task-activity.tsx
│       │   │   │   │   │       ├── task-comments.tsx
│       │   │   │   │   │       ├── task-checklist.tsx
│       │   │   │   │   │       ├── task-time-tracking.tsx
│       │   │   │   │   │       ├── task-attachments.tsx
│       │   │   │   │   │       ├── task-dependencies.tsx
│       │   │   │   │   │       └── task-history.tsx
│       │   │   │   │   └── components/
│       │   │   │   │       ├── task-board.tsx          # Kanban board
│       │   │   │   │       ├── task-list.tsx           # List view
│       │   │   │   │       ├── task-column.tsx         # Kanban column
│       │   │   │   │       ├── task-card.tsx           # Kanban card
│       │   │   │   │       ├── task-create-dialog.tsx
│       │   │   │   │       ├── task-filters.tsx
│       │   │   │   │       └── task-table.tsx
│       │   │   │   │
│       │   │   │   ├── calendar/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── components/
│       │   │   │   │       ├── calendar-view.tsx
│       │   │   │   │       ├── month-view.tsx
│       │   │   │   │       ├── week-view.tsx
│       │   │   │   │       ├── day-view.tsx
│       │   │   │   │       └── timeline-view.tsx
│       │   │   │   │
│       │   │   │   ├── reports/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── [reportId]/
│       │   │   │   │   ├── builder/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   └── components/
│       │   │   │   │       ├── report-chart.tsx
│       │   │   │   │       ├── report-table.tsx
│       │   │   │   │       ├── report-filters.tsx
│       │   │   │   │       ├── export-button.tsx
│       │   │   │   │       └── schedule-config.tsx
│       │   │   │   │
│       │   │   │   ├── analytics/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── components/
│       │   │   │   │       ├── burndown-chart.tsx
│       │   │   │   │       ├── velocity-chart.tsx
│       │   │   │   │       ├── sla-compliance.tsx
│       │   │   │   │       ├── heat-map.tsx
│       │   │   │   │       └── leaderboard.tsx
│       │   │   │   │
│       │   │   │   ├── teams/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── [teamId]/
│       │   │   │   │   └── components/
│       │   │   │   │       ├── team-card.tsx
│       │   │   │   │       └── team-members.tsx
│       │   │   │   │
│       │   │   │   ├── users/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── [userId]/
│       │   │   │   │   └── components/
│       │   │   │   │       ├── user-table.tsx
│       │   │   │   │       ├── user-create-dialog.tsx
│       │   │   │   │       ├── user-import-export.tsx
│       │   │   │   │       └── user-invite.tsx
│       │   │   │   │
│       │   │   │   ├── admin/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── roles/
│       │   │   │   │   │   ├── page.tsx
│       │   │   │   │   │   └── components/
│       │   │   │   │   │       ├── role-list.tsx
│       │   │   │   │   │       ├── role-editor.tsx
│       │   │   │   │   │       └── permission-grid.tsx
│       │   │   │   │   ├── departments/
│       │   │   │   │   ├── workflows/
│       │   │   │   │   ├── automation/
│       │   │   │   │   ├── integrations/
│       │   │   │   │   └── settings/
│       │   │   │   │
│       │   │   │   └── settings/
│       │   │   │       ├── page.tsx
│       │   │   │       ├── profile/
│       │   │   │       ├── security/
│       │   │   │       ├── notifications/
│       │   │   │       └── appearance/
│       │   │   │
│       │   │   ├── layout.tsx           # Root layout
│       │   │   ├── providers.tsx        # All context providers
│       │   │   ├── globals.css          # Global styles + Tailwind
│       │   │   ├── not-found.tsx
│       │   │   ├── error.tsx
│       │   │   └── loading.tsx
│       │   │
│       │   ├── components/             # Shared UI components
│       │   │   ├── ui/                  # Shadcn/ui base components
│       │   │   │   ├── button.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   ├── dropdown-menu.tsx
│       │   │   │   ├── input.tsx
│       │   │   │   ├── select.tsx
│       │   │   │   ├── table.tsx
│       │   │   │   ├── toast.tsx
│       │   │   │   ├── badge.tsx
│       │   │   │   ├── avatar.tsx
│       │   │   │   ├── card.tsx
│       │   │   │   ├── skeleton.tsx
│       │   │   │   ├── tooltip.tsx
│       │   │   │   ├── popover.tsx
│       │   │   │   ├── command.tsx
│       │   │   │   └── ... (all shadcn components)
│       │   │   │
│       │   │   ├── layout/
│       │   │   │   ├── sidebar.tsx           # Main sidebar navigation
│       │   │   │   ├── topbar.tsx            # Top navigation bar
│       │   │   │   ├── command-palette.tsx   # ⌘K command palette
│       │   │   │   ├── breadcrumbs.tsx
│       │   │   │   ├── user-menu.tsx
│       │   │   │   ├── notification-dropdown.tsx
│       │   │   │   └── search-dialog.tsx
│       │   │   │
│       │   │   ├── shared/
│       │   │   │   ├── empty-state.tsx       # Beautiful empty states
│       │   │   │   ├── loading-skeleton.tsx
│       │   │   │   ├── page-header.tsx
│       │   │   │   ├── data-table.tsx        # Reusable data table
│       │   │   │   ├── confirm-dialog.tsx
│       │   │   │   ├── status-badge.tsx
│       │   │   │   ├── priority-badge.tsx
│       │   │   │   ├── user-avatar.tsx
│       │   │   │   ├── file-upload.tsx
│       │   │   │   └── filter-bar.tsx
│       │   │   │
│       │   │   └── forms/
│       │   │       ├── rich-text-editor.tsx  # TipTap wrapper
│       │   │       ├── date-picker.tsx
│       │   │       ├── user-picker.tsx
│       │   │       ├── department-picker.tsx
│       │   │       ├── team-picker.tsx
│       │   │       ├── project-picker.tsx
│       │   │       ├── tag-input.tsx
│       │   │       └── color-picker.tsx
│       │   │
│       │   ├── lib/
│       │   │   ├── db/                  # Database layer
│       │   │   │   ├── index.ts         # Drizzle connection
│       │   │   │   ├── schema/          # Drizzle schema definitions
│       │   │   │   │   ├── index.ts
│       │   │   │   │   ├── users.ts
│       │   │   │   │   ├── organizations.ts
│       │   │   │   │   ├── departments.ts
│       │   │   │   │   ├── teams.ts
│       │   │   │   │   ├── projects.ts
│       │   │   │   │   ├── tasks.ts
│       │   │   │   │   ├── workflows.ts
│       │   │   │   │   ├── audit-logs.ts
│       │   │   │   │   └── ... (one per table)
│       │   │   │   ├── queries/         # Reusable query functions
│       │   │   │   │   ├── tasks.ts
│       │   │   │   │   ├── users.ts
│       │   │   │   │   ├── projects.ts
│       │   │   │   │   └── reports.ts
│       │   │   │   └── migrations/
│       │   │   │
│       │   │   ├── auth/                # Authentication
│       │   │   │   ├── index.ts         # Better Auth client
│       │   │   │   ├── middleware.ts     # Next.js middleware
│       │   │   │   ├── session.ts       # Session helpers
│       │   │   │   └── permissions.ts   # Permission checking
│       │   │   │
│       │   │   ├── validations/         # Zod schemas
│       │   │   │   ├── auth.ts
│       │   │   │   ├── user.ts
│       │   │   │   ├── task.ts
│       │   │   │   ├── project.ts
│       │   │   │   ├── team.ts
│       │   │   │   └── common.ts        # Shared validators
│       │   │   │
│       │   │   ├── utils/
│       │   │   │   ├── cn.ts            # clsx + tailwind-merge
│       │   │   │   ├── date.ts          # date-fns helpers
│       │   │   │   ├── id.ts            # Task ID generation (TASK-1234)
│       │   │   │   ├── permissions.ts   # Permission check helpers
│       │   │   │   ├── rate-limit.ts    # Rate limiter
│       │   │   │   └── logger.ts        # Pino logger
│       │   │   │
│       │   │   ├── queue/               # BullMQ
│       │   │   │   ├── index.ts         # Queue connection
│       │   │   │   ├── tasks/
│       │   │   │   │   ├── notification.queue.ts
│       │   │   │   │   ├── report.queue.ts
│       │   │   │   │   ├── email.queue.ts
│       │   │   │   │   └── automation.queue.ts
│       │   │   │   └── workers/
│       │   │   │       ├── notification.worker.ts
│       │   │   │       ├── report.worker.ts
│       │   │   │       └── email.worker.ts
│       │   │   │
│       │   │   ├── events/              # Internal event bus
│       │   │   │   ├── index.ts
│       │   │   │   ├── handlers/
│       │   │   │   │   ├── task-events.ts
│       │   │   │   │   ├── user-events.ts
│       │   │   │   │   └── project-events.ts
│       │   │   │   └── types.ts
│       │   │   │
│       │   │   ├── ai/                  # AI integration
│       │   │   │   ├── index.ts         # OpenAI/Claude client
│       │   │   │   ├── prompts/
│       │   │   │   │   ├── task-summary.ts
│       │   │   │   │   ├── eod-report.ts
│       │   │   │   │   ├── priority.ts
│       │   │   │   │   └── duplicate-detection.ts
│       │   │   │   └── services/
│       │   │   │       ├── task-ai.ts
│       │   │   │       └── report-ai.ts
│       │   │   │
│       │   │   ├── email/
│       │   │   │   ├── index.ts         # Email client (Resend/SendGrid)
│       │   │   │   └── templates/
│       │   │   │       ├── task-assigned.tsx
│       │   │   │       ├── task-overdue.tsx
│       │   │   │       ├── eod-report.tsx
│       │   │   │       └── invitation.tsx
│       │   │   │
│       │   │   ├── storage/             # File storage abstraction
│       │   │   │   ├── index.ts
│       │   │   │   ├── providers/
│       │   │   │   │   ├── s3.ts
│       │   │   │   │   └── minio.ts
│       │   │   │   └── virus-scanner.ts
│       │   │   │
│       │   │   ├── search/              # Meilisearch
│       │   │   │   ├── index.ts
│       │   │   │   └── indexes/
│       │   │   │       ├── tasks.ts
│       │   │   │       ├── projects.ts
│       │   │   │       └── users.ts
│       │   │   │
│       │   │   └── cache/               # Redis caching
│       │   │       ├── index.ts
│       │   │       └── keys.ts          # Cache key conventions
│       │   │
│       │   ├── server/                  # Server-side logic
│       │   │   ├── actions/             # Server Actions
│       │   │   │   ├── auth.actions.ts
│       │   │   │   ├── task.actions.ts
│       │   │   │   ├── project.actions.ts
│       │   │   │   ├── user.actions.ts
│       │   │   │   ├── team.actions.ts
│       │   │   │   ├── report.actions.ts
│       │   │   │   └── notification.actions.ts
│       │   │   │
│       │   │   ├── services/            # Domain services
│       │   │   │   ├── task.service.ts
│       │   │   │   ├── project.service.ts
│       │   │   │   ├── user.service.ts
│       │   │   │   ├── notification.service.ts
│       │   │   │   ├── report.service.ts
│       │   │   │   ├── workflow.service.ts
│       │   │   │   ├── automation.service.ts
│       │   │   │   └── audit.service.ts
│       │   │   │
│       │   │   ├── trpc/                # tRPC (alternative to Server Actions)
│       │   │   │   ├── index.ts         # tRPC server setup
│       │   │   │   ├── router.ts        # Root router
│       │   │   │   ├── context.ts       # Request context
│       │   │   │   └── routers/
│       │   │   │       ├── task.router.ts
│       │   │   │       ├── project.router.ts
│       │   │   │       ├── user.router.ts
│       │   │   │       ├── team.router.ts
│       │   │   │       └── report.router.ts
│       │   │   │
│       │   │   └── middleware/
│       │   │       ├── auth.ts          # Auth middleware
│       │   │       ├── rbac.ts          # Permission middleware
│       │   │       ├── rate-limit.ts
│       │   │       └── audit.ts         # Audit logging middleware
│       │   │
│       │   ├── hooks/                   # React hooks
│       │   │   ├── use-tasks.ts
│       │   │   ├── use-projects.ts
│       │   │   ├── use-users.ts
│       │   │   ├── use-notifications.ts
│       │   │   ├── use-time-tracking.ts
│       │   │   ├── use-keyboard-shortcuts.ts
│       │   │   ├── use-debounce.ts
│       │   │   └── use-current-user.ts
│       │   │
│       │   ├── stores/                  # Zustand stores (client state only)
│       │   │   ├── sidebar.ts
│       │   │   ├── filters.ts
│       │   │   ├── theme.ts
│       │   │   └── task-board.ts
│       │   │
│       │   └── types/                   # Shared TypeScript types
│       │       ├── index.ts
│       │       ├── task.ts
│       │       ├── user.ts
│       │       ├── project.ts
│       │       ├── organization.ts
│       │       ├── notification.ts
│       │       └── common.ts
│       │
│       ├── middleware.ts                # Next.js middleware (auth, redirects)
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── postcss.config.js
│       ├── vitest.config.ts
│       └── playwright.config.ts
│
├── packages/
│   ├── shared/                          # Shared between frontend & backend
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── validations/            # Zod schemas shared
│   │   │   ├── constants/              # Status enums, priorities, roles
│   │   │   │   ├── status.ts           # Task status, workflow states
│   │   │   │   ├── priorities.ts
│   │   │   │   └── permissions.ts      # Permission codes
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── database/                        # Database package
│       ├── src/
│       │   ├── schema/                 # All Drizzle schema definitions
│       │   ├── migrations/
│       │   ├── seed.ts                 # Seed data
│       │   └── index.ts
│       ├── drizzle.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml              # PostgreSQL, Redis, MinIO, Meilisearch
│   ├── docker-compose.prod.yml
│   └── .dockerignore
│
├── scripts/
│   ├── seed.ts                         # Full DB seed
│   ├── seed-demo.ts                    # Demo data seed
│   ├── backup.sh
│   └── migrate.sh
│
├── docs/                               # Architecture documentation
│   ├── architecture/
│   │   ├── TECH-STACK.md
│   │   └── ARCHITECTURE.md
│   ├── schema/
│   │   └── DATABASE-SCHEMA.md
│   ├── api/
│   │   └── API-DESIGN.md
│   ├── design/
│   │   └── UI-DESIGN-SYSTEM.md
│   ├── security/
│   │   └── SECURITY-ARCHITECTURE.md
│   ├── deployment/
│   │   └── DEPLOYMENT.md
│   └── testing/
│       └── TESTING-STRATEGY.md
│
├── .env.example
├── .gitignore
├── package.json                        # Root package.json (pnpm workspace)
├── pnpm-workspace.yaml
├── turbo.json                          # Turborepo config
├── tsconfig.json                       # Root tsconfig
├── eslint.config.js
├── prettier.config.js
└── README.md
```

## Key Architecture Decisions in Folder Structure

### Why `packages/` monorepo?
- **`packages/shared`** — Shared types, Zod schemas, constants between frontend and backend. Avoids duplication.
- **`packages/database`** — Schema definitions are independent of the app. Can be used by future services (cron jobs, microservices, data pipelines).

### Why Server Actions + tRPC?
- **Server Actions** — For form mutations (create task, update status). Simple, built-in.
- **tRPC** — For complex querying (filtered task lists, dashboard data). Full RPC type safety.
- Both are offered as options; you can start with Server Actions and add tRPC as complexity grows.

### Why `lib/db/queries/`?
- Reusable query functions that combine Drizzle queries with caching logic. Each query is a pure function that can be called from Server Actions, tRPC routers, or API routes.

### Why `server/services/`?
- Business logic is isolated from the transport layer. Services can be called from Server Actions, tRPC, webhooks, or background jobs.

### Why `server/events/`?
- Decoupled event-driven architecture. When a task is created, the event bus fires — notification, audit log, automation engine, and report cache invalidation all happen independently through handlers.
