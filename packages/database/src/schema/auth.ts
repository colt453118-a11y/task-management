import { pgTable, text, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './index';

// ─── Better Auth Account Table ───────────────────────────────

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_accounts_user').on(table.userId),
    providerAccountUnique: uniqueIndex('idx_accounts_provider_account').on(
      table.providerId,
      table.accountId,
    ),
  }),
);

// ─── Better Auth Session Table ───────────────────────────────
// id is the internal record identifier; token stores the session token string

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_sessions_user_id').on(table.userId),
  }),
);

// ─── Verification Tokens ─────────────────────────────────────

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: text('id').primaryKey(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    identifierIdx: index('idx_verification_identifier').on(table.identifier),
    tokenIdx: uniqueIndex('idx_verification_token_unique').on(table.token),
  }),
);

// ─── Relations ───────────────────────────────────────────────

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
