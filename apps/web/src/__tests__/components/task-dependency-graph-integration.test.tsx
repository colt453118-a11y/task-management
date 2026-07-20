// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCallback } from 'react';
import { TaskDependencyGraph } from '@/components/tasks/task-dependency-graph';
import { useTaskStore, defaultFilters } from '@/stores/task-store';

// ─── Helpers ────────────────────────────────────────────────────

function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Fixtures ───────────────────────────────────────────────────

const mockDepTask = {
  id: 'task-dep-1',
  title: 'Frontend setup',
  taskIdDisplay: 'TASK-2',
  status: 'completed',
};

const dep1 = {
  id: 'dep-blocked-1',
  taskId: 'task-1',
  dependsOnTaskId: 'task-dep-1',
  dependencyType: 'blocks',
  createdAt: new Date().toISOString(),
  dependsOnTask: mockDepTask,
};

const dep2 = {
  id: 'dep-blocked-2',
  taskId: 'task-1',
  dependsOnTaskId: 'task-dep-2',
  dependencyType: 'blocks',
  createdAt: new Date().toISOString(),
  dependsOnTask: {
    id: 'task-dep-2',
    title: 'Design mockups',
    taskIdDisplay: 'TASK-7',
    status: 'in_review',
  },
};

// ─── Wrapper (mimics the task detail page pattern) ──────────

