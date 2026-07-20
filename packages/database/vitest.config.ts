import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // Integration tests need a real Postgres connection via DATABASE_URL
    // Skip if no DATABASE_URL is set (local dev without Postgres)
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
