import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations, users } from './index';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    message: text('message'),
    link: varchar('link', { length: 500 }),
    actorId: text('actor_id').references(() => users.id),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').default({}),
    isRead: boolean('is_read').default(false),
    isDismissed: boolean('is_dismissed').default(false),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_notifications_user').on(table.userId, table.createdAt),
    userUnreadIdx: index('idx_notifications_user_unread').on(table.userId, table.isRead, table.createdAt),
    orgIdx: index('idx_notifications_org').on(table.organizationId),
    typeIdx: index('idx_notifications_type').on(table.type),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
}));
