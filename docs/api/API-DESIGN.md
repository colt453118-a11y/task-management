# API Design — Enterprise Work Management Platform

## API Philosophy

- **Server Actions first** — For simple mutations, use Next.js Server Actions. Type-safe, no manual API layer.
- **tRPC for complex queries** — When you need filtered, paginated, sorted data with type safety end-to-end.
- **REST API for external consumers** — OpenAPI-documented REST endpoints for webhooks and integrations.
- **GraphQL optional** — Can be added later for complex nested query patterns.

---

## API Architecture Layers

```
External Clients (Webhooks, Integrations, Mobile)
        │
        ▼
┌──────────────────────────┐
│     REST API (Next.js)    │  ← For external consumers
│   /api/v1/*               │     OpenAPI documented
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│   tRPC HTTP / RSC         │  ← For client-side queries
│   Internal type-safe RPC   │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│   Server Actions (Forms)  │  ← For form submissions
│   useActionState          │     Direct DB access
└──────────────────────────┘
```

---

## Server Action Examples

```typescript
// lib/server/actions/task.actions.ts
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { requireAuth, requirePermission } from '@/lib/auth';
import { eventBus } from '@/lib/events';
import { revalidatePath } from 'next/cache';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
});

export type CreateTaskResult = 
  | { success: true; task: Task }
  | { success: false; errors: Record<string, string[]> };

export async function createTask(
  prevState: CreateTaskResult | null,
  formData: FormData
): Promise<CreateTaskResult> {
  // 1. Authenticate
  const session = await requireAuth();
  
  // 2. Authorize
  await requirePermission('task:create');
  
  // 3. Validate
  const parsed = CreateTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }
  
  // 4. Execute
  const [task] = await db.insert(tasks).values({
    ...parsed.data,
    organizationId: session.orgId,
    createdBy: session.userId,
    taskIdDisplay: await generateTaskId(session.orgId),
  }).returning();
  
  // 5. Fire events
  eventBus.emit('task.created', { task, userId: session.userId });
  
  // 6. Revalidate cache
  revalidatePath('/tasks');
  
  return { success: true, task };
}
```

---

## tRPC Router Examples

```typescript
// lib/server/trpc/routers/task.router.ts
import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../trpc';
import { db } from '@/lib/db';
import { tasks, taskAssignees } from '@/lib/db/schema';
import { and, eq, inArray, desc, sql } from 'drizzle-orm';

export const taskRouter = router({
  // Get task list with filters
  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid().optional(),
      status: z.array(z.string()).optional(),
      assignedTo: z.string().uuid().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']).optional(),
      search: z.string().optional(),
      cursor: z.string().optional(),       // cursor-based pagination
      limit: z.number().min(1).max(100).default(50),
      sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'status']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(tasks.organizationId, ctx.session.orgId),
        eq(tasks.deletedAt, null),
      ];
      
      if (input.projectId) conditions.push(eq(tasks.projectId, input.projectId));
      if (input.status) conditions.push(inArray(tasks.status, input.status));
      if (input.assignedTo) conditions.push(eq(tasks.assignedTo, input.assignedTo));
      
      const results = await db.select()
        .from(tasks)
        .where(and(...conditions))
        .limit(input.limit + 1)           // Fetch one extra for cursor
        .orderBy(
          input.sortOrder === 'desc' 
            ? desc(tasks[input.sortBy])
            : sql`${tasks[input.sortBy]} ASC`
        );
      
      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, input.limit) : results;
      const nextCursor = hasMore ? items[items.length - 1].id : null;
      
      return { items, nextCursor, hasMore };
    }),
  
  // Get single task with relations
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const task = await db.query.tasks.findFirst({
        where: and(
          eq(tasks.id, input.id),
          eq(tasks.organizationId, ctx.session.orgId),
          eq(tasks.deletedAt, null)
        ),
        with: {
          assignees: true,
          comments: true,
          attachments: true,
          checklistItems: true,
          dependencies: true,
          watchers: true,
          // ... other relations
        },
      });
      
      if (!task) throw new TRPCError({ code: 'NOT_FOUND' });
      
      return task;
    }),
  
  // Bulk status update
  bulkUpdateStatus: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.string().uuid()).min(1).max(100),
      status: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requirePermission('task:update');
      
      const result = await db.update(tasks)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(
            inArray(tasks.id, input.taskIds),
            eq(tasks.organizationId, ctx.session.orgId)
          )
        )
        .returning({ id: tasks.id });
      
      // Fire events for each task
      for (const task of result) {
        eventBus.emit('task.statusChanged', { taskId: task.id, newStatus: input.status });
      }
      
      return { updated: result.length };
    }),
});
```

---

## REST API Endpoints

