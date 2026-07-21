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
};

/**
 * Create and persist a notification in the database, then send an email
 * notification asynchronously (non-blocking). The email send is fire-and-forget
 * — failures are logged but never bubble up.
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
 * This runs asynchronously after the API response is sent.
 */
async function sendEmailNotificationAsync(
  data: CreateNotificationInput,
): Promise<void> {
  try {
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
