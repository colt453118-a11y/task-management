import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SnapshotDetailPage from '@/app/(dashboard)/reports/snapshots/[id]/page';

// ─── Mock next/navigation ──────────────────────────────────

const mockPush = vi.fn();
const mockParams = { id: 'snap-1' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => mockParams,
}));

// ─── Mock framer-motion ────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

// ─── Mock UI components ────────────────────────────────────

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={className} data-variant={variant}>{children}</span>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// ─── Mock fetch ─────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

// ─── Mock data — Snapshot Detail ────────────────────────────

const MOCK_SUMMARY_WITH_AI = {
  totalTasks: 8,
  completedCount: 2,
  overdueCount: 1,
  activeProjects: 2,
  totalUsers: 3,
  completionRate: 25,
  aiSummary: 'Team completed 2 of 8 tasks today with a 25% completion rate. 1 task is overdue. 2 active projects ongoing.',
};

const MOCK_SUMMARY_WITHOUT_AI = {
  totalTasks: 8,
  completedCount: 2,
  overdueCount: 1,
  activeProjects: 2,
  totalUsers: 3,
  completionRate: 25,
};

const MOCK_SNAPSHOT_DATA = {
  timestamp: '2026-07-21T17:00:00.000Z',
  generatedBy: 'user-1',
  organizationId: 'org-1',
  date: '2026-07-21',
  tasks: {
    total: 8,
    byStatus: { open: 2, in_progress: 2, completed: 2, closed: 1, blocked: 1 },
    byPriority: { critical: 2, high: 2, medium: 1, low: 1, none: 2 },
    overdue: 1,
    createdThisPeriod: 3,
    completedThisPeriod: 2,
    completionRate: 25,
  },
  projects: {
    total: 3,
    active: 2,
    byStatus: { active: 2, archived: 1 },
  },
  users: { total: 5, active: 3 },
  teams: { total: 2 },
};

const MOCK_SNAPSHOT = {
  id: 'snap-1',
  snapshotDate: '2026-07-21',
  snapshotType: 'eod',
  label: 'EOD Report - Jul 21, 2026',
  summary: MOCK_SUMMARY_WITH_AI,
  snapshotData: MOCK_SNAPSHOT_DATA,
  generatedBy: 'user-1',
  createdAt: '2026-07-21T17:00:00.000Z',
};

const MOCK_PREVIOUS_SNAPSHOT = {
  id: 'snap-0',
  snapshotDate: '2026-07-20',
  snapshotType: 'eod',
  label: 'EOD Report - Jul 20, 2026',
  summary: {
    totalTasks: 6,
    completedCount: 1,
    overdueCount: 2,
    activeProjects: 2,
    totalUsers: 3,
    completionRate: 17,
  },
  snapshotData: null,
  generatedBy: 'user-1',
  createdAt: '2026-07-20T17:00:00.000Z',
};

const SNAPSHOT_DETAIL_RESPONSE = { snapshot: MOCK_SNAPSHOT };

const SNAPSHOT_LIST_RESPONSE = {
  snapshots: [MOCK_SNAPSHOT, MOCK_PREVIOUS_SNAPSHOT],
  total: 2,
  limit: 50,
  offset: 0,
};

const AI_SUMMARY_RESPONSE = {
  message: 'AI summary generated',
  summary: { ...MOCK_SUMMARY_WITH_AI, aiSummary: 'Regenerated: Fresh AI summary.' },
};

// ─── Helper: Set up default mock fetch ──────────────────────

function setupDefaultMockFetch() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/reports/snapshots/') && url.includes('/export')) {
      return Promise.resolve(
        new Response('Snapshot Export\nField,Value\nTest,Data\n', {
          status: 200,
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        }),
      );
    }
    if (url.includes('/api/reports/snapshots/') && url.includes('/ai-summary')) {
      return Promise.resolve(
        new Response(JSON.stringify(AI_SUMMARY_RESPONSE), { status: 200 }),
      );
    }
    if (url.includes('/api/reports/snapshots/') && url.endsWith(mockParams.id)) {
      return Promise.resolve(
        new Response(JSON.stringify(SNAPSHOT_DETAIL_RESPONSE), { status: 200 }),
      );
    }
    if (url.includes('/api/reports/snapshots?limit=50')) {
      return Promise.resolve(
        new Response(JSON.stringify(SNAPSHOT_LIST_RESPONSE), { status: 200 }),
      );
    }
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
}

// ─── Tests ──────────────────────────────────────────────────

