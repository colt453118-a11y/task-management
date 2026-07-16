// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskActivityFeed } from '@/components/tasks/task-activity-feed';

// ─── Helpers ────────────────────────────────────────────────────

/** Returns a mock fetch Response with JSON body and Content-Type header. */
function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Sample history entries for testing. */
function sampleEntries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry-${i + 1}`,
    taskId: 'task-1',
    userId: 'user-1',
    field: 'status',
    oldValue: i % 2 === 0 ? 'open' : 'in_progress',
    newValue: i % 2 === 0 ? 'in_progress' : 'completed',
    changeType: 'status_change',
    description: `Changed status from ${i % 2 === 0 ? 'open' : 'in_progress'} to ${i % 2 === 0 ? 'in_progress' : 'completed'}`,
    createdAt: new Date(Date.now() - i * 60 * 1000).toISOString(),
    user: { id: 'user-1', name: 'Alice Johnson', avatarUrl: null },
  }));
}

/** A single creation entry (green dot). */
const creationEntry = {
  id: 'entry-create',
  taskId: 'task-1',
  userId: 'user-1',
  field: 'title',
  oldValue: null,
  newValue: 'My task',
  changeType: 'creation',
  description: 'Created this task',
  createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  user: { id: 'user-1', name: 'Bob Smith', avatarUrl: null },
};

/** An assignment entry (blue dot). */
const assignmentEntry = {
  id: 'entry-assign',
  taskId: 'task-1',
  userId: 'user-2',
  field: 'assignedTo',
  oldValue: null,
  newValue: 'user-1',
  changeType: 'assignment',
  description: 'Assigned to Alice Johnson',
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  user: { id: 'user-2', name: 'Carol Williams', avatarUrl: null },
};

/** A generic "other" entry (gray dot). */
const otherEntry = {
  id: 'entry-other',
  taskId: 'task-1',
  userId: 'user-1',
  field: 'title',
  oldValue: 'Old title',
  newValue: 'New title',
  changeType: 'update',
  description: 'Changed title from "Old title" to "New title"',
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  user: { id: 'user-1', name: 'Bob Smith', avatarUrl: null },
};

/** An entry with no user (System). */
const systemEntry = {
  id: 'entry-system',
  taskId: 'task-1',
  userId: 'system',
  field: 'priority',
  oldValue: 'low',
  newValue: 'high',
  changeType: 'update',
  description: 'Changed priority from low to high',
  createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  user: null,
};

/** An entry without a description (uses fieldLabels fallback). */
const noDescriptionEntry = {
  id: 'entry-nodesc',
  taskId: 'task-1',
  userId: 'user-1',
  field: 'status',
  oldValue: 'draft',
  newValue: 'open',
  changeType: 'status_change',
  description: null,
  createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  user: { id: 'user-1', name: 'Alice Johnson', avatarUrl: null },
};

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskActivityFeed (React Testing Library)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────

  it('shows shimmer loading state while fetching history', () => {
    // Leave fetch unresolved so loading persists
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { container } = render(<TaskActivityFeed taskId="task-loading" />);

    // Loading state renders 3 shimmer rows
    const shimmers = container.querySelectorAll('.shimmer');
    expect(shimmers.length).toBeGreaterThanOrEqual(4); // 1 title + 3 rows (row: avatar circle + text skeleton)
  });

  // ── Empty state ────────────────────────────────────────────

  it('shows empty state when no history entries exist', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [] }),
    );

    render(<TaskActivityFeed taskId="task-empty" />);

    // Wait for fetch to resolve
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByText('Changes to this task will appear here')).toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────

  it('shows error state when fetch fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<TaskActivityFeed taskId="task-error" />);

    expect(await screen.findByText('Failed to load activity history')).toBeInTheDocument();
  });

  // ── History items rendering ───────────────────────────────

  it('renders history entries with user name, description, and timestamp', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [creationEntry] }),
    );

    render(<TaskActivityFeed taskId="task-history" />);

    // Wait for entry to render
    expect(await screen.findByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Created this task')).toBeInTheDocument();
  });

  it('shows "System" when entry has no user', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [systemEntry] }),
    );

    render(<TaskActivityFeed taskId="task-system" />);

    expect(await screen.findByText('System')).toBeInTheDocument();
    expect(screen.getByText('Changed priority from low to high')).toBeInTheDocument();
  });

  it('renders field label fallback when description is null', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [noDescriptionEntry] }),
    );

    render(<TaskActivityFeed taskId="task-nodesc" />);

    // Should show "Updated Status" rather than a description
    expect(await screen.findByText('Status')).toBeInTheDocument();
    expect(screen.getByText(/^Updated/)).toBeInTheDocument();
  });

  it('renders assignment and creation entries alongside other entries', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [otherEntry, assignmentEntry, creationEntry] }),
    );

    render(<TaskActivityFeed taskId="task-mix" />);

    // "Bob Smith" appears in both otherEntry and creationEntry
    expect(await screen.findAllByText('Bob Smith')).toHaveLength(2);
    expect(screen.getByText('Carol Williams')).toBeInTheDocument();

    // All three unique descriptions should be visible
    expect(screen.getByText('Changed title from "Old title" to "New title"')).toBeInTheDocument();
    expect(screen.getByText('Assigned to Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Created this task')).toBeInTheDocument();
  });

  it('renders correct number of entries from the API response', async () => {
    const entries = sampleEntries(5);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: entries }),
    );

    render(<TaskActivityFeed taskId="task-count" />);

    // Wait for entries to render — the user names should appear
    // All 5 entries have user "Alice Johnson"
    const userNames = await screen.findAllByText('Alice Johnson');
    expect(userNames).toHaveLength(5);
  });

  // ── Show more / show less ──────────────────────────────────

  it('shows "Show X more entries" button when more than 10 entries exist', async () => {
    const entries = sampleEntries(15);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: entries }),
    );

    render(<TaskActivityFeed taskId="task-many" />);

    // "Show 5 more entries" (15 - 10 = 5)
    const showMore = await screen.findByText('Show 5 more entries');
    expect(showMore).toBeInTheDocument();
  });

  it('renders only 10 entries initially and all entries after clicking "Show more"', async () => {
    const entries = sampleEntries(15);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: entries }),
    );

    render(<TaskActivityFeed taskId="task-expand" />);

    // Wait for the 10 visible entries
    const initialNames = await screen.findAllByText('Alice Johnson');
    expect(initialNames).toHaveLength(10);

    // Click "Show 5 more entries"
    const showMore = screen.getByText('Show 5 more entries');
    fireEvent.click(showMore);

    // After expanding, all 15 should be visible
    await waitFor(() => {
      expect(screen.getAllByText('Alice Johnson')).toHaveLength(15);
    });

    // Button should now say "Show less"
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('hides "Show more" button when exactly 10 entries exist', async () => {
    const entries = sampleEntries(10);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: entries }),
    );

    render(<TaskActivityFeed taskId="task-exact-10" />);

    // Wait for entries to render
    await screen.findAllByText('Alice Johnson');

    // "Show more" pattern should not appear (10 is not > 10)
    expect(screen.queryByText(/Show.*more entries/)).not.toBeInTheDocument();
    expect(screen.queryByText('Show less')).not.toBeInTheDocument();
  });

  it('hides "Show more" button when fewer than 10 entries exist', async () => {
    const entries = sampleEntries(3);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: entries }),
    );

    render(<TaskActivityFeed taskId="task-few" />);

    // Wait for entries to render
    await screen.findAllByText('Alice Johnson');

    expect(screen.queryByText(/Show.*more entries/)).not.toBeInTheDocument();
  });

  it('toggles back to 10 entries after clicking "Show less"', async () => {
    const entries = sampleEntries(15);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: entries }),
    );

    render(<TaskActivityFeed taskId="task-toggle" />);

    // Expand
    fireEvent.click(await screen.findByText('Show 5 more entries'));

    await waitFor(() => {
      expect(screen.getAllByText('Alice Johnson')).toHaveLength(15);
    });

    // Collapse
    fireEvent.click(screen.getByText('Show less'));

    await waitFor(() => {
      expect(screen.getAllByText('Alice Johnson')).toHaveLength(10);
    });

    // Button should say "Show 5 more entries" again
    expect(screen.getByText('Show 5 more entries')).toBeInTheDocument();
  });

  // ── Timeline dot colors ────────────────────────────────────

  it('renders status_change entries with amber dot', async () => {
    const statusChangeEntry = {
      ...sampleEntries(1)[0]!,
      user: { id: 'user-1', name: 'Diana', avatarUrl: null },
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [statusChangeEntry] }),
    );

    const { container } = render(<TaskActivityFeed taskId="task-amber" />);

    await screen.findByText('Diana');

    // The timeline dot for status_change should have bg-amber-500
    const dots = container.querySelectorAll('.bg-amber-500');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('renders assignment entries with blue dot', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [assignmentEntry] }),
    );

    const { container } = render(<TaskActivityFeed taskId="task-blue" />);

    await screen.findByText('Carol Williams');

    const dots = container.querySelectorAll('.bg-blue-500');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('renders creation entries with green dot', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [creationEntry] }),
    );

    const { container } = render(<TaskActivityFeed taskId="task-green" />);

    await screen.findByText('Bob Smith');

    const dots = container.querySelectorAll('.bg-green-500');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('renders other entries with gray (surface-400) dot', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [otherEntry] }),
    );

    const { container } = render(<TaskActivityFeed taskId="task-gray" />);

    await screen.findByText('Bob Smith');

    const dots = container.querySelectorAll('.bg-surface-400');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  // ── User initials in timeline dots ─────────────────────────

  it('renders user initials in the timeline dot', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [creationEntry] }),
    );

    render(<TaskActivityFeed taskId="task-initials" />);

    // "Bob Smith" → "BS"
    expect(await screen.findByText('BS')).toBeInTheDocument();
  });

  it('renders "?" for system entries without a user', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [systemEntry] }),
    );

    render(<TaskActivityFeed taskId="task-qmark" />);

    expect(await screen.findByText('?')).toBeInTheDocument();
  });

  it('renders raw field name when field is not in fieldLabels', async () => {
    const unknownFieldEntry = {
      id: 'entry-unknown',
      taskId: 'task-1',
      userId: 'user-1',
      field: 'custom_field',
      oldValue: null,
      newValue: 'something',
      changeType: 'update',
      description: null,
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      user: { id: 'user-1', name: 'Alice Johnson', avatarUrl: null },
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ history: [unknownFieldEntry] }),
    );

    render(<TaskActivityFeed taskId="task-unknown-field" />);

    // Should show "Updated custom_field" (the raw field name, since it's not in fieldLabels)
    expect(await screen.findByText('custom_field')).toBeInTheDocument();
    expect(screen.getByText(/^Updated/)).toBeInTheDocument();
  });
});