function DependencySection({ taskId }: { taskId: string }) {
  const blockedBy = useTaskStore((s) => s.blockedBy);
  const blocking = useTaskStore((s) => s.blocking);
  const setDependencies = useTaskStore((s) => s.setDependencies);

  const refetchDependencies = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`);
      if (res.ok) {
        const data = await res.json();
        setDependencies(data.blockedBy ?? [], data.blocking ?? []);
      }
    } catch {
      // silent
    }
  }, [taskId, setDependencies]);

  return (
    <TaskDependencyGraph
      blockedBy={blockedBy}
      blocking={blocking}
      taskId={taskId}
      onDependencyAdded={refetchDependencies}
      onDependencyRemoved={refetchDependencies}
    />
  );
}

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskDependencyGraph — Store Integration', () => {
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

  // ── Store-backed initial render ─────────────────────────────

  it('renders dependencies from the store on initial render', async () => {
    // Populate store with dependencies
    useTaskStore.setState({ blockedBy: [dep1], blocking: [] });

    // Mock the current task fetch (GraphView fetches this on mount)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        task: { id: 'task-1', title: 'My Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
      }),
    );

    render(<DependencySection taskId="task-1" />);

    // Should render the dependency from the store
    expect(await screen.findByText('Frontend setup')).toBeInTheDocument();
    expect(screen.getByText('TASK-2')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows empty state when store has no dependencies', () => {
    // Store is empty by default (reset in beforeEach)
    render(<DependencySection taskId="task-1" />);

    expect(screen.getByText('No dependencies')).toBeInTheDocument();
  });

  it('reacts to store updates by re-rendering', async () => {
    // Start with no dependencies
    render(<DependencySection taskId="task-1" />);
    expect(screen.getByText('No dependencies')).toBeInTheDocument();

    // Mock current task fetch (GraphView mounts later)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        task: { id: 'task-1', title: 'My Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
      }),
    );

    // Update the store with dependencies (simulating a refetch)
    useTaskStore.setState({ blockedBy: [dep1], blocking: [] });

    // Component should re-render to show the dependencies
    expect(await screen.findByText('Frontend setup')).toBeInTheDocument();
    expect(screen.getByText('Blocked by')).toBeInTheDocument();
  });

  // ── Remove + refetch flow ─────────────────────────────────

  it('removes a dependency then refetches and updates the store', async () => {
    // Mock current task fetch
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        task: { id: 'task-1', title: 'My Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
      }),
    );

    // Populate store with dependencies
    useTaskStore.setState({ blockedBy: [dep1], blocking: [] });

    render(<DependencySection taskId="task-1" />);

    await screen.findByText('Frontend setup');

    // Switch to list view for easier remove button access
    fireEvent.click(screen.getByText('List'));

    // Mock the DELETE call to succeed
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    // Mock the refetch (GET) to return no dependencies
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ blockedBy: [], blocking: [] }),
    );

    // Click remove
    const removeButton = document.querySelector('.group button');
    expect(removeButton).toBeTruthy();
    fireEvent.click(removeButton!);

    // Wait for the refetch to complete and store to update
    await waitFor(() => {
      expect(useTaskStore.getState().blockedBy).toEqual([]);
      expect(useTaskStore.getState().blocking).toEqual([]);
    });

    // Component should show empty state
    expect(await screen.findByText('No dependencies')).toBeInTheDocument();
  });

  it('removes a dependency and refetches with remaining dependencies', async () => {
    // Mock current task fetch
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        task: { id: 'task-1', title: 'My Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
      }),
    );

    // Populate store with TWO dependencies
    useTaskStore.setState({ blockedBy: [dep1, dep2], blocking: [] });

    render(<DependencySection taskId="task-1" />);

    await screen.findByText('Frontend setup');
    expect(screen.getByText('Design mockups')).toBeInTheDocument();

    // Switch to list view
    fireEvent.click(screen.getByText('List'));

    // Mock the DELETE call to succeed
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    // Mock the refetch to return only the remaining dependency
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ blockedBy: [dep2], blocking: [] }),
    );

    // Click remove on the first dependency (dep1)
    const removeButtons = document.querySelectorAll('.group button');
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]!);

    // Wait for refetch — store should have only dep2
    await waitFor(() => {
      expect(useTaskStore.getState().blockedBy).toHaveLength(1);
      expect(useTaskStore.getState().blockedBy[0]!.id).toBe('dep-blocked-2');
    });

    // dep1 should be gone, dep2 should remain
    expect(await screen.findByText('Design mockups')).toBeInTheDocument();
    expect(screen.queryByText('Frontend setup')).not.toBeInTheDocument();
  });

  // ── Add + refetch flow ────────────────────────────────────

  it('adds a dependency, refetches, and shows the updated store data', async () => {
    // Mock current task fetch (no deps initially, so GraphView won't mount)
    // But just in case, set up the mock
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        task: { id: 'task-1', title: 'My Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
      }),
    );

    // Start with empty store
    useTaskStore.setState({ blockedBy: [], blocking: [] });

    render(<DependencySection taskId="task-1" />);

    // Open dialog via header plus button
    fireEvent.click(screen.getByTitle('Add dependency'));

    const searchInput = screen.getByPlaceholderText('Search tasks to link...');
    fireEvent.change(searchInput, { target: { value: 'Database' } });

    // Mock search results
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({
        tasks: [
          { id: 'task-4', title: 'Database schema', taskIdDisplay: 'TASK-4', status: 'in_progress' },
        ],
      }),
    );

    expect(await screen.findByText('Database schema')).toBeInTheDocument();

    // Mock the POST for adding dependency
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    // Mock the refetch (GET) to return the new dependency
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({
        blockedBy: [{
          ...dep1,
          dependsOnTask: { ...mockDepTask, title: 'Database schema', taskIdDisplay: 'TASK-4' },
        }],
        blocking: [],
      }),
    );

    // Click to add
    fireEvent.click(screen.getByText('Database schema'));

    // Wait for refetch — store should be updated
    await waitFor(() => {
      expect(useTaskStore.getState().blockedBy).toHaveLength(1);
    });

    // The UI should show the new dependency after refetch
    expect(await screen.findByText('Database schema')).toBeInTheDocument();
  });

  // ── Error handling in the remove flow ──────────────────────

  it('does NOT refetch when DELETE fails, and store remains unchanged', async () => {
    // Mock current task fetch
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        task: { id: 'task-1', title: 'My Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
      }),
    );

    useTaskStore.setState({ blockedBy: [dep1], blocking: [] });

    render(<DependencySection taskId="task-1" />);

    await screen.findByText('Frontend setup');
    fireEvent.click(screen.getByText('List'));

    // Mock DELETE to fail
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ error: 'Server error' }, 500),
    );

    const removeButton = document.querySelector('.group button');
    expect(removeButton).toBeTruthy();
    fireEvent.click(removeButton!);

    // Wait for DELETE to resolve (fails, catch block runs, refetch NOT called)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/tasks/task-1/dependencies?dependencyId=dep-blocked-1',
        { method: 'DELETE' },
      );
    });

    // Store should remain unchanged (no refetch happened since DELETE failed)
    expect(useTaskStore.getState().blockedBy).toHaveLength(1);
    expect(useTaskStore.getState().blockedBy[0]!.id).toBe('dep-blocked-1');

    // dep1 should still be visible
    expect(screen.getByText('Frontend setup')).toBeInTheDocument();
  });

  // ── Store updates via setDependencies (simulating parallel updates) ──

  it('handles store being updated externally via setDependencies', async () => {
    // Mock current task fetch
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        task: { id: 'task-1', title: 'My Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
      }),
    );

    // Start with one dep, then simulate an external refetch that adds another
    useTaskStore.setState({ blockedBy: [dep1], blocking: [] });

    render(<DependencySection taskId="task-1" />);

    expect(await screen.findByText('Frontend setup')).toBeInTheDocument();

    // Simulate an external store update (e.g., from another component)
    useTaskStore.getState().setDependencies([dep1, dep2], []);

    // Both dependencies should now be visible
    expect(await screen.findByText('Design mockups')).toBeInTheDocument();
    expect(screen.getByText('Frontend setup')).toBeInTheDocument();

    // Simulate clearing all dependencies externally
    useTaskStore.getState().setDependencies([], []);

    // Should return to empty state
    await waitFor(() => {
      expect(screen.getByText('No dependencies')).toBeInTheDocument();
    });
  });
});
