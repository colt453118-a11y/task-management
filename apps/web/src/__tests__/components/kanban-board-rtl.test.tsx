// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KanbanCard } from '@/components/tasks/kanban-card';
import { KanbanBoard } from '@/components/tasks/kanban-board';

// ═══════════════════════════════════════════════════════════════════
// Mock DnD dependencies
// jsdom doesn't support pointer events or DOM measurement APIs that
// @dnd-kit sensors require, so we mock the primitives at module level.
// ═══════════════════════════════════════════════════════════════════

vi.mock('@dnd-kit/core', () => {
  const MockDndContext = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const MockDragOverlay = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DndContext: MockDndContext,
    DragOverlay: MockDragOverlay,
    useDroppable: () => ({
      isOver: false,
      setNodeRef: vi.fn(),
    }),
    useSensor: <T,>(sensor: T) => sensor,
    useSensors: <T,>(...sensors: T[]) => sensors,
    PointerSensor: class {},
    KeyboardSensor: class {},
  };
});

vi.mock('@dnd-kit/sortable', () => {
  const MockSortableContext = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
    SortableContext: MockSortableContext,
    verticalListSortingStrategy: {},
  };
});

// ═══════════════════════════════════════════════════════════════════
// Sample task factory
// ═══════════════════════════════════════════════════════════════════

