import type { NotificationEvent } from './notifications/listener';
import { getDb, schema } from '@workmanagement/database';
import { eq, sql } from 'drizzle-orm';
import { sendNotificationEmail } from './email';
import { emitNotification } from './notifications/listener';
import { sendSlackNotification } from './slack/webhook';

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
  'report.eod_ready': 'report_eod_ready',
};

export async function shouldSendEmailForType(
  userId: string,
  type: string,
  force?: boolean,
): Promise<boolean> {
  if (force) return true;

  const prefKey = TYPE_TO_PREF_KEY[type];
  if (!prefKey) return true;

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

    const typeChannels = notifications.typeChannels as
      | Record<string, Record<string, boolean>>
      | undefined;
    const channelPrefs = typeChannels?.[prefKey];
    if (channelPrefs !== undefined && channelPrefs.email !== undefined) {
      return channelPrefs.email;
    }

    const types = notifications.types as Record<string, boolean> | undefined;
    const channels = notifications.channels as Record<string, boolean> | undefined;

    const typeEnabled = types ? types[prefKey] !== false : true;
    const emailEnabled = channels ? channels.email !== false : true;

    return typeEnabled && emailEnabled;
  } catch {
    return true;
  }
}

export async function shouldSendSlackForType(
  userId: string,
  type: string,
  force?: boolean,
): Promise<boolean> {
  if (force) return true;

  const prefKey = TYPE_TO_PREF_KEY[type];
  if (!prefKey) return true;

  try {
    const db = getDb();
    const [user] = await db
      .select({ preferences: schema.users.preferences })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user?.preferences) return false;

    const prefs = user.preferences as Record<string, unknown>;
    const notifications = prefs.notifications as Record<string, unknown> | undefined;
    if (!notifications) return false;

    const typeChannels = notifications.typeChannels as
      | Record<string, Record<string, boolean>>
      | undefined;
    const channelPrefs = typeChannels?.[prefKey];
    if (channelPrefs !== undefined && channelPrefs.slack !== undefined) {
      return channelPrefs.slack;
    }

    const types = notifications.types as Record<string, boolean> | undefined;
    const channels = notifications.channels as Record<string, boolean> | undefined;

    const typeEnabled = types ? types[prefKey] !== false : true;
    const slackEnabled = channels ? channels.slack === true : false;

    return typeEnabled && slackEnabled;
  } catch {
    return false;
  }
}

/**
 * Create and persist a notification, then send email + Slack asynchronously.
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

  const notification = notif!;

  // Fire-and-forget
  sendEmailNotificationAsync(data).catch(() => {});
  sendSlackNotificationAsync(data).catch(() => {});

  emitNotification(notification as unknown as NotificationEvent);

  try {
    await db.execute(
      sql`SELECT pg_notify(
        'notification_channel',
        ${JSON.stringify({
          userId: notification.userId,
          notificationId: notification.id,
          type: notification.type,
        })}
      )`,
    );
  } catch {
    // Non-critical
  }

  return notification;
}

async function sendEmailNotificationAsync(data: CreateNotificationInput): Promise<void> {
  try {
    const shouldSend = await shouldSendEmailForType(data.userId, data.type, data.force);
    if (!shouldSend) return;

    const db = getDb();
    const [user] = await db
      .select({ email: schema.users.email, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, data.userId))
      .limit(1);

    if (!user?.email) return;

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
    console.error('[notifications] Email failed:', error);
  }
}

/**
 * Send a simple Slack notification. Fire-and-forget.
 */
async function sendSlackNotificationAsync(data: CreateNotificationInput): Promise<void> {
  try {
    const shouldSend = await shouldSendSlackForType(data.userId, data.type, data.force);
    if (!shouldSend) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const fullLink = data.link ? `${appUrl}${data.link}` : appUrl;

    // Build simple message
    const text = data.message
      ? `*${data.title}*\n${data.message}`
      : data.title;

    const blocks: Array<Record<string, unknown>> = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text },
      },
    ];

    if (data.link) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View', emoji: true },
            url: fullLink,
            style: 'primary',
          },
        ],
      });
    }

    await sendSlackNotification(data.organizationId, { text, blocks });
  } catch {
    // Non-critical
  }
}
