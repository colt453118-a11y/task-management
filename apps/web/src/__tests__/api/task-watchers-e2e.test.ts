import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain, createRequest } from '@/__tests__/api/test-helpers';

// ═══════════════════════════════════════════════════════════════════
// Hoisted mocks — these run before all imports
// ═══════════════════════════════════════════════════════════════════

const { mockNextResponseJson, mockDb, mockRequirePermission, mockCreateAuditEntry } = vi.hoisted(
  () => ({
    mockNextResponseJson: vi.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      ok: (init?.status ?? 200) < 400,
      json: async () => body,
    })),

    mockDb: vi.fn(),

    mockRequirePermission: vi.fn(() => Promise.resolve()),

    mockCreateAuditEntry: vi.fn(() => Promise.resolve()),
  }),
);

// ═══════════════════════════════════════════════════════════════════
// Module-level mocks
// ═══════════════════════════════════════════════════════════════════

vi.mock('next/server', () => ({
  NextResponse: { json: mockNextResponseJson },
}));

vi.mock('@/lib/auth/api-auth', () => ({
  // Wrap the handler so exported GET/POST/DELETE keep their original
  // (req) => Response signature — no second arg needed in tests.
  withAuth: (handler: Function) =>
    async (req: unknown) =>
      handler(req, {
        user: { id: 'user-1', email: 'test@test.com', name: 'Test User' },
        orgId: 'org-1',
      }),
  requirePermission: mockRequirePermission,
  checkPermission: vi.fn(() => Promise.resolve(true)),
  enforceOrgScope: vi.fn(),
}));

vi.mock('@/lib/api/db', () => ({
  db: mockDb,
  schema: {
    // These just need to not throw when properties are accessed.
    // The actual values are passed to the mocked chain and never used directly.
    tasks: { id: 'tasks.id', organizationId: 'tasks.orgId', deletedAt: 'tasks.deletedAt' } as Record<string, string>,
    taskWatchers: { id: 'tw.id', taskId: 'tw.taskId', userId: 'tw.userId', watchType: 'tw.watchType', createdAt: 'tw.createdAt' } as Record<string, string>,
    users: { id: 'users.id', name: 'users.name', avatarUrl: 'users.avatarUrl' } as Record<string, string>,
  },
  handleApiError: vi.fn((_error: unknown, message: string) => ({
    error: { code: 'INTERNAL_ERROR', message },
    status: 500,
  })),
}));

vi.mock('@/lib/audit', () => ({
  createAuditEntry: mockCreateAuditEntry,
}));

// ═══════════════════════════════════════════════════════════════════
// Imports — these run after mocks are in place
// ═══════════════════════════════════════════════════════════════════

import { GET, POST, DELETE } from '@/app/api/tasks/[id]/watchers/route';

