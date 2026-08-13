import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardClient } from '@/app/(dashboard)/dashboard-client';

// The dashboard page is now an async server component that hands initial
// metrics to this client shell. Passing initialMetrics={null} exercises the
// client-fetch fallback path (mocked below) — the same behavior these SSE
// tests were written against.
const DashboardPage = () => <DashboardClient initialMetrics={null} initialUserName="Test User" />;

// ─── Controllable mock state ───────────────────────────────

let mockUnreadCount = 0;

// ─── Mock next/link ────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// ─── Mock framer-motion ────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    a: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  },
}));

// ─── Mock UI components ────────────────────────────────────

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className} data-testid="card-title">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, size, className }: any) => (
    <span className={className} data-variant={variant} data-size={size}>{children}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));

// ─── Mock SSE hook (no-op) ────────────────────────────────

vi.mock('@/lib/hooks/use-notification-sse', () => ({
  useNotificationSSE: () => {},
}));

// ─── Mock notification store (dynamic unreadCount) ────────

vi.mock('@/stores/notification-store', () => ({
  useNotificationStore: (selector: any) => {
    const state = {
      notifications: [],
      unreadCount: mockUnreadCount,
      loading: false,
      fetchNotifications: vi.fn(),
      fetchUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      dismiss: vi.fn(),
      setUnreadCount: vi.fn(),
      addOptimistic: vi.fn(),
      removeOptimistic: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// ─── Mock dashboard sub-components ─────────────────────────

vi.mock('@/components/dashboard/team-activity-feed', () => ({
  TeamActivityFeed: vi.fn(({ maxItems, refreshCounter }: any) => (
    <div data-testid="team-activity-feed" data-max-items={maxItems} data-refresh-counter={refreshCounter}>
      Team Activity Feed
    </div>
  )),
}));

vi.mock('@/components/dashboard/eod-report-widget', () => ({
  EODReportWidget: () => <div data-testid="eod-report-widget">EOD Report</div>,
}));

// ─── Mock recharts-charts (lazy loaded) ───────────────────

vi.mock('@/components/dashboard/recharts-charts', () => ({
  default: () => <div data-testid="recharts-charts">Charts</div>,
}));

// ─── Mock fetch for dashboard data ─────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function setupDashboardData() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/tasks')) {
      return Promise.resolve(new Response(JSON.stringify({ tasks: [] }), { status: 200 }));
    }
    if (url.includes('/api/projects')) {
      return Promise.resolve(new Response(JSON.stringify({ projects: [] }), { status: 200 }));
    }
    if (url.includes('/api/users')) {
      return Promise.resolve(new Response(JSON.stringify({ users: [] }), { status: 200 }));
    }
    if (url.includes('/api/auth/get-session')) {
      return Promise.resolve(new Response(JSON.stringify({ user: { id: 'user-1', name: 'Test User' } }), { status: 200 }));
    }
    return Promise.reject(new Error(`Unhandled: ${url}`));
  });
}

// ─── Tests ─────────────────────────────────────────────────

describe('Dashboard SSE Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnreadCount = 0;
    setupDashboardData();
  });

  // ══════════════════════════════════════════════════════════
  //  Unread Badge Visibility
  // ══════════════════════════════════════════════════════════

  it('hides unread notification badges when unreadCount is 0', async () => {
    mockUnreadCount = 0;
    render(<DashboardPage />);

    await screen.findAllByTestId('team-activity-feed');

    // The "X new" badge should not be present (format: "3 new", "15 new")
    expect(screen.queryByText(/\d+ new/i)).not.toBeInTheDocument();
  });

  it('shows unread badge in Team Activity card header when unreadCount > 0', async () => {
    mockUnreadCount = 3;
    render(<DashboardPage />);

    await screen.findAllByTestId('team-activity-feed');

    // The "X new" text badge should be visible with the count
    expect(screen.getByText('3 new')).toBeInTheDocument();

    // The red dot badge (just the number) should be visible
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows 9+ badge for unread counts over 9', async () => {
    mockUnreadCount = 15;
    render(<DashboardPage />);

    await screen.findAllByTestId('team-activity-feed');

    // Should show 9+ in the dot badge
    expect(screen.getByText('9+')).toBeInTheDocument();

    // Should show "15 new" text badge (the actual count in the text badge)
    expect(screen.getByText('15 new')).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  refreshCounter Bump Behavior
  // ══════════════════════════════════════════════════════════

  it('passes initial refreshCounter of 0 to TeamActivityFeed', async () => {
    mockUnreadCount = 0;
    render(<DashboardPage />);

    const feed = await screen.findByTestId('team-activity-feed');

    expect(feed).toHaveAttribute('data-refresh-counter', '0');
    expect(feed).toHaveAttribute('data-max-items', '20');
  });

  it('bumps refreshCounter when unreadCount increases after initial load', async () => {
    // Simulate initial unread count from SSE sync (e.g., there were already 3 unread)
    mockUnreadCount = 3;
    const { rerender } = render(<DashboardPage />);

    const feed = await screen.findByTestId('team-activity-feed');
    expect(feed).toHaveAttribute('data-refresh-counter', '0');

    // Simulate a new notification arriving via SSE — unreadCount increases
    mockUnreadCount = 5;
    rerender(<DashboardPage />);

    // The effect should detect 5 > 3 and bump the counter to 1
    const updatedFeed = await screen.findByTestId('team-activity-feed');
    expect(updatedFeed).toHaveAttribute('data-refresh-counter', '1');
  });

  it('does not bump refreshCounter on initial mount even if unreadCount is non-zero', async () => {
    // Even though unreadCount is 3, the initial mount should not bump the counter
    // (prevUnreadRef.current === 0 guard prevents it)
    mockUnreadCount = 3;
    render(<DashboardPage />);

    const feed = await screen.findByTestId('team-activity-feed');
    expect(feed).toHaveAttribute('data-refresh-counter', '0');
  });

  // ══════════════════════════════════════════════════════════
  //  Team Activity Card Title
  // ══════════════════════════════════════════════════════════

  it('renders Team Activity card with correct title', async () => {
    render(<DashboardPage />);

    await screen.findAllByTestId('team-activity-feed');

    expect(screen.getByText('Team Activity')).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  EOD Report Widget
  // ══════════════════════════════════════════════════════════

  it('renders EOD Report widget', async () => {
    render(<DashboardPage />);

    await screen.findAllByTestId('team-activity-feed');

    expect(screen.getByTestId('eod-report-widget')).toBeInTheDocument();
  });
});
