# Tech Stack — Enterprise Work Management Platform

## Decision Framework

Every technology choice is evaluated against:
- **Enterprise readiness** — production stability, security, compliance
- **Scalability** — horizontal scaling, caching, background processing
- **Developer experience** — TypeScript safety, tooling, documentation
- **Ecosystem & longevity** — community health, maintenance, talent availability
- **Cost efficiency** — open-source-first, predictable pricing at scale

---

## Stack Overview

```
Frontend (Next.js 16)         Backend (Next.js + Drizzle)      Infrastructure
┌─────────────────────┐       ┌──────────────────────┐        ┌──────────────┐
│ React 19            │       │ Server Actions       │        │ Docker        │
│ Tailwind CSS v4     │       │ tRPC (type-safe API)  │        │ GitHub Actions│
│ Shadcn/ui + Radix   │       │ Drizzle ORM           │        │ Sentry        │
│ TanStack Query      │◄─────►│ Better Auth           │◄──────►│ OpenTelemetry │
│ TipTap (rich text)  │       │ BullMQ (queues)       │        │ MinIO/S3      │
│ dnd-kit (Kanban)    │       │ Zod (validation)      │        │ Redis         │
│ Tremor (charts)     │       │                          │        │ PostgreSQL    │
└─────────────────────┘       └──────────────────────────┘        └──────────────┘
```

---

## Layer-by-Layer Breakdown

### 1. Runtime & Language

| Choice | Version | Rationale |
|--------|---------|-----------|
| **Node.js** | 22 LTS | Long-term support, native ESM, built-in test runner, performance improvements |
| **TypeScript** | 5.7+ | Strict mode throughout. Non-negotiable for enterprise code quality |
| **Package Manager** | pnpm | Disk-efficient, strict dependency isolation, fast |

### 2. Frontend Framework

| Choice | Rationale |
|--------|-----------|
| **Next.js 16** (App Router) | React Server Components for minimal client JS, Server Actions for type-safe mutations, ISR for reporting dashboards, excellent DX |
| **React 19** | Concurrent features, server components, improved hooks |
| **React Server Components** | Render task lists, dashboards, reports on server — send minimal JS to client |

**Why not SPA-only?** Enterprise platforms need SEO for public report sharing, fast initial loads on slow networks, and reduced client bundle size. Next.js delivers all of these.

### 3. Styling & UI Components

| Choice | Rationale |
|--------|-----------|
| **Tailwind CSS v4** | Utility-first, CSS-first config, CSS variables for theming, no runtime |
| **Shadcn/ui** | Copy-paste components built on Radix — full ownership, no dependency lock-in |
| **Radix UI Primitives** | Accessible (WCAG AA), headless, unstyled primitives for modals, dropdowns, popovers, etc. |
| **Framer Motion** | Layout animations for Kanban board, micro-interactions |

### 4. State Management & Data Fetching

| Choice | Rationale |
|--------|-----------|
| **TanStack Query v5** | Server state management — caching, refetching, optimistic updates (critical for task assignment/completion UX) |
| **Zustand** | Minimal client state (UI state, filters, sidebar state). Not for server data |
| **Zod** | Runtime validation of all API inputs/outputs. Shared schemas between client and server |
| **tRPC** | End-to-end type safety between frontend and backend. Automatic TypeScript inference |

### 5. Database & ORM

| Choice | Rationale |
|--------|-----------|
| **PostgreSQL 17** | The only correct choice for enterprise relational data. MVCC, JSONB for custom fields, full-text search, partitioning, row-level security |
| **Drizzle ORM** | Type-safe, SQL-like API, zero-cold-start (critical for serverless), migration system, supports raw SQL when needed |
| **Redis 7** | Caching (task queries, user sessions), BullMQ job queue, rate limiting, real-time pub/sub |

**Why Drizzle over Prisma?**
- No heavy engine binary — faster cold starts in serverless
- SQL-like syntax — easier to optimize queries
- Lighter bundle — important for edge deployments
- Better bulk insert/update performance for audit logs

### 6. Authentication & Authorization

| Choice | Rationale |
|--------|-----------|
| **Better Auth** | Open-source, self-hosted, full data ownership. Built for B2B: organizations, teams, roles in your own DB. Supports email/password, OAuth (Google, Microsoft), Magic Link, SSO-ready |
| **RBAC (Custom)** | Granular permission system per the spec — every permission (View, Create, Edit, Delete, Assign, Approve, Close, Reopen, Export, etc.) independently configurable |

**Why not Clerk/Auth0/NextAuth?**
- **Better Auth** stores everything in your PostgreSQL DB — join directly on users, roles, permissions
- No vendor lock-in for the identity layer
- Free and open-source with no user limits
- Magic link, 2FA, session management, device tracking built-in

### 7. Rich Text Editor

| Choice | Rationale |
|--------|-----------|
| **TipTap** (ProseMirror) | Headless, extendable, Notion-like experience. Slash commands, @-mentions, checklists, nested blocks, collaborative editing via Yjs |

Alternatives considered: Lexical (more low-level), BlockNote (less flexible).

### 8. Drag & Drop

| Choice | Rationale |
|--------|-----------|
| **dnd-kit** | Best DX for Kanban boards. Built-in sortable preset, keyboard accessibility, excellent TypeScript. Handles column-to-column movement naturally |

### 9. Charts & Data Visualization

