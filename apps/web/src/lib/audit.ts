import { getDb, schema } from '@workmanagement/database';

export type AuditLogInput = {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Write an audit log entry.
 * This function is called from API routes after sensitive mutations.
 */
export async function createAuditEntry(data: AuditLogInput) {
  const db = getDb();
  const [entry] = await db
    .insert(schema.auditLogs)
    .values({
      organizationId: data.organizationId ?? null,
      userId: data.userId ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      oldValues: data.oldValues ?? null,
      newValues: data.newValues ?? null,
      metadata: data.metadata ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    })
    .returning();
  return entry;
}
