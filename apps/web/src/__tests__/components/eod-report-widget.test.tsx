import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EODReportWidget } from '@/components/dashboard/eod-report-widget';

// ─── Module-level mock state for useAIEODSummary ──────────────

let mockAiSummaryState: {
  summary: string | null;
  loading: boolean;
  error: string | null;
} = { summary: null, loading: false, error: null };
const mockGenerateEODSummary = vi.fn();

vi.mock('@/hooks/use-ai', () => ({
  useAIEODSummary: () => ({
    summary: mockAiSummaryState.summary,
    loading: mockAiSummaryState.loading,
    error: mockAiSummaryState.error,
    generateEODSummary: mockGenerateEODSummary,
    setSummary: vi.fn(),
  }),
}));

// ─── Mock framer-motion ──────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

// ─── Mock UI components ──────────────────────────────────────

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant}>{children}</button>
  ),
}));

// ─── Mock next/link ──────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href, className }: any) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// ─── Mock fetch ──────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ─── Mock Data ───────────────────────────────────────────────

const MOCK_SNAPSHOT_WITH_AI = {
  id: 'snap-1',
  snapshotDate: '2026-07-21',
  snapshotType: 'eod',
  label: 'EOD Report - Jul 21, 2026',
  summary: {
    totalTasks: 8,
    completedCount: 2,
    overdueCount: 1,
    activeProjects: 2,
    totalUsers: 5,
    completionRate: 25,
    aiSummary: 'Team completed 2 of 8 tasks with a 25% completion rate.',
  },
  createdAt: '2026-07-21T17:00:00.000Z',
};

const MOCK_SNAPSHOT_WITHOUT_AI = {
  id: 'snap-1',
  snapshotDate: '2026-07-21',
  snapshotType: 'eod',
  label: 'EOD Report - Jul 21, 2026',
  summary: {
    totalTasks: 8,
    completedCount: 2,
    overdueCount: 1,
    activeProjects: 2,
    totalUsers: 5,
    completionRate: 25,
  },
  createdAt: '2026-07-21T17:00:00.000Z',
};

const MOCK_NEW_SNAPSHOT_RESPONSE = {
  snapshot: {
    id: 'snap-2',
    snapshotDate: '2026-07-22',
    snapshotType: 'eod',
    label: 'EOD Report - Jul 22, 2026',
    summary: {
      totalTasks: 10,
      completedCount: 4,
      overdueCount: 0,
      activeProjects: 3,
      totalUsers: 5,
      completionRate: 40,
      aiSummary: 'Great progress today with 4 of 10 tasks completed.',
    },
    createdAt: '2026-07-22T17:00:00.000Z',
  },
};

function setupListResponse(snapshots: unknown[]) {
  return {
    snapshots,
    total: snapshots.length,
    limit: 1,
    offset: 0,
  };
}

// ─── Helper: set up default mock fetch ───────────────────────

function setupDefaultMockFetch(options?: { hasAiSummary?: boolean }) {
  const snapshot = options?.hasAiSummary ? MOCK_SNAPSHOT_WITH_AI : MOCK_SNAPSHOT_WITHOUT_AI;

  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/api/reports/snapshots?limit=1')) {
      return Promise.resolve(
        new Response(JSON.stringify(setupListResponse([snapshot])), { status: 200 }),
      );
    }
    if (url.includes('/api/reports/snapshots') && init?.method === 'POST') {
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_NEW_SNAPSHOT_RESPONSE), { status: 200 }),
      );
    }
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
}

// ─── Tests ──────────────────────────────────────────────────

