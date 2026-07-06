# WorkManager

> Enterprise work & task management platform — a modern Jira/Linear alternative.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM · PostgreSQL · Better Auth · Redis · MinIO · Meilisearch

---

## Quick Start

```bash
# 1. Start infrastructure (Postgres, Redis, MinIO, Meilisearch, Mailpit)
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env

# 4. Push database schema
pnpm db:push

# 5. Seed initial data (org, roles, permissions, default admin)
pnpm db:seed

# 6. Start development server
pnpm dev
```

Or use the automated setup script:
```bash
chmod +x scripts/setup.sh && ./scripts/setup.sh
```

Open [http://localhost:3000](http://localhost:3000) and create an account.

---

## Architecture

### Monorepo Structure

```
workmanagement/
├── apps/
│   └── web/                  # Next.js 15 web application
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/      # REST API routes
│       │   │   ├── auth/     # Auth pages (login, register, etc.)
│       │   │   └── (dashboard)/ # Dashboard pages
│       │   ├── components/
│       │   │   ├── layout/   # Sidebar, Topbar
│       │   │   └── ui/       # UI component library
│       │   └── lib/
│       │       ├── api/      # Shared API utilities
│       │       ├── auth/     # Better Auth config
│       │       └── utils/    # Utility functions
│       └── ...
├── packages/
│   ├── database/             # Drizzle ORM schema & migrations
│   │   ├── src/
│   │   │   ├── schema/       # 30+ database tables
│   │   │   ├── seed.ts       # Database seed script
│   │   │   └── index.ts      # Database connection
│   │   └── drizzle.config.ts
│   └── shared/               # Shared types, constants, permissions
│       └── src/
│           ├── types/        # TypeScript type definitions
│           ├── constants/    # Status labels, priorities, colors
│           └── index.ts
├── docker-compose.yml        # PostgreSQL, Redis, MinIO, Meilisearch, Mailpit
└── scripts/                  # Setup & dev scripts
```

### Database Schema (30+ tables)

| Module | Tables |
|--------|--------|
| **Core** | organizations, users, departments, teams, teamMembers |
| **Auth** | accounts, sessions, verificationTokens, loginHistory |
| **Roles & Permissions** | roles, permissions, rolePermissions, userRoles |
| **Projects** | projects, milestones |
| **Tasks** | tasks, taskAssignees, taskHistory, taskComments, taskAttachments, taskChecklistItems, taskDependencies, taskWatchers, timeEntries |

### Authentication

Better Auth handles all authentication with:
- Email/password authentication
- Google & Microsoft OAuth (configurable)
- Forgot/reset password flow
- Session management with cookie-based auth
- Rate limiting

### API Routes

All routes are protected by middleware and wired with Drizzle ORM queries:

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/[...all]` | GET, POST | Better Auth handler |
| `/api/tasks` | GET, POST | List & create tasks |
| `/api/tasks/[id]` | GET, PATCH, DELETE | CRUD for individual tasks |
| `/api/projects` | GET, POST | List & create projects |
| `/api/teams` | GET, POST | List & create teams |
| `/api/users` | GET | List users (searchable, filterable) |
| `/api/users/[id]` | GET, PATCH | Read & update users |

---

## Development

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10
- **Docker** (for PostgreSQL, Redis, MinIO, Meilisearch)

### Commands

```bash
pnpm dev          # Start dev server (localhost:3000)
pnpm build        # Production build
pnpm typecheck    # TypeScript type checking
pnpm lint         # Lint all packages
pnpm test         # Run tests

# Database
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema to database
pnpm db:seed      # Seed with initial data
pnpm db:studio    # Open Drizzle Studio
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Random secret for auth tokens |
| `NEXT_PUBLIC_APP_URL` | ✅ | Application URL |
| `AUTH_GOOGLE_ID` | OAuth | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | OAuth | Google OAuth client secret |
| `AUTH_MICROSOFT_ID` | OAuth | Microsoft OAuth client ID |
| `AUTH_MICROSOFT_SECRET` | OAuth | Microsoft OAuth client secret |

### Infrastructure Services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Caching & queues |
| MinIO | 9000/9001 | File storage (S3-compatible) |
| Meilisearch | 7700 | Full-text search |
| Mailpit | 1025/8025 | Email testing UI |

---

## Project Status

### ✅ Completed
- Database schema with 30+ tables and relations
- Authentication (sign-up, sign-in, forgot/reset password)
- Dashboard layout with sidebar navigation & theme toggle
- Dashboard page with KPI cards, activity feed, deadlines
- Tasks list page with search & status filters
- Projects list page with progress tracking
- Teams & departments management page
- Reports overview page
- Calendar page with monthly grid
- Settings page with tabs (general, security, team, notifications)
- REST API routes wired with Drizzle ORM queries
- Shared types, constants, and permission definitions
- Tailwind CSS v4 with custom design tokens
- UI component library (Card, Input, Dialog, Select, Badge, Avatar, etc.)
- Docker Compose for local development
- Database seed script

### 🔜 Roadmap
- Dependencies & task relationships
- Drag-and-drop Kanban board
- Time tracking & reporting
- File attachments (MinIO integration)
- Full-text search (Meilisearch)
- Email notifications
- RBAC permission enforcement
- Webhooks & integrations
- Mobile responsive design
- Performance monitoring (Sentry)

---

## Tech Stack

| Category | Choice |
|----------|--------|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS v4 |
| **Database ORM** | Drizzle ORM |
| **Database** | PostgreSQL 17 |
| **Auth** | Better Auth |
| **State** | TanStack Query + Zustand |
| **Forms** | React Hook Form + Zod |
| **UI Library** | Radix UI primitives |
| **Icons** | Lucide React |
| **Rich Text** | TipTap |
| **Drag & Drop** | dnd-kit |
| **Charts** | Recharts + Tremor |
| **Caching** | Redis (BullMQ) |
| **Search** | Meilisearch |
| **Storage** | MinIO (S3-compatible) |
| **Package Manager** | pnpm workspaces |
| **Monorepo Tool** | Turborepo |
| **Container** | Docker Compose |
