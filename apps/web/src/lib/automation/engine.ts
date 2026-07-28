import { getDb, schema } from '@workmanagement/database';
import { eq, and, isNull } from 'drizzle-orm';
import { evaluateConditions } from './conditions';
import { executeAction } from './actions';

// ─── Types ──────────────────────────────────────────────────

export type TriggerEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.assigned'
  | 'task.comment_added'
  | 'task.overdue'
  | 'task.completed'
  | 'task.closed'
  | 'task.reopened'
  | 'task.deleted'
  | 'project.created'
  | 'project.updated'
  | 'project.completed';

export interface AutomationContext {
  organizationId: string;
  triggeredByUserId: string | null;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  /** Previous values (for update events) */
  previousValues?: Record<string, unknown>;
}

export interface ExecutionResult {
  ruleId: string;
  ruleName: string;
  conditionsMet: boolean;
  actionsResults: Array<{ type: string; success: boolean; message?: string }>;
  success: boolean;
  durationMs: number;
  errorMessage?: string;
}

// ─── Trigger Labels (for UI) ────────────────────────────────

export const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  'task.created': 'Task Created',
  'task.updated': 'Task Updated',
  'task.status_changed': 'Task Status Changed',
  'task.assigned': 'Task Assigned',
  'task.comment_added': 'Comment Added',
  'task.overdue': 'Task Overdue',
  'task.completed': 'Task Completed',
  'task.closed': 'Task Closed',
  'task.reopened': 'Task Reopened',
  'task.deleted': 'Task Deleted',
  'project.created': 'Project Created',
  'project.updated': 'Project Updated',
  'project.completed': 'Project Completed',
};

export const TRIGGER_DESCRIPTIONS: Record<TriggerEvent, string> = {
  'task.created': 'Fires when a new task is created',
  'task.updated': 'Fires when a task is updated',
  'task.status_changed': 'Fires when a task status changes',
  'task.assigned': 'Fires when a task is assigned to someone',
  'task.comment_added': 'Fires when a comment is added to a task',
  'task.overdue': 'Fires when a task becomes overdue',
  'task.completed': 'Fires when a task is completed',
  'task.closed': 'Fires when a task is closed',
  'task.reopened': 'Fires when a closed task is reopened',
  'task.deleted': 'Fires when a task is deleted',
  'project.created': 'Fires when a new project is created',
  'project.updated': 'Fires when a project is updated',
  'project.completed': 'Fires when a project is completed',
};

// ─── Action Labels (for UI) ─────────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
  notify: 'Send Notification',
  change_status: 'Change Status',
  assign: 'Assign To',
  add_label: 'Add Label',
  change_priority: 'Change Priority',
  escalate: 'Escalate',
};

export const ACTION_ICONS: Record<string, string> = {
  notify: 'Bell',
  change_status: 'ArrowRightLeft',
  assign: 'UserPlus',
  add_label: 'Tag',
  change_priority: 'Flag',
  escalate: 'AlertTriangle',
};

// ─── Condition Operators (for UI) ───────────────────────────

export const CONDITION_OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
] as const;

export const CONDITION_FIELDS = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignedTo', label: 'Assignee' },
  { value: 'projectId', label: 'Project' },
  { value: 'labels', label: 'Labels' },
  { value: 'tags', label: 'Tags' },
  { value: 'title', label: 'Title' },
  { value: 'estimatedHours', label: 'Estimated Hours' },
  { value: 'isOverdue', label: 'Is Overdue' },
] as const;

// ─── Core Engine ────────────────────────────────────────────

/**
 * Evaluate and execute automation rules for a given trigger event.
 * This is called after the primary action (e.g., task creation) completes.
 */
