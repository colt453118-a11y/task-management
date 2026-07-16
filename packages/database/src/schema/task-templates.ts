import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './index';

export const taskTemplates = pgTable(
  'task_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    taskTitle: varchar('task_title', { length: 500 }),
    taskDescription: text('task_description'),
    priority: varchar('priority', { length: 20 }).default('medium'),
    category: varchar('category', { length: 100 }),
    labels: text('labels').array(),
    tags: text('tags').array(),
    estimatedHours: decimal('estimated_hours', { precision: 8, scale: 2 }),
    isDefault: boolean('is_default').default(false),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: text('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    orgIdx: index('idx_task_templates_org').on(table.organizationId),
    nameIdx: index('idx_task_templates_name').on(table.organizationId, table.name),
  }),
);