beforeEach(() => {
  vi.resetAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe('Watchers API — full CRUD flow', () => {
  it('POST → watches a task (creates a watcher)', async () => {
    const chain = createChain([
      // Query 1: task existence check → task found
      [{ id: 'task-123', organizationId: 'org-1' }],
      // Query 2: check existing watcher → not watching yet
      [],
      // Query 3: insert watcher → success
      [{ id: 'watcher-1', taskId: 'task-123', userId: 'user-1', watchType: 'watching' }],
    ]);
    mockDb.mockReturnValue(chain);

    const response = await POST(createRequest('POST', '/api/tasks/task-123/watchers'));

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        watcher: expect.objectContaining({ id: 'watcher-1' }),
        isWatching: true,
      }),
      expect.objectContaining({ status: 201 }),
    );
    expect(response.status).toBe(201);

    // Verify DB operations
    expect(chain.select).toHaveBeenCalled();
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-123', userId: 'user-1', watchType: 'watching' }),
    );
    expect(chain.returning).toHaveBeenCalled();

    // Verify audit entry
    expect(mockCreateAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'task.watcher_added',
        entityId: 'task-123',
        userId: 'user-1',
      }),
    );
  });

  it('GET → lists watchers for a task', async () => {
    const watchers = [
      {
        id: 'watcher-1',
        taskId: 'task-123',
        userId: 'user-1',
        watchType: 'watching',
        createdAt: new Date().toISOString(),
        user: { id: 'user-1', name: 'Test User', avatarUrl: null },
      },
    ];

    const chain = createChain([
      [{ id: 'task-123', organizationId: 'org-1' }],
      watchers,
    ]);
    mockDb.mockReturnValue(chain);

    const response = await GET(createRequest('GET', '/api/tasks/task-123/watchers'));

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ watchers, isWatching: true, watcherCount: 1 }),
    );
    expect(response.status).toBe(200);
    expect(chain.leftJoin).toHaveBeenCalled();
  });

  it('GET → returns isWatching: false when current user is not among watchers', async () => {
    const watchers = [
      {
        id: 'watcher-2',
        taskId: 'task-123',
        userId: 'some-other-user',
        watchType: 'watching',
        createdAt: new Date().toISOString(),
        user: { id: 'some-other-user', name: 'Other User', avatarUrl: null },
      },
    ];

    const chain = createChain([
      [{ id: 'task-123', organizationId: 'org-1' }],
      watchers,
    ]);
    mockDb.mockReturnValue(chain);

    await GET(createRequest('GET', '/api/tasks/task-123/watchers'));

    const firstCall = mockNextResponseJson.mock.calls[0];
    expect(firstCall).toBeDefined();
    const body = firstCall![0] as Record<string, unknown>;
    expect(body.isWatching).toBe(false);
    expect(body.watcherCount).toBe(1);
  });

  it('DELETE → unwatches a task (removes watcher)', async () => {
    const chain = createChain([
      [{ id: 'task-123', organizationId: 'org-1' }],
      [{ id: 'watcher-1' }],
      [],
    ]);
    mockDb.mockReturnValue(chain);

    const response = await DELETE(createRequest('DELETE', '/api/tasks/task-123/watchers'));

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, isWatching: false }),
    );
    expect(response.status).toBe(200);
    expect(chain.delete).toHaveBeenCalled();

    expect(mockCreateAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'task.watcher_removed',
        entityId: 'task-123',
        userId: 'user-1',
      }),
    );
  });

});

// ─── Error Cases ────────────────────────────────────────────────

describe('Watchers API — error cases', () => {
  it('POST returns 409 when already watching', async () => {
    const chain = createChain([
      [{ id: 'task-123', organizationId: 'org-1' }],
      [{ id: 'watcher-1' }], // already watching!
    ]);
    mockDb.mockReturnValue(chain);

    const response = await POST(createRequest('POST', '/api/tasks/task-123/watchers'));

    expect(response.status).toBe(409);
    expect(chain.insert).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CONFLICT', message: 'Already watching this task' }),
      }),
      expect.objectContaining({ status: 409 }),
    );
  });

  it('POST returns 404 when task does not exist', async () => {
    const chain = createChain([[]]); // task not found
    mockDb.mockReturnValue(chain);

    const response = await POST(createRequest('POST', '/api/tasks/task-123/watchers'));
    expect(response.status).toBe(404);
  });

  it('POST returns 500 when watcher insert fails (returns empty)', async () => {
    const chain = createChain([
      [{ id: 'task-123', organizationId: 'org-1' }], // task exists
      [],                                              // not watching
      [],                                              // insert returned empty!
    ]);
    mockDb.mockReturnValue(chain);

    const response = await POST(createRequest('POST', '/api/tasks/task-123/watchers'));
    expect(response.status).toBe(500);
    expect(mockCreateAuditEntry).not.toHaveBeenCalled(); // audit skipped on error
  });

  it('DELETE returns 404 when not watching the task', async () => {
    const chain = createChain([
      [{ id: 'task-123', organizationId: 'org-1' }],
      [], // not watching
    ]);
    mockDb.mockReturnValue(chain);

    const response = await DELETE(createRequest('DELETE', '/api/tasks/task-123/watchers'));

    expect(response.status).toBe(404);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND', message: 'Not watching this task' }),
      }),
      expect.objectContaining({ status: 404 }),
    );
  });

  it('DELETE returns 404 when task does not exist', async () => {
    const chain = createChain([[]]); // task not found
    mockDb.mockReturnValue(chain);

    const response = await DELETE(createRequest('DELETE', '/api/tasks/task-123/watchers'));

    expect(response.status).toBe(404);
    expect(chain.delete).not.toHaveBeenCalled();
  });

  it('GET returns 404 when task does not exist', async () => {
    const chain = createChain([[]]); // task not found
    mockDb.mockReturnValue(chain);

    const response = await GET(createRequest('GET', '/api/tasks/task-123/watchers'));

    expect(response.status).toBe(404);
    expect(chain.leftJoin).not.toHaveBeenCalled();
  });
});

