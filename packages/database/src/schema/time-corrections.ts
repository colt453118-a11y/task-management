import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations, users } from './index';
import { timeEntries, tasks } from './tasks';

// ─── Time Correction Requests ─────────────────────────────────
// Users request manager approval to edit a time entry's duration.
// Managers can approve or reject the request.
// On approval, the original time entry's duration is updated.
//
// Security invariants:
// - Only the entry owner can create a request
// - Only the user's reporting manager (or an admin) can approve/reject
// - Approved requests update the original entry's duration
// - Rejected requests keep the original entry unchanged

export const timeCorrectionRequests = pgTable(
  'time_correction_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    timeEntryId: uuid('time_entry_id')
      .notNull()
      .references(() => timeEntries.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    originalMinutes: integer('original_minutes').notNull(),
    requestedMinutes: integer('requested_minutes').notNull(),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_correction_reqs_org').on(table.organizationId, table.status),
    userIdx: index('idx_correction_reqs_user').on(table.userId, table.createdAt),
    entryIdx: index('idx_correction_reqs_entry').on(table.timeEntryId),
    statusIdx: index('idx_correction_reqs_status').on(table.status),
    reviewerIdx: index('idx_correction_reqs_reviewer').on(table.reviewedBy),
  }),
);

// ─── Relations ───────────────────────────────────────────────

export const timeCorrectionRequestsRelations = relations(
  timeCorrectionRequests,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [timeCorrectionRequests.organizationId],
      references: [organizations.id],
    }),
    timeEntry: one(timeEntries, {
      fields: [timeCorrectionRequests.timeEntryId],
      references: [timeEntries.id],
    }),
    user: one(users, {
      fields: [timeCorrectionRequests.userId],
      references: [users.id],
    }),
    reviewer: one(users, {
      fields: [timeCorrectionRequests.reviewedBy],
      references: [users.id],
    }),
    task: one(tasks, {
      fields: [timeCorrectionRequests.taskId],
      references: [tasks.id],
    }),
  }),
);
