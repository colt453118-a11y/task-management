import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTaskStore, defaultFilters } from '../task-store';
import type { Task, Comment, Attachment, TimeEntry, Dependency } from '../task-store';

// ─── Fixtures ───────────────────────────────────────────────

const mockTask: Task = {
  id: 'task-1',
  title: 'Test task',
  description: 'A test task',
  taskIdDisplay: 'TASK-1',
  status: 'open',
  priority: 'medium',
  assignedTo: 'user-1',
  projectId: 'project-1',
  departmentId: null,
  teamId: null,
  createdBy: 'user-1',
  updatedBy: null,
  dueDate: '2026-08-01T00:00:00Z',
  startDate: null,
  estimatedHours: '8',
  actualHours: null,
  labels: ['bug'],
  tags: null,
  category: 'dev',
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-15T00:00:00Z',
  deletedAt: null,
  updatedByName: null,
  sortOrder: '0',
};

const mockComment: Comment = {
  id: 'c-1',
  taskId: 'task-1',
  userId: 'u-1',
  content: 'Nice work',
  isInternalNote: false,
  parentId: null,
  isEdited: false,
  editedAt: null,
  createdAt: '2026-07-10T00:00:00Z',
  user: { id: 'u-1', name: 'Alice', avatarUrl: null },
};

const mockAttachment: Attachment = {
  id: 'a-1',
  taskId: 'task-1',
  userId: 'u-1',
  fileName: 'doc.pdf',
  fileSize: 5000,
  mimeType: 'application/pdf',
  createdAt: '2026-07-10T00:00:00Z',
  user: { id: 'u-1', name: 'Alice' },
};

const mockTimeEntry: TimeEntry = {
  id: 't-1',
  taskId: 'task-1',
  userId: 'u-1',
  startTime: '2026-07-10T08:00:00Z',
  endTime: '2026-07-10T09:30:00Z',
  durationMinutes: 90,
  entryType: 'manual',
  description: 'Work',
  createdAt: '2026-07-10T09:30:00Z',
  user: { id: 'u-1', name: 'Alice', avatarUrl: null },
};

const mockDependency: Dependency = {
  id: 'd-1',
  taskId: 'task-1',
  dependsOnTaskId: 'task-2',
  dependencyType: 'blocks',
  createdAt: '2026-07-05T00:00:00Z',
  dependsOnTask: { id: 'task-2', title: 'Task 2', taskIdDisplay: 'TASK-2', status: 'completed' },
};

// ─── Helpers ────────────────────────────────────────────────

function okResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

function errorResponse(status: number, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
    statusText: message,
  } as Response);
}

function networkError(message: string) {
  return Promise.reject(new Error(message));
}

