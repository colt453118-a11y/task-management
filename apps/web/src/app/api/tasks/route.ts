import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission, checkPermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull, like, or, sql, inArray } from 'drizzle-orm';
import { TaskCreateSchema, validationError } from '@/lib/api/validation';
import { sanitizeRichText } from '@/lib/sanitize';
import { indexTask } from '@/lib/search';

export const runtime = 'nodejs';

// GET /api/tasks - List tasks (rate limited: 100 req/min per user)
// Role-aware visibility:
// - Users with 'task:view' permission see:
//   - tasks assigned to them
//   - tasks they created
//   - tasks where they are mentioned (mentionedUserIds contains user.id)
// - Users with 'task:view_all' permission see all tasks in the org
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'task:view');

      const canViewAll = await checkPermission(user.id, 'task:view_all');
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId');
      const status = searchParams.get('status');
      const assignedTo = searchParams.get('assignedTo');
      const priority = searchParams.get('priority');
      const searchParam = searchParams.get('search');
      const watchedBy = searchParams.get('watchedBy');
      const showDeleted = searchParams.get('deleted') === 'true';
      const deletedBy = searchParams.get('deletedBy');
      const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
      const fieldsOnly = searchParams.get('fields') === 'id';

      const conditions = [eq(schema.tasks.organizationId, orgId!)];

      if (showDeleted) {
        // Show only soft-deleted tasks
        conditions.push(sql`${schema.tasks.deletedAt} IS NOT NULL`);
      } else {
        // Normal view: hide deleted tasks
        conditions.push(isNull(schema.tasks.deletedAt));
      }

      if (deletedBy) conditions.push(eq(schema.tasks.updatedBy, deletedBy));

      // Role-aware data scoping: without task:view_all, only see tasks
      // that are assigned to the user, created by the user, or mention the user
      if (!canViewAll) {
        const scopeFilter = or(
          eq(schema.tasks.assignedTo, user.id),
          eq(schema.tasks.createdBy, user.id),
          sql`${user.id} = ANY(${schema.tasks.mentionedUserIds})`,
        );
        if (scopeFilter) conditions.push(scopeFilter);
      }

      if (projectId) conditions.push(eq(schema.tasks.projectId, projectId));
      if (status) conditions.push(eq(schema.tasks.status, status));
      if (assignedTo) conditions.push(eq(schema.tasks.assignedTo, assignedTo));
      if (priority) conditions.push(eq(schema.tasks.priority, priority));
      if (searchParam) {
        const searchClause = or(
          like(schema.tasks.title, `%${searchParam}%`),
          like(schema.tasks.description, `%${searchParam}%`),
          like(schema.tasks.taskIdDisplay, `%${searchParam}%`),
        );
        if (searchClause) conditions.push(searchClause);
      }

      // Filter by watched tasks — find all task IDs watched by this user
      if (watchedBy === 'me') {
        const watchedTaskIds = await db()
          .select({ taskId: schema.taskWatchers.taskId })
          .from(schema.taskWatchers)
          .where(eq(schema.taskWatchers.userId, user.id));

        const ids = watchedTaskIds.map((w) => w.taskId);
        if (ids.length > 0) {
          conditions.push(inArray(schema.tasks.id, ids));
        } else {
          return NextResponse.json({ tasks: [] });
        }
      }

      // Get total count (ignoring pagination)
      const [countResult] = await db()
        .select({ count: sql<number>`count(*)` })
        .from(schema.tasks)
        .where(and(...conditions));
      const total = Number(countResult?.count ?? 0);

      // fields=id mode: return just IDs for cross-page batch selection
      if (fieldsOnly) {
        const idRows = await db()
          .select({ id: schema.tasks.id })
          .from(schema.tasks)
          .where(and(...conditions))
          .orderBy(desc(schema.tasks.createdAt))
          .limit(limit)
          .offset(offset);

        return NextResponse.json({ ids: idRows.map((r) => r.id), total });
      }

      let tasks;

      if (showDeleted) {
        // Include the name of the user who deleted the task (via updatedBy)
        const rows = await db()
          .select({
            task: schema.tasks,
            updatedByName: schema.users.name,
          })
          .from(schema.tasks)
          .leftJoin(schema.users, eq(schema.tasks.updatedBy, schema.users.id))
          .where(and(...conditions))
          .orderBy(desc(schema.tasks.updatedAt))
          .limit(limit)
          .offset(offset);

        tasks = rows.map((r) => ({
          ...r.task,
          updatedByName: r.updatedByName,
        }));
      } else {
        tasks = await db()
          .select()
          .from(schema.tasks)
          .where(and(...conditions))
          .orderBy(desc(schema.tasks.createdAt))
          .limit(limit)
          .offset(offset);
      }

      return NextResponse.json({ tasks, total });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch tasks');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'tasks:list' },
);