describe('SnapshotDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.id = 'snap-1';
  });

  // ══════════════════════════════════════════════════════════
  //  Loading State
  // ══════════════════════════════════════════════════════════

  it('shows shimmer loading state while data is being fetched', async () => {
    // Keep loading by delaying the fetch resolution
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<SnapshotDetailPage />);

    // Shimmer elements should be visible during loading
    const shimmerElements = document.querySelectorAll('.shimmer');
    expect(shimmerElements.length).toBeGreaterThanOrEqual(1);
  });

  // ══════════════════════════════════════════════════════════
  //  Error States
  // ══════════════════════════════════════════════════════════

  it('shows Snapshot not found error when API returns 404', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots/') && url.includes('nonexistent')) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      // List fetch also returns 404 or ok
      return Promise.resolve(new Response(JSON.stringify({ snapshots: [] }), { status: 200 }));
    });
    mockParams.id = 'nonexistent-id';

    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Snapshot not found')).toBeInTheDocument();
    });

    expect(screen.getByText(/may have been deleted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to reports/i })).toBeInTheDocument();
  });

  it('shows error message when fetch fails generically', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));

    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /back to reports/i })).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Successful Load — Header & KPI Cards
  // ══════════════════════════════════════════════════════════

  it('renders snapshot header with label and type badge', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // Type badge should show EOD
    expect(screen.getByText('EOD')).toBeInTheDocument();

    // Back button should be present
    expect(screen.getByLabelText('Back to reports')).toBeInTheDocument();
  });

  it('renders KPI stat cards with snapshot summary metrics', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // KPI labels — use getAllByText since these also appear in the comparison section
    // KPI labels that may also appear in the comparison section
    expect(screen.getAllByText('Total Tasks').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Active Projects').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Team Members').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Completion Rate').length).toBeGreaterThanOrEqual(1);

    // Values from mock data — also appear in comparison section
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('25%').length).toBeGreaterThanOrEqual(1);
  });

  // ══════════════════════════════════════════════════════════
  //  AI Summary
  // ══════════════════════════════════════════════════════════

  it('shows AI summary card with generated text when present', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // AI Summary section heading — CardTitle renders as <h3>
    const aiHeading = screen.getAllByRole('heading').find((h) => h.textContent === 'AI Summary');
    expect(aiHeading).toBeInTheDocument();

    // AI summary text from mock data
    expect(screen.getByText(/team completed 2 of 8 tasks/i)).toBeInTheDocument();
  });

  it('shows generate prompt when no AI summary exists', async () => {
    // Create a snapshot without AI summary
    const snapshotWithoutAi = {
      ...MOCK_SNAPSHOT,
      summary: MOCK_SUMMARY_WITHOUT_AI,
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots/') && url.endsWith('snap-1')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshot: snapshotWithoutAi }), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots?limit=50')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshots: [snapshotWithoutAi], total: 1 }), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/no ai summary yet/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  it('regenerates AI summary on button click', async () => {
    setupDefaultMockFetch();
    const user = userEvent.setup();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // Regenerate button should be present
    const regenerateBtn = screen.getByRole('button', { name: /regenerate/i });
    expect(regenerateBtn).toBeInTheDocument();

    await user.click(regenerateBtn);

    // Should show the regenerated summary text
    await waitFor(() => {
      expect(screen.getByText(/regenerated:/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during AI summary generation', async () => {
    // Make AI summary fetch hang
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots/') && url.includes('/ai-summary')) {
        return new Promise(() => {}); // Never resolves
      }
      if (url.includes('/api/reports/snapshots/') && url.endsWith('snap-1')) {
        return Promise.resolve(
          new Response(JSON.stringify(SNAPSHOT_DETAIL_RESPONSE), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots?limit=50')) {
        return Promise.resolve(
          new Response(JSON.stringify(SNAPSHOT_LIST_RESPONSE), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const user = userEvent.setup();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /regenerate/i }));

    // Should show loading state
    expect(screen.getByText('Regenerating...')).toBeInTheDocument();
  });

  it('toggles long AI summary show more/less', async () => {
    const longSummary = 'A. '.repeat(110); // > 200 chars
    const snapshotWithLongSummary = {
      ...MOCK_SNAPSHOT,
      summary: {
        ...MOCK_SUMMARY_WITH_AI,
        aiSummary: longSummary,
      },
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots/') && url.endsWith('snap-1')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshot: snapshotWithLongSummary }), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots?limit=50')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshots: [snapshotWithLongSummary], total: 1 }), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const user = userEvent.setup();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // "Show more" button should be visible for long summaries
    const showMoreBtn = screen.getByText('Show more');
    expect(showMoreBtn).toBeInTheDocument();

    // Click to expand
    await user.click(showMoreBtn);
    expect(screen.getByText('Show less')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText('Show less'));
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Task Breakdown Sections
  // ══════════════════════════════════════════════════════════

  it('shows task status and priority distribution headings', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // Section headings — CardTitle renders as <h3>
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toContain('Task Status Distribution');
    expect(headings).toContain('Task Priority Distribution');
  });

  it('renders task status bar rows with data', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // Status labels should appear — 'Completed' also exists in KPI cards, use getAllByText
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('renders task priority bar rows with data', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // Priority labels
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('shows empty state when no task status data', async () => {
    const snapshotNoTaskData = {
      ...MOCK_SNAPSHOT,
      snapshotData: {
        ...MOCK_SNAPSHOT_DATA,
        tasks: {
          ...MOCK_SNAPSHOT_DATA.tasks,
          byStatus: {},
          byPriority: {},
        },
      },
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots/') && url.endsWith('snap-1')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshot: snapshotNoTaskData }), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots?limit=50')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshots: [snapshotNoTaskData], total: 1 }), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('No task data')).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════
  //  Task Activity & Project Stats Sections
  // ══════════════════════════════════════════════════════════

  it('shows task activity section with created/completed/overdue metrics', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    const activityHeadings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(activityHeadings).toContain('Task Activity');
    expect(screen.getByText('Created Today')).toBeInTheDocument();
    expect(screen.getByText('Completed Today')).toBeInTheDocument();
    expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Completion Rate').length).toBeGreaterThanOrEqual(1);
  });

  it('shows project status section with totals', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    const projectHeadings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(projectHeadings).toContain('Project Status');
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
  });

  it('shows people & teams section with user and team counts', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    const peopleHeadings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(peopleHeadings).toContain('People & Teams');
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Daily Comparison Section
  // ══════════════════════════════════════════════════════════

  it('shows comparison section when previous snapshot exists', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      const compareHeadings = screen.getAllByRole('heading').filter((h) =>
        h.textContent?.toLowerCase().includes('vs previous snapshot'),
      );
      expect(compareHeadings.length).toBe(1);
    });

    // Delta indicators — each comparison metric has "Previous: X" so multiple exist
    expect(screen.getAllByText(/previous:/i).length).toBeGreaterThanOrEqual(1);
  });

  it('does not show comparison section without previous snapshot', async () => {
    const singleSnapshotList = { snapshots: [MOCK_SNAPSHOT], total: 1 };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots/') && url.endsWith('snap-1')) {
        return Promise.resolve(
          new Response(JSON.stringify(SNAPSHOT_DETAIL_RESPONSE), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots?limit=50')) {
        return Promise.resolve(
          new Response(JSON.stringify(singleSnapshotList), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    const compareHeadings = screen.getAllByRole('heading')
      .filter((h) => h.textContent?.startsWith('vs Previous Snapshot'));
    expect(compareHeadings.length).toBe(0);
  });

  // ══════════════════════════════════════════════════════════
  //  Interactions
  // ══════════════════════════════════════════════════════════

  it('navigates back to reports on back button click', async () => {
    setupDefaultMockFetch();
    const user = userEvent.setup();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Back to reports')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Back to reports'));
    expect(mockPush).toHaveBeenCalledWith('/reports');
  });

  it('navigates back to reports on error state back button', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));
    const user = userEvent.setup();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /back to reports/i }));
    expect(mockPush).toHaveBeenCalledWith('/reports');
  });

  it('downloads CSV export on export button click', async () => {
    setupDefaultMockFetch();
    const user = userEvent.setup();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    expect(exportBtn).toBeInTheDocument();

    await user.click(exportBtn);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/export'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  // ══════════════════════════════════════════════════════════
  //  Metadata Footer
  // ══════════════════════════════════════════════════════════

  it('renders metadata footer with snapshot info', async () => {
    setupDefaultMockFetch();
    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /EOD Report/i })).toBeInTheDocument();
    });

    // Snapshot ID prefix should appear in the footer
    expect(screen.getByText(/snap-1/i)).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Missing Data Handling
  // ══════════════════════════════════════════════════════════

  it('renders successfully without label (falls back to Snapshot — date)', async () => {
    const snapshotNoLabel = {
      ...MOCK_SNAPSHOT,
      label: null,
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/reports/snapshots/') && url.endsWith('snap-1')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshot: snapshotNoLabel }), { status: 200 }),
        );
      }
      if (url.includes('/api/reports/snapshots?limit=50')) {
        return Promise.resolve(
          new Response(JSON.stringify({ snapshots: [snapshotNoLabel] }), { status: 200 }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<SnapshotDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Snapshot — 2026-07-21/i)).toBeInTheDocument();
    });
  });
});