```typescript
// /api/v1/tasks
GET    /api/v1/tasks                    // List tasks (paginated, filtered)
POST   /api/v1/tasks                    // Create task
GET    /api/v1/tasks/:id                // Get task details
PATCH  /api/v1/tasks/:id                // Update task
DELETE /api/v1/tasks/:id                // Soft delete task
POST   /api/v1/tasks/:id/comments       // Add comment
POST   /api/v1/tasks/:id/attachments    // Upload attachment
POST   /api/v1/tasks/:id/time-entries   // Log time
POST   /api/v1/tasks/bulk-status        // Bulk status update
POST   /api/v1/tasks/bulk-assign        // Bulk assign

// /api/v1/projects
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id
GET    /api/v1/projects/:id/tasks       // Tasks in project
GET    /api/v1/projects/:id/report      // Project report

// /api/v1/users
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
POST   /api/v1/users/import             // Bulk import CSV/Excel
GET    /api/v1/users/export             // Bulk export
POST   /api/v1/users/invite             // Invite users
GET    /api/v1/users/me                 // Current user profile
PATCH  /api/v1/users/me/settings        // Update settings

// /api/v1/teams
GET    /api/v1/teams
POST   /api/v1/teams
GET    /api/v1/teams/:id
PATCH  /api/v1/teams/:id
DELETE /api/v1/teams/:id

// /api/v1/departments
GET    /api/v1/departments
POST   /api/v1/departments
GET    /api/v1/departments/:id
PATCH  /api/v1/departments/:id
DELETE /api/v1/departments/:id

// /api/v1/roles
GET    /api/v1/roles
POST   /api/v1/roles
GET    /api/v1/roles/:id
PATCH  /api/v1/roles/:id
DELETE /api/v1/roles/:id
GET    /api/v1/roles/:id/permissions

// /api/v1/reports
GET    /api/v1/reports
POST   /api/v1/reports
GET    /api/v1/reports/:id
DELETE /api/v1/reports/:id
POST   /api/v1/reports/:id/generate
GET    /api/v1/reports/:id/download
POST   /api/v1/reports/:id/schedule

// /api/v1/analytics
GET    /api/v1/analytics/dashboard       // Dashboard KPIs
GET    /api/v1/analytics/productivity    // Productivity metrics
GET    /api/v1/analytics/workload        // Workload distribution
GET    /api/v1/analytics/sla             // SLA compliance
GET    /api/v1/analytics/velocity        // Task velocity

// /api/v1/notifications
GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all
GET    /api/v1/notifications/unread-count

// /api/v1/audit-logs
GET    /api/v1/audit-logs               // With filters: action, entity, user, date range

// /api/v1/search
GET    /api/v1/search?q=...              // Global search
```

---

## Common API Patterns

### Pagination (Cursor-Based)
```typescript
// Request
GET /api/v1/tasks?cursor=abc123&limit=50&status=in_progress

// Response
{
  "data": [...],
  "pagination": {
    "nextCursor": "def456",
    "hasMore": true,
    "total": 1250          // Optional, heavy on large datasets
  }
}
```

### Filtering
```typescript
// Filter syntax
GET /api/v1/tasks?filters=status:in_progress,priority:high&search=login page

// Equivalent tRPC input
{
  filters: [
    { field: "status", operator: "eq", value: "in_progress" },
    { field: "priority", operator: "eq", value: "high" }
  ],
  search: "login page"
}
```

### Error Response Format
```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "title": ["Title is required"],
      "dueDate": ["Due date must be in the future"]
    },
    "requestId": "req_abc123"
  }
}
```

### Rate Limiting Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1623456789
Retry-After: 42
```

---

## Webhooks

```typescript
// Webhook event format
POST https://customer.com/webhooks/workmanagement
Content-Type: application/json
X-Webhook-Signature: sha256=...

{
  "event": "task.status_changed",
  "timestamp": "2026-01-15T10:30:00Z",
  "data": {
    "taskId": "uuid",
    "taskIdDisplay": "TASK-1042",
    "previousStatus": "in_progress",
    "newStatus": "completed",
    "changedBy": "uuid",
    "projectId": "uuid"
  }
}
```

Webhook events:
- `task.created`, `task.updated`, `task.status_changed`, `task.assigned`
- `task.completed`, `task.closed`, `task.reopened`
- `comment.created`, `attachment.uploaded`
- `project.created`, `project.completed`
- `user.created`, `user.deactivated`
- `milestone.completed`
- `sla.breached`, `sla.warning`

---

## OpenAPI Documentation

Auto-generated via `@asteasolutions/zod-to-openapi`:

```typescript
// lib/api/openapi.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/v1/tasks',
  summary: 'List tasks',
  tags: ['Tasks'],
  request: {
    query: z.object({
      status: z.string().optional(),
      projectId: z.string().uuid().optional(),
      limit: z.coerce.number().default(50),
      cursor: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated task list',
      content: { 'application/json': { schema: taskListSchema } },
    },
  },
});
```
