import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Root-level smoke test
  'vitest.config.root.ts',

  // Web app — React/Next.js with jsdom environment
  'apps/web',

  // Shared package — pure TypeScript utilities, types, and Zod schemas
  'packages/shared',

  // Database package — Drizzle schema + Postgres integration tests
  'packages/database',
]);
