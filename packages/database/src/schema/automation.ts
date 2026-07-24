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

// ─── Automation Rules ──────────────────────────────────────────
//
// Each row defines a single automation rule: when a trigger event
// occurs and optional conditions are met, a set of actions fires.

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    trigger: varchar('trigger', { length: 100 }).notNull(),
    // e.g. 'task.created', 'task.status_changed', 'task.overdue', 'task.assigned'

    conditions: jsonb('conditions').default([]),
    // Array of condition groups. Each group is { type: 'and'|'or', conditions: [...] }
    // Each condition: { field: string, operator: 'eq'|'neq'|'contains'|'gt'|'lt'|'gte'|'lte'|'is_empty'|'is_not_empty', value: any }

    actions: jsonb('actions').default([]).notNull(),
    // Array of action objects:
    // { type: 'notify', config: { userIds: string[], message: string } }
    // { type: 'change_status', config: { status: string } }
    // { type: 'assign', config: { userId: string } }
    // { type: 'add_label', config: { label: string } }
    // { type: 'change_priority', config: { priority: string } }
    // { type: 'escalate', config: { message: string } }

    enabled: boolean('enabled').default(true),
    cooldownMinutes: integer('cooldown_minutes').default(0),
    // Minimum time (in minutes) between consecutive firings for the same entity.
    // 0 means no cooldown.

    lastTriggeredAt: timestamp('last_triggered_at'),
    // When this rule last fired.

    executionCount: integer('execution_count').default(0),
    // Total number of times this rule has fired.

    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: text('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    orgIdx: index('idx_auto_rules_org').on(table.organizationId),
    triggerOrgIdx: index('idx_auto_rules_trigger_org').on(table.trigger, table.organizationId),
    enabledOrgIdx: index('idx_auto_rules_enabled_org').on(table.enabled, table.organizationId),
  }),
);

// ─── Automation Execution Logs ─────────────────────────────────
//
// Append-only log of every rule execution. Used for audit and debugging.

export const automationLogs = pgTable(
  'automation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'cascade' }),
    ruleName: varchar('rule_name', { length: 200 }).notNull(),
    trigger: varchar('trigger', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    // e.g. 'task', 'project', 'comment'
    entityId: varchar('entity_id', { length: 255 }).notNull(),
    // The ID of the entity that triggered the rule

    conditionsMet: boolean('conditions_met').default(true),
    // Whether the rule's conditions passed

    actionsExecuted: jsonb('actions_executed').default([]),
    // List of action results: { type: string, success: boolean, message?: string }

    success: boolean('success').default(true),
    // Overall success: true if all actions succeeded

    errorMessage: text('error_message'),
    // If any action failed, the error message

    durationMs: integer('duration_ms'),
    // How long the rule execution took

    triggeredByUserId: text('triggered_by_user_id').references(() => users.id),
    // The user who performed the action that triggered this rule

    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // NOTE: deliberately no updatedAt or deletedAt — rows are immutable
  },
  (table) => ({
    ruleIdx: index('idx_auto_logs_rule').on(table.ruleId, table.createdAt),
    orgIdx: index('idx_auto_logs_org').on(table.organizationId, table.createdAt),
    entityIdx: index('idx_auto_logs_entity').on(table.entityType, table.entityId),
    triggerIdx: index('idx_auto_logs_trigger').on(table.trigger),
  }),
);

// ─── Relations ───────────────────────────────────────────────

export const automationRulesRelations = relations(automationRules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [automationRules.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [automationRules.createdBy],
    references: [users.id],
  }),
  logs: many(automationLogs),
}));

export const automationLogsRelations = relations(automationLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [automationLogs.organizationId],
    references: [organizations.id],
  }),
  rule: one(automationRules, {
    fields: [automationLogs.ruleId],
    references: [automationRules.id],
  }),
  triggeredBy: one(users, {
    fields: [automationLogs.triggeredByUserId],
    references: [users.id],
  }),
}));