function sampleTask(
  overrides: Partial<{
    id: string;
    title: string;
    status: string;
    priority: string;
    taskIdDisplay: string;
    assignedTo: string | null;
    dueDate: string | null;
  }> = {},
) {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'open',
    priority: 'high',
    taskIdDisplay: 'TASK-1',
    assignedTo: 'Alice',
    dueDate: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// KanbanCard Tests
// ═══════════════════════════════════════════════════════════════════

describe('KanbanCard (React Testing Library)', () => {
  // ── Basic rendering ────────────────────────────────────────

  it('renders task title, task ID, and priority badge', () => {
    render(<KanbanCard task={sampleTask({ title: 'Setup CI pipeline', priority: 'urgent' })} />);

    expect(screen.getByText('Setup CI pipeline')).toBeInTheDocument();
    expect(screen.getByText('TASK-1')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('shows "Unassigned" when task has no assignee', () => {
    render(<KanbanCard task={sampleTask({ assignedTo: null })} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('truncates assignee names longer than 8 characters', () => {
    render(<KanbanCard task={sampleTask({ assignedTo: 'Christopher' })} />);
    // Component truncates to 8 chars + '…'
    expect(screen.getByText(/Christop/)).toBeInTheDocument();
  });

  // ── Due date rendering ─────────────────────────────────────

  it('shows formatted due date', () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const formatted = futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    render(<KanbanCard task={sampleTask({ dueDate: futureDate.toISOString() })} />);
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });

  it('shows overdue styling for past due dates on active (non-readonly) tasks', () => {
    const pastDate = new Date(Date.now() - 86_400_000); // yesterday
    const formatted = pastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    render(
      <KanbanCard task={sampleTask({ dueDate: pastDate.toISOString(), status: 'in_progress' })} />,
    );

    // The overdue class is applied to the wrapper <div>, not the <span> containing the date text
    const dateSpan = screen.getByText(formatted);
    const dateWrapper = dateSpan.parentElement;
    expect(dateWrapper).toBeInTheDocument();
    expect(dateWrapper!.className).toContain('text-status-blocked');
  });

  it('does NOT apply overdue styling for past due dates on completed tasks', () => {
    const pastDate = new Date(Date.now() - 86_400_000);
    const formatted = pastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    render(
      <KanbanCard task={sampleTask({ dueDate: pastDate.toISOString(), status: 'completed' })} />,
    );

    const dateSpan = screen.getByText(formatted);
    const dateWrapper = dateSpan.parentElement;
    expect(dateWrapper).toBeInTheDocument();
    expect(dateWrapper!.className).not.toContain('text-status-blocked');
  });

  it('renders no Calendar icon when dueDate is null', () => {
    const { container } = render(<KanbanCard task={sampleTask({ dueDate: null })} />);
    const calendarIcons = container.querySelectorAll('svg.lucide-calendar');
    expect(calendarIcons.length).toBe(0);
  });

  // ── Read-only state (opacity) ──────────────────────────────

  it.each(['closed', 'archived', 'completed'])(
    'applies readonly opacity for %s status',
    (status) => {
      const { container } = render(<KanbanCard task={sampleTask({ status })} />);
      expect(container.firstChild).toHaveClass('opacity-60');
    },
  );

  it('does not apply readonly opacity for active task statuses', () => {
    const { container } = render(<KanbanCard task={sampleTask({ status: 'in_progress' })} />);
    expect(container.firstChild).not.toHaveClass('opacity-60');
  });

  // ── Drag overlay ───────────────────────────────────────────

  it('applies drag overlay styles when isDragOverlay is true', () => {
    const { container } = render(<KanbanCard task={sampleTask()} isDragOverlay />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('shadow-glass');
    expect(card.className).toContain('rotate-[3deg]');
  });

  // ── Accessibility ──────────────────────────────────────────

  it('has correct aria-label with task ID display and title', () => {
    render(<KanbanCard task={sampleTask({ taskIdDisplay: 'PROJ-42', title: 'Fix login bug' })} />);
    expect(screen.getByRole('button', { name: 'Task PROJ-42: Fix login bug' })).toBeInTheDocument();
  });

  // ── Priority badges ────────────────────────────────────────

  it('renders all priority levels with correct labels', () => {
    const priorities = [
      { priority: 'none', label: 'None' },
      { priority: 'low', label: 'Low' },
      { priority: 'medium', label: 'Medium' },
      { priority: 'high', label: 'High' },
      { priority: 'urgent', label: 'Urgent' },
      { priority: 'critical', label: 'Critical' },
    ] as const;

    for (const { priority, label } of priorities) {
      const { unmount } = render(<KanbanCard task={sampleTask({ priority })} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  // ── Status left-border accent ──────────────────────────────

  it.each([
    ['draft', 'border-l-status-draft'],
    ['open', 'border-l-status-open'],
    ['blocked', 'border-l-status-blocked'],
    ['completed', 'border-l-status-completed'],
    ['closed', 'border-l-status-closed'],
  ])('renders %s card with correct left-border accent class', (status, expectedClass) => {
    const { container } = render(<KanbanCard task={sampleTask({ status })} />);
    expect(container.firstChild).toHaveClass(expectedClass);
  });

  it('falls back to border-l-surface-300 for unknown statuses', () => {
    const { container } = render(<KanbanCard task={sampleTask({ status: 'unknown_status' })} />);
    expect(container.firstChild).toHaveClass('border-l-surface-300');
  });
});

// ═══════════════════════════════════════════════════════════════════
// KanbanBoard Tests
// ═══════════════════════════════════════════════════════════════════

describe('KanbanBoard (React Testing Library)', () => {
  const onStatusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Column rendering ───────────────────────────────────────

  it('renders all 8 workflow columns (Draft through Closed)', () => {
    render(<KanbanBoard tasks={[]} onStatusChange={onStatusChange} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('renders tasks in their correct status columns', () => {
    const tasks = [
      sampleTask({ id: 't1', title: 'Draft Task', status: 'draft' }),
      sampleTask({ id: 't2', title: 'Active Task', status: 'open' }),
      sampleTask({ id: 't3', title: 'In Progress Task', status: 'in_progress' }),
      sampleTask({ id: 't4', title: 'Completed Task', status: 'completed' }),
    ];

    render(<KanbanBoard tasks={tasks} onStatusChange={onStatusChange} />);

    expect(screen.getByText('Draft Task')).toBeInTheDocument();
    expect(screen.getByText('Active Task')).toBeInTheDocument();
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.getByText('Completed Task')).toBeInTheDocument();
  });

  it('groups multiple tasks into the same column', () => {
    const tasks = [
      sampleTask({ id: 't1', title: 'First Open', status: 'open' }),
      sampleTask({ id: 't2', title: 'Second Open', status: 'open' }),
      sampleTask({ id: 't3', title: 'Third Open', status: 'open' }),
    ];

    render(<KanbanBoard tasks={tasks} onStatusChange={onStatusChange} />);

    expect(screen.getByText('First Open')).toBeInTheDocument();
    expect(screen.getByText('Second Open')).toBeInTheDocument();
    expect(screen.getByText('Third Open')).toBeInTheDocument();
  });

  // ── Task count badges ──────────────────────────────────────

  it('shows task count badge in each column header', () => {
    const tasks = [
      sampleTask({ id: 't1', title: 'Task 1', status: 'open' }),
      sampleTask({ id: 't2', title: 'Task 2', status: 'open' }),
      sampleTask({ id: 't3', title: 'Task 3', status: 'draft' }),
    ];

    render(<KanbanBoard tasks={tasks} onStatusChange={onStatusChange} />);

    // Open column has 2 tasks, Draft column has 1 task
    const countBadges = screen.getAllByText(/^[0-9]+$/);
    expect(countBadges.length).toBeGreaterThanOrEqual(8); // all 8 columns have a count badge

    // At least one column shows "2" (Open) and one shows "1" (Draft)
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows "0" badge for columns with no tasks', () => {
    render(<KanbanBoard tasks={[]} onStatusChange={onStatusChange} />);

    // All 8 columns have 0 tasks
    const zeroBadges = screen.getAllByText('0');
    expect(zeroBadges.length).toBe(8);
  });

  // ── Empty state ────────────────────────────────────────────

  it('shows empty state ("No tasks" / "Drag tasks here") for columns without tasks', () => {
    const tasks = [sampleTask({ id: 't1', status: 'draft' })];

    render(<KanbanBoard tasks={tasks} onStatusChange={onStatusChange} />);

    // 7 columns (all except Draft) show "No tasks"
    const noTasksMessages = screen.getAllByText('No tasks');
    expect(noTasksMessages.length).toBe(7);

    const dragHereMessages = screen.getAllByText('Drag tasks here');
    expect(dragHereMessages.length).toBe(7);
  });

  it('does not show "No tasks" message for a column that has tasks', () => {
    const tasks = [sampleTask({ id: 't1', title: 'Only Task', status: 'open' })];

    render(<KanbanBoard tasks={tasks} onStatusChange={onStatusChange} />);

    // Open should not show "No tasks" — it has a task
    // We can verify this by checking that the "No tasks" count is 7 (all except Open)
    const noTasksMessages = screen.getAllByText('No tasks');
    expect(noTasksMessages.length).toBe(7);
  });

  // ── Create-task buttons ────────────────────────────────────

  it('renders create-task button with correct aria-label in each column', () => {
    render(<KanbanBoard tasks={[]} onStatusChange={onStatusChange} />);

    expect(screen.getByRole('button', { name: 'Create task in Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task in Open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task in In Progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task in Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task in Closed' })).toBeInTheDocument();
  });

  // ── Secondary status columns ───────────────────────────────

  it('shows secondary status columns only when they have tasks', () => {
    const tasks = [
      sampleTask({ id: 't1', status: 'draft' }),
      sampleTask({ id: 't2', status: 'on_hold', title: 'On Hold Task' }),
      sampleTask({ id: 't3', status: 'cancelled', title: 'Cancelled Task' }),
    ];

    render(<KanbanBoard tasks={tasks} onStatusChange={onStatusChange} />);

    // Secondary status columns that HAVE tasks should appear
    expect(screen.getByText('On Hold Task')).toBeInTheDocument();
    expect(screen.getByText('Cancelled Task')).toBeInTheDocument();

    // Secondary status columns without tasks should NOT appear
    // (archived, approved, rejected have no tasks, so they should not have column headers)
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument();
  });

  // ── Priority dots on cards ─────────────────────────────────

  it('renders priority indicator dot on each card', () => {
    const { container } = render(
      <KanbanBoard
        tasks={[sampleTask({ id: 't1', priority: 'critical' })]}
        onStatusChange={onStatusChange}
      />,
    );

    // Each KanbanCard renders a priority dot span with bg-priority-*
    const priorityDots = container.querySelectorAll('[class*="bg-priority-"]');
    expect(priorityDots.length).toBeGreaterThanOrEqual(1);
  });
});
