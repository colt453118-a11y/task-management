import { describe, it, expect } from 'vitest';

/**
 * Smoke test to verify the vitest workspace config is wired correctly.
 * This file sits at the project root and is included via vitest.workspace.ts.
 * Run from root: pnpm test:smoke  (or: vitest run  which auto-discovers vitest.workspace.ts)
 */
describe('workspace smoke test', () => {
  it('vitest is accessible and can run basic assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('supports async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('supports object equality', () => {
    expect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });
  });

  it('supports snapshot-like string matching', () => {
    expect('hello world').toContain('world');
  });

  it('supports zero and falsy checks', () => {
    expect(0).toBe(0);
    expect(null).toBeNull();
    expect(undefined).toBeUndefined();
  });

  it('resolves imports from workspace members (cross-project resolution)', async () => {
    // This verifies vitest.workspace.ts discovers 'apps/web' and can resolve
    // imports into workspace members via the 'apps/web' tsconfig paths.
    const { useTaskStore, defaultFilters } = await import('./apps/web/src/stores/task-store');
    expect(useTaskStore).toBeDefined();
    expect(useTaskStore.getState().currentTask).toBeNull();
    expect(defaultFilters.search).toBe('');
  });
});
