// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanColumn } from '@/components/tasks/kanban-column';

// ═══════════════════════════════════════════════════════════════════
// Mock DnD dependencies
// ═══════════════════════════════════════════════════════════════════

const { mockUseDroppable } = vi.hoisted(() => ({
  mockUseDroppable: vi.fn(() => ({
    isOver: false,
    setNodeRef: vi.fn(),
  })),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useDroppable: (...args: Parameters<typeof mockUseDroppable>) => mockUseDroppable(...args),
  useSensor: <T,>(sensor: T) => sensor,
  useSensors: <T,>(...sensors: T[]) => sensors,
  PointerSensor: class {},
  KeyboardSensor: class {},
}));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
}));

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
    dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// KanbanColumn Tests
// ═══════════════════════════════════════════════════════════════════

describe('KanbanColumn (React Testing Library)', () => {
  beforeEach(() => {
    // Reset useDroppable to default state (not hovering over column)
    mockUseDroppable.mockImplementation(() => ({
      isOver: false,
      setNodeRef: vi.fn(),
    }));
  });

  // ── Header rendering ───────────────────────────────────────

  it('renders column header with label and task count', () => {
    const tasks = [sampleTask({ id: 't1' }), sampleTask({ id: 't2' })];
    render(<KanbanColumn status="open" label="Open" tasks={tasks} headerBg="bg-status-open/5" />);

    // Label in heading
    expect(screen.getByText('Open')).toBeInTheDocument();
    // Count badge
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders status dot with the correct color class', () => {
    const { container } = render(
      <KanbanColumn
        status="in_progress"
        label="In Progress"
        tasks={[sampleTask()]}
        headerBg="bg-status-in-progress/5"
      />,
    );

    // The status dot is a span with h-2.5 w-2.5 rounded-full and a bg class
    const dot = container.querySelector('span.h-2\\.5');
    expect(dot).toBeInTheDocument();
    expect(dot!.className).toContain('bg-status-in-progress');
  });

  it('falls back to bg-surface-400 for unknown status dot color', () => {
    const { container } = render(
      <KanbanColumn status="unknown" label="Unknown" tasks={[]} headerBg="" />,
    );

    const dot = container.querySelector('span.h-2\\.5');
    expect(dot!.className).toContain('bg-surface-400');
  });

  it('applies the header background class to the header area', () => {
    const { container } = render(
      <KanbanColumn
        status="blocked"
        label="Blocked"
        tasks={[sampleTask()]}
        headerBg="bg-status-blocked/5"
      />,
    );

    // The header is the first child of the column root div
    const columnRoot = container.firstChild as HTMLElement;
    const headerDiv = columnRoot.children[0]!;
    expect(headerDiv.className).toContain('bg-status-blocked/5');
  });

  // ── Empty state ────────────────────────────────────────────

  it('shows "No tasks" and "Drag tasks here" when tasks array is empty', () => {
    render(<KanbanColumn status="draft" label="Draft" tasks={[]} headerBg="bg-status-draft/5" />);

    expect(screen.getByText('No tasks')).toBeInTheDocument();
    expect(screen.getByText('Drag tasks here')).toBeInTheDocument();
  });

  it('hides empty state messages when tasks exist', () => {
    render(
      <KanbanColumn
        status="open"
        label="Open"
        tasks={[sampleTask(), sampleTask({ id: 't2' })]}
        headerBg="bg-status-open/5"
      />,
    );

    expect(screen.queryByText('No tasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Drag tasks here')).not.toBeInTheDocument();
  });

  // ── Task list rendering ────────────────────────────────────

  it('renders the correct number of task cards', () => {
    const tasks = [
      sampleTask({ id: 't1', title: 'Task One' }),
      sampleTask({ id: 't2', title: 'Task Two' }),
      sampleTask({ id: 't3', title: 'Task Three' }),
    ];

    render(<KanbanColumn status="open" label="Open" tasks={tasks} headerBg="bg-status-open/5" />);

    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByText('Task Two')).toBeInTheDocument();
    expect(screen.getByText('Task Three')).toBeInTheDocument();
  });

  it('renders task cards with correct status inheritance', () => {
    const task = sampleTask({ id: 't1', title: 'My Task', status: 'open' });

    render(<KanbanColumn status="open" label="Open" tasks={[task]} headerBg="bg-status-open/5" />);

    expect(screen.getByText('My Task')).toBeInTheDocument();
    expect(screen.getByText('TASK-1')).toBeInTheDocument();
  });

  it('passes 0 count badge when tasks array is empty', () => {
    render(<KanbanColumn status="open" label="Open" tasks={[]} headerBg="bg-status-open/5" />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // ── Valid drop state (isOver = true, isValidDropTarget != false) ──

  it('shows valid drop indicator (brand ring) when isOver is true and isValidDropTarget is undefined', () => {
    mockUseDroppable.mockReturnValue({
      isOver: true,
      setNodeRef: vi.fn(),
    });

    const { container } = render(
      <KanbanColumn
        status="open"
        label="Open"
        tasks={[sampleTask()]}
        headerBg="bg-status-open/5"
        isValidDropTarget={undefined}
      />,
    );

    // When isOver && isValidDropTarget !== false → ring-2 ring-brand-400
    const column = container.firstChild as HTMLElement;
    expect(column.className).toContain('ring-brand-400');
    expect(column.className).toContain('ring-inset');
    expect(column.className).toContain('ring-2');
  });

  it('shows valid drop indicator when isOver is true and isValidDropTarget is true', () => {
    mockUseDroppable.mockReturnValue({
      isOver: true,
      setNodeRef: vi.fn(),
    });

    const { container } = render(
      <KanbanColumn
        status="in_progress"
        label="In Progress"
        tasks={[sampleTask()]}
        headerBg="bg-status-in-progress/5"
        isValidDropTarget
      />,
    );

    const column = container.firstChild as HTMLElement;
    expect(column.className).toContain('ring-brand-400');
  });

  // ── Invalid drop state (isOver = true, isValidDropTarget = false) ──

  it('shows invalid drop indicator (red ring) when isOver is true and isValidDropTarget is false', () => {
    mockUseDroppable.mockReturnValue({
      isOver: true,
      setNodeRef: vi.fn(),
    });

    const { container } = render(
      <KanbanColumn
        status="completed"
        label="Done"
        tasks={[sampleTask()]}
        headerBg="bg-status-completed/5"
        isValidDropTarget={false}
      />,
    );

    const column = container.firstChild as HTMLElement;
    expect(column.className).toContain('ring-red-400');
    expect(column.className).toContain('ring-inset');
    expect(column.className).toContain('ring-2');
  });

  // ── No drop state (isOver = false) ──

  it('hides drop indicator when isOver is false regardless of isValidDropTarget', () => {
    mockUseDroppable.mockReturnValue({
      isOver: false,
      setNodeRef: vi.fn(),
    });

    const { container } = render(
      <KanbanColumn
        status="open"
        label="Open"
        tasks={[sampleTask()]}
        headerBg="bg-status-open/5"
        isValidDropTarget={false}
      />,
    );

    const column = container.firstChild as HTMLElement;
    expect(column.className).not.toContain('ring-brand-400');
    expect(column.className).not.toContain('ring-red-400');
    expect(column.className).not.toContain('ring-inset');
  });

  // ── Left-border accent ─────────────────────────────────────

  it.each([
    ['draft', 'border-l-status-draft'],
    ['open', 'border-l-status-open'],
    ['in_progress', 'border-l-status-in-progress'],
    ['blocked', 'border-l-status-blocked'],
    ['completed', 'border-l-status-completed'],
    ['closed', 'border-l-status-closed'],
  ])('applies %s left-border accent class', (status, expectedClass) => {
    const { container } = render(
      <KanbanColumn
        status={status}
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        tasks={[]}
        headerBg=""
      />,
    );

    const column = container.firstChild as HTMLElement;
    expect(column.className).toContain(expectedClass);
  });

  it('falls back to border-l-surface-300 for unknown status', () => {
    const { container } = render(
      <KanbanColumn status="unknown" label="Unknown" tasks={[]} headerBg="" />,
    );

    const column = container.firstChild as HTMLElement;
    expect(column.className).toContain('border-l-surface-300');
  });

  // ── Create button ──────────────────────────────────────────

  it('renders create button with correct aria-label based on label prop', () => {
    render(<KanbanColumn status="open" label="Open" tasks={[]} headerBg="bg-status-open/5" />);

    const button = screen.getByRole('button', { name: 'Create task in Open' });
    expect(button).toBeInTheDocument();
  });

  it('renders create button with Plus icon', () => {
    render(
      <KanbanColumn
        status="in_progress"
        label="In Progress"
        tasks={[]}
        headerBg="bg-status-in-progress/5"
      />,
    );

    const button = screen.getByRole('button', { name: 'Create task in In Progress' });
    const plusIcon = button.querySelector('svg.lucide-plus');
    expect(plusIcon).toBeInTheDocument();
  });

  it('navigates to /tasks/new?status=... on create button click', () => {
    // Save and mock window.location
    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    render(
      <KanbanColumn
        status="in_progress"
        label="In Progress"
        tasks={[]}
        headerBg="bg-status-in-progress/5"
      />,
    );

    const button = screen.getByRole('button', { name: 'Create task in In Progress' });
    fireEvent.click(button);

    expect(window.location.href).toBe('/tasks/new?status=in_progress');

    // Restore
    Object.defineProperty(window, 'location', {
      value: { href: originalHref },
      writable: true,
    });
  });

  // ── useDroppable integration ───────────────────────────────

  it('calls useDroppable with column-status id and status data', () => {
    render(
      <KanbanColumn
        status="blocked"
        label="Blocked"
        tasks={[sampleTask()]}
        headerBg="bg-status-blocked/5"
      />,
    );

    expect(mockUseDroppable).toHaveBeenCalledWith({
      id: 'column-blocked',
      data: { status: 'blocked', accepts: 'blocked' },
    });
  });
});
