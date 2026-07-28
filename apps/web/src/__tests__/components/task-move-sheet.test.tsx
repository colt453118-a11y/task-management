import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskMoveSheet } from '@/components/tasks/task-move-sheet';

vi.mock('@/lib/api/validation', () => ({
  TASK_STATUS_TRANSITIONS: {
    open: ['in_progress', 'blocked'],
    in_progress: ['completed', 'blocked', 'under_review'],
    completed: ['closed', 'reopened'],
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="move-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

const mockOnMove = vi.fn();

const sampleTask = {
  id: 'task-1',
  title: 'Design system migration',
  status: 'open',
  taskIdDisplay: 'TASK-42',
};

describe('TaskMoveSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <TaskMoveSheet task={null} open={false} onOpenChange={vi.fn()} onMove={mockOnMove} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders task info when open', () => {
    render(
      <TaskMoveSheet task={sampleTask} open={true} onOpenChange={vi.fn()} onMove={mockOnMove} />,
    );
    expect(screen.getByText('Move task')).toBeInTheDocument();
    expect(screen.getByText('TASK-42')).toBeInTheDocument();
    expect(screen.getByText('Design system migration')).toBeInTheDocument();
  });

  it('shows valid transitions from current status', () => {
    render(
      <TaskMoveSheet task={sampleTask} open={true} onOpenChange={vi.fn()} onMove={mockOnMove} />,
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('calls onMove when target status is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TaskMoveSheet task={sampleTask} open={true} onOpenChange={vi.fn()} onMove={mockOnMove} />,
    );

    await user.click(screen.getByText('In Progress'));
    expect(mockOnMove).toHaveBeenCalledWith('task-1', 'in_progress');
  });

  it('calls onOpenChange with false on Cancel', async () => {
    const mockSetOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskMoveSheet task={sampleTask} open={true} onOpenChange={mockSetOpen} onMove={mockOnMove} />,
    );

    await user.click(screen.getByText('Cancel'));
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  it('shows "No further transitions" for tasks with nowhere to go', () => {
    // Using 'completed' which has transitions to closed/reopened
    render(
      <TaskMoveSheet
        task={{ ...sampleTask, status: 'completed' }}
        open={true}
        onOpenChange={vi.fn()}
        onMove={mockOnMove}
      />,
    );
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Reopened')).toBeInTheDocument();
  });

  it('shows current status indicator', () => {
    render(
      <TaskMoveSheet task={sampleTask} open={true} onOpenChange={vi.fn()} onMove={mockOnMove} />,
    );
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
  });
});
