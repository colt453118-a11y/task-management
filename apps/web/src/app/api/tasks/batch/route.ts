import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { VALID_PRIORITIES, READONLY_STATUSES } from '@/lib/api/validation';

export const runtime = 'nodejs';

export const BatchUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, 'At least one task ID is required').max(100, 'Maximum 100 tasks per batch operation'),
  action: z.enum(['change_status', 'change_priority', 'assign', 'delete', 'restore', 'permanent_delete']),
  value: z.string().min(1, 'Value is required'),
}).strict('Unexpected fields');

// POST /api/tasks/batch - Perform batch operations on tasks
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const body = await request.json();
      const parsed = BatchUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid batch operation data',
              details: parsed.error.flatten().fieldErrors,
            },
          },
          { status: 400 },
        );
      }

      const { taskIds, action, value } = parsed.data;

      // For restore/permanent_delete, find deleted tasks; for other actions, find active tasks
      const deletedCondition = action === 'restore' || action === 'permanent_delete'
        ? sql`${schema.tasks.deletedAt} IS NOT NULL`
        : isNull(schema.tasks.deletedAt);

      // Verify all tasks exist and belong to the org
      const tasks = await db()
        .select({
          id: schema.tasks.id,
          organizationId: schema.tasks.organizationId,
          status: schema.tasks.status,
        })
        .from(schema.tasks)
        .where(
          and(
            inArray(schema.tasks.id, taskIds),
            deletedCondition,
          ),
        );

      if (tasks.length !== taskIds.length) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'One or more tasks not found' } },
          { status: 404 },
        );
      }

      // Verify all tasks belong to the same org
      for (const task of tasks) {
        if (task.organizationId !== orgId) {
          return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Cross-organization operation denied' } },
            { status: 403 },
          );
        }
      }

      // Check for read-only tasks (skip for restore and permanent_delete actions)
      if (action !== 'restore' && action !== 'permanent_delete') {
        const readOnlyTasks = tasks.filter((t) => READONLY_STATUSES.has(t.status));
        if (readOnlyTasks.length > 0) {
          return NextResponse.json(
            {
              error: {
                code: 'INVALID_STATE',
                message: `Cannot modify ${readOnlyTasks.length} task(s) with closed or archived status`,
              },
            },
            { status: 422 },
          );
        }
      }

      let updatedCount = 0;

      if (action === 'restore') {
        // Batch restore soft-deleted tasks
        await requirePermission(user.id, 'task:delete');

        await db()
          .update(schema.tasks)
          .set({ deletedAt: null, updatedAt: new Date(), updatedBy: user.id })
          .where(inArray(schema.tasks.id, taskIds));

        updatedCount = taskIds.length;
      } else if (action === 'delete') {
        // Bulk soft delete
        await requirePermission(user.id, 'task:delete');

        await db()
          .update(schema.tasks)
          .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: user.id })
          .where(inArray(schema.tasks.id, taskIds));

        updatedCount = taskIds.length;
      } else if (action === 'change_status') {
        await requirePermission(user.id, 'task:edit');

        await db()
          .update(schema.tasks)
          .set({ status: value, updatedBy: user.id, updatedAt: new Date() })
          .where(inArray(schema.tasks.id, taskIds));

        updatedCount = taskIds.length;
      } else if (action === 'change_priority') {
        if (!VALID_PRIORITIES.includes(value as typeof VALID_PRIORITIES[number])) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: `Invalid priority: '${value}'` } },
            { status: 400 },
          );
        }

        await requirePermission(user.id, 'task:edit');

        await db()
          .update(schema.tasks)
          .set({ priority: value, updatedBy: user.id, updatedAt: new Date() })
          .where(inArray(schema.tasks.id, taskIds));

        updatedCount = taskIds.length;
      } else if (action === 'permanent_delete') {
        // Batch permanent delete
        await requirePermission(user.id, 'task:delete');

        await db()
          .delete(schema.tasks)
          .where(inArray(schema.tasks.id, taskIds));

        updatedCount = taskIds.length;
      } else if (action === 'assign') {
        await requirePermission(user.id, 'task:assign');

        // Validate assignee belongs to the org
        const [assignee] = await db()
          .select({ id: schema.users.id, organizationId: schema.users.organizationId, isActive: schema.users.isActive, isSuspended: schema.users.isSuspended })
          .from(schema.users)
          .where(eq(schema.users.id, value))
          .limit(1);

        if (!assignee) {
          return NextResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Assigned user not found' } },
            { status: 404 },
          );
        }

        if (assignee.organizationId !== orgId) {
          return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Cross-organization assignment denied' } },
            { status: 403 },
          );
        }

        if (!assignee.isActive || assignee.isSuspended) {
          return NextResponse.json(
            { error: { code: 'INVALID_STATE', message: 'Cannot assign tasks to inactive or suspended user' } },
            { status: 422 },
          );
        }

        await db()
          .update(schema.tasks)
          .set({ assignedTo: value, assignedBy: user.id, updatedBy: user.id, updatedAt: new Date() })
          .where(inArray(schema.tasks.id, taskIds));

        updatedCount = taskIds.length;
      }

      // Audit the batch operation
      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: `tasks.batch_${action}`,
        entityType: 'task',
        newValues: { taskIds, action, value, updatedCount },
      });

      return NextResponse.json({
        success: true,
        updatedCount,
        action,
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to perform batch operation');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 20, namespace: 'tasks:batch' },
);
