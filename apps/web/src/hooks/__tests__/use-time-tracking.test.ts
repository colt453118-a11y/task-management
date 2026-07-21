import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTimeEntries, useRunningTimer, useTaskSearch } from '../use-time-tracking';

// ─── Mocks ──────────────────────────────────────────────────

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ────────────────────────────────────────────────

function mockFetchResponse(data: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(data),
  };
}

// ─── Fixtures ───────────────────────────────────────────────

const mockTimeEntry = {
  id: 'entry-1',
  taskId: 'task-1',
  userId: 'user-1',
  startTime: '2024-01-15T09:00:00.000Z',
  endTime: '2024-01-15T10:30:00.000Z',
  durationMinutes: 90,
  billableMinutes: 90,
  entryType: 'timer',
  description: 'Working on feature X',
  isApproved: false,
  createdAt: '2024-01-15T09:00:00.000Z',
  task: {
    id: 'task-1',
    title: 'Test Task',
    taskIdDisplay: 'TASK-1',
    status: 'in_progress',
    projectId: 'proj-1',
  },
};

const mockTimeEntry2 = {
  ...mockTimeEntry,
  id: 'entry-2',
  durationMinutes: 45,
  startTime: '2024-01-15T14:00:00.000Z',
  endTime: '2024-01-15T14:45:00.000Z',
  task: { ...mockTimeEntry.task, id: 'task-2', title: 'Second Task', taskIdDisplay: 'TASK-2' },
};

const mockTimeEntriesData = {
  entries: [mockTimeEntry, mockTimeEntry2],
  total: 2,
  summary: {
    totalHours: '2.3',
    totalMinutes: 135,
    billableMinutes: 135,
    entryCount: 2,
    avgSessionMinutes: 68,
  },
  taskBreakdown: [
    { taskId: 'task-1', title: 'Test Task', taskIdDisplay: 'TASK-1', status: 'in_progress', totalMinutes: 90, count: 1 },
    { taskId: 'task-2', title: 'Second Task', taskIdDisplay: 'TASK-2', status: 'in_progress', totalMinutes: 45, count: 1 },
  ],
};

const mockRunningTimerData = {
  running: true,
  entry: {
    ...mockTimeEntry,
    endTime: null,
    durationMinutes: null,
  },
};

const mockNoRunningTimerData = {
  running: false,
  entry: null,
};

const mockTaskSearchResults = {
  tasks: [
    { id: 'task-1', title: 'Test Task', taskIdDisplay: 'TASK-1', status: 'in_progress' },
    { id: 'task-2', title: 'Second Task', taskIdDisplay: 'TASK-2', status: 'todo' },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  useTimeEntries Tests
// ═══════════════════════════════════════════════════════════════

describe('useTimeEntries', () => {

  it('should start with loading true and empty data', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useTimeEntries('today'));

    expect(result.current.loading).toBe(true);
    expect(result.current.entries).toEqual([]);
    expect(result.current.summary).toBeNull();
    expect(result.current.taskBreakdown).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('should fetch and return time entries on success', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockTimeEntriesData),
    );

    const { result } = renderHook(() => useTimeEntries('today'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]!.id).toBe('entry-1');
    expect(result.current.entries[1]!.id).toBe('entry-2');
    expect(result.current.summary?.totalHours).toBe('2.3');
    expect(result.current.summary?.totalMinutes).toBe(135);
    expect(result.current.taskBreakdown).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/time-entries?scope=today&limit=100');
  });

  it('should fetch with different scope', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockTimeEntriesData),
    );

    renderHook(() => useTimeEntries('week'));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/time-entries?scope=week&limit=100');
    });
  });

  it('should handle empty response gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({
        entries: [],
        total: 0,
        summary: { totalHours: '0', totalMinutes: 0, billableMinutes: 0, entryCount: 0, avgSessionMinutes: 0 },
        taskBreakdown: [],
      }),
    );

    const { result } = renderHook(() => useTimeEntries('today'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entries).toEqual([]);
    expect(result.current.summary?.totalHours).toBe('0');
    expect(result.current.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch error (non-ok response)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ error: { message: 'Server error' } }, false),
    );

    const { result } = renderHook(() => useTimeEntries('today'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch time entries');
    expect(result.current.entries).toEqual([]);
  });

  it('should handle network error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network failure'),
    );

    const { result } = renderHook(() => useTimeEntries('today'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Hook returns the actual error message since err instanceof Error
    expect(result.current.error).toBe('Network failure');
  });

  it('should refresh data when refresh is called', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockTimeEntriesData),
    );

    const { result } = renderHook(() => useTimeEntries('today'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(2);

    // Refresh should re-fetch
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ ...mockTimeEntriesData, entries: [mockTimeEntry], total: 1 }),
    );

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should use the correct scope in the URL', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    renderHook(() => useTimeEntries('month'));

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/time-entries?scope=month&limit=100');
  });
});

// ═══════════════════════════════════════════════════════════════
//  useRunningTimer Tests
// ═══════════════════════════════════════════════════════════════

