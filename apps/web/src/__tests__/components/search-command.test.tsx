import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchCommand } from '@/components/layout/search-command';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('SearchCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<SearchCommand open={false} onOpenChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders search input when open', () => {
    render(<SearchCommand open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
  });

  it('shows initial state text when no query', () => {
    render(<SearchCommand open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Type to search tasks')).toBeInTheDocument();
  });

  it('fetches search results on input', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      hits: [{ id: 't1', title: 'Test Task', taskIdDisplay: 'TASK-1', status: 'open', priority: 'high', description: null }],
      total: 1, estimatedTotal: 1,
    })));

    render(<SearchCommand open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Search tasks...');
    input.focus();
    await userEvent.type(input, 'test');

    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/search?q=test&limit=10');
    });
  });

  it('shows close keyboard hint in footer', () => {
    render(<SearchCommand open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('shows navigation footer', () => {
    render(<SearchCommand open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});
