// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskWatcherButton } from '@/components/tasks/task-watcher-button';

// ─── Helpers ────────────────────────────────────────────────────

/** Returns a mock fetch Response with JSON body and Content-Type header. */
function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskWatcherButton (React Testing Library)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering (post-fetch) ─────────────────────────────────

  it('renders "Watch" button when not watching with no count', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ isWatching: false, watcherCount: 0 }),
    );

    render(<TaskWatcherButton taskId="test-1" />);

    // Wait for fetch to resolve and component to re-render
    const button = await screen.findByRole('button', { name: 'Watch' });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    // No count badge when watcherCount is 0
    expect(button).toHaveTextContent('Watch');
    expect(button).not.toHaveTextContent(/[0-9]/);
  });

  it('renders "Watch" button with count badge when not watching with watchers', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ isWatching: false, watcherCount: 5 }),
    );

    render(<TaskWatcherButton taskId="test-2" />);

    // "Watch 5" is the accessible name when a count badge is present
    const button = await screen.findByRole('button', { name: /Watch(?!ing)/ });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Watch');
    expect(button).toHaveTextContent('5');
  });

  it('renders "Watching" button with count badge when watching', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ isWatching: true, watcherCount: 3 }),
    );

    render(<TaskWatcherButton taskId="test-3" />);

    const button = await screen.findByRole('button', { name: /watching/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Watching');
    expect(button).toHaveTextContent('3');
  });

  // ── Click interaction (watch → unwatch) ────────────────────

  it('toggles from Watch to Watching on click (POST succeeds)', async () => {
    // First fetch returns not-watching
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ isWatching: false, watcherCount: 2 }),
    );

    render(<TaskWatcherButton taskId="test-4" />);

    // Wait for the "Watch" button to appear
    const watchButton = await screen.findByRole('button', { name: /Watch(?!ing)/ });
    expect(watchButton).toBeInTheDocument();

    // Mock the POST response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ isWatching: true }),
    );

    // Click to watch
    fireEvent.click(watchButton);

    // After clicking, button should show "Watching" with incremented count (2 + 1 = 3)
    const watchingButton = await screen.findByRole('button', { name: /watching/i });
    expect(watchingButton).toBeInTheDocument();
    expect(watchingButton).toHaveTextContent('Watching');
    expect(watchingButton).toHaveTextContent('3');

    // Verify POST was called
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/test-4/watchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  });

  it('toggles from Watching to Watch on click (DELETE succeeds)', async () => {
    // First fetch returns watching
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ isWatching: true, watcherCount: 4 }),
    );

    render(<TaskWatcherButton taskId="test-5" />);

    // Wait for the "Watching" button to appear
    const watchingButton = await screen.findByRole('button', { name: /watching/i });
    expect(watchingButton).toBeInTheDocument();

    // Mock the DELETE response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    // Click to unwatch
    fireEvent.click(watchingButton);

    // After clicking, button should show "Watch" with decremented count (4 - 1 = 3)
    const watchButton = await screen.findByRole('button', { name: /Watch(?!ing)/ });
    expect(watchButton).toBeInTheDocument();
    expect(watchButton).toHaveTextContent('Watch');
    expect(watchButton).toHaveTextContent('3');

    // Verify DELETE was called
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/test-5/watchers', {
      method: 'DELETE',
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  it('clamps watcher count to 0 when unsubscribing from 0 watchers', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ isWatching: true, watcherCount: 0 }),
    );

    render(<TaskWatcherButton taskId="test-6" />);

    const watchingButton = await screen.findByRole('button', { name: /watching/i });
    expect(watchingButton).toBeInTheDocument();

    // Mock the DELETE response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    fireEvent.click(watchingButton);

    // After clicking, button should show "Watch" with count clamped to 0
    // When count is 0, no badge renders, so accessible name is just "Watch"
    const watchButton = await screen.findByRole('button', { name: 'Watch' });
    expect(watchButton).toBeInTheDocument();
    expect(watchButton).toHaveTextContent('Watch');
    expect(watchButton).not.toHaveTextContent('0');
  });

  it('handles fetch error gracefully and renders default state', async () => {
    // Mock fetch to reject (network error)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error'),
    );

    render(<TaskWatcherButton taskId="test-7" />);

    // After the failed fetch, component falls back to default:
    // isWatching=false, watcherCount=0, so "Watch" with no badge
    const watchButton = await screen.findByRole('button', { name: 'Watch' });
    expect(watchButton).toBeInTheDocument();
    expect(watchButton).not.toBeDisabled();
  });

  // ── Spinner / toggling state ────────────────────────────────

  it('shows spinner while POST is in flight, then shows Watching', async () => {
    // Deferred promise to control when the fetch resolves
    let resolvePost: (value: unknown) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    // First call (GET on mount) resolves immediately
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ isWatching: false, watcherCount: 0 }),
    );

    render(<TaskWatcherButton taskId="test-spinner-post" />);

    const watchButton = await screen.findByRole('button', { name: 'Watch' });
    expect(watchButton).toBeInTheDocument();

    // Intercept the POST call with a deferred promise
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => postPromise,
    );

    fireEvent.click(watchButton);

    // Button should be disabled and show the spinner while POST is pending
    await waitFor(() => expect(watchButton).toBeDisabled());
    expect(watchButton.querySelector('.animate-spin')).toBeInTheDocument();

    // Resolve the POST with success
    resolvePost!(mockFetchResponse({ isWatching: true }));

    // After resolving, button should show "Watching"
    const watchingButton = await screen.findByRole('button', { name: /watching/i });
    expect(watchingButton).toBeInTheDocument();
    expect(watchingButton).not.toBeDisabled();

    // Spinner should be gone
    expect(watchingButton.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('shows spinner while DELETE is in flight, then reverts to Watch', async () => {
    // Deferred promise to control when the fetch resolves
    let resolveDelete: (value: unknown) => void;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });

    // First call (GET on mount) resolves immediately
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ isWatching: true, watcherCount: 2 }),
    );

    render(<TaskWatcherButton taskId="test-spinner-delete" />);

    const watchingButton = await screen.findByRole('button', { name: /watching/i });
    expect(watchingButton).toBeInTheDocument();

    // Intercept the DELETE call with a deferred promise
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => deletePromise,
    );

    fireEvent.click(watchingButton);

    // Button should be disabled and show the spinner while DELETE is pending
    await waitFor(() => expect(watchingButton).toBeDisabled());
    expect(watchingButton.querySelector('.animate-spin')).toBeInTheDocument();

    // Resolve the DELETE with success
    resolveDelete!(mockFetchResponse({ success: true }));

    // After resolving, button should show "Watch" with decremented count (2 - 1 = 1)
    const watchButton = await screen.findByRole('button', { name: /Watch(?!ing)/ });
    expect(watchButton).toBeInTheDocument();
    expect(watchButton).not.toBeDisabled();
    expect(watchButton).toHaveTextContent('1');

    // Spinner should be gone
    expect(watchButton.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('does not update count when POST fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ isWatching: false, watcherCount: 3 }),
    );

    render(<TaskWatcherButton taskId="test-8" />);

    const watchButton = await screen.findByRole('button', { name: /Watch(?!ing)/ });
    expect(watchButton).toHaveTextContent('3');

    // Mock the POST response to fail (500)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ error: 'Internal error' }, 500),
    );

    fireEvent.click(watchButton);

    // Button should revert to "Watch" with original count (not incremented)
    const buttonAgain = await screen.findByRole('button', { name: /Watch(?!ing)/ });
    expect(buttonAgain).toBeInTheDocument();
    expect(buttonAgain).toHaveTextContent('3');
  });
});
