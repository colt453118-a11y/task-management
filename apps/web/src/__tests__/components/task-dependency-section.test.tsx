import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDependencySection } from '@/components/tasks/task-dependency-section';

const mockSetDependencies = vi.fn();
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('@/stores/task-store', () => ({
  useTaskStore: (selector: any) => {
    const state = {
      blockedBy: [{ id: 't2', title: 'Blocking Task', taskIdDisplay: 'TASK-2', status: 'open', priority: 'high' }],
      blocking: [{ id: 't3', title: 'Blocked Task', taskIdDisplay: 'TASK-3', status: 'in_progress', priority: 'medium' }],
      setDependencies: mockSetDependencies,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/components/tasks/task-dependency-graph', () => ({
  TaskDependencyGraph: ({ blockedBy, blocking, taskId, onDependencyAdded, onDependencyRemoved }: any) => (
    <div data-testid="dependency-graph">
      <span>Task: {taskId}</span>
      <span>Blocked by: {blockedBy.length}</span>
      <span>Blocking: {blocking.length}</span>
      <button onClick={onDependencyAdded} data-testid="dep-added">Dep Added</button>
      <button onClick={onDependencyRemoved} data-testid="dep-removed">Dep Removed</button>
    </div>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('TaskDependencySection', () => {
  it('renders dependency graph with task data', () => {
    render(<TaskDependencySection taskId="t1" />);
    expect(screen.getByTestId('dependency-graph')).toBeInTheDocument();
    expect(screen.getByText('Task: t1')).toBeInTheDocument();
    expect(screen.getByText('Blocked by: 1')).toBeInTheDocument();
    expect(screen.getByText('Blocking: 1')).toBeInTheDocument();
  });

  it('calls fetch on dependency added callback', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      blockedBy: [], blocking: [],
    })));
    const user = userEvent.setup();
    render(<TaskDependencySection taskId="t1" />);
    await user.click(screen.getByTestId('dep-added'));
    expect(mockFetch).toHaveBeenCalledWith('/api/tasks/t1/dependencies');
  });

  it('calls fetch on dependency removed callback', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      blockedBy: [], blocking: [],
    })));
    const user = userEvent.setup();
    render(<TaskDependencySection taskId="t1" />);
    await user.click(screen.getByTestId('dep-removed'));
    expect(mockFetch).toHaveBeenCalledWith('/api/tasks/t1/dependencies');
  });

  it('calls setDependencies on successful refetch', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      blockedBy: [{ id: 't2', title: 'T2', taskIdDisplay: 'TASK-2', status: 'open', priority: 'medium' }],
      blocking: [],
    })));
    const user = userEvent.setup();
    mockSetDependencies.mockClear();
    render(<TaskDependencySection taskId="t1" />);
    await user.click(screen.getByTestId('dep-added'));
    await vi.waitFor(() => {
      expect(mockSetDependencies).toHaveBeenCalledWith(
        [{ id: 't2', title: 'T2', taskIdDisplay: 'TASK-2', status: 'open', priority: 'medium' }],
        [],
      );
    });
  });

  it('renders with custom className', () => {
    const { container } = render(<TaskDependencySection taskId="t1" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
