// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskDependencyGraph } from '@/components/tasks/task-dependency-graph';

// ─── Helpers ────────────────────────────────────────────────────

/** Returns a mock fetch Response with JSON body and Content-Type header. */
function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const currentTaskResponse = {
  task: {
    id: 'task-1',
    title: 'Current Task',
    taskIdDisplay: 'TASK-1',
    status: 'in_progress',
  },
};

const mockDepTask = {
  id: 'task-dep-1',
  title: 'Frontend setup',
  taskIdDisplay: 'TASK-2',
  status: 'completed',
};

const mockBlockingTask = {
  id: 'task-block-1',
  title: 'API integration',
  taskIdDisplay: 'TASK-3',
  status: 'todo',
};

const blockedByDep = {
  id: 'dep-blocked-1',
  taskId: 'task-1',
  dependsOnTaskId: 'task-dep-1',
  dependencyType: 'blocks',
  createdAt: new Date().toISOString(),
  dependsOnTask: mockDepTask,
};

const blockingDep = {
  id: 'dep-blocking-1',
  taskId: 'task-block-1',
  dependsOnTaskId: 'task-1',
  dependencyType: 'blocks',
  createdAt: new Date().toISOString(),
  blockingTask: mockBlockingTask,
};

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskDependencyGraph (React Testing Library)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Empty state ──────────────────────────────────────────────

  it('shows empty state when no dependencies exist', () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    expect(screen.getByText('No dependencies')).toBeInTheDocument();
    expect(screen.getByText('Link this task to others')).toBeInTheDocument();
    expect(screen.getByText('Add dependency')).toBeInTheDocument();
  });

  // ── Graph view ───────────────────────────────────────────────

  it('renders blockedBy dependencies in graph view', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Should show the section header
    expect(screen.getByText('Blocked by')).toBeInTheDocument();

    // The dependency task title should appear
    expect(await screen.findByText('Frontend setup')).toBeInTheDocument();
    expect(screen.getByText('TASK-2')).toBeInTheDocument();

    // The current task info should be fetched and displayed
    expect(await screen.findByText('Current Task')).toBeInTheDocument();
    expect(screen.getByText('TASK-1')).toBeInTheDocument();

    // The status badge should be rendered
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders blocking dependencies in graph view', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[blockingDep]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    expect(screen.getByText('Blocking')).toBeInTheDocument();
    expect(await screen.findByText('API integration')).toBeInTheDocument();
    expect(screen.getByText('TASK-3')).toBeInTheDocument();
  });

  it('renders both blockedBy and blocking dependencies simultaneously', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[blockingDep]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    expect(screen.getByText('Blocked by')).toBeInTheDocument();
    expect(screen.getByText('Blocking')).toBeInTheDocument();

    expect(await screen.findByText('Frontend setup')).toBeInTheDocument();
    expect(screen.getByText('API integration')).toBeInTheDocument();

    // Total dependency count should be shown
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('renders unknown task title when dependsOnTask is missing', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    const depNoTask = { ...blockedByDep, dependsOnTask: undefined };

    render(
      <TaskDependencyGraph
        blockedBy={[depNoTask]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    expect(await screen.findByText('Unknown task')).toBeInTheDocument();
  });

  // ── Fetches current task info in graph view ──────────────────

  it('fetches current task info from API on mount in graph view', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Wait for current task info to render
    expect(await screen.findByText('Current Task')).toBeInTheDocument();

    // Should have fetched the current task
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/task-1');
  });

  it('shows placeholder when current task fetch fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Should show placeholder text when fetch fails
    expect(await screen.findByText('Current Task')).toBeInTheDocument();
  });

  // ── View toggle ──────────────────────────────────────────────

  it('toggles between graph and list view', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Initially in graph mode with 'Blocked by' heading
    expect(screen.getByText('Blocked by')).toBeInTheDocument();

    // Find the Graph/List toggle buttons and click List
    const listButton = screen.getByText('List');
    fireEvent.click(listButton);

    // Now should be in list mode with 'Blocked by (1)' heading
    expect(screen.getByText('Blocked by (1)')).toBeInTheDocument();

    // Click back to graph
    const graphButton = screen.getByText('Graph');
    fireEvent.click(graphButton);

    // Back in graph mode
    expect(screen.getByText('Blocked by')).toBeInTheDocument();
  });

  // ── List view ────────────────────────────────────────────────

  it('renders dependencies in list view', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[blockingDep]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Switch to list view
    fireEvent.click(screen.getByText('List'));

    expect(await screen.findByText('Blocked by (1)')).toBeInTheDocument();
    expect(screen.getByText('Blocking (1)')).toBeInTheDocument();

    // Both task titles should be present
    expect(screen.getByText('Frontend setup')).toBeInTheDocument();
    expect(screen.getByText('API integration')).toBeInTheDocument();
  });

  // ── Remove dependency ────────────────────────────────────────

  it('removes a dependency from the list view', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    const onRemoved = vi.fn();

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={onRemoved}
      />,
    );

    // Switch to list view to easily find the remove button
    fireEvent.click(screen.getByText('List'));

    await screen.findByText('Frontend setup');

    // Mock the DELETE response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    // In list view, each dep item div has class 'group' with exactly one button inside
    const removeButton = document.querySelector('.group button');
    if (removeButton) fireEvent.click(removeButton);

    // Verify DELETE was called
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/tasks/task-1/dependencies?dependencyId=dep-blocked-1',
        { method: 'DELETE' },
      );
    });

    // Callback should have been invoked
    await waitFor(() => {
      expect(onRemoved).toHaveBeenCalled();
    });
  });

  it('shows spinner on remove button while deleting', async () => {
    // Deferred promise to control when delete resolves
    let resolveDelete: (value: unknown) => void;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    // Mock the DELETE call with a deferred promise
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => deletePromise);

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Switch to list view
    fireEvent.click(screen.getByText('List'));

    await screen.findByText('Frontend setup');

    // Click the remove button
    const removeButton = document.querySelector('.group button');
    if (removeButton) fireEvent.click(removeButton);

    // Spinner should appear
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    // Resolve the delete
    resolveDelete!(mockFetchResponse({ success: true }));
  });

  // ── Add dependency dialog ────────────────────────────────────

  it('opens the add dependency dialog when clicking the plus button', () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Click the header plus button (title="Add dependency") to open the dialog
    const addButton = screen.getByTitle('Add dependency');
    fireEvent.click(addButton);

    // Dialog should appear with search input
    expect(screen.getByPlaceholderText('Search tasks to link...')).toBeInTheDocument();
  });

  it('opens dialog from the plus icon button when dependencies exist', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Find the plus button (it has a title "Add dependency")
    const plusButton = screen.getByTitle('Add dependency');
    fireEvent.click(plusButton);

    expect(screen.getByPlaceholderText('Search tasks to link...')).toBeInTheDocument();
  });

  it('searches for tasks with debounced input and displays results', async () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Open dialog via the header plus button
    fireEvent.click(screen.getByTitle('Add dependency'));

    const searchInput = screen.getByPlaceholderText('Search tasks to link...');

    // Type a search query
    fireEvent.change(searchInput, { target: { value: 'Database' } });

    // Mock search fetch (debounced at 300ms)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({
        tasks: [
          { id: 'task-4', title: 'Database schema', taskIdDisplay: 'TASK-4', status: 'in_progress' },
          { id: 'task-5', title: 'Auth module', taskIdDisplay: 'TASK-5', status: 'todo' },
        ],
      }),
    );

    // Wait for debounce to fire and results to appear
    expect(await screen.findByText('Database schema')).toBeInTheDocument();
    expect(screen.getByText('Auth module')).toBeInTheDocument();
  });

  it('filters out the current task and already-depended tasks from search results', async () => {
    // Mock current task fetch so graph view shows a real title (not placeholder)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ task: { id: 'task-1', title: 'Main Task', taskIdDisplay: 'TASK-1', status: 'in_progress' } }),
    );

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep]} // task-dep-1 is already a dependency
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Open dialog via the header plus button
    fireEvent.click(screen.getByTitle('Add dependency'));

    const searchInput = screen.getByPlaceholderText('Search tasks to link...');

    // Mock search returns all tasks including current + already-depended
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({
        tasks: [
          // task-1 (current task) should be filtered out
          { id: 'task-1', title: 'Current Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
          // task-dep-1 (already a dependency) should be filtered out
          { id: 'task-dep-1', title: 'Already Dep Task', taskIdDisplay: 'TASK-2', status: 'completed' },
          // task-valid should remain
          { id: 'task-valid', title: 'New feature', taskIdDisplay: 'TASK-6', status: 'todo' },
        ],
      }),
    );

    fireEvent.change(searchInput, { target: { value: 'task' } });

    // Wait for results — current task and already-depended should be filtered out
    expect(await screen.findByText('New feature')).toBeInTheDocument();
    expect(screen.queryByText('Current Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Already Dep Task')).not.toBeInTheDocument();

    // Graph view center node should still show the current task title
    expect(screen.getByText('Main Task')).toBeInTheDocument();
  });

  it('adds a dependency by clicking a search result', async () => {
    const onAdded = vi.fn();

    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={onAdded}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Open dialog via the header plus button
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

    // Click on Database schema to add it
    fireEvent.click(screen.getByText('Database schema'));

    // Verify POST was called with correct data
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/task-1/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependsOnTaskId: 'task-4',
          dependencyType: 'blocks',
        }),
      });
    });

    // Callback should have been invoked
    await waitFor(() => {
      expect(onAdded).toHaveBeenCalled();
    });

    // Dialog should close (waitFor because AnimatePresence delays DOM removal)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search tasks to link...')).not.toBeInTheDocument();
    });
  });

  it('shows error message when adding a dependency fails', async () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Open dialog via the header plus button
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

    // Mock the POST to fail
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ error: { message: 'Circular dependency detected' } }, 400),
    );

    // Click to add
    fireEvent.click(screen.getByText('Database schema'));

    // Error message should appear
    expect(await screen.findByText('Circular dependency detected')).toBeInTheDocument();

    // Dialog should remain open
    expect(screen.getByPlaceholderText('Search tasks to link...')).toBeInTheDocument();
  });

  it('shows placeholder text when no search results match', async () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Open dialog via the header plus button
    fireEvent.click(screen.getByTitle('Add dependency'));

    const searchInput = screen.getByPlaceholderText('Search tasks to link...');
    fireEvent.change(searchInput, { target: { value: 'zzzzz' } });

    // Mock empty search results
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ tasks: [] }),
    );

    expect(await screen.findByText(/No tasks found/)).toBeInTheDocument();
  });

  it('closes the dialog when clicking cancel', async () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Open dialog via the header plus button
    fireEvent.click(screen.getByTitle('Add dependency'));
    expect(screen.getByPlaceholderText('Search tasks to link...')).toBeInTheDocument();

    // Click Cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Dialog should close (waitFor because AnimatePresence delays DOM removal)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search tasks to link...')).not.toBeInTheDocument();
    });
  });

  it('closes the dialog when clicking the backdrop', async () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    // Open dialog via the header plus button
    fireEvent.click(screen.getByTitle('Add dependency'));
    expect(screen.getByPlaceholderText('Search tasks to link...')).toBeInTheDocument();

    // Click the backdrop (the fixed overlay div)
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);

    // Dialog should close (waitFor because AnimatePresence delays DOM removal)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search tasks to link...')).not.toBeInTheDocument();
    });
  });

  // ── Initial placeholder text ────────────────────────────────

  it('shows instructions text when dialog is first opened and no query entered', () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Add dependency'));

    expect(screen.getByText('Type to search for a task to link')).toBeInTheDocument();
  });

  // ── Dependency count ─────────────────────────────────────────

  it('does not show dependency count when there are zero dependencies', () => {
    render(
      <TaskDependencyGraph
        blockedBy={[]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    expect(screen.queryByText(/\(0\)/)).not.toBeInTheDocument();
  });

  it('shows correct dependency count for multiple blockedBy', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(currentTaskResponse),
    );

    const dep2 = {
      ...blockedByDep,
      id: 'dep-blocked-2',
      dependsOnTaskId: 'task-dep-2',
      dependsOnTask: {
        id: 'task-dep-2',
        title: 'Design mockups',
        taskIdDisplay: 'TASK-7',
        status: 'in_review',
      },
    };

    render(
      <TaskDependencyGraph
        blockedBy={[blockedByDep, dep2]}
        blocking={[]}
        taskId="task-1"
        onDependencyAdded={vi.fn()}
        onDependencyRemoved={vi.fn()}
      />,
    );

    expect(await screen.findByText('(2)')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════
  //  EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    // ── Search: invalid API data ───────────────────────────────

    it('shows no results when search API returns non-array tasks (object)', async () => {
      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // API returns tasks as an object (invalid)
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFetchResponse({ tasks: { id: 'bad', title: 'Not array' } }),
      );

      // Error is caught silently; placeholder text should appear
      expect(await screen.findByText(/No tasks found/)).toBeInTheDocument();
    });

    it('shows no results when search API returns null tasks', async () => {
      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // API returns null tasks
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFetchResponse({ tasks: null }),
      );

      expect(await screen.findByText(/No tasks found/)).toBeInTheDocument();
    });

    it('shows no results when search API returns undefined tasks (missing field)', async () => {
      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // API returns response without tasks field
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFetchResponse({}),
      );

      expect(await screen.findByText(/No tasks found/)).toBeInTheDocument();
    });

    it('shows no results and no error when search API returns 500', async () => {
      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // API returns 500
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFetchResponse({ error: 'Server error' }, 500),
      );

      // Should show no results (the 500 response isn't ok, so results stay empty)
      expect(await screen.findByText(/No tasks found/)).toBeInTheDocument();
    });

    // ── Search: network error ──────────────────────────────────

    it('handles network error during search silently', async () => {
      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Fetch rejects with network error
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network failure'),
      );

      // Should show no results (error is caught silently)
      expect(await screen.findByText(/No tasks found/)).toBeInTheDocument();
    });

    // ── Large search results ───────────────────────────────────

    it('renders 12 search results when API returns many tasks', async () => {
      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');

      // Generate 12 tasks
      const manyTasks = Array.from({ length: 12 }, (_, i) => ({
        id: `task-${i + 10}`,
        title: `Search result ${i + 1}`,
        taskIdDisplay: `TASK-${i + 10}`,
        status: i % 2 === 0 ? 'todo' : 'in_progress',
      }));

      // Use mockImplementation to handle any stray fetch calls (e.g. from GraphView)
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
        if (url.includes('/api/tasks?search=')) {
          return mockFetchResponse({ tasks: manyTasks });
        }
        return mockFetchResponse(currentTaskResponse);
      });

      // Input triggers debounce which will call the mock after 300ms
      fireEvent.change(searchInput, { target: { value: 'task' } });

      // Wait for debounce to fire and results to appear
      await waitFor(() => {
        expect(screen.getByText('Search result 1')).toBeInTheDocument();
      });

      // All 12 results should be rendered
      const resultButtons = screen.getAllByText(/Search result/);
      expect(resultButtons).toHaveLength(12);
    });

    // ── Clear query ────────────────────────────────────────────

    it('clears search results when query is cleared', async () => {
      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');

      // First, type a query and wait for results
      fireEvent.change(searchInput, { target: { value: 'Database' } });

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFetchResponse({
          tasks: [{ id: 'task-4', title: 'Database schema', taskIdDisplay: 'TASK-4', status: 'todo' }],
        }),
      );

      expect(await screen.findByText('Database schema')).toBeInTheDocument();

      // Clear the query
      fireEvent.change(searchInput, { target: { value: '' } });

      // Results should immediately clear (no debounce needed for empty string)
      await waitFor(() => {
        expect(screen.queryByText('Database schema')).not.toBeInTheDocument();
      });

      // Instructions text should reappear
      expect(screen.getByText('Type to search for a task to link')).toBeInTheDocument();
    });

    // ── Remove failure ─────────────────────────────────────────

    it('does not call onDependencyRemoved when DELETE returns non-ok status', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse(currentTaskResponse),
      );

      const onRemoved = vi.fn();

      render(
        <TaskDependencyGraph
          blockedBy={[blockedByDep]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={onRemoved}
        />,
      );

      fireEvent.click(screen.getByText('List'));
      await screen.findByText('Frontend setup');

      // Mock DELETE to return 500
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFetchResponse({ error: 'Server error' }, 500),
      );

      const removeButton = document.querySelector('.group button');
      if (removeButton) fireEvent.click(removeButton);

      // Give the async handler time to complete
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          '/api/tasks/task-1/dependencies?dependencyId=dep-blocked-1',
          { method: 'DELETE' },
        );
      });

      // Callback should NOT have been invoked
      expect(onRemoved).not.toHaveBeenCalled();
    });

    it('does not call onDependencyRemoved when DELETE network request fails', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse(currentTaskResponse),
      );

      const onRemoved = vi.fn();

      render(
        <TaskDependencyGraph
          blockedBy={[blockedByDep]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={onRemoved}
        />,
      );

      fireEvent.click(screen.getByText('List'));
      await screen.findByText('Frontend setup');

      // Mock DELETE to reject with network error
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const removeButton = document.querySelector('.group button');
      if (removeButton) fireEvent.click(removeButton);

      // Give the async handler time to complete (catch block runs, callback not called)
      await waitFor(() => {
        // The loading spinner should have been removed since the catch block runs finally
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
      });

      expect(onRemoved).not.toHaveBeenCalled();
    });

    // ── Long task title ────────────────────────────────────────

    it('renders task titles with truncation class in list view', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse(currentTaskResponse),
      );

      const longTitle = 'This is an extremely long task title that should be truncated with CSS ellipsis in the list view component for proper rendering of dependency names without breaking the layout';
      const depWithLongTitle = {
        ...blockedByDep,
        dependsOnTask: { ...mockDepTask, title: longTitle },
      };

      render(
        <TaskDependencyGraph
          blockedBy={[depWithLongTitle]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByText('List'));

      const titleElement = await screen.findByText(longTitle);
      expect(titleElement).toBeInTheDocument();
      // Should have CSS truncation classes
      expect(titleElement.className).toContain('truncate');
    });

    // ── Quick query changes (debounce cancellation) ────────────

    it('cancels previous debounce when query changes rapidly', async () => {
      let searchCallCount = 0;

      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');

      // Mock all fetch calls to track count and return different data per query
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
        if (url.includes('/api/tasks?search=')) {
          searchCallCount++;
          const searchTerm = decodeURIComponent(url.split('search=')[1]!.split('&')[0]!);
          return mockFetchResponse({
            tasks: searchTerm === 'Database'
              ? [{ id: 'task-initial', title: 'First search', taskIdDisplay: 'T-1', status: 'todo' }]
              : [{ id: 'task-final', title: 'Final search', taskIdDisplay: 'T-2', status: 'todo' }],
          });
        }
        return mockFetchResponse(currentTaskResponse);
      });

      // Type first query (debounce starts: 300ms)
      fireEvent.change(searchInput, { target: { value: 'Database' } });

      // Immediately (before debounce fires) change query — this cancels the first timeout
      fireEvent.change(searchInput, { target: { value: 'Database final' } });

      // Wait for debounce to fire — only the second query's results should appear
      await waitFor(() => {
        expect(screen.getByText('Final search')).toBeInTheDocument();
      });

      // Only ONE search call should have been made (the second query, after first was cancelled)
      expect(searchCallCount).toBe(1);
      expect(screen.queryByText('First search')).not.toBeInTheDocument();
    });

    it('sends single search request even when typing multiple characters in rapid succession', async () => {
      let searchCallCount = 0;

      render(
        <TaskDependencyGraph
          blockedBy={[]}
          blocking={[]}
          taskId="task-1"
          onDependencyAdded={vi.fn()}
          onDependencyRemoved={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTitle('Add dependency'));
      const searchInput = screen.getByPlaceholderText('Search tasks to link...');

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
        if (url.includes('/api/tasks?search=')) {
          searchCallCount++;
          return mockFetchResponse({
            tasks: [{ id: 'task-final', title: 'Results', taskIdDisplay: 'T-1', status: 'todo' }],
          });
        }
        return mockFetchResponse(currentTaskResponse);
      });

      // All typing happens synchronously, well before any 300ms debounce fires
      // So each keystroke clears the previous debounce, and only the last fires
      fireEvent.change(searchInput, { target: { value: 'A' } });
      fireEvent.change(searchInput, { target: { value: 'AB' } });
      fireEvent.change(searchInput, { target: { value: 'ABC' } });
      fireEvent.change(searchInput, { target: { value: 'ABCD' } });

      // Wait for debounce to fire — only one search call for the final query
      await waitFor(() => {
        expect(screen.getByText('Results')).toBeInTheDocument();
      });

      expect(searchCallCount).toBe(1);
    });
  });
});