describe('EODReportWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiSummaryState = { summary: null, loading: false, error: null };
  });

  // ══════════════════════════════════════════════════════════
  //  Loading State
  // ══════════════════════════════════════════════════════════

  it('shows shimmer loading skeleton while fetching data', () => {
    // Keep fetch pending
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<EODReportWidget />);

    // The loading state renders shimmer elements
    const shimmerElements = document.querySelectorAll('.shimmer');
    expect(shimmerElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('EOD Report')).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Error State
  // ══════════════════════════════════════════════════════════

  it('shows error message when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Retry button should be present
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('retries fetching on retry button click', async () => {
    // First call fails, second succeeds
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(setupListResponse([MOCK_SNAPSHOT_WITHOUT_AI])), { status: 200 }),
      );

    const user = userEvent.setup();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Retry'));

    // Should eventually show snapshot data instead of error
    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════
  //  Empty State
  // ══════════════════════════════════════════════════════════

  it('shows empty state when no snapshots exist', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots?limit=1')) {
        return Promise.resolve(
          new Response(JSON.stringify(setupListResponse([])), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('No EOD reports yet')).toBeInTheDocument();
    });

    // Take Snapshot button should be present
    expect(screen.getByRole('button', { name: /take snapshot/i })).toBeInTheDocument();
  });

  it('shows empty state when snapshot exists but summary is null', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots?limit=1')) {
        return Promise.resolve(
          new Response(JSON.stringify(setupListResponse([{
            id: 'snap-1',
            snapshotDate: '2026-07-21',
            snapshotType: 'eod',
            label: 'EOD Report - Jul 21, 2026',
            summary: null,
            createdAt: '2026-07-21T17:00:00.000Z',
          }])), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<EODReportWidget />);

    await waitFor(() => {
      // Should show the empty state because snapshot.summary is null
      expect(screen.getByText('No EOD reports yet')).toBeInTheDocument();
    });

    // Metric grid sections should NOT be rendered
    expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.queryByText('Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();

    // AI Summary should NOT be rendered
    expect(screen.queryByText('AI Summary')).not.toBeInTheDocument();

    // Footer with timestamp and New Snapshot should NOT be rendered
    expect(screen.queryByRole('button', { name: /new snapshot/i })).not.toBeInTheDocument();

    // Take Snapshot button SHOULD be present (empty state CTA)
    expect(screen.getByRole('button', { name: /take snapshot/i })).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Loaded with Summary
  // ══════════════════════════════════════════════════════════

  it('renders metric grid with snapshot summary values', async () => {
    setupDefaultMockFetch();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    // All metric labels should be present
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();

    // Metric values — use unique values to avoid duplicate text matches
    // Mock: totalTasks=8, completedCount=2, overdueCount=1, activeProjects=3, totalUsers=5, completionRate=25
    // (activeProjects is 3 to avoid collision with completedCount=2)
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getAllByText('25%').length).toBeGreaterThanOrEqual(1);
  });

  it('shows link to snapshot detail page', async () => {
    setupDefaultMockFetch();
    render(<EODReportWidget />);

    await waitFor(() => {
      // Wait for snapshot data to render — tasks value "8" from mock
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    // Link to snapshot detail should be present in the card header.
    // The snapshot label link text is "— Jul 21" (createdAt date formatted).
    // Use getAllByText since the footer also contains "Jul 21" in a full timestamp.
    const allJul21 = screen.getAllByText(/Jul 21/i);
    const link = allJul21.find((el) => el.closest('a'));
    expect(link).toBeInTheDocument();
    expect(link!.closest('a')).toHaveAttribute('href', '/reports/snapshots/snap-1');
  });

  it('shows full reports link', async () => {
    setupDefaultMockFetch();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    const reportsLink = screen.getByText('Full Reports');
    expect(reportsLink).toBeInTheDocument();
    expect(reportsLink.closest('a')).toHaveAttribute('href', '/reports');
  });

  it('shows timestamp in the footer', async () => {
    setupDefaultMockFetch();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    // The footer should have a "New Snapshot" button
    expect(screen.getByRole('button', { name: /new snapshot/i })).toBeInTheDocument();

    // The footer renders a full timestamp like "Jul 21, 5:00 PM" (month, day, hour, minute).
    // Use a more specific regex to distinguish it from the header link ("— Jul 21").
    expect(screen.getByText(/Jul 21.*\d+:\d{2}/i)).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  AI Summary States
  // ══════════════════════════════════════════════════════════

  it('shows AI summary card when snapshot has server-side AI summary', async () => {
    setupDefaultMockFetch({ hasAiSummary: true });
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('AI Summary')).toBeInTheDocument();
    });

    // The AI summary text from the server should be shown
    expect(screen.getByText(/team completed 2 of 8 tasks/i)).toBeInTheDocument();
  });

  it('generates client-side AI summary when no server-side AI summary exists', async () => {
    setupDefaultMockFetch({ hasAiSummary: false });
    render(<EODReportWidget />);

    // Wait for snapshot to load, then the component should call generateEODSummary
    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    expect(mockGenerateEODSummary).toHaveBeenCalledTimes(1);
    expect(mockGenerateEODSummary).toHaveBeenCalledWith(
      expect.stringContaining('Total tasks: 8'),
    );
  });

  it('shows AI summary loading indicator', async () => {
    mockAiSummaryState = { summary: null, loading: true, error: null };
    setupDefaultMockFetch({ hasAiSummary: false });
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('Generating AI summary...')).toBeInTheDocument();
    });
  });

  it('shows client-generated AI summary text', async () => {
    mockAiSummaryState = {
      summary: 'Client-generated summary for this EOD report.',
      loading: false,
      error: null,
    };
    setupDefaultMockFetch({ hasAiSummary: false });
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('Client-generated summary for this EOD report.')).toBeInTheDocument();
    });
  });

  it('prefers server-side AI summary over client-generated', async () => {
    // Both server and client have summaries — server should win
    mockAiSummaryState = {
      summary: 'Client-generated summary.',
      loading: false,
      error: null,
    };
    setupDefaultMockFetch({ hasAiSummary: true });
    render(<EODReportWidget />);

    await waitFor(() => {
      // The server-side summary should be shown (not the client one)
      expect(screen.getByText(/team completed 2 of 8 tasks/i)).toBeInTheDocument();
    });

    // Client summary should NOT be shown
    expect(screen.queryByText('Client-generated summary.')).not.toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Take New Snapshot
  // ══════════════════════════════════════════════════════════

  it('creates a new snapshot on button click', async () => {
    setupDefaultMockFetch({ hasAiSummary: true });
    const user = userEvent.setup();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    const newSnapshotBtn = screen.getByRole('button', { name: /new snapshot/i });
    await user.click(newSnapshotBtn);

    // Should call POST /api/reports/snapshots
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/reports/snapshots',
      expect.objectContaining({ method: 'POST' }),
    );

    // After creation, should show the new snapshot data
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('creates a new snapshot from empty state', async () => {
    // Start with no snapshots, then return a snapshot after POST
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/reports/snapshots?limit=1')) {
        return Promise.resolve(
          new Response(JSON.stringify(setupListResponse([])), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots') && init?.method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify(MOCK_NEW_SNAPSHOT_RESPONSE), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const user = userEvent.setup();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('No EOD reports yet')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /take snapshot/i }));

    // Should now show the new snapshot data
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('shows saving state while creating snapshot', async () => {
    // Keep POST hanging
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/reports/snapshots?limit=1')) {
        return Promise.resolve(
          new Response(JSON.stringify(setupListResponse([MOCK_SNAPSHOT_WITH_AI])), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots') && init?.method === 'POST') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const user = userEvent.setup();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /new snapshot/i }));

    // Should show saving state
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Snapshot Creation Error
  // ══════════════════════════════════════════════════════════

  it('handles snapshot creation error gracefully when data already loaded', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/reports/snapshots?limit=1')) {
        return Promise.resolve(
          new Response(JSON.stringify(setupListResponse([MOCK_SNAPSHOT_WITH_AI])), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots') && init?.method === 'POST') {
        return Promise.reject(new Error('Failed to generate snapshot'));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const user = userEvent.setup();
    render(<EODReportWidget />);

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    // Click new snapshot — it will fail
    await user.click(screen.getByRole('button', { name: /new snapshot/i }));

    // Wait for the operation to complete (generating goes back to false)
    // The button should be re-enabled after the failed attempt
    // The previous data should still be shown (snapshot is still set)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new snapshot/i })).not.toBeDisabled();
    });

    // The original data should still be visible
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
