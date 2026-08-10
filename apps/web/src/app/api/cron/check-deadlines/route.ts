import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { and, isNull, lte, gte, not, inArray } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { isCronAuthorized } from '@/lib/api/cron-auth';

export const runtime = 'nodejs';

const TERMINAL_STATUSES = ['completed', 'closed', 'archived', 'cancelled'] as const;

/**
 * Find active (non-deleted, non-terminal) tasks matching a date condition.
 * Used for both due-soon and overdue checks.
 */
async function findTasksWithDeadlines(
  dateCondition: ReturnType<typeof gte> | ReturnType<typeof lte>,
  additionalCondition?: ReturnType<typeof gte>,
) {
  const conditions = [
    isNull(schema.tasks.deletedAt),
    not(inArray(schema.tasks.status, TERMINAL_STATUSES as unknown as typeof schema.tasks.status)),
    dateCondition,
  ];
  if (additionalCondition) conditions.push(additionalCondition);

  return db()
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      taskIdDisplay: schema.tasks.taskIdDisplay,
      dueDate: schema.tasks.dueDate,
      assignedTo: schema.tasks.assignedTo,
      organizationId: schema.tasks.organizationId,
    })
    .from(schema.tasks)
    .where(and(...conditions))
    .limit(100);
}

/**
 * POST /api/cron/check-deadlines
 *
 * Scheduled task (e.g. via Vercel Cron Jobs) that checks for tasks with
 * approaching or past-due deadlines and sends notifications.
 *
 * Security: Requires CRON_SECRET in Authorization header or matching query param.
 *
 * Phases:
 *   1. Due Soon — tasks with dueDate within the next 24 hours
 *   2. Overdue — tasks with dueDate in the past, not completed/closed/archived
 */
export const POST = async (request: NextRequest) => {
  try {
    // ── Auth (fails closed — see lib/api/cron-auth) ───────────
    if (!isCronAuthorized(request)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing CRON_SECRET' } },
        { status: 401 },
      );
    }

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const results = {
      dueSoon: { found: 0, notified: 0 },
      overdue: { found: 0, notified: 0 },
    };

    // ── Phase 1: Due Soon ─────────────────────────────────────
    // Tasks with dueDate within the next 24 hours, not in terminal status
    const dueSoonTasks = await findTasksWithDeadlines(
      lte(schema.tasks.dueDate, twentyFourHoursFromNow),
      gte(schema.tasks.dueDate, now),
    );

    results.dueSoon.found = dueSoonTasks.length;

    for (const task of dueSoonTasks) {
      if (!task.assignedTo) continue;

      try {
        await createNotification({
          organizationId: task.organizationId,
          userId: task.assignedTo,
          type: 'task.due_soon',
          title: task.title,
          message: `Task #${task.taskIdDisplay} is due within 24 hours (${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'soon'})`,
          link: `/tasks/${task.id}`,
          entityType: 'task',
          entityId: task.id,
          metadata: { dueDate: task.dueDate?.toISOString() ?? null },
        });
        results.dueSoon.notified++;
      } catch (err) {
        console.error('[cron] Failed to send due_soon notification:', err);
        results.dueSoon.notified = results.dueSoon.notified; // counted as errored in logging
      }
    }

    // ── Phase 2: Overdue ──────────────────────────────────────
    // Tasks past their dueDate, not in terminal status
    const overdueTasks = await findTasksWithDeadlines(
      lte(schema.tasks.dueDate, now),
    );

    results.overdue.found = overdueTasks.length;

    for (const task of overdueTasks) {
      if (!task.assignedTo) continue;

      try {
        await createNotification({
          organizationId: task.organizationId,
          userId: task.assignedTo,
          type: 'task.overdue',
          title: task.title,
          message: `Task #${task.taskIdDisplay} is overdue (was due ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'unknown'})`,
          link: `/tasks/${task.id}`,
          entityType: 'task',
          entityId: task.id,
          metadata: { dueDate: task.dueDate?.toISOString() ?? null },
        });
        results.overdue.notified++;
      } catch (err) {
        console.error('[cron] Failed to send overdue notification:', err);
        results.overdue.notified = results.overdue.notified;
      }
    }

    return NextResponse.json({
      ok: true,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    const { error: err, status } = handleApiError(error, 'Failed to check deadlines');
    return NextResponse.json(err, { status });
  }
};