export async function evaluateAutomationRules(
  event: TriggerEvent,
  context: AutomationContext,
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  try {
    const db = getDb();

    // Find all enabled rules matching the trigger and organization
    const rules = await db
      .select()
      .from(schema.automationRules)
      .where(
        and(
          eq(schema.automationRules.organizationId, context.organizationId),
          eq(schema.automationRules.trigger, event),
          eq(schema.automationRules.enabled, true),
          isNull(schema.automationRules.deletedAt),
        ),
      );

    if (rules.length === 0) return results;

    for (const rule of rules) {
      const ruleStart = Date.now();
      const actionResults: Array<{ type: string; success: boolean; message?: string }> = [];

      try {
        // ── Check cooldown ──────────────────────────────────
        const cooldownMinutes = rule.cooldownMinutes ?? 0;
        if (cooldownMinutes > 0 && rule.lastTriggeredAt) {
          const cooldownEnd = new Date(rule.lastTriggeredAt);
          cooldownEnd.setMinutes(cooldownEnd.getMinutes() + cooldownMinutes);
          if (new Date() < cooldownEnd) {
            // Skip — still in cooldown
            continue;
          }
        }

        // ── Evaluate conditions ─────────────────────────────
        const rawConditions = rule.conditions;
        const conditionsArray = Array.isArray(rawConditions) ? rawConditions : [];
        const conditionsMet =
          conditionsArray.length === 0 || evaluateConditions(conditionsArray, context.data);

        // ── Execute actions ─────────────────────────────────
        if (conditionsMet) {
          const rawActions = rule.actions as Array<Record<string, unknown>> | null;
          const actions: Array<{ type: string; config: Record<string, unknown> }> =
            (rawActions as Array<{ type: string; config: Record<string, unknown> }>) ?? [];

          for (const action of actions) {
            const actionStart = Date.now();
            try {
              await executeAction(action, context);
              actionResults.push({
                type: action.type,
                success: true,
                message: `Executed ${action.type} (${Date.now() - actionStart}ms)`,
              });
            } catch (actionError) {
              actionResults.push({
                type: action.type,
                success: false,
                message: actionError instanceof Error ? actionError.message : 'Unknown error',
              });
            }
          }

          // Update rule stats
          await db
            .update(schema.automationRules)
            .set({
              lastTriggeredAt: new Date(),
              executionCount: (rule.executionCount ?? 0) + 1,
              updatedAt: new Date(),
            })
            .where(eq(schema.automationRules.id, rule.id));
        }

        const durationMs = Date.now() - ruleStart;
        const allActionsSucceeded = actionResults.every((a) => a.success);

        // ── Log execution ───────────────────────────────────
        await db.insert(schema.automationLogs).values({
          organizationId: context.organizationId,
          ruleId: rule.id,
          ruleName: rule.name,
          trigger: event,
          entityType: context.entityType,
          entityId: context.entityId,
          conditionsMet,
          actionsExecuted: actionResults,
          success: allActionsSucceeded,
          errorMessage: allActionsSucceeded ? null : 'One or more actions failed',
          durationMs,
          triggeredByUserId: context.triggeredByUserId,
          metadata: {
            entityData: context.data,
            previousValues: context.previousValues,
          },
        });

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          conditionsMet,
          actionsResults: actionResults,
          success: allActionsSucceeded,
          durationMs,
          errorMessage: allActionsSucceeded ? undefined : 'One or more actions failed',
        });
      } catch (ruleError) {
        const durationMs = Date.now() - ruleStart;
        const errorMsg = ruleError instanceof Error ? ruleError.message : 'Unknown error';

        // Log the failure
        await db.insert(schema.automationLogs).values({
          organizationId: context.organizationId,
          ruleId: rule.id,
          ruleName: rule.name,
          trigger: event,
          entityType: context.entityType,
          entityId: context.entityId,
          conditionsMet: false,
          actionsExecuted: [],
          success: false,
          errorMessage: errorMsg,
          durationMs,
          triggeredByUserId: context.triggeredByUserId,
          metadata: { error: errorMsg, entityData: context.data },
        });

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          conditionsMet: false,
          actionsResults: [],
          success: false,
          durationMs,
          errorMessage: errorMsg,
        });
      }
    }
  } catch (error) {
    // Automation engine should never crash the app
    console.error(
      '[automation] Engine error:',
      error instanceof Error ? error.message : error,
    );
  }

  return results;
}
