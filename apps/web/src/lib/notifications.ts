import { getDb, schema } from '@workmanagement/database';

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
 * Create and persist a notification in the database.
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
  return notif;
}
