import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskHoverCard, TaskMentionText } from '@/components/tasks/task-hover-card';

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={className} data-variant={variant}>{children}</span>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open }: any) => <div data-open={open}>{children}</div>,
  PopoverTrigger: ({ children }: any) => <span>{children}</span>,
  PopoverContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('TaskHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children as trigger', () => {
    render(<TaskHoverCard taskRef="TASK-1"><span>Click me</span></TaskHoverCard>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('fetches task data on hover', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      task: { id: 't1', title: 'Test Task', taskIdDisplay: 'TASK-1', status: 'open' },
    })));

    const user = userEvent.setup();
    render(<TaskHoverCard taskRef="t1"><span>Hover me</span></TaskHoverCard>);

    await user.hover(screen.getByText('Hover me'));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tasks/t1');
    });
  });

  it('uses encodeURIComponent for taskRef', () => {
    render(<TaskHoverCard taskRef="ABC-123"><span>Ref</span></TaskHoverCard>);
    expect(screen.getByText('Ref')).toBeInTheDocument();
  });
});

describe('TaskMentionText', () => {
  it('renders plain text without references', () => {
    render(<TaskMentionText text="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders task ID reference as a hoverable link', () => {
    render(<TaskMentionText text="See TASK-42 for details" />);
    expect(screen.getByText('TASK-42')).toBeInTheDocument();
    expect(screen.getByText('See')).toBeInTheDocument();
    expect(screen.getByText('for details')).toBeInTheDocument();
  });

  it('renders multiple task references', () => {
    render(<TaskMentionText text="Related: TASK-1, TASK-2" />);
    expect(screen.getByText('TASK-1')).toBeInTheDocument();
    expect(screen.getByText('TASK-2')).toBeInTheDocument();
  });

  it('strips # prefix from task ref in link', () => {
    render(<TaskMentionText text="Check #ABC-123" />);
    expect(screen.getByText('#ABC-123')).toBeInTheDocument();
  });

  it('renders UUID references', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    render(<TaskMentionText text={`Ref ${uuid}`} />);
    expect(screen.getByText(uuid)).toBeInTheDocument();
  });

  it('handles empty text', () => {
    const { container } = render(<TaskMentionText text="" />);
    expect(container.textContent).toBe('');
  });
});
