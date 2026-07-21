import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations, users } from './index';

// ─── Webhook Subscriptions ─────────────────────────────────────
//
// Each row represents a registered webhook endpoint that will receive
// HTTP POST requests when matching events occur.

export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(), // HMAC signing secret (stored hashed/encrypted in production)
    events: text('events').array().notNull(), // e.g. ['task.created', 'task.updated', 'task.deleted']
    headers: jsonb('headers').default({}), // Custom headers to include in requests
    isActive: boolean('is_active').default(true),
    retryCount: integer('retry_count').default(3),
    retryIntervalMs: integer('retry_interval_ms').default(5000),
    timeoutMs: integer('timeout_ms').default(10000),
    lastSuccessAt: timestamp('last_success_at'),
    lastFailureAt: timestamp('last_failure_at'),
    lastFailureReason: text('last_failure_reason'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    orgIdx: index('idx_webhook_subs_org').on(table.organizationId),
    activeOrgIdx: index('idx_webhook_subs_active_org').on(table.organizationId, table.isActive),
    eventsIdx: index('idx_webhook_subs_events').on(table.events),
  }),
);

// ─── Webhook Delivery Logs ─────────────────────────────────────
//
// Immutable log of every webhook delivery attempt.
// Rows are never updated or deleted — they are append-only for audit.

export const webhookDeliveryLogs = pgTable(
  'webhook_delivery_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    requestHeaders: jsonb('request_headers'),
    responseStatusCode: integer('response_status_code'),
    responseHeaders: jsonb('response_headers'),
    responseBody: text('response_body'),
    durationMs: integer('duration_ms'),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    attempt: integer('attempt').default(1),
    nextRetryAt: timestamp('next_retry_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // NOTE: deliberately no updatedAt or deletedAt — rows are immutable
  },
  (table) => ({
    subscriptionIdx: index('idx_webhook_logs_subscription').on(
      table.subscriptionId,
      table.createdAt,
    ),
    eventTypeIdx: index('idx_webhook_logs_event').on(table.eventType),
    successIdx: index('idx_webhook_logs_success').on(table.success),
    pendingRetryIdx: index('idx_webhook_logs_retry').on(table.nextRetryAt),
  }),
);

// ─── Relations ───────────────────────────────────────────────

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [webhookSubscriptions.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [webhookSubscriptions.createdBy],
    references: [users.id],
  }),
  deliveryLogs: many(webhookDeliveryLogs),
}));

export const webhookDeliveryLogsRelations = relations(webhookDeliveryLogs, ({ one }) => ({
  subscription: one(webhookSubscriptions, {
    fields: [webhookDeliveryLogs.subscriptionId],
    references: [webhookSubscriptions.id],
  }),
}));
