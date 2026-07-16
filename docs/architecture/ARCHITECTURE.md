# System Architecture — Enterprise Work Management Platform

## Architecture Philosophy

- **Clean Architecture** — Domain, Application, Infrastructure, and Presentation layers
- **DDD (Domain-Driven Design)** — Bounded contexts for each module (Auth, Organization, Project, Task, Reporting, etc.)
- **Modular Monolith** (Phase 1) → **Microservices** (Phase 3+) — start deployed as a cohesive unit, split when needed
- **Event-Driven** — Internal event bus for cross-module communication (task.created → notification, audit.log)

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                                │
│  Browser (Web App)    ↔    Mobile (future)    ↔    API        │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS/WSS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS 16 APPLICATION                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   PRESENTATION LAYER                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │Dashboard │ │  Tasks   │ │ Projects │ │  Reports   │ │  │
│  │  │ Pages    │ │   Pages  │ │  Pages   │ │   Pages    │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │ Admin    │ │ Settings │ │  Teams   │ │ Calendar   │ │  │
│  │  │ Pages    │ │   Pages  │ │  Pages   │ │   Pages    │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            │                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    APPLICATION LAYER                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │  tRPC    │ │  Server  │ │   Auth   │ │  Middleware │ │  │
│  │  │ Routers  │ │ Actions  │ │  (Better)│ │ (Logging,  │ │  │
│  │  │          │ │          │ │          │ │  RateLimit)│ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │              EVENT BUS (EventEmitter)              │   │  │
│  │  │  task.created → notification.email + audit.log     │   │  │
│  │  │  task.completed → report.update + team.notify      │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            │                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    DOMAIN LAYER                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │  Auth    │ │   User   │ │   Org    │ │  Project   │ │  │
│  │  │ Domain   │ │  Domain  │ │  Domain  │ │  Domain    │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │  Task    │ │ Workflow │ │  Report  │ │Notification│ │  │
│  │  │ Domain   │ │  Domain  │ │  Domain  │ │  Domain    │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            │                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  INFRASTRUCTURE LAYER                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │ Drizzle  │ │  Redis   │ │   S3     │ │  BullMQ    │ │  │
│  │  │ + PG     │ │  Cache   │ │  Files   │ │  Queues    │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │Meilisearch│ │ OpenAI   │ │ Sentry   │ │  Pino      │ │  │
│  │  │  Search  │ │  AI      │ │  Errors  │ │  Logs      │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                           │
│  PostgreSQL    Redis     S3/MinIO    Meilisearch    OpenAI    │
│  (Primary DB)  (Cache)   (Files)     (Search)       (AI)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Bounded Contexts (DDD)

Each module is a bounded context with its own domain models, services, and data.

| Context             | Responsibility                                           | Data Ownership                               |
| ------------------- | -------------------------------------------------------- | -------------------------------------------- |
| **Auth**            | Authentication, sessions, MFA, device management         | users, sessions, devices                     |
| **Organization**    | Org, departments, teams, hierarchy                       | organizations, departments, teams            |
| **User Management** | Users, roles, permissions, invitations                   | users, roles, permissions                    |
| **Project**         | Projects, milestones, goals                              | projects, milestones, goals                  |
| **Task**            | Tasks, subtasks, checklists, dependencies, time tracking | tasks, task_history, time_entries            |
| **Workflow**        | Workflow engine, status transitions, automation rules    | workflows, workflow_states, automation_rules |
| **Calendar**        | Calendar events, due dates, leave, holidays              | calendars, calendar_events                   |
| **Notification**    | In-app, email, push notifications                        | notifications, notification_preferences      |
| **Report**          | Reports, analytics, dashboards                           | report_definitions, report_data              |
| **File**            | File uploads, storage, validation                        | files, file_versions                         |
| **Audit**           | Audit logs, activity feed                                | audit_logs, activity_logs                    |
| **Search**          | Full-text search indexing                                | (uses Meilisearch)                           |

---

## Data Flow Patterns

### Read Flow (Server Components)

```
Browser → Next.js RSC → tRPC/Server Function → Drizzle Query → PostgreSQL
                                                     ↓
                                              Redis Cache (check/update)
```

### Mutation Flow (Server Actions / tRPC Mutation)

```
Browser → Server Action → Auth Check → Zod Validation → Drizzle Mutation → PostgreSQL
                                                              ↓
                                                      Event Bus → Notifications
                                                              ↓
                                                      Redis Cache Invalidation
                                                              ↓
                                                      BullMQ Job (if async)
```

