import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebhookSettings } from '@/components/settings/webhook-settings';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => (
    <span className={className}>{children}</span>
  ),
}));

const mockWebhooks = [
  {
    id: 'wh1',
    name: 'Slack Notifications',
    url: 'https://hooks.slack.com/services/xxx',
    events: ['task.created', 'task.updated', 'task.assigned', 'task.comment_added', 'task.deleted'],
    headers: {},
    isActive: true,
    retryCount: 3,
    retryIntervalMs: 5000,
    timeoutMs: 10000,
    lastSuccessAt: '2024-06-15T10:00:00Z',
    lastFailureAt: null,
    lastFailureReason: null,
    hasSecret: true,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'wh2',
    name: 'GitHub Integration',
    url: 'https://api.github.com/repos/owner/repo/dispatches',
    events: ['task.status_changed', 'task.completed'],
    headers: {},
    isActive: false,
    retryCount: 5,
    retryIntervalMs: 10000,
    timeoutMs: 30000,
    lastSuccessAt: null,
    lastFailureAt: '2024-06-10T08:30:00Z',
    lastFailureReason: 'Connection timeout',
    hasSecret: false,
    createdAt: '2024-03-20T10:00:00Z',
  },
];

describe('WebhookSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no webhooks', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: [] })));
    render(<WebhookSettings />);
    await waitFor(() => {
      expect(screen.getByText('No webhooks configured')).toBeInTheDocument();
    });
    expect(screen.getByText('Create Your First Webhook')).toBeInTheDocument();
  });

  it('renders webhook list', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: mockWebhooks })));
    render(<WebhookSettings />);
    await waitFor(() => {
      expect(screen.getByText('Slack Notifications')).toBeInTheDocument();
    });
    expect(screen.getByText('GitHub Integration')).toBeInTheDocument();
  });

  it('shows event tags on webhooks', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: mockWebhooks })));
    render(<WebhookSettings />);
    await waitFor(() => {
      expect(screen.getByText('task.created')).toBeInTheDocument();
      expect(screen.getByText('+1 more')).toBeInTheDocument(); // 4 events, show 3 + 1 more
    });
  });

  it('opens create form', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: [] })));
    const user = userEvent.setup();
    render(<WebhookSettings />);
    await waitFor(() => expect(screen.getByText('Create Your First Webhook')).toBeInTheDocument());
    await user.click(screen.getByText('Create Your First Webhook'));
    expect(screen.getByText('Create Webhook')).toBeInTheDocument();
    expect(screen.getByText('Task Created')).toBeInTheDocument();
  });

  it('renders event checkboxes in create form', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: [] })));
    const user = userEvent.setup();
    render(<WebhookSettings />);
    await waitFor(() => expect(screen.getByText('Create Your First Webhook')).toBeInTheDocument());
    await user.click(screen.getByText('Create Your First Webhook'));
    expect(screen.getByText('Task Created')).toBeInTheDocument();
    expect(screen.getByText('Task Updated')).toBeInTheDocument();
    expect(screen.getByText('Task Assigned')).toBeInTheDocument();
  });

  it('shows validation errors on empty form', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: [] })));
    const user = userEvent.setup();
    render(<WebhookSettings />);
    await waitFor(() => expect(screen.getByText('Create Your First Webhook')).toBeInTheDocument());
    await user.click(screen.getByText('Create Your First Webhook'));
    await user.click(screen.getByText('Create'));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to load'));
    render(<WebhookSettings />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows active/inactive status badges', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: mockWebhooks })));
    render(<WebhookSettings />);
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });
});
