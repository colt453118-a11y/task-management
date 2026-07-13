import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    // Inline sanitize-html + htmlparser2 through Vite's SSR transform pipeline
    // because sanitize-html uses require('htmlparser2') and htmlparser2 is
    // ESM-only. Vite's transformer resolves the ESM/CJS boundary.
    server: {
      deps: {
        inline: ['sanitize-html', 'htmlparser2'],
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