### Background Job Flow

```
BullMQ Queue → Worker Process → Drizzle Query → PostgreSQL
                                      ↓
                               Send Email / Push / Slack
                                      ↓
                               Update Report Cache
```

---

## Authentication Flow (Better Auth)

```
1. User visits login page
2. Server Component renders login form
3. User submits credentials
4. Server Action validates via Better Auth
5. Better Auth verifies against PostgreSQL
6. JWT/ Session token set as httpOnly cookie
7. Middleware checks session on every request
8. Session data available in RSC via headers()
```

---

## Caching Strategy

| Cache Layer              | What                                    | TTL                    | Invalidation               |
| ------------------------ | --------------------------------------- | ---------------------- | -------------------------- |
| **React Cache**          | RSC data                                | Request dedup          | Per-request                |
| **Redis**                | Task lists, user profiles, project data | 5 min                  | On mutation (event-driven) |
| **Redis**                | Session data                            | Session TTL            | On logout/expire           |
| **Redis**                | Rate limit counters                     | Sliding window         | Automatic                  |
| **CDN**                  | Static assets, report exports           | Varies                 | On deploy                  |
| **SWR (TanStack Query)** | Client-side lists                       | Stale-while-revalidate | On mutation refetch        |

---

## Error Handling Strategy

```
Layer              Handler
──────────────────────────────────────────
Zod Schema         → Field-level validation errors
Server Action      → throw new TRPCError / FormState errors
Domain Service     → throw new DomainError(code, message)
Infrastructure     → DatabaseError → 500 / NotFoundError → 404
Global Handler     → Error Boundary (UI) / Sentry capture
```

All errors are:

1. Logged via Pino
2. Captured by Sentry
3. Returned as structured API errors
4. Displayed to user in toast notifications

---

## Performance Targets

| Metric                | Target                          |
| --------------------- | ------------------------------- |
| Page Load (logged in) | < 1.5s (TTFB < 200ms)           |
| Task List Render      | < 500ms for 1000 tasks          |
| Search Results        | < 100ms                         |
| API Response (p95)    | < 200ms                         |
| Dashboard Load        | < 2s                            |
| Report Generation     | < 5s (async if > 5s)            |
| Concurrent Users      | 10,000+                         |
| Database Rows         | 100M+ tasks (with partitioning) |

---

## Modularity & Microservice Readiness

The architecture is designed so each bounded context can be extracted into a microservice:

1. **Shared kernel** — Types, Zod schemas, domain interfaces in a `packages/shared` workspace
2. **Event contract** — Each context publishes/subscribes to typed events via Redis pub/sub (future) or internal event bus (now)
3. **Database isolation** — Each context has its own schema namespace in PostgreSQL, can be moved to separate DB later
4. **API gateway pattern** — tRPC routers can be delegated to external services behind a BFF (Backend for Frontend)

---

## Scalability Architecture

```
                    ┌──────────────┐
                    │  Load Balancer │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ Next.js│  │ Next.js│  │ Next.js│  ← Horizontal scaling
         │  App   │  │  App   │  │  App   │
         └───┬────┘  └───┬────┘  └───┬────┘
             │           │           │
             ▼           ▼           ▼
         ┌─────────────────────────────────┐
         │         PostgreSQL (Primary)     │
         │         Read Replicas            │  ← Read scaling
         └─────────────────────────────────┘
                            │
         ┌─────────────────────────────────┐
         │         Redis Cluster           │  ← Cache, sessions, queues
         └─────────────────────────────────┘
```

---

## Security Boundary

```
Internet
   │
   ▼
┌────────────────────────┐
│  WAF / CDN              │  ← DDoS protection, rate limiting
│  Cloudflare / AWS WAF   │
└──────────┬─────────────┘
           │
┌──────────▼─────────────┐
│  Next.js App             │
│  ┌───────────────────┐  │
│  │ Auth Middleware    │  │  ← Session validation, CSRF
│  ├───────────────────┤  │
│  │ RBAC Guard        │  │  ← Permission check per route
│  ├───────────────────┤  │
│  │ Rate Limiter      │  │  ← Redis-based rate limiting
│  ├───────────────────┤  │
│  │ Input Validation  │  │  ← Zod schema validation
│  └───────────────────┘  │
└─────────────────────────┘
           │
           ▼
┌────────────────────────┐
│  Database              │
│  • Parameterized SQL   │  ← SQL injection protection
│  • Row-Level Security  │  ← Multi-tenant isolation
│  • Encrypted at rest   │
└────────────────────────┘
```