// POST /api/tasks - Create task (rate limited: 30 req/min per user)
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'task:create');

      const body = await request.json();
      const parsed = TaskCreateSchema.safeParse(body);
      if (!parsed.success) {
        const { error: err, status } = validationError(parsed.error);
        return NextResponse.json(err, { status });
      }

      const {
        title,
        description: rawDescription,
        projectId,
        milestoneId,
        priority,
        assignedTo,
        dueDate,
      } = parsed.data;
      const description = sanitizeRichText(rawDescription);

      // Validate project org scope if projectId provided
      if (projectId) {
        const [project] = await db()
          .select({ id: schema.projects.id, organizationId: schema.projects.organizationId })
          .from(schema.projects)
          .where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)))
          .limit(1);
        if (!project) {
          return NextResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Project not found' } },
            { status: 404 },
          );
        }
        if (project.organizationId !== orgId) {
          return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Cross-organization project access denied' } },
            { status: 403 },
          );
        }
      }

      // Validate assignedTo is in same org if provided
      if (assignedTo) {
        const [assigneeUser] = await db()
          .select({
            id: schema.users.id,
            organizationId: schema.users.organizationId,
            isActive: schema.users.isActive,
            isSuspended: schema.users.isSuspended,
          })
          .from(schema.users)
          .where(eq(schema.users.id, assignedTo))
          .limit(1);
        if (!assigneeUser) {
          return NextResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Assigned user not found' } },
            { status: 404 },
          );
        }
        if (assigneeUser.organizationId !== orgId) {
          return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Cross-organization assignment denied' } },
            { status: 403 },
          );
        }
        if (!assigneeUser.isActive || assigneeUser.isSuspended) {
          return NextResponse.json(
            {
              error: {
                code: 'INVALID_STATE',
                message: 'Cannot assign task to inactive or suspended user',
              },
            },
            { status: 422 },
          );
        }
      }

      const [task] = await db()
        .insert(schema.tasks)
        .values({
          title,
          description,
          projectId,
          milestoneId,
          priority,
          assignedTo,
          assignedBy: assignedTo ? user.id : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          organizationId: orgId!,
          createdBy: user.id,
          updatedBy: user.id,
          taskIdDisplay: `TASK-${Date.now().toString(36).toUpperCase()}`,
          status: 'open',
        })
        .returning();

      if (!task) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create task' } },
          { status: 500 },
        );
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'task.created',
        entityType: 'task',
        entityId: task.id,
        newValues: { title, priority, status: 'open', assignedTo },
      });

      // Index in Meilisearch (non-blocking)
      indexTask({
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        taskIdDisplay: task.taskIdDisplay,
        status: task.status,
        priority: task.priority ?? 'medium',
        assignedTo: task.assignedTo ?? null,
        projectId: task.projectId ?? null,
        organizationId: orgId!,
        labels: (task.labels as string[] | null) ?? null,
        tags: (task.tags as string[] | null) ?? null,
        createdAt: (task.createdAt as Date).toISOString(),
        updatedAt: (task.updatedAt as Date).toISOString(),
      });

      return NextResponse.json({ task }, { status: 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to create task');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'tasks:create' },
);