describe('useRunningTimer', () => {

  it('should start with no running timer and not loading', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRunningTimer());

    expect(result.current.runningTimer).toBeNull();
    expect(result.current.timerElapsed).toBe(0);
    expect(result.current.timerLoading).toBe(false);
  });

  it('should detect running timer on mount', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockRunningTimerData),
    );

    const { result } = renderHook(() => useRunningTimer());

    await waitFor(() => expect(result.current.runningTimer).not.toBeNull());

    expect(result.current.runningTimer?.running).toBe(true);
    expect(result.current.runningTimer?.entry?.id).toBe('entry-1');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/time-entries/running');
  });

  it('should detect no running timer', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockNoRunningTimerData),
    );

    const { result } = renderHook(() => useRunningTimer());

    await waitFor(() => expect(result.current.runningTimer).not.toBeNull());

    expect(result.current.runningTimer?.running).toBe(false);
    expect(result.current.runningTimer?.entry).toBeNull();
  });

  it('should handle fetch error silently (no error state)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderHook(() => useRunningTimer());

    // Should not throw — error is caught silently
    await expect(result.current.runningTimer).toBeNull();
  });

  it('should start timer and re-check running state', async () => {
    // First call (mount check) — no running timer
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(mockNoRunningTimerData),
    );
    // Second call (startTimer POST) — success
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ entry: mockTimeEntry }, true),
    );
    // Third call (checkRunningTimer after start) — now running
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(mockRunningTimerData),
    );

    const { result } = renderHook(() => useRunningTimer());

    // Wait for initial check
    await waitFor(() => expect(result.current.runningTimer).not.toBeNull());

    // Start timer
    await act(async () => {
      await result.current.startTimer('task-1');
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/task-1/time-entries', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('timer'),
    }));

    // Should re-check and find running timer
    await waitFor(() => expect(result.current.runningTimer?.running).toBe(true));
    expect(result.current.timerLoading).toBe(false);
  });

  it('should stop timer and clear state', async () => {
    // First call (mount check) — running timer
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(mockRunningTimerData),
    );
    // Second call (stopTimer PATCH) — success
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ entry: { ...mockTimeEntry, endTime: new Date().toISOString(), durationMinutes: 30 } }),
    );

    const { result } = renderHook(() => useRunningTimer());

    await waitFor(() => expect(result.current.runningTimer?.running).toBe(true));

    await act(async () => {
      await result.current.stopTimer('entry-1', 'task-1');
    });

    expect(result.current.runningTimer).toBeNull();
    expect(result.current.timerElapsed).toBe(0);
    expect(result.current.timerLoading).toBe(false);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/tasks/task-1/time-entries?entryId=entry-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('refresh should re-check running timer', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockNoRunningTimerData),
    );

    const { result } = renderHook(() => useRunningTimer());

    await waitFor(() => expect(result.current.runningTimer).not.toBeNull());
    const callCount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
//  useTaskSearch Tests
// ═══════════════════════════════════════════════════════════════

describe('useTaskSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should start with empty query and results', () => {
    const { result } = renderHook(() => useTaskSearch());

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should set query when search is called', () => {
    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.search('test');
    });

    expect(result.current.query).toBe('test');
  });

  it('should clear results when search is called with empty string', () => {
    const { result } = renderHook(() => useTaskSearch());

    // First set some results
    act(() => {
      result.current.search('test');
    });

    // Then clear with empty
    act(() => {
      result.current.search('');
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
  });

  it('should fetch tasks after debounce delay', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockTaskSearchResults),
    );

    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.search('test query');
    });

    expect(result.current.query).toBe('test query');
    expect(result.current.loading).toBe(false);
    expect(result.current.results).toEqual([]); // Not yet fetched

    // Advance past debounce (300ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.results).toHaveLength(2);
    expect(result.current.results[0]!.id).toBe('task-1');
    expect(result.current.results[0]!.title).toBe('Test Task');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks?search=test%20query'),
    );
  });

  it('should debounce multiple rapid calls', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ tasks: [{ id: 'task-3', title: 'Third Task', taskIdDisplay: 'TASK-3', status: 'completed' }] }),
    );

    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.search('a');
    });

    act(() => {
      result.current.search('ab');
    });

    act(() => {
      result.current.search('abc');
    });

    // Only the last call should trigger after debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('search=abc'),
    );
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0]!.title).toBe('Third Task');
  });

  it('should clear query and results when clear is called', () => {
    const { result } = renderHook(() => useTaskSearch());

    // Set some state
    act(() => {
      result.current.search('test');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
  });

  it('should handle fetch error silently', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.search('test');
    });

    // Advance past debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Error is caught silently, results should remain empty
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should handle non-ok response gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ error: 'Server error' }, false),
    );

    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.search('test');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Non-ok response doesn't set results
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should set loading to true during fetch', async () => {
    // Return a promise that doesn't resolve immediately
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.search('test');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Loading should be true since the fetch never resolves
    expect(result.current.loading).toBe(true);
  });

  it('should encode URI components properly', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse(mockTaskSearchResults),
    );

    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.search('special chars: &?=#');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('special chars: &?=#')),
    );
  });
});