// ─── Permission Enforcement ───────────────────────────────────
// NOTE: Only the GET handler calls requirePermission(). The POST and
// DELETE handlers delegate access control to checkTaskAccessOrRespond
// (org-scope check) without a separate requirePermission call.

describe('Watchers API — permission enforcement', () => {
  it('GET enforces task:view permission', async () => {
    mockRequirePermission.mockImplementation(() =>
      Promise.reject(new Error('Forbidden')),
    );
    const response = await GET(createRequest('GET', '/api/tasks/task-123/watchers'));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', 'task:view');
  });

  it('POST rejects cross-org access', async () => {
    const chain = createChain([
      [{ id: 'task-123', organizationId: 'other-org' }], // task exists but different org
    ]);
    mockDb.mockReturnValue(chain);
    const response = await POST(createRequest('POST', '/api/tasks/task-123/watchers'));
    expect(response.status).toBe(403);
  });

  it('DELETE rejects cross-org access', async () => {
    const chain = createChain([
      [{ id: 'task-123', organizationId: 'other-org' }], // task exists but different org
    ]);
    mockDb.mockReturnValue(chain);
    const response = await DELETE(createRequest('DELETE', '/api/tasks/task-123/watchers'));
    expect(response.status).toBe(403);
  });
});

// ─── API Contract ───────────────────────────────────────────────

describe('Watchers API — response contract', () => {
  it('GET returns expected response shape', async () => {
    const watchers = [
      {
        id: 'watcher-1',
        taskId: 'task-123',
        userId: 'user-1',
        watchType: 'watching',
        createdAt: new Date().toISOString(),
        user: { id: 'user-1', name: 'Test User', avatarUrl: null },
      },
    ];

    mockDb.mockReturnValue(
      createChain([
        [{ id: 'task-123', organizationId: 'org-1' }],
        watchers,
      ]),
    );

    await GET(createRequest('GET', '/api/tasks/task-123/watchers'));

    const firstCall = mockNextResponseJson.mock.calls[0];
    expect(firstCall).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = firstCall![0] as any;
    expect(body).toHaveProperty('watchers');
    expect(body).toHaveProperty('isWatching');
    expect(body).toHaveProperty('watcherCount');
    expect(Array.isArray(body.watchers)).toBe(true);
    expect(typeof body.isWatching).toBe('boolean');
    expect(typeof body.watcherCount).toBe('number');

    const w = body.watchers[0];
    expect(w).toHaveProperty('id');
    expect(w).toHaveProperty('taskId');
    expect(w).toHaveProperty('userId');
    expect(w).toHaveProperty('watchType');
    expect(w).toHaveProperty('createdAt');
    expect(w).toHaveProperty('user');
    expect(w.user).toHaveProperty('id');
    expect(w.user).toHaveProperty('name');
  });

  it('POST returns 201 and watcher object on success', async () => {
    mockDb.mockReturnValue(
      createChain([
        [{ id: 'task-123', organizationId: 'org-1' }],
        [],
        [{ id: 'watcher-1', taskId: 'task-123', userId: 'user-1', watchType: 'watching' }],
      ]),
    );

    await POST(createRequest('POST', '/api/tasks/task-123/watchers'));

    const firstCall = mockNextResponseJson.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [body, init] = firstCall! as [Record<string, unknown>, { status?: number } | undefined];
    expect(init?.status).toBe(201);
    expect(body).toHaveProperty('watcher');
    expect(body).toHaveProperty('isWatching', true);
    expect(body.watcher).toHaveProperty('id');
    expect(body.watcher).toHaveProperty('taskId');
    expect(body.watcher).toHaveProperty('userId');
    expect(body.watcher).toHaveProperty('watchType');
  });

  it('DELETE returns 200 with success:true on unwatch', async () => {
    mockDb.mockReturnValue(
      createChain([
        [{ id: 'task-123', organizationId: 'org-1' }],
        [{ id: 'watcher-1' }],
        [],
      ]),
    );

    await DELETE(createRequest('DELETE', '/api/tasks/task-123/watchers'));

    const firstCall = mockNextResponseJson.mock.calls[0];
    expect(firstCall).toBeDefined();
    const body = firstCall![0] as Record<string, unknown>;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('isWatching', false);
  });
});
