import { getDb, schema } from '@workmanagement/database';
import { eq } from 'drizzle-orm';
import { sendNotificationEmail } from './email';

export type CreateNotificationInput = {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  /**
   * If true, skip the user's notification preference check and send regardless.
   * Used for critical notifications like security alerts.
   */
  force?: boolean;
};

// Map notification types to their preference keys
const TYPE_TO_PREF_KEY: Record<string, string> = {
  'task.assigned': 'task_assigned',
  'task.comment': 'task_comment',
  'task.mention': 'task_mention',
  'task.status_changed': 'task_status_changed',
  'task.completed': 'task_completed',
  'task.closed': 'task_closed',
  'task.reopened': 'task_reopened',
  'task.due_soon': 'task_due_soon',
  'task.overdue': 'task_overdue',
  'task.escalated': 'task_escalated',
};

/**
 * Check if the user has enabled email notifications for a given type.
 *
 * Looks at the user's `preferences.notifications` JSON field.
 * Defaults to `true` if no preference is set.
 */
async function shouldSendEmailForType(
  userId: string,
  type: string,
  force?: boolean,
): Promise<boolean> {
  if (force) return true;

  const prefKey = TYPE_TO_PREF_KEY[type];
  if (!prefKey) return true; // Unknown type — send by default

  try {
    const db = getDb();
    const [user] = await db
      .select({ preferences: schema.users.preferences })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user?.preferences) return true;

    const prefs = user.preferences as Record<string, unknown>;
    const notifications = prefs.notifications as Record<string, unknown> | undefined;
    if (!notifications) return true;

    const types = notifications.types as Record<string, boolean> | undefined;
    if (!types) return true;

    // Default to true if preference not explicitly set
    return types[prefKey] !== false;
  } catch {
    // If we can't read preferences, send the email to be safe
    return true;
  }
}

/**
 * Create and persist a notification in the database, then send an email
 * notification asynchronously (non-blocking) if the user has not disabled it.
 * The email send is fire-and-forget — failures are logged but never bubble up.
 *
 * Call this from API routes after relevant mutations (task assigned, comment added, etc.).
 */
export async function createNotification(data: CreateNotificationInput) {
  const db = getDb();
  const [notif] = await db
    .insert(schema.notifications)
    .values({
      organizationId: data.organizationId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message ?? null,
      link: data.link ?? null,
      actorId: data.actorId ?? null,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      metadata: (data.metadata ?? {}) as Record<string, unknown>,
    })
    .returning();

  // Fire-and-forget email notification — never block the API response
  sendEmailNotificationAsync(data).catch(() => {});

  return notif;
}

/**
 * Fetch the user's email and name from the database, then send the email.
 * Checks the user's preferences first before sending.
 * This runs asynchronously after the API response is sent.
 */
async function sendEmailNotificationAsync(
  data: CreateNotificationInput,
): Promise<void> {
  try {
    // Check if user wants email for this notification type
    const shouldSend = await shouldSendEmailForType(data.userId, data.type, data.force);
    if (!shouldSend) return;

    const db = getDb();
    const [user] = await db
      .select({ email: schema.users.email, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, data.userId))
      .limit(1);

    if (!user?.email) {
      console.warn(`[notifications] No email found for user ${data.userId}, skipping email`);
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const fullLink = data.link ? `${appUrl}${data.link}` : appUrl;

    await sendNotificationEmail({
      to: user.email,
      userName: user.name ?? 'User',
      type: data.type,
      title: data.title,
      message: data.message ?? '',
      link: fullLink,
    });
  } catch (error) {
    // Email failures are non-critical — just log and move on
    console.error(
      '[notifications] Failed to send email notification:',
      error instanceof Error ? error.message : error,
    );
  }
}
