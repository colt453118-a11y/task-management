import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DependencyVisualizer } from '@/components/tasks/task-dependency-visualizer';

vi.mock('framer-motion', () => ({
  motion: {
    g: ({ children, ...props }: any) => <g {...props}>{children}</g>,
    line: (props: any) => <line {...props} />,
    circle: (props: any) => <circle {...props} />,
    text: (props: any) => <text {...props} />,
    polygon: (props: any) => <polygon {...props} />,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const baseProps = {
  taskId: 't1',
  nodes: [
    { id: 't1', title: 'Root Task', taskIdDisplay: 'TASK-1', status: 'open', priority: 'high' },
    { id: 't2', title: 'Dependency', taskIdDisplay: 'TASK-2', status: 'completed', priority: 'medium' },
  ],
  edges: [
    { id: 'e1', source: 't2', target: 't1', dependencyType: 'blocks' },
  ],
  stats: { totalNodes: 2, totalEdges: 1, maxDepth: 1, cycles: false },
  loading: false,
  error: null,
  onRefresh: vi.fn(),
};

describe('DependencyVisualizer', () => {
  it('shows loading state', () => {
    render(<DependencyVisualizer {...baseProps} loading={true} />);
    expect(screen.getByText('Loading dependency graph...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<DependencyVisualizer {...baseProps} error="Failed to load graph" />);
    expect(screen.getByText('Failed to load graph')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('shows empty state when no nodes', () => {
    render(<DependencyVisualizer {...baseProps} nodes={[]} edges={[]} stats={{ totalNodes: 0, totalEdges: 0, maxDepth: 0, cycles: false }} />);
    expect(screen.getByText('No dependencies found')).toBeInTheDocument();
  });

  it('renders graph with nodes and edges', () => {
    render(<DependencyVisualizer {...baseProps} />);
    // Should have SVG with rendered content (not loading/error/empty)
    expect(screen.queryByText('Loading dependency graph...')).not.toBeInTheDocument();
    expect(screen.queryByText('No dependencies found')).not.toBeInTheDocument();
  });

  it('shows stats in fullScreen mode', () => {
    render(<DependencyVisualizer {...baseProps} fullScreen={true} />);
    expect(screen.getByText('Dependency Graph')).toBeInTheDocument();
    expect(screen.getByText('2 nodes · 1 edges · depth 1')).toBeInTheDocument();
  });

  it('shows cycle detection warning', () => {
    render(
      <DependencyVisualizer
        {...baseProps}
        fullScreen={true}
        stats={{ totalNodes: 3, totalEdges: 3, maxDepth: 2, cycles: true }}
      />,
    );
    expect(screen.getByText(/cycle detected/i)).toBeInTheDocument();
  });

  it('renders zoom controls in fullScreen mode', () => {
    render(<DependencyVisualizer {...baseProps} fullScreen={true} />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset view')).toBeInTheDocument();
  });
});