// Reset store and fetch mock before each test
beforeEach(() => {
  useTaskStore.setState({
    tasks: [],
    totalCount: 0,
    loading: false,
    error: null,
    currentTask: null,
    comments: [],
    attachments: [],
    timeEntries: [],
    blockedBy: [],
    blocking: [],
    checklistItems: [],
    loadingDetail: false,
    detailError: null,
    filters: { ...defaultFilters },
    ui: {
      view: 'list',
      page: 0,
      pageSize: 25,
      selectedIds: new Set(),
      allSelectedMode: false,
      allMatchingIds: [],
      showFilters: false,
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// ─── fetchTasks ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('fetchTasks', () => {
  it('should set loading=true initially, then set tasks and loading=false on success', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => okResponse({ tasks: [mockTask], total: 1 }));

    // Initiate the async fetch
    const promise = useTaskStore.getState().fetchTasks();

    // During fetch — loading should be true
    expect(useTaskStore.getState().loading).toBe(true);
    expect(useTaskStore.getState().error).toBeNull();

    await promise;

    // After fetch — tasks loaded
    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([mockTask]);
    expect(state.totalCount).toBe(1);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('should fetch with params appended to the URL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => okResponse({ tasks: [], total: 0 }));

    await useTaskStore.getState().fetchTasks('status=open&priority=high');

    expect(fetchSpy).toHaveBeenCalledWith('/api/tasks?status=open&priority=high');
  });

  it('should fetch without params using just /api/tasks', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => okResponse({ tasks: [], total: 0 }));

    await useTaskStore.getState().fetchTasks();

    expect(fetchSpy).toHaveBeenCalledWith('/api/tasks');
  });

  it('should set loading=false and error on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      errorResponse(500, 'Internal Server Error'),
    );

    const promise = useTaskStore.getState().fetchTasks();

    // During fetch — loading is true
    expect(useTaskStore.getState().loading).toBe(true);

    await promise;

    const state = useTaskStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Failed to fetch tasks');
    expect(state.tasks).toEqual([]);
  });

  it('should handle network errors gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => networkError('Network failure'));

    await useTaskStore.getState().fetchTasks();

    const state = useTaskStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Network failure');
    expect(state.tasks).toEqual([]);
  });

  it('should handle non-Error thrown values', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject('string error'));

    await useTaskStore.getState().fetchTasks();

    const state = useTaskStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Failed to fetch tasks');
  });

  it('should use fallback empty arrays when response is missing fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => okResponse({}), // missing tasks and total
    );

    await useTaskStore.getState().fetchTasks();

    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.totalCount).toBe(0);
  });

  it('should preserve existing tasks on error (catch block only sets error/loading, not tasks)', async () => {
    useTaskStore.setState({ tasks: [mockTask], totalCount: 1 });

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => errorResponse(500, 'Server error'));

    await useTaskStore.getState().fetchTasks();

    // The catch block only sets { error, loading }, so existing tasks are preserved
    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([mockTask]); // preserved
    expect(state.totalCount).toBe(1);
    expect(state.error).toBe('Failed to fetch tasks');
  });

  it('should clear error before starting a new fetch', async () => {
    useTaskStore.setState({ error: 'Previous error' });

    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      okResponse({ tasks: [mockTask], total: 1 }),
    );

    await useTaskStore.getState().fetchTasks();

    // During fetch — error cleared
    expect(useTaskStore.getState().error).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── fetchTaskDetail ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('fetchTaskDetail', () => {
  const taskId = 'task-1';

  it('should set loadingDetail=true, then load all data and set loadingDetail=false on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string') {
        if (
          url.includes(`/tasks/${taskId}`) &&
          !url.includes('/comments') &&
          !url.includes('/attachments') &&
          !url.includes('/dependencies') &&
          !url.includes('/time-entries')
        ) {
          return okResponse({ task: mockTask });
        }
        if (url.includes('/comments')) return okResponse({ comments: [mockComment] });
        if (url.includes('/attachments')) return okResponse({ attachments: [mockAttachment] });
        if (url.includes('/dependencies'))
          return okResponse({ blockedBy: [mockDependency], blocking: [] });
        if (url.includes('/time-entries')) return okResponse({ entries: [mockTimeEntry] });
      }
      return errorResponse(404, 'Not found');
    });

    const promise = useTaskStore.getState().fetchTaskDetail(taskId);

    // During fetch
    expect(useTaskStore.getState().loadingDetail).toBe(true);
    expect(useTaskStore.getState().detailError).toBeNull();

    await promise;

    const state = useTaskStore.getState();
    expect(state.currentTask).toEqual(mockTask);
    expect(state.comments).toEqual([mockComment]);
    expect(state.attachments).toEqual([mockAttachment]);
    expect(state.blockedBy).toEqual([mockDependency]);
    expect(state.blocking).toEqual([]);
    expect(state.timeEntries).toEqual([mockTimeEntry]);
    expect(state.loadingDetail).toBe(false);
    expect(state.detailError).toBeNull();

    // Verify all 5 endpoints were called
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('should set detailError on 404 with the correct message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (
        typeof url === 'string' &&
        url.includes(`/tasks/${taskId}`) &&
        !url.includes('/comments') &&
        !url.includes('/attachments') &&
        !url.includes('/dependencies') &&
        !url.includes('/time-entries')
      ) {
        return errorResponse(404, 'Not found');
      }
      // Other requests still succeed but won't matter because task endpoint fails first
      return okResponse({});
    });

    await useTaskStore.getState().fetchTaskDetail(taskId);

    const state = useTaskStore.getState();
    expect(state.loadingDetail).toBe(false);
    expect(state.detailError).toBe('Task not found');
    expect(state.currentTask).toBeNull();
  });

  it('should set generic error on non-404 failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (
        typeof url === 'string' &&
        url.includes(`/tasks/${taskId}`) &&
        !url.includes('/comments')
      ) {
        return errorResponse(500, 'Server Error');
      }
      return okResponse({});
    });

    await useTaskStore.getState().fetchTaskDetail(taskId);

    const state = useTaskStore.getState();
    expect(state.loadingDetail).toBe(false);
    expect(state.detailError).toBe('Failed to load task');
    expect(state.currentTask).toBeNull();
  });

  it('should handle network errors on the task endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => networkError('Network failure'));

    await useTaskStore.getState().fetchTaskDetail(taskId);

    const state = useTaskStore.getState();
    expect(state.loadingDetail).toBe(false);
    expect(state.detailError).toBe('Network failure');
  });

  it('should use fallback empty arrays when sub-endpoints return non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string') {
        if (
          url.includes(`/tasks/${taskId}`) &&
          !url.includes('/comments') &&
          !url.includes('/attachments') &&
          !url.includes('/dependencies') &&
          !url.includes('/time-entries')
        ) {
          return okResponse({ task: mockTask });
        }
        // comments returns 500, others succeed
        if (url.includes('/comments')) return errorResponse(500, 'Bad');
        if (url.includes('/attachments')) return okResponse({ attachments: [mockAttachment] });
        if (url.includes('/dependencies'))
          return okResponse({ blockedBy: [mockDependency], blocking: [] });
        if (url.includes('/time-entries')) return okResponse({ entries: [mockTimeEntry] });
      }
      return errorResponse(404, 'Not found');
    });

    await useTaskStore.getState().fetchTaskDetail(taskId);

    const state = useTaskStore.getState();
    // Task loaded
    expect(state.currentTask).toEqual(mockTask);
    // Comments fallback to empty
    expect(state.comments).toEqual([]);
    // Other endpoints loaded
    expect(state.attachments).toEqual([mockAttachment]);
    expect(state.blockedBy).toEqual([mockDependency]);
    expect(state.timeEntries).toEqual([mockTimeEntry]);
    expect(state.loadingDetail).toBe(false);
    expect(state.detailError).toBeNull();
  });

  it('should handle all sub-endpoints returning non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string') {
        if (
          url.includes(`/tasks/${taskId}`) &&
          !url.includes('/comments') &&
          !url.includes('/attachments') &&
          !url.includes('/dependencies') &&
          !url.includes('/time-entries')
        ) {
          return okResponse({ task: mockTask });
        }
      }
      return errorResponse(500, 'Server error');
    });

    await useTaskStore.getState().fetchTaskDetail(taskId);

    const state = useTaskStore.getState();
    expect(state.currentTask).toEqual(mockTask);
    expect(state.comments).toEqual([]);
    expect(state.attachments).toEqual([]);
    expect(state.blockedBy).toEqual([]);
    expect(state.blocking).toEqual([]);
    expect(state.timeEntries).toEqual([]);
    expect(state.loadingDetail).toBe(false);
    expect(state.detailError).toBeNull();
  });

  it('should clear detailError before starting a new fetch', async () => {
    useTaskStore.setState({ detailError: 'Previous error' });

    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (
        typeof url === 'string' &&
        url.includes(`/tasks/${taskId}`) &&
        !url.includes('/comments')
      ) {
        return okResponse({ task: mockTask });
      }
      return okResponse({});
    });

    expect(useTaskStore.getState().detailError).toBe('Previous error');

    await useTaskStore.getState().fetchTaskDetail(taskId);

    // error cleared during fetch, then data loaded
    const state = useTaskStore.getState();
    expect(state.currentTask).toEqual(mockTask);
    expect(state.detailError).toBeNull();
  });
});
