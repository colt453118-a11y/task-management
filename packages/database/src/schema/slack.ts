import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations, users } from './index';

// ─── Slack Integrations ───────────────────────────────────────
//
// Simple Slack Incoming Webhook configuration per organization.
// One row per org - just the webhook URL.

export const slackIntegrations = pgTable(
  'slack_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Webhook configuration
    webhookUrl: text('webhook_url').notNull(),
    channelName: varchar('channel_name', { length: 200 }),

    // Status
    isActive: boolean('is_active').default(true),
    lastUsedAt: timestamp('last_used_at'),
    lastError: text('last_error'),

    // Audit
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    orgIdx: index('idx_slack_int_org').on(table.organizationId),
  }),
);

export const slackIntegrationsRelations = relations(slackIntegrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [slackIntegrations.organizationId],
    references: [organizations.id],
  }),
}));
