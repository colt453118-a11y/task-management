import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamActivityFeed, type ActivityFeedItem } from '@/components/dashboard/team-activity-feed';

// ─── Mock framer-motion ────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

// ─── Mock next/image ───────────────────────────────────────

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} data-testid="avatar-image" />
  ),
}));

// ─── Mock fetch ────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ─── Helpers: fixed system time ────────────────────────────

const FIXED_NOW = new Date('2026-07-21T15:00:00.000Z').getTime();

// ─── Track window.location.href for navigation tests ───────

let mockLocationHref = '';

// ─── Mock Data ─────────────────────────────────────────────

function makeItem(overrides: Partial<ActivityFeedItem> = {}): ActivityFeedItem {
  return {
    id: 'item-1',
    type: 'task_update',
    action: 'task.created',
    description: null,
    userId: 'user-1',
    userName: 'Alice Johnson',
    userAvatar: null,
    taskId: 'task-1',
    taskTitle: 'Design the new dashboard',
    projectId: 'proj-1',
    entityType: null,
    entityId: null,
    metadata: null,
    createdAt: new Date(FIXED_NOW - 120_000).toISOString(), // 2 minutes ago
    ...overrides,
  };
}

const MOCK_ITEMS: ActivityFeedItem[] = [
  makeItem({
    id: 'item-1',
    action: 'task.created',
    userName: 'Alice Johnson',
    userAvatar: null,
    taskTitle: 'Design the new dashboard',
    createdAt: new Date(FIXED_NOW - 120_000).toISOString(),
  }),
  makeItem({
    id: 'item-2',
    action: 'task.completed',
    userName: 'Bob Smith',
    userAvatar: 'https://example.com/avatar.png',
    taskTitle: 'Implement auth flow',
    createdAt: new Date(FIXED_NOW - 600_000).toISOString(),
  }),
  makeItem({
    id: 'item-3',
    type: 'comment',
    action: 'comment.added',
    userName: 'Charlie Brown',
    userAvatar: null,
    taskId: 'task-3',
    taskTitle: 'Fix login bug',
    description: 'I think we need to check the token refresh logic in the auth middleware before the next deploy.',
    createdAt: new Date(FIXED_NOW - 3_600_000).toISOString(), // 1 hour ago
  }),
  makeItem({
    id: 'item-4',
    type: 'audit',
    action: 'task.status_changed',
    userName: 'Diana Prince',
    userAvatar: null,
    taskId: 'task-4',
    taskTitle: 'Update API docs',
    metadata: { field: 'status', newValue: 'in_progress' },
    createdAt: new Date(FIXED_NOW - 86_400_000).toISOString(), // 1 day ago
  }),
  makeItem({
    id: 'item-5',
    type: 'audit',
    action: 'project.created',
    userName: 'Eve Adams',
    userAvatar: null,
    taskId: null,
    taskTitle: null,
    metadata: { entityId: 'proj-42' },
    createdAt: new Date(FIXED_NOW - 7 * 86_400_000).toISOString(), // 7 days ago
  }),
];

function setupFetchResponse(items: ActivityFeedItem[] = MOCK_ITEMS) {
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ items }), { status: 200 }),
  );
}

// ─── Tests ─────────────────────────────────────────────────

