import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://dev:devpassword@localhost:5432/workmanagement',
  },
  verbose: true,
  strict: true,
});
