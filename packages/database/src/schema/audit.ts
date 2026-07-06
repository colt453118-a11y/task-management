import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, organizations } from './index';

// ─── Audit Logs ──────────────────────────────────────────────
// Immutable audit trail for sensitive operations.
// This table is WRITE-ONLY from the application — never updated or deleted.

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  userId: text('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: text('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_audit_org').on(table.organizationId, table.createdAt),
  userIdx: index('idx_audit_user').on(table.userId, table.createdAt),
  actionIdx: index('idx_audit_action').on(table.action, table.createdAt),
  entityIdx: index('idx_audit_entity').on(table.entityType, table.entityId),
}));

// ─── Relations ───────────────────────────────────────────────

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ─── Action Constants ────────────────────────────────────────

export const AuditActions = {
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_RESET: 'auth.password_reset',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DEACTIVATED: 'user.deactivated',
  USER_SUSPENDED: 'user.suspended',
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  ROLE_PERMISSIONS_CHANGED: 'role.permissions_changed',
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',
  TASK_CLOSED: 'task.closed',
  TASK_REOPENED: 'task.reopened',
  TASK_ARCHIVED: 'task.archived',
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_ARCHIVED: 'project.archived',
  REPORT_GENERATED: 'report.generated',
  REPORT_EXPORTED: 'report.exported',
  SETTINGS_CHANGED: 'settings.changed',
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];