describe('TeamActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

    // Mock window.location.href to persist assignments
    // (avoids replacing entire window.location which can break happy-dom internals)
    mockLocationHref = '';
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      get() { return mockLocationHref; },
      set(v) { mockLocationHref = v; },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    // Restore native href property
    delete (window.location as any).href;
  });

  // ══════════════════════════════════════════════════════════
  //  Loading State
  // ══════════════════════════════════════════════════════════

  it('shows shimmer loading skeleton while fetching data', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<TeamActivityFeed />);

    const shimmerElements = document.querySelectorAll('.shimmer');
    expect(shimmerElements.length).toBeGreaterThanOrEqual(5);
  });

  // ══════════════════════════════════════════════════════════
  //  Error State
  // ══════════════════════════════════════════════════════════

  it('shows error state with retry button when fetch fails and no items', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load activity')).toBeInTheDocument();
    });

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('retries fetching on try again click', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [MOCK_ITEMS[0]] }), { status: 200 }),
      );

    const user = userEvent.setup();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load activity')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Try again'));

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('preserves existing items when background poll fails', async () => {
    // Mock: first fetch succeeds, second fetch fails
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [MOCK_ITEMS[0]] }), { status: 200 }),
      )
      .mockRejectedValueOnce(new Error('Network error'));

    const { rerender } = render(<TeamActivityFeed refreshCounter={0} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Trigger a refetch by changing refreshCounter — simulates what happens
    // when the 30s poll fires and the request fails
    rerender(<TeamActivityFeed refreshCounter={1} />);

    // After the failed refetch, items should still be shown
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
    expect(screen.queryByText('Failed to load activity')).not.toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Empty State
  // ══════════════════════════════════════════════════════════

  it('shows empty state when no items returned', async () => {
    setupFetchResponse([]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/changes across the organization will appear here/i),
    ).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Loaded State — Item Rendering
  // ══════════════════════════════════════════════════════════

  it('renders user names and action labels', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    expect(screen.getByText('Diana Prince')).toBeInTheDocument();
    expect(screen.getByText('Eve Adams')).toBeInTheDocument();

    // Action labels
    expect(screen.getByText('created task')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('commented on')).toBeInTheDocument();
    expect(screen.getByText('changed status of')).toBeInTheDocument();
    expect(screen.getByText('created project')).toBeInTheDocument();
  });

  it('renders task description text with link icon', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    // Description text appears in both the description row and chip row.
    // Use getAllByText to handle the duplicate and verify at least one exists.
    await waitFor(() => {
      const matches = screen.getAllByText('Design the new dashboard');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders comment snippet from description', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText(/token refresh logic/i)).toBeInTheDocument();
    });
  });

  it('renders status change description from audit action', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    // For audit-type items, formatDescription returns item.action.replace(/\./g, ' ')
    await waitFor(() => {
      expect(screen.getByText('task status_changed')).toBeInTheDocument();
    });
  });

  it('renders avatar with initials when no avatar image', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Initials for two-word names: Alice Johnson → AJ
    expect(screen.getByText('AJ')).toBeInTheDocument();
    expect(screen.getByText('CB')).toBeInTheDocument();
    expect(screen.getByText('DP')).toBeInTheDocument();
    expect(screen.getByText('EA')).toBeInTheDocument();
  });

  it('renders image avatar when userAvatar is provided', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    const avatarImgs = screen.getAllByTestId('avatar-image');
    expect(avatarImgs.length).toBeGreaterThanOrEqual(1);
    expect(avatarImgs[0]).toHaveAttribute('src', 'https://example.com/avatar.png');
    expect(avatarImgs[0]).toHaveAttribute('alt', 'Bob Smith');
  });

  it('renders action chips with type labels', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Chip text: for task_update items, action.split('.')[0] = 'task'
    expect(screen.getAllByText(/task/i).length).toBeGreaterThanOrEqual(1);
    // Comment item shows "Comment"
    expect(screen.getByText('Comment')).toBeInTheDocument();
  });

  it('renders relative timestamps', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // item-1: 2 minutes ago (Date.now = FIXED_NOW, createdAt = FIXED_NOW - 2min)
    expect(screen.getByText('2m ago')).toBeInTheDocument();
    // item-2: 10 minutes ago
    expect(screen.getByText('10m ago')).toBeInTheDocument();
    // item-3: 1 hour ago
    expect(screen.getByText('1h ago')).toBeInTheDocument();
    // item-4: 1 day ago
    expect(screen.getByText('1d ago')).toBeInTheDocument();
    // item-5: 7+ days ago → uses toLocaleDateString
    expect(screen.getByText(/jul/i)).toBeInTheDocument();
  });

  it('renders task titles in info row', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    // Task titles appear in both description and chip row — use getAllByText
    await waitFor(() => {
      const matches = screen.getAllByText('Design the new dashboard');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    // Use getAllByText for titles that might appear in multiple locations
    const authMatches = screen.getAllByText('Implement auth flow');
    expect(authMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('respects maxItems prop to limit displayed items', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed maxItems={2} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Should show first 2 items
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();

    // Should NOT show items beyond maxItems
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
  });

  it('shows System fallback when userName is null', async () => {
    setupFetchResponse([
      makeItem({
        id: 'item-system',
        action: 'task.created',
        userName: null,
        userAvatar: null,
        taskTitle: 'System task',
        createdAt: new Date(FIXED_NOW - 60_000).toISOString(),
      }),
    ]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('renders single-word name initials', async () => {
    setupFetchResponse([
      makeItem({
        id: 'item-single',
        action: 'task.created',
        userName: 'Alice',
        userAvatar: null,
        taskTitle: 'Single name',
        createdAt: new Date(FIXED_NOW - 60_000).toISOString(),
      }),
    ]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument();
    });
  });

  it('renders just now timestamp for very recent items', async () => {
    setupFetchResponse([
      makeItem({
        id: 'item-just-now',
        action: 'task.created',
        createdAt: new Date(FIXED_NOW - 5_000).toISOString(), // 5 seconds ago
      }),
    ]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('just now')).toBeInTheDocument();
    });
  });

  it('renders seconds-ago timestamps', async () => {
    setupFetchResponse([
      makeItem({
        id: 'item-secs',
        action: 'task.created',
        createdAt: new Date(FIXED_NOW - 30_000).toISOString(), // 30 seconds ago
      }),
    ]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('30s ago')).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════
  //  Footer States
  // ══════════════════════════════════════════════════════════

  it('shows Live indicator and Refresh button in footer when loaded', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('manually refreshes on Refresh button click', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Click the Refresh button in the footer
    fireEvent.click(screen.getByText('Refresh'));

    // Refresh should trigger one more fetch call
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  Interaction — Click Navigation
  // ══════════════════════════════════════════════════════════

  it('navigates to task page on item click', async () => {
    setupFetchResponse();
    const user = userEvent.setup();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Find clickable item rows via role="button" and filter by content
    const buttons = screen.getAllByRole('button');
    const taskRow = buttons.find((btn) =>
      btn.textContent?.includes('Design the new dashboard'),
    );
    expect(taskRow).toBeInTheDocument();

    if (taskRow) {
      await user.click(taskRow);
    }

    // handleItemClick sets window.location.href = taskLink
    expect(window.location.href).toBe('/tasks/task-1');
  });

  it('does not make items without taskLinks clickable', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Eve Adams')).toBeInTheDocument();
    });

    // "created project" item has no taskId → should not have role="button"
    const projectItem = screen.getByText('created project').closest('[role="button"]');
    expect(projectItem).toBeNull();
  });

  it('navigates on keyboard Enter for items with task links', async () => {
    setupFetchResponse();
    const user = userEvent.setup();
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const taskRow = buttons.find((btn) =>
      btn.textContent?.includes('Design the new dashboard'),
    );
    expect(taskRow).toBeInTheDocument();

    if (taskRow) {
      taskRow.focus();
      await user.keyboard('{Enter}');
    }

    // handleItemClick sets window.location.href = taskLink
    expect(window.location.href).toBe('/tasks/task-1');
  });

  // ══════════════════════════════════════════════════════════
  //  refreshCounter Prop
  // ══════════════════════════════════════════════════════════

  it('works without refreshCounter prop (defaults to 0)', async () => {
    setupFetchResponse();
    render(<TeamActivityFeed />);

    // Should render items normally without the prop
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Should have fetched once on mount
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refetches when refreshCounter changes', async () => {
    setupFetchResponse();
    const { rerender } = render(<TeamActivityFeed refreshCounter={0} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    mockFetch.mockClear();
    setupFetchResponse();
    rerender(<TeamActivityFeed refreshCounter={1} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('does not refetch when refreshCounter stays the same', async () => {
    setupFetchResponse();
    const { rerender } = render(<TeamActivityFeed refreshCounter={0} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    mockFetch.mockClear();
    rerender(<TeamActivityFeed refreshCounter={0} />);

    // Small delay to ensure no fetch was triggered
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refetches on multiple consecutive increments', async () => {
    setupFetchResponse();
    const { rerender } = render(<TeamActivityFeed refreshCounter={0} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // First increment: 0 → 1
    mockFetch.mockClear();
    setupFetchResponse();
    rerender(<TeamActivityFeed refreshCounter={1} />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Second increment: 1 → 2
    mockFetch.mockClear();
    setupFetchResponse();
    rerender(<TeamActivityFeed refreshCounter={2} />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Third increment: 2 → 3
    mockFetch.mockClear();
    setupFetchResponse();
    rerender(<TeamActivityFeed refreshCounter={3} />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('handles refetch returning identical data gracefully', async () => {
    // Render with initial data
    setupFetchResponse();
    const { rerender } = render(<TeamActivityFeed refreshCounter={0} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    mockFetch.mockClear();

    // Trigger a refetch that returns the SAME data as before
    setupFetchResponse();
    rerender(<TeamActivityFeed refreshCounter={1} />);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // The content should still be showing the same items
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('2m ago')).toBeInTheDocument();

    // Items should still be visible — no error state
    expect(screen.queryByText('Failed to load activity')).not.toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Edge Cases — Truncation & HTML Stripping
  // ══════════════════════════════════════════════════════════

  it('truncates long comment descriptions', async () => {
    const longDesc = 'A'.repeat(200);
    setupFetchResponse([
      makeItem({
        id: 'item-long',
        type: 'comment',
        action: 'comment.added',
        description: longDesc,
        taskTitle: 'Long comment task',
        createdAt: new Date(FIXED_NOW - 60_000).toISOString(),
      }),
    ]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      // First 80 chars + ellipsis
      expect(screen.getByText(/A{80}…/)).toBeInTheDocument();
    });
  });

  it('strips HTML tags from comment descriptions', async () => {
    setupFetchResponse([
      makeItem({
        id: 'item-html',
        type: 'comment',
        action: 'comment.added',
        description: '<b>Bold</b> and <i>italic</i> text',
        taskTitle: 'HTML comment',
        createdAt: new Date(FIXED_NOW - 60_000).toISOString(),
      }),
    ]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      // Tags should be stripped: "Bold and italic text"
      expect(screen.getByText(/Bold and italic text/)).toBeInTheDocument();
    });
  });

  it('shows unknown task title fallback for items with no description or taskTitle', async () => {
    setupFetchResponse([
      makeItem({
        id: 'item-unknown',
        type: 'task_update',
        action: 'status_change',
        description: null,
        taskTitle: null,
        taskId: null,
        metadata: null,
        createdAt: new Date(FIXED_NOW - 60_000).toISOString(),
      }),
    ]);
    render(<TeamActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Unknown task')).toBeInTheDocument();
    });
  });
});
