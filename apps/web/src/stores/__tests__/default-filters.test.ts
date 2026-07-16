import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore, defaultFilters, type TaskFilters } from '../task-store';

// ─── Helpers ────────────────────────────────────────────────

/** Returns the default filter values as a fresh object for comparison. */
function freshDefaults(): TaskFilters {
  return { ...defaultFilters };
}

// ═══════════════════════════════════════════════════════════════
// ─── defaultFilters Export ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('defaultFilters export', () => {
  it('should have all 8 filter fields', () => {
    const keys = Object.keys(defaultFilters).sort();
    expect(keys).toEqual([
      'assignedTo',
      'deletedBy',
      'priority',
      'projectId',
      'search',
      'showTrash',
      'status',
      'watchedOnly',
    ]);
  });

  it('should have empty strings for text filters', () => {
    expect(defaultFilters.search).toBe('');
    expect(defaultFilters.status).toBe('');
    expect(defaultFilters.priority).toBe('');
    expect(defaultFilters.projectId).toBe('');
    expect(defaultFilters.assignedTo).toBe('');
    expect(defaultFilters.deletedBy).toBe('');
  });

  it('should have false for boolean filters', () => {
    expect(defaultFilters.watchedOnly).toBe(false);
    expect(defaultFilters.showTrash).toBe(false);
  });

  it('should not be frozen (intentionally mutable by consumers)', () => {
    // The export itself is a plain const object, not Object.frozen.
    // Spreading it in setFilters creates a new object each time.
    expect(Object.isFrozen(defaultFilters)).toBe(false);
  });

  it('should match the store initial state filters', () => {
    const { filters } = useTaskStore.getState();
    expect(filters).toEqual(defaultFilters);
  });

  it('should survive resetFilters to return to defaults', () => {
    useTaskStore.getState().setFilters({
      search: 'something',
      status: 'open',
      priority: 'urgent',
    });
    useTaskStore.getState().resetFilters();
    expect(useTaskStore.getState().filters).toEqual(defaultFilters);
  });

  it('should be reusable after mutation (plain object, spread-safe)', () => {
    // Verify that spreading defaultFilters gives a fresh copy
    const copy1 = { ...defaultFilters };
    const copy2 = { ...defaultFilters };
    copy1.search = 'mutated';
    expect(copy2.search).toBe(''); // spread creates independent copy
    expect(defaultFilters.search).toBe(''); // original unaffected
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── setFilters spread merge behavior ─────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('setFilters spread merge', () => {
  beforeEach(() => {
    useTaskStore.setState({ filters: { ...defaultFilters } });
  });

  it('should merge a single field while keeping others at defaults', () => {
    useTaskStore.getState().setFilters({ search: 'find me' });
    const { filters } = useTaskStore.getState();
    expect(filters.search).toBe('find me');
    // All other fields remain at defaults
    expect(filters.status).toBe('');
    expect(filters.priority).toBe('');
    expect(filters.projectId).toBe('');
    expect(filters.assignedTo).toBe('');
    expect(filters.watchedOnly).toBe(false);
    expect(filters.showTrash).toBe(false);
    expect(filters.deletedBy).toBe('');
  });

  it('should merge multiple fields at once', () => {
    useTaskStore.getState().setFilters({
      search: 'complex',
      status: 'in_progress',
      priority: 'high',
      assignedTo: 'user-42',
    });
    const { filters } = useTaskStore.getState();
    expect(filters.search).toBe('complex');
    expect(filters.status).toBe('in_progress');
    expect(filters.priority).toBe('high');
    expect(filters.assignedTo).toBe('user-42');
    // Not set — still at defaults
    expect(filters.projectId).toBe('');
    expect(filters.watchedOnly).toBe(false);
    expect(filters.showTrash).toBe(false);
    expect(filters.deletedBy).toBe('');
  });

  it('should overwrite a previously-set value', () => {
    useTaskStore.getState().setFilters({ search: 'first' });
    useTaskStore.getState().setFilters({ search: 'second' });
    expect(useTaskStore.getState().filters.search).toBe('second');
  });

  it('should toggle boolean fields', () => {
    useTaskStore.getState().setFilters({ watchedOnly: true });
    expect(useTaskStore.getState().filters.watchedOnly).toBe(true);

    useTaskStore.getState().setFilters({ watchedOnly: false });
    expect(useTaskStore.getState().filters.watchedOnly).toBe(false);
  });

  it('should handle setting all 8 fields at once', () => {
    const all: Partial<TaskFilters> = {
      search: 'full reset',
      status: 'completed',
      priority: 'critical',
      projectId: 'proj-x',
      assignedTo: 'me',
      watchedOnly: true,
      showTrash: false,
      deletedBy: 'user-deleter',
    };
    useTaskStore.getState().setFilters(all);
    expect(useTaskStore.getState().filters).toEqual({
      ...defaultFilters,
      ...all,
    });
  });

  it('should accept an empty object and change nothing', () => {
    useTaskStore.getState().setFilters({ status: 'open' });
    useTaskStore.getState().setFilters({});
    const { filters } = useTaskStore.getState();
    expect(filters.status).toBe('open'); // unchanged
    expect(filters).toEqual({
      ...defaultFilters,
      status: 'open',
    });
  });

  it('should not mutate the previous filters object (spread creates new object)', () => {
    const prevFilters = useTaskStore.getState().filters;
    useTaskStore.getState().setFilters({ search: 'new' });
    const nextFilters = useTaskStore.getState().filters;
    // prevFilters reference is stale — the store replaced it
    expect(prevFilters.search).toBe('');
    expect(nextFilters.search).toBe('new');
    expect(prevFilters).not.toBe(nextFilters); // different objects
  });

  it('should cascade overrides correctly across multiple calls', () => {
    // Simulate a real user flow: search → add status → remove search
    useTaskStore.getState().setFilters({ search: 'bug' });
    useTaskStore.getState().setFilters({ status: 'open', priority: 'high' });
    useTaskStore.getState().setFilters({ search: '' });

    const { filters } = useTaskStore.getState();
    expect(filters.search).toBe(''); // cleared
    expect(filters.status).toBe('open'); // kept from second call
    expect(filters.priority).toBe('high'); // kept from second call
    expect(filters.projectId).toBe(''); // never touched
  });

  it('should set a non-string field (watchedOnly boolean) independently', () => {
    useTaskStore.getState().setFilters({ watchedOnly: true });
    useTaskStore.getState().setFilters({ search: 'watched tasks' });

    expect(useTaskStore.getState().filters.watchedOnly).toBe(true);
    expect(useTaskStore.getState().filters.search).toBe('watched tasks');
  });

  it('should reset a string back to empty explicitly', () => {
    useTaskStore.getState().setFilters({ status: 'open' });
    expect(useTaskStore.getState().filters.status).toBe('open');

    useTaskStore.getState().setFilters({ status: '' });
    expect(useTaskStore.getState().filters.status).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── setFilters edge cases ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('setFilters edge cases', () => {
  beforeEach(() => {
    useTaskStore.setState({ filters: { ...defaultFilters } });
  });

  it('should include extra keys passed at runtime (JS spread semantics)', () => {
    // TypeScript prevents unknown keys at compile time via Partial<TaskFilters>,
    // but at runtime, JavaScript's object spread includes all enumerable own properties.
    const partial = { search: 'test', unknownKey: 'should be ignored' } as Partial<TaskFilters>;
    useTaskStore.getState().setFilters(partial);
    const { filters } = useTaskStore.getState();
    expect(filters.search).toBe('test');
    // Runtime: spread includes unknownKey because JS doesn't enforce TS types
    expect('unknownKey' in filters).toBe(true);
    expect((filters as unknown as Record<string, unknown>).unknownKey).toBe('should be ignored');
  });

  it('should handle consecutive identical settings without side effects', () => {
    useTaskStore.getState().setFilters({ status: 'open' });
    useTaskStore.getState().setFilters({ status: 'open' });
    useTaskStore.getState().setFilters({ status: 'open' });
    expect(useTaskStore.getState().filters).toEqual({
      ...defaultFilters,
      status: 'open',
    });
  });

  it('should set a field to the same default value that is already there', () => {
    useTaskStore.getState().setFilters({ search: '' });
    expect(useTaskStore.getState().filters).toEqual(freshDefaults());
  });

  it('should overwrite with undefined when explicitly passed (spread semantics)', () => {
    // Setting a value to undefined via Partial<TaskFilters> is allowed by
    // the type signature. At runtime, { ...existing, key: undefined } sets
    // key to undefined. Consumers should avoid this in practice and use '' instead.
    const partial: Partial<TaskFilters> = { status: undefined };
    useTaskStore.getState().setFilters(partial);
    const { filters } = useTaskStore.getState();
    expect(filters.status).toBeUndefined();
  });
});
