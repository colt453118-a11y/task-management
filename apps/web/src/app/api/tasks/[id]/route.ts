import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, enforceOrgScope, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { eq, and, isNull } from 'drizzle-orm';
import {
  TaskUpdateSchema,
  validationError,
  isValidTransition,
  READONLY_STATUSES,
} from '@/lib/api/validation';
import { sanitizeRichText } from '@/lib/sanitize';
import { indexTask, removeTaskFromIndex } from '@/lib/search';
import { dispatchWebhookEvent } from '@/lib/webhooks/deliver';

export const runtime = 'nodejs';

function getIdFromPath(request: NextRequest): string {
  return request.nextUrl.pathname.split('/').pop()!;
}

// GET /api/tasks/[id] - Get single task (rate limited: 100 req/min per user)
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'task:view');

      const [task] = await db()
        .select()
        .from(schema.tasks)
        .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)))
        .limit(1);

      if (!task) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(task.organizationId, orgId);

      return NextResponse.json({ task });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch task');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'tasks:get' },
);

// PATCH /api/tasks/[id] - Update task (rate limited: 60 req/min per user)
export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'task:edit');

      const body = await request.json();
      const parsed = TaskUpdateSchema.safeParse(body);
      if (!parsed.success) {
        const { error: err, status } = validationError(parsed.error);
        return NextResponse.json(err, { status });
      }

      const {
        title,
        description: rawDescription,
        status,
        priority,
        assignedTo,
        dueDate,
        projectId,
      } = parsed.data;
      // Preserve `undefined` when description is not in the update body,
      // so the `if (description !== undefined)` check below skips it correctly.
      const description =
        rawDescription !== undefined ? sanitizeRichText(rawDescription) : rawDescription;

      const [existing] = await db()
        .select()
        .from(schema.tasks)
        .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)))
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(existing.organizationId, orgId);

      // ── Readonly enforcement: closed/archived tasks cannot be edited ──
      if (READONLY_STATUSES.has(existing.status)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATE',
              message: `Tasks with status '${existing.status}' cannot be edited`,
            },
          },
          { status: 422 },
        );
      }

      // ── Status transition enforcement ──
      if (status !== undefined && status !== existing.status) {
        if (!isValidTransition(existing.status, status)) {
          return NextResponse.json(
            {
              error: {
                code: 'INVALID_STATE',
                message: `Invalid status transition from '${existing.status}' to '${status}'`,
              },
            },
            { status: 422 },
          );
        }

        // Require 'task:close' permission for closing tasks
        if (status === 'closed') {
          await requirePermission(user.id, 'task:close');
        }
        // Require 'task:reopen' for reopening
        if (status === 'reopened') {
          await requirePermission(user.id, 'task:reopen');
        }
      }

      // ── Validate assignedTo belongs to same org (if changing) ──
      if (assignedTo !== undefined && assignedTo !== null) {
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

      // ── Validate projectId belongs to same org (if changing) ──
      if (projectId !== undefined && projectId !== null) {
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

      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};

      if (title !== undefined) {
        oldValues.title = existing.title;
        newValues.title = title;
      }
      if (description !== undefined) {
        oldValues.description = existing.description;
        newValues.description = description;
      }
      if (status !== undefined) {
        oldValues.status = existing.status;
        newValues.status = status;
      }
      if (priority !== undefined) {
        oldValues.priority = existing.priority;
        newValues.priority = priority;
      }
      if (assignedTo !== undefined) {
        oldValues.assignedTo = existing.assignedTo;
        newValues.assignedTo = assignedTo;
        newValues.assignedBy = user.id;
      }
      if (projectId !== undefined) {
        oldValues.projectId = existing.projectId;
        newValues.projectId = projectId;
      }
      if (dueDate !== undefined) {
        oldValues.dueDate = existing.dueDate;
        newValues.dueDate = dueDate;
      }

      const updateData: Record<string, unknown> = {
        ...newValues,
        updatedBy: user.id,
        updatedAt: new Date(),
      };

      // Track assigned_by if assignee changed
      if (assignedTo !== undefined && assignedTo !== existing.assignedTo) {
        updateData.assignedBy = user.id;
      }

      // Track completion time
      if (status === 'completed' && existing.status !== 'completed') {
        updateData.completedAt = new Date();
        updateData.completionSummary = `${existing.title} completed by ${user.id}`;
      }

      // Track closure time
      if (status === 'closed' && existing.status !== 'closed') {
        updateData.closedAt = new Date();
        updateData.closedBy = user.id;
      }

      const [task] = await db()
        .update(schema.tasks)
        .set(updateData)
        .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)))
        .returning();

      if (!task) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 },
        );
      }

      if (Object.keys(oldValues).length > 0) {
        const auditAction =
          status && status !== existing.status ? 'task.status_changed' : 'task.updated';
        await createAuditEntry({
          organizationId: orgId,
          userId: user.id,
          action: auditAction,
          entityType: 'task',
          entityId: id,
          oldValues,
          newValues,
        });

        if (status && status !== existing.status) {
          await db()
            .insert(schema.taskHistory)
            .values({
              taskId: id,
              userId: user.id,
              field: 'status',
              oldValue: existing.status,
              newValue: status,
              changeType: 'status_change',
              description: `Status changed from ${existing.status} to ${status}`,
            });
        }
      }

      // ── Create notifications for assignment changes ────────────
      if (assignedTo !== undefined && assignedTo !== existing.assignedTo && assignedTo !== null) {
        await createNotification({
          organizationId: orgId!,
          userId: assignedTo,
          type: 'task.assigned',
          title: `You've been assigned: ${existing.title}`,
          message: `Task #${existing.taskIdDisplay} was assigned to you`,
          link: `/tasks/${id}`,
          actorId: user.id,
          entityType: 'task',
          entityId: id,
        });
      }

      // ── Create notifications for status changes ───────────────
      if (status !== undefined && status !== existing.status && existing.assignedTo && existing.assignedTo !== user.id) {
        const statusLabels: Record<string, string> = {
          todo: 'To Do',
          'in_progress': 'In Progress',
          'in_review': 'In Review',
          completed: 'Completed',
          closed: 'Closed',
          reopened: 'Reopened',
          archived: 'Archived',
        };
        const fromLabel = statusLabels[existing.status] ?? existing.status;
        const toLabel = statusLabels[status] ?? status;

        await createNotification({
          organizationId: orgId!,
          userId: existing.assignedTo,
          type: status === 'completed' ? 'task.completed' : status === 'closed' ? 'task.closed' : status === 'reopened' ? 'task.reopened' : 'task.status_changed',
          title: `${existing.title} moved to ${toLabel}`,
          message: `Status changed from ${fromLabel} to ${toLabel}`,
          link: `/tasks/${id}`,
          actorId: user.id,
          entityType: 'task',
          entityId: id,
        });
      }

      // Re-index in Meilisearch (non-blocking)
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

      // Fire-and-forget webhook dispatch
      dispatchWebhookEvent(
        status !== undefined && status !== existing.status
          ? 'task.status_changed'
          : 'task.updated',
        orgId!,
        {
          taskId: task.id,
          title: task.title,
          taskIdDisplay: task.taskIdDisplay,
          status: task.status,
          priority: task.priority ?? 'medium',
          assignedTo: task.assignedTo ?? null,
          projectId: task.projectId ?? null,
          updatedBy: user.id,
          previousStatus: status !== undefined && status !== existing.status ? existing.status : undefined,
          newStatus: status !== undefined && status !== existing.status ? status : undefined,
        },
      );

      // Dispatch separate task.assigned event if assignment changed
      if (assignedTo !== undefined && assignedTo !== existing.assignedTo) {
        dispatchWebhookEvent('task.assigned', orgId!, {
          taskId: task.id,
          title: task.title,
          taskIdDisplay: task.taskIdDisplay,
          assignedTo: assignedTo,
          previousAssignee: existing.assignedTo,
          assignedBy: user.id,
        });
      }

      return NextResponse.json({ task });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update task');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'tasks:update' },
);

// DELETE /api/tasks/[id] - Soft delete task (rate limited: 30 req/min per user)
export const DELETE = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'task:delete');

      const [existing] = await db()
        .select()
        .from(schema.tasks)
        .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)))
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(existing.organizationId, orgId);

      await db()
        .update(schema.tasks)
        .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: user.id })
        .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)));

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'task.deleted',
        entityType: 'task',
        entityId: id,
        oldValues: { title: existing.title, status: existing.status },
      });

      // Remove from Meilisearch index (non-blocking)
      removeTaskFromIndex(id);

      // Fire-and-forget webhook dispatch
      dispatchWebhookEvent('task.deleted', orgId!, {
        taskId: id,
        title: existing.title,
        taskIdDisplay: existing.taskIdDisplay,
        status: existing.status,
        deletedBy: user.id,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to delete task');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'tasks:delete' },
);
