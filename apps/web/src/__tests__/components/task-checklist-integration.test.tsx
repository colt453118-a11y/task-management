// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskChecklist } from '@/components/tasks/task-checklist';
import { useTaskStore, defaultFilters } from '@/stores/task-store';
import type { Task } from '@/stores/task-store';

// ─── Helpers ────────────────────────────────────────────────────

function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Fixtures ───────────────────────────────────────────────────

function makeItem(overrides: Partial<{
  id: string;
  taskId: string;
  content: string;
  isChecked: boolean;
  sortOrder: number;
}> = {}) {
  return {
    id: 'item-1',
    taskId: 'task-1',
    content: 'Setup database',
    isChecked: false,
    checkedBy: null,
    checkedAt: null,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const item1 = makeItem({ id: 'item-1', content: 'Setup database', sortOrder: 0 });
const item2 = makeItem({ id: 'item-2', content: 'Design API', sortOrder: 1 });
const item3 = makeItem({ id: 'item-3', content: 'Write tests', isChecked: true, sortOrder: 2 });

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskChecklist — Store Integration', () => {
  beforeEach(() => {
    // Reset the store to initial state
    useTaskStore.setState({
      tasks: [],
      totalCount: 0,
      loading: false,
      error: null,
      currentTask: null,
      comments: [],
      attachments: [],
      timeEntries: [],
      blockedBy: [],
      blocking: [],
      checklistItems: [],
      loadingDetail: false,
      detailError: null,
      filters: { ...defaultFilters },
      ui: {
        view: 'list',
        page: 0,
        pageSize: 25,
        selectedIds: new Set(),
        allSelectedMode: false,
        allMatchingIds: [],
        showFilters: false,
      },
    });

    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Store-backed fetch ─────────────────────────────────────

  it('stores checklist items from API via setChecklistItems', async () => {
    // Mock an API call that returns checklist items
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [item1, item2] }),
    );

    const res = await fetch('/api/tasks/task-1/checklist');
    const data = await res.json();

    // Store the fetched items
    useTaskStore.getState().setChecklistItems(data.items ?? []);

    // Verify store state
    expect(useTaskStore.getState().checklistItems).toHaveLength(2);
    expect(useTaskStore.getState().checklistItems[0]!.content).toBe('Setup database');
    expect(useTaskStore.getState().checklistItems[1]!.content).toBe('Design API');
  });

  // ── CRUD via API + store actions ──────────────────────────

  it('adds an item via API and updates the store', async () => {
    // Mock POST to add item
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ item: item1 }),
    );

    const res = await fetch('/api/tasks/task-1/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Setup database' }),
    });
    const data = await res.json();

    // Add to store
    useTaskStore.getState().addChecklistItem(data.item);

    expect(useTaskStore.getState().checklistItems).toHaveLength(1);
    expect(useTaskStore.getState().checklistItems[0]!.content).toBe('Setup database');
    expect(useTaskStore.getState().checklistItems[0]!.isChecked).toBe(false);
  });

  it('appends multiple items to the store', async () => {
    // Add first item
    useTaskStore.getState().addChecklistItem(item1);
    expect(useTaskStore.getState().checklistItems).toHaveLength(1);

    // Add second item (appended)
    useTaskStore.getState().addChecklistItem(item2);
    expect(useTaskStore.getState().checklistItems).toHaveLength(2);
    expect(useTaskStore.getState().checklistItems[1]!.content).toBe('Design API');
  });

  it('toggles an item via API and updates the store', async () => {
    // Start with items in the store
    useTaskStore.setState({ checklistItems: [item1] });

    // Mock PATCH to toggle
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ item: { ...item1, isChecked: true } }),
    );

    const res = await fetch('/api/tasks/task-1/checklist?itemId=item-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isChecked: true }),
    });
    const data = await res.json();

    // Update store with the API response
    useTaskStore.getState().updateChecklistItem(data.item.id, {
      isChecked: data.item.isChecked,
    });

    expect(useTaskStore.getState().checklistItems[0]!.isChecked).toBe(true);
  });

  it('edits an item content via API and updates the store', async () => {
    useTaskStore.setState({ checklistItems: [item1] });

    // Mock PATCH to update content
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ item: { ...item1, content: 'Setup PostgreSQL database' } }),
    );

    const res = await fetch('/api/tasks/task-1/checklist?itemId=item-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Setup PostgreSQL database' }),
    });
    const data = await res.json();

    useTaskStore.getState().updateChecklistItem(data.item.id, {
      content: data.item.content,
    });

    expect(useTaskStore.getState().checklistItems[0]!.content).toBe(
      'Setup PostgreSQL database',
    );
    // Other fields should remain unchanged
    expect(useTaskStore.getState().checklistItems[0]!.isChecked).toBe(false);
  });

  it('deletes an item via API and removes from the store', async () => {
    useTaskStore.setState({ checklistItems: [item1, item2] });

    // Mock DELETE
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ success: true }),
    );

    await fetch('/api/tasks/task-1/checklist?itemId=item-1', { method: 'DELETE' });

    // Remove from store
    useTaskStore.getState().removeChecklistItem('item-1');

    expect(useTaskStore.getState().checklistItems).toHaveLength(1);
    expect(useTaskStore.getState().checklistItems[0]!.content).toBe('Design API');
  });

  // ── Full CRUD lifecycle ───────────────────────────────────

  it('completes a full CRUD lifecycle through the store', async () => {
    // 1. Initial fetch: store is empty
    expect(useTaskStore.getState().checklistItems).toHaveLength(0);

    // 2. Add two items
    useTaskStore.getState().addChecklistItem(item1);
    useTaskStore.getState().addChecklistItem(item2);

    let items = useTaskStore.getState().checklistItems;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.content)).toEqual(['Setup database', 'Design API']);

    // 3. Toggle first item as completed
    useTaskStore.getState().updateChecklistItem('item-1', { isChecked: true });

    items = useTaskStore.getState().checklistItems;
    expect(items[0]!.isChecked).toBe(true);
    expect(items[1]!.isChecked).toBe(false);

    // 4. Edit second item's content
    useTaskStore.getState().updateChecklistItem('item-2', {
      content: 'Design REST API',
    });

    items = useTaskStore.getState().checklistItems;
    expect(items[1]!.content).toBe('Design REST API');

    // 5. Delete the completed item
    useTaskStore.getState().removeChecklistItem('item-1');

    items = useTaskStore.getState().checklistItems;
    expect(items).toHaveLength(1);
    expect(items[0]!.content).toBe('Design REST API');

    // 6. Replace all items (simulating a refetch)
    useTaskStore.getState().setChecklistItems([item3]);

    items = useTaskStore.getState().checklistItems;
    expect(items).toHaveLength(1);
    expect(items[0]!.content).toBe('Write tests');
    expect(items[0]!.isChecked).toBe(true);
  });

  // ── Edge cases ─────────────────────────────────────────────

  it('handles empty items from the API gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [] }),
    );

    const res = await fetch('/api/tasks/task-1/checklist');
    const data = await res.json();

    useTaskStore.getState().setChecklistItems(data.items ?? []);

    expect(useTaskStore.getState().checklistItems).toEqual([]);
  });

  it('handles missing items field from the API', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({}),
    );

    const res = await fetch('/api/tasks/task-1/checklist');
    const data = await res.json();

    useTaskStore.getState().setChecklistItems(data.items ?? []);

    expect(useTaskStore.getState().checklistItems).toEqual([]);
  });

  it('does not update non-existent items', async () => {
    useTaskStore.setState({ checklistItems: [item1] });

    // Try updating a non-existent item
    useTaskStore.getState().updateChecklistItem('nonexistent', { isChecked: true });

    // Existing items should be unchanged
    expect(useTaskStore.getState().checklistItems).toHaveLength(1);
    expect(useTaskStore.getState().checklistItems[0]!.isChecked).toBe(false);
  });

  it('does nothing when removing a non-existent item', async () => {
    useTaskStore.setState({ checklistItems: [item1, item2] });

    useTaskStore.getState().removeChecklistItem('nonexistent');

    expect(useTaskStore.getState().checklistItems).toHaveLength(2);
  });

  it('replaces all items when setChecklistItems is called', async () => {
    useTaskStore.setState({ checklistItems: [item1, item2, item3] });

    useTaskStore.getState().setChecklistItems([item1]);

    expect(useTaskStore.getState().checklistItems).toHaveLength(1);
    expect(useTaskStore.getState().checklistItems[0]!.id).toBe('item-1');
  });

  // ── Store state isolation ─────────────────────────────────

  it('does not affect other store slices when updating checklists', () => {
    useTaskStore.setState({
      currentTask: {
        id: 'task-1',
        title: 'Test',
        description: null,
        taskIdDisplay: 'TASK-1',
        status: 'open',
        priority: 'medium',
        assignedTo: null,
        projectId: null,
        departmentId: null,
        teamId: null,
        createdBy: 'user-1',
        updatedBy: null,
        dueDate: null,
        startDate: null,
        estimatedHours: null,
        actualHours: null,
        labels: null,
        tags: null,
        category: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        updatedByName: null,
        sortOrder: null,
      } as Task,
      checklistItems: [item1],
    });

    useTaskStore.getState().addChecklistItem(item2);

    const state = useTaskStore.getState();
    expect(state.checklistItems).toHaveLength(2);
    // currentTask should be untouched
    expect(state.currentTask?.id).toBe('task-1');
    // Other arrays should be untouched
    expect(state.comments).toEqual([]);
    expect(state.blockedBy).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════
  //  COMPONENT + STORE RENDERING
  // ═══════════════════════════════════════════════════════════════

  it('renders TaskChecklist with items from API and store can be updated independently', async () => {
    // Mock the initial fetch to return items
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [item1, item2] }),
    );

    render(<TaskChecklist taskId="task-1" taskStatus="open" />);

    // Wait for items to render
    expect(await screen.findByText('Setup database')).toBeInTheDocument();
    expect(screen.getByText('Design API')).toBeInTheDocument();

    // The component manages its own state — verify the store is still empty
    // (the component doesn't sync to the store)
    expect(useTaskStore.getState().checklistItems).toEqual([]);

    // Store can be independently populated
    useTaskStore.getState().setChecklistItems([item1, item2]);
    expect(useTaskStore.getState().checklistItems).toHaveLength(2);
  });

  it('renders empty state when API returns no items', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [] }),
    );

    render(<TaskChecklist taskId="task-1" taskStatus="open" />);

    expect(await screen.findByText('No items')).toBeInTheDocument();
    expect(screen.getByText('No checklist items yet. Add one below.')).toBeInTheDocument();

    // Store is also independently empty
    expect(useTaskStore.getState().checklistItems).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════
  //  REFETCH CALLBACK PATTERN
  // ═══════════════════════════════════════════════════════════════

  it('refetchChecklist pattern — fetches items from API and updates the store via setChecklistItems', async () => {
    const taskId = 'task-1';

    // Mock the refetch API
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [item1, item2, item3] }),
    );

    // Simulate the page-level pattern: fetch + update store
    const refetchChecklist = async () => {
      const res = await fetch(`/api/tasks/${taskId}/checklist`);
      if (res.ok) {
        const data = await res.json();
        useTaskStore.getState().setChecklistItems(data.items ?? []);
      }
    };

    await refetchChecklist();

    // Store should be updated with all items
    expect(useTaskStore.getState().checklistItems).toHaveLength(3);
    expect(useTaskStore.getState().checklistItems.map((i) => i.content)).toEqual([
      'Setup database',
      'Design API',
      'Write tests',
    ]);

    // Verify fetch was called correctly
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/task-1/checklist');
  });

  it('refetchChecklist — handles API failure gracefully (store remains unchanged)', async () => {
    const taskId = 'task-1';

    // Pre-populate the store
    useTaskStore.setState({ checklistItems: [item1] });

    // Mock the refetch API to fail
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ error: 'Server error' }, 500),
    );

    const refetchChecklist = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/checklist`);
        if (res.ok) {
          const data = await res.json();
          useTaskStore.getState().setChecklistItems(data.items ?? []);
        }
      } catch {
        // silent
      }
    };

    await refetchChecklist();

    // Store should remain unchanged since the API returned non-ok
    expect(useTaskStore.getState().checklistItems).toHaveLength(1);
    expect(useTaskStore.getState().checklistItems[0]!.content).toBe('Setup database');
  });
});
