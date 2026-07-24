import { getDb, schema } from '@workmanagement/database';
import { and, lt, isNull, notInArray, inArray, gte, eq } from 'drizzle-orm';

// ─── Constants ──────────────────────────────────────────────

/** Terminal statuses that should never be checked for overdue */
const TERMINAL_STATUSES = ['completed', 'closed', 'cancelled', 'archived'];

/** Minimum time between overdue notifications for the same task (6 hours) */
const OVERDUE_COOLDOWN_HOURS = 6;

// ─── Types ──────────────────────────────────────────────────

export interface OverdueTaskResult {
  taskId: string;
  taskTitle: string;
  organizationId: string;
  dueDate: string;
  status: string;
  priority: string | null;
  assignedTo: string | null;
  rulesFired: number;
}

export interface OverdueCheckResult {
  checkedAt: string;
  totalOverdueTasks: number;
  tasksProcessed: number;
  tasksSkippedDuplicates: number;
  results: OverdueTaskResult[];
  errors: Array<{ taskId: string; error: string }>;
}

// ─── Overdue Logic ──────────────────────────────────────────

/**
 * Find all overdue tasks across all organizations and fire
 * automation rules for each one.
 *
 * Idempotency: tasks that already had an overdue trigger fired
 * within the last OVERDUE_COOLDOWN_HOURS are skipped.
 */
export async function checkOverdueTasks(): Promise<OverdueCheckResult> {
  const checkedAt = new Date().toISOString();
  const results: OverdueTaskResult[] = [];
  const errors: Array<{ taskId: string; error: string }> = [];
  let tasksProcessed = 0;
  let tasksSkippedDuplicates = 0;

  try {
    const db = getDb();

    // ── 1. Find all overdue tasks ──────────────────────────
    // Tasks with dueDate in the past, not deleted, and not in a terminal status
    const now = new Date();

    const overdueTasks = await db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        organizationId: schema.tasks.organizationId,
        dueDate: schema.tasks.dueDate,
        status: schema.tasks.status,
        priority: schema.tasks.priority,
        assignedTo: schema.tasks.assignedTo,
        createdBy: schema.tasks.createdBy,
        description: schema.tasks.description,
        taskIdDisplay: schema.tasks.taskIdDisplay,
      })
      .from(schema.tasks)
      .where(
        and(
          isNull(schema.tasks.deletedAt),
          lt(schema.tasks.dueDate, now),
          notInArray(schema.tasks.status, TERMINAL_STATUSES),
        ),
      );

    if (overdueTasks.length === 0) {
      return {
        checkedAt,
        totalOverdueTasks: 0,
        tasksProcessed: 0,
        tasksSkippedDuplicates: 0,
        results: [],
        errors: [],
      };
    }

    // ── 2. Check idempotency — skip tasks that were recently notified ──
    const cooldownStart = new Date(now.getTime() - OVERDUE_COOLDOWN_HOURS * 60 * 60 * 1000);

    // Get recently logged overdue triggers scoped to these task IDs
    const taskIds = overdueTasks.map((t) => t.id);
    const recentLogs = await db
      .select({
        id: schema.automationLogs.id,
        entityId: schema.automationLogs.entityId,
        createdAt: schema.automationLogs.createdAt,
      })
      .from(schema.automationLogs)
      .where(
        and(
          eq(schema.automationLogs.trigger, 'task.overdue'),
          gte(schema.automationLogs.createdAt, cooldownStart),
          inArray(schema.automationLogs.entityId, taskIds),
        ),
      );

    const recentlyProcessedIds = new Set(recentLogs.map((log) => log.entityId));

    // ── 3. Process each overdue task ───────────────────────
    const { evaluateAutomationRules } = await import('@/lib/automation/engine');

    for (const task of overdueTasks) {
      if (recentlyProcessedIds.has(task.id)) {
        tasksSkippedDuplicates++;
        continue;
      }

      try {
        // Cron-triggered events use null as the userId since no real user performed the action
        const ruleResults = await evaluateAutomationRules('task.overdue', {
          organizationId: task.organizationId,
          triggeredByUserId: null,
          entityType: 'task',
          entityId: task.id,
          data: {
            id: task.id,
            title: task.title,
            taskIdDisplay: task.taskIdDisplay,
            dueDate: task.dueDate,
            status: task.status,
            priority: task.priority ?? 'medium',
            assignedTo: task.assignedTo ?? null,
            createdBy: task.createdBy,
            description: task.description,
          },
        });

        results.push({
          taskId: task.id,
          taskTitle: task.title,
          organizationId: task.organizationId,
          dueDate: task.dueDate?.toISOString() ?? 'unknown',
          status: task.status,
          priority: task.priority,
          assignedTo: task.assignedTo,
          rulesFired: ruleResults.length,
        });

        tasksProcessed++;
      } catch (taskError) {
        errors.push({
          taskId: task.id,
          error: taskError instanceof Error ? taskError.message : 'Unknown error',
        });
      }
    }
  } catch (error) {
    console.error('[overdue] Failed to check overdue tasks:', error);
    throw error;
  }

  return {
    checkedAt,
    totalOverdueTasks: results.length + tasksSkippedDuplicates,
    tasksProcessed,
    tasksSkippedDuplicates,
    results,
    errors,
  };
}
