import type { AutomationContext } from './engine';

// ─── Action Definitions ────────────────────────────────────

export interface NotifyActionConfig {
  userIds: string[];
  message: string;
  type?: string;
}

export interface ChangeStatusActionConfig {
  status: string;
}

export interface AssignActionConfig {
  userId: string;
}

export interface AddLabelActionConfig {
  label: string;
}

export interface ChangePriorityActionConfig {
  priority: string;
}

export interface EscalateActionConfig {
  message: string;
  userIds?: string[];
}

export type ActionConfig =
  | { type: 'notify'; config: NotifyActionConfig }
  | { type: 'change_status'; config: ChangeStatusActionConfig }
  | { type: 'assign'; config: AssignActionConfig }
  | { type: 'add_label'; config: AddLabelActionConfig }
  | { type: 'change_priority'; config: ChangePriorityActionConfig }
  | { type: 'escalate'; config: EscalateActionConfig };

// ─── Execute Action ────────────────────────────────────────

/**
 * Execute a single automation action within the given context.
 *
 * @throws If the action fails for any reason.
 */
export async function executeAction(
  action: { type: string; config: Record<string, unknown> },
  context: AutomationContext,
): Promise<void> {
  switch (action.type) {
    case 'notify':
      await executeNotify(action.config as unknown as NotifyActionConfig, context);
      break;
    case 'change_status':
      await executeChangeStatus(action.config as unknown as ChangeStatusActionConfig, context);
      break;
    case 'assign':
      await executeAssign(action.config as unknown as AssignActionConfig, context);
      break;
    case 'add_label':
      await executeAddLabel(action.config as unknown as AddLabelActionConfig, context);
      break;
    case 'change_priority':
      await executeChangePriority(action.config as unknown as ChangePriorityActionConfig, context);
      break;
    case 'escalate':
      await executeEscalate(action.config as unknown as EscalateActionConfig, context);
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// ─── Action Implementations ────────────────────────────────

async function executeNotify(
  config: NotifyActionConfig,
  context: AutomationContext,
): Promise<void> {
  const { userIds, message } = config;
  if (!userIds || userIds.length === 0) {
    throw new Error('No user IDs specified for notification');
  }

  // Attempt to notify each user via the notification system
  const { createNotification } = await import('@/lib/notifications');

  for (const userId of userIds) {
    try {
      await createNotification({
        organizationId: context.organizationId,
        userId,
        type: 'automation.triggered',
        title: 'Automation Triggered',
        message: message || `A rule was triggered for ${context.entityType}`,
        link: `/${context.entityType}s/${context.entityId}`,
        entityType: context.entityType,
        entityId: context.entityId,
      });
    } catch {
      // Individual notification failures shouldn't stop others
      console.warn(`[automation] Failed to notify user ${userId}`);
    }
  }
}

async function executeChangeStatus(
  config: ChangeStatusActionConfig,
  context: AutomationContext,
): Promise<void> {
  const { status } = config;
  if (!status) throw new Error('No status specified');

  if (context.entityType !== 'task') {
    throw new Error(`change_status action not supported for entity type: ${context.entityType}`);
  }

  const { getDb, schema } = await import('@workmanagement/database');
  const { eq, isNull, and } = await import('drizzle-orm');

  const db = getDb();
  await db
    .update(schema.tasks)
    .set({
      status,
      updatedAt: new Date(),
      updatedBy: context.triggeredByUserId,
    })
    .where(
      and(
        eq(schema.tasks.id, context.entityId),
        isNull(schema.tasks.deletedAt),
      ),
    );
}

async function executeAssign(
  config: AssignActionConfig,
  context: AutomationContext,
): Promise<void> {
  const { userId } = config;
  if (!userId) throw new Error('No user ID specified for assignment');

  if (context.entityType !== 'task') {
    throw new Error(`assign action not supported for entity type: ${context.entityType}`);
  }

  const { getDb, schema } = await import('@workmanagement/database');
  const { eq, isNull, and } = await import('drizzle-orm');

  const db = getDb();
  await db
    .update(schema.tasks)
    .set({
      assignedTo: userId,
      assignedBy: context.triggeredByUserId,
      updatedAt: new Date(),
      updatedBy: context.triggeredByUserId,
    })
    .where(
      and(
        eq(schema.tasks.id, context.entityId),
        isNull(schema.tasks.deletedAt),
      ),
    );
}

async function executeAddLabel(
  config: AddLabelActionConfig,
  context: AutomationContext,
): Promise<void> {
  const { label } = config;
  if (!label) throw new Error('No label specified');

  if (context.entityType !== 'task') {
    throw new Error(`add_label action not supported for entity type: ${context.entityType}`);
  }

  const { getDb, schema } = await import('@workmanagement/database');
  const { eq, isNull, and } = await import('drizzle-orm');

  const db = getDb();

  // Get current task to read existing labels
  const [task] = await db
    .select({ id: schema.tasks.id, labels: schema.tasks.labels })
    .from(schema.tasks)
    .where(
      and(eq(schema.tasks.id, context.entityId), isNull(schema.tasks.deletedAt)),
    )
    .limit(1);

  if (!task) throw new Error('Task not found');

  const currentLabels: string[] = (task.labels as string[]) ?? [];
  if (currentLabels.includes(label)) return; // Already has the label

  await db
    .update(schema.tasks)
    .set({
      labels: [...currentLabels, label],
      updatedAt: new Date(),
      updatedBy: context.triggeredByUserId,
    })
    .where(
      and(eq(schema.tasks.id, context.entityId), isNull(schema.tasks.deletedAt)),
    );
}

async function executeChangePriority(
  config: ChangePriorityActionConfig,
  context: AutomationContext,
): Promise<void> {
  const { priority } = config;
  if (!priority) throw new Error('No priority specified');

  if (context.entityType !== 'task') {
    throw new Error(`change_priority action not supported for entity type: ${context.entityType}`);
  }

  const { getDb, schema } = await import('@workmanagement/database');
  const { eq, isNull, and } = await import('drizzle-orm');

  const db = getDb();
  await db
    .update(schema.tasks)
    .set({
      priority,
      updatedAt: new Date(),
      updatedBy: context.triggeredByUserId,
    })
    .where(
      and(
        eq(schema.tasks.id, context.entityId),
        isNull(schema.tasks.deletedAt),
      ),
    );
}

async function executeEscalate(
  config: EscalateActionConfig,
  context: AutomationContext,
): Promise<void> {
  const { message, userIds } = config;

  if (context.entityType !== 'task') {
    throw new Error(`escalate action not supported for entity type: ${context.entityType}`);
  }

  // First, change priority to critical
  const { getDb, schema } = await import('@workmanagement/database');
  const { eq, isNull, and } = await import('drizzle-orm');

  const db = getDb();
  await db
    .update(schema.tasks)
    .set({
      priority: 'critical',
      updatedAt: new Date(),
      updatedBy: context.triggeredByUserId,
    })
    .where(
      and(
        eq(schema.tasks.id, context.entityId),
        isNull(schema.tasks.deletedAt),
      ),
    );

  // Notify the escalation recipients
  if (userIds && userIds.length > 0) {
    const { createNotification } = await import('@/lib/notifications');
    for (const userId of userIds) {
      try {
        await createNotification({
          organizationId: context.organizationId,
          userId,
          type: 'task.escalated',
          title: '⚠️ Task Escalated',
          message: message || `Task has been escalated`,
          link: `/${context.entityType}s/${context.entityId}`,
          entityType: context.entityType,
          entityId: context.entityId,
        });
      } catch {
        console.warn(`[automation] Failed to escalate to user ${userId}`);
      }
    }
  }
}
