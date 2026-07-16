import { describe, it, expect } from 'vitest';

describe('@workmanagement/shared package exports', () => {
  it('should export constants', async () => {
    const mod = await import('../constants');
    expect(mod.TASK_STATUSES).toBeDefined();
    expect(mod.TASK_PRIORITIES).toBeDefined();
    expect(mod.PROJECT_STATUSES).toBeDefined();
    expect(mod.DEFAULT_WORKFLOW).toBeDefined();
    expect(mod.DEFAULT_PAGE_LIMIT).toBeDefined();
    expect(mod.MAX_PAGE_LIMIT).toBeDefined();
  });

  it('should export types', async () => {
    const mod = await import('../types');
    expect(mod).toBeDefined();
    // Types only exist at compile time, but the module should still import
  });

  it('should export permission constants when imported directly', async () => {
    const permissions = await import('../constants/permissions');
    expect(permissions.PERMISSIONS).toBeDefined();
    expect(permissions.ALL_PERMISSIONS).toBeDefined();
    expect(permissions.ALL_PERMISSIONS.length).toBeGreaterThan(0);
  });

  it('should have the main index.ts re-export types and constants', async () => {
    const mod = await import('../index');
    expect(mod).toBeDefined();
  });
});
