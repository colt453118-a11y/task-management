import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('CreateTaskDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<CreateTaskDialog open={false} onOpenChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the form when open', () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: [] })));
    render(<CreateTaskDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Quick Create Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a description (optional)...')).toBeInTheDocument();
  });

  it('renders form fields: Priority, Due Date, Assignee', () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: [] })));
    render(<CreateTaskDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
  });

  it('disables Create button when title is empty', () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: [] })));
    render(<CreateTaskDialog open={true} onOpenChange={vi.fn()} />);
    const createBtn = screen.getByText('Create').closest('button');
    expect(createBtn).toBeDisabled();
  });

  it('enables Create button when title is filled', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: [] })));
    const user = userEvent.setup();
    render(<CreateTaskDialog open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByPlaceholderText('What needs to be done?');
    await user.type(input, 'New task title');

    const createBtn = screen.getByText('Create').closest('button');
    expect(createBtn).not.toBeDisabled();
  });

  it('shows Cancel and Create buttons', () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: [] })));
    render(<CreateTaskDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders the keyboard shortcut hint', () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: [] })));
    render(<CreateTaskDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('⌘T')).toBeInTheDocument();
  });

  it('fetches users when opened', () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ users: [
      { id: 'u1', name: 'Alice', email: 'alice@test.com' },
    ] })));
    render(<CreateTaskDialog open={true} onOpenChange={vi.fn()} />);
    expect(mockFetch).toHaveBeenCalledWith('/api/users?limit=50');
  });
});
