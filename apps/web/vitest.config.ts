import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    // Pre-bundle sanitize-html + htmlparser2 through Vite's SSR optimizer so
    // Vite transforms the ESM/CJS boundary. sanitize-html uses require() on
    // htmlparser2 which is ESM-only — the SSR optimizer resolves this.
    deps: {
      optimizer: {
        ssr: {
          include: ['sanitize-html', 'htmlparser2'],
        },
      },
    },
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/types.ts'],
      thresholds: {
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workmanagement/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@workmanagement/database': path.resolve(__dirname, '../../packages/database/src'),
    },
  },
});
