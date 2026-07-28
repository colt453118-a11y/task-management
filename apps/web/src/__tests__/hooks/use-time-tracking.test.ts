import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTimeEntries, useRunningTimer, useTaskSearch } from '@/hooks/use-time-tracking';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('useTimeEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with loading state', () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [], summary: null, taskBreakdown: [] })));
    const { result } = renderHook(() => useTimeEntries('today'));
    expect(result.current.loading).toBe(true);
    expect(result.current.entries).toEqual([]);
  });

  it('fetches time entries on mount', async () => {
    const mockData = {
      entries: [{ id: 'e1', taskId: 't1', startTime: '2024-01-01T00:00:00Z', endTime: null }],
      summary: { totalHours: '2.5', totalMinutes: 150, entryCount: 1 },
      taskBreakdown: [],
      total: 1,
    };
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData)));

    const { result } = renderHook(() => useTimeEntries('week'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.summary?.totalHours).toBe('2.5');
    expect(mockFetch).toHaveBeenCalledWith('/api/time-entries?scope=week&limit=100');
  });

  it('handles fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useTimeEntries('month'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
  });

  it('refresh refetches data', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ entries: [] })));
    const { result } = renderHook(() => useTimeEntries('today'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      entries: [{ id: 'e2', taskId: 't2' }],
    })));

    act(() => { result.current.refresh(); });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});

describe('useRunningTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks running timer on mount', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ running: false, entry: null })));
    const { result } = renderHook(() => useRunningTimer());
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/time-entries/running');
      expect(result.current.runningTimer?.running).toBe(false);
    });
  });

  it('starts a timer', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({})));
    const { result } = renderHook(() => useRunningTimer());
    // Wait for the initial checkRunningTimer effect to fire
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/time-entries/running');
    });
    mockFetch.mockClear();
    await act(async () => {
      await result.current.startTimer('task-1');
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/tasks/task-1/time-entries', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('stops a timer', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
    const { result } = renderHook(() => useRunningTimer());
    await act(async () => {
      await result.current.stopTimer('entry-1', 'task-1');
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tasks/task-1/time-entries?entryId=entry-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(result.current.runningTimer).toBeNull();
    expect(result.current.timerElapsed).toBe(0);
  });
});

describe('useTaskSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('initializes with empty query and results', () => {
    const { result } = renderHook(() => useTaskSearch());
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('clears results when query is empty', () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => { result.current.search(''); });
    expect(result.current.results).toEqual([]);
  });

  it('debounces search by 300ms', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ tasks: [{ id: 't1', title: 'Test' }] })));
    const { result } = renderHook(() => useTaskSearch());

    act(() => { result.current.search('test'); });
    expect(result.current.results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });
    // Flush microtask queue (timers are faked, so use pure microtask yield)
    await Promise.resolve();
    await Promise.resolve();
    expect(mockFetch).toHaveBeenCalled();
  });

  it('clear resets query and results', () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => { result.current.search('test'); });
    act(() => { result.current.clear(); });
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
  });
});