| Choice | Rationale |
|--------|-----------|
| **Tremor** | Built on Recharts + Tailwind. Beautiful dashboards, consistent design, React Server Component compatible |
| **Recharts** | For custom chart types not covered by Tremor |

### 10. Background Jobs & Queues

| Choice | Rationale |
|--------|-----------|
| **BullMQ** | Redis-backed job queue. Handles notifications, report generation, EOD summaries, automation engine, audit log batch inserts |
| **Bull Board** | Dashboard UI for monitoring job queues in development |

### 11. Forms

| Choice | Rationale |
|--------|-----------|
| **react-hook-form** | Performant, minimal re-renders |
| **Zod** | Schema validation shared between client/server |

### 12. Search

| Choice | Rationale |
|--------|-----------|
| **Meilisearch** (primary) | Blazing fast typo-tolerant full-text search. Instant results for task ID, project, user, comments, custom fields |
| **PostgreSQL full-text search** (fallback) | For simple searches without additional infrastructure. Meilisearch for advanced/enterprise |

### 13. File Storage

| Environment | Choice |
|-------------|--------|
| Development | MinIO (S3-compatible local) |
| Production | AWS S3 or Cloudflare R2 |
| CDN | Cloudflare or AWS CloudFront |

### 14. AI / LLM Integration

| Choice | Rationale |
|--------|-----------|
| **OpenAI API** / **Anthropic Claude** | AI task summaries, EOD reports, priority suggestions, duplicate detection, writing assistant |
| **Vercel AI SDK** | Unified interface for LLM calls, streaming, tool use |

### 15. Monitoring & Observability

| Choice | Rationale |
|--------|-----------|
| **Sentry** | Error tracking, performance monitoring, release health |
| **OpenTelemetry** | Distributed tracing, metrics export |
| **Pino** | Structured JSON logging |
| **Health checks** | `/api/health` endpoint, database connection pool monitoring, queue health |

### 16. Testing

| Choice | Rationale |
|--------|-----------|
| **Vitest** | Fast, Jest-compatible, TypeScript-native unit/integration tests |
| **Playwright** | End-to-end testing across browsers, API testing, visual regression |
| **MSW** (Mock Service Worker) | API mocking for tests — intercepts at network level |

### 17. Deployment & DevOps

| Choice | Rationale |
|--------|-----------|
| **Docker** | Containerized deployment, reproducible environments |
| **Docker Compose** | Local development with PostgreSQL, Redis, MinIO, Meilisearch |
| **GitHub Actions** | CI/CD — lint, typecheck, test, build, deploy |
| **Terraform** | (Phase 2) Infrastructure as Code for production |
| **Kubernetes** | (Phase 3) For multi-region, auto-scaling enterprise deployment |

### 18. Hosting Options

| Option | Best For | Considerations |
|--------|----------|----------------|
| **Railway** | Startup/medium scale | Simple deploy, built-in PostgreSQL, Redis |
| **AWS (ECS/EKS)** | Enterprise | Full control, compliance, multi-region |
| **Vercel** | Frontend hosting | If using Next.js, excellent for frontend + serverless functions. Pair with separate DB |

---

## Complete Dependency Map (package.json groups)

```jsonc
// Dependencies by concern

// Core
"next": "^16",
"react": "^19",
"react-dom": "^19",
"typescript": "^5.7",

// UI
"tailwindcss": "^4",
"@radix-ui/*": "^2",
"@shadcn/ui": "latest",
"framer-motion": "^12",

// Data & API
"@tanstack/react-query": "^5",
"@trpc/*": "^11",
"zod": "^3.23",
"zustand": "^5",

// Database
"drizzle-orm": "^0.38",
"@neondatabase/serverless": "^1",
"postgres": "^3",
"redis": "^4",

// Auth
"better-auth": "^1",

// Rich Text
"@tiptap/react": "^2",
"@tiptap/starter-kit": "^2",
"@tiptap/extension-mention": "^2",
"@tiptap/extension-task-item": "^2",
"@tiptap/extension-task-list": "^2",

// Drag & Drop
"@dnd-kit/core": "^6",
"@dnd-kit/sortable": "^8",
"@dnd-kit/utilities": "^3",

// Charts
"@tremor/react": "^4",
"recharts": "^2",

// Forms
"react-hook-form": "^7",
"@hookform/resolvers": "^3",

// Background Jobs
"bullmq": "^5",

// AI
"@ai-sdk/openai": "^1",
"ai": "^4",

// Search
"meilisearch": "^0.42",

// Validation
"zod": "^3.23",

// Logging
"pino": "^9",
"pino-pretty": "^11",

// Utils
"clsx": "^2",
"tailwind-merge": "^2",
"date-fns": "^4",
"nanoid": "^5",
"lucide-react": "^0.460"
```

---

## Why These Choices Win Together

1. **End-to-end type safety**: Drizzle + tRPC + Zod + TypeScript means a change in the database schema propagates type safety all the way to the UI — zero manual type maintenance.

2. **Single language**: TypeScript everywhere — frontend, backend, scripts, tests. No context switching.

3. **Minimal dependencies**: Shadcn gives you component code in your repo. Drizzle is lightweight. No bloated frameworks.

4. **Production-proven**: Every library listed powers major production applications at scale.

5. **Extensible**: Modular architecture means each layer can be replaced independently as needs evolve.
