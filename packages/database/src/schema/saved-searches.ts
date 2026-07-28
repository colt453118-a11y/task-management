import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations, users } from './index';

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    query: varchar('query', { length: 500 }).notNull().default(''),
    type: varchar('type', { length: 50 }).notNull().default('all'), // all | tasks | projects | users
    filters: jsonb('filters').default({}), // { status?: string; priority?: string; assignee?: string; dateRange?: { from?: string; to?: string } }
    isDefault: boolean('is_default').default(false),
    sortOrder: text('sort_order'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userOrgIdx: index('idx_saved_searches_user_org').on(table.userId, table.organizationId),
    userIdx: index('idx_saved_searches_user').on(table.userId),
    nameUserUnique: uniqueIndex('idx_saved_searches_name_user').on(table.name, table.userId),
  }),
);

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  organization: one(organizations, {
    fields: [savedSearches.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}));
