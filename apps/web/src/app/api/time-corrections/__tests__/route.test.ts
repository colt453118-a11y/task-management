import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════
// Hoisted mocks — must be defined before vi.mock calls
// ═══════════════════════════════════════════════════════════════════

const {
  mockDb,
  mockCreateNotification,
  mockRecalcTaskHours,
  mockHandleApiError,
  mockRequirePermission,
} = vi.hoisted(() => ({
  mockDb: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockRecalcTaskHours: vi.fn().mockResolvedValue('8.50'),
  mockHandleApiError: vi.fn().mockReturnValue({
    error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    status: 500,
  }),
  mockRequirePermission: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════
// Module-level mocks
// ═══════════════════════════════════════════════════════════════════

vi.mock('@/lib/api/db', () => ({
  db: mockDb,
  schema: {
    timeCorrectionRequests: {},
    timeEntries: {},
    tasks: {},
    users: {},
  },
  handleApiError: mockHandleApiError,
  recalcTaskHours: mockRecalcTaskHours,
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: vi.fn(
    (
      handler: (
        req: NextRequest,
        context: { user: { id: string; name: string }; orgId: string },
      ) => Promise<NextResponse>,
      _rateLimit?: unknown,
    ) => {
      return async (req: NextRequest) => {
        return handler(req, { user: { id: 'user-1', name: 'Test User' }, orgId: 'org-1' });
      };
    },
  ),
  requirePermission: mockRequirePermission,
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: mockCreateNotification,
}));

// ═══════════════════════════════════════════════════════════════════
// Imports — after mocks are established
// ═══════════════════════════════════════════════════════════════════

import { GET, POST, PATCH, DELETE } from '../route';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Generic request helper for GET, POST, PATCH handlers (supports body).
 */
function createRequest<T = unknown>(
  method: string,
  pathname: string,
  searchParams?: string,
  body?: T,
): NextRequest {
  return {
    method,
    nextUrl: {
      pathname,
      searchParams: new URLSearchParams(searchParams ?? ''),
    },
    json: async () => body ?? { content: 'Test content' },
  } as unknown as NextRequest;
}

/**
 * Create a minimal mock NextRequest for DELETE with a search param.
 */
function createCancelRequest(id: string | null): NextRequest {
  return {
    method: 'DELETE',
    nextUrl: {
      searchParams: new URLSearchParams(id ? `id=${id}` : ''),
    },
  } as unknown as NextRequest;
}

/**
 * Build a thenable Drizzle-like query chain.
 */
function createChain<T = unknown>(resultsQueue: T[]) {
  let index = 0;
  const chain: Record<string, unknown> & { then: (resolve: (value: T) => void) => void } = {
    then: (resolve: (value: T) => void) => resolve(resultsQueue[index++] ?? ([] as unknown as T)),
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  };
  return chain;
}

// ─── Fixtures ─────────────────────────────────────────────

const CORRECTION_REQUEST = {
  id: '00000000-0000-0000-0000-000000000010',
  organizationId: 'org-1',
  userId: 'user-1',            // Owned by user-1 (matches the mock auth user)
  timeEntryId: '00000000-0000-0000-0000-000000000001',
  taskId: '00000000-0000-0000-0000-000000000002',
  originalMinutes: 120,
  requestedMinutes: 150,
  status: 'pending',
};

const OTHER_USERS_REQUEST = {
  ...CORRECTION_REQUEST,
  id: '00000000-0000-0000-0000-000000000011',
  userId: 'user-2',            // Owned by another user
};

const REVIEWED_REQUEST = {
  ...CORRECTION_REQUEST,
  id: '00000000-0000-0000-0000-000000000012',
  status: 'approved',
};

const USER_WITH_MANAGER = {
  id: 'user-1',
  reportingManagerId: 'manager-1',
};

const USER_WITHOUT_MANAGER = {
  id: 'user-1',
  reportingManagerId: null,
};

const TIME_ENTRY = {
  id: '00000000-0000-0000-0000-000000000001',
  userId: 'user-1',
  taskId: '00000000-0000-0000-0000-000000000002',
  durationMinutes: 120,
  endTime: '2026-07-21T10:00:00Z',
  taskOrgId: 'org-1',
};

const CROSS_ORG_TIME_ENTRY = {
  ...TIME_ENTRY,
  taskOrgId: 'org-99',
};

const OTHER_USERS_TIME_ENTRY = {
  ...TIME_ENTRY,
  userId: 'user-2',
};

const CORRECTION_REQUEST_DECREASE = {
  ...CORRECTION_REQUEST,
  id: '00000000-0000-0000-0000-000000000020',
  originalMinutes: 120,
  requestedMinutes: 60,
};

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Validation ───────────────────────────────────────────

describe('DELETE /api/time-corrections — validation', () => {
  it('returns 400 when id param is missing', async () => {
    const res = await DELETE(createCancelRequest(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when id param is empty string', async () => {
    const res = await DELETE(createCancelRequest(''));
    expect(res.status).toBe(400);
  });
});

// ─── Not Found ────────────────────────────────────────────

describe('DELETE /api/time-corrections — not found', () => {
  it('returns 404 when correction request does not exist', async () => {
    mockDb.mockReturnValue(createChain([[]])); // Empty result — not found
    const res = await DELETE(createCancelRequest(CORRECTION_REQUEST.id));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── Authorization — Cross-Org ───────────────────────────

describe('DELETE /api/time-corrections — cross-org access', () => {
  it('returns 403 when request belongs to another organization', async () => {
    const crossOrgReq = { ...CORRECTION_REQUEST, organizationId: 'org-2' };
    mockDb.mockReturnValue(createChain([[crossOrgReq]]));
    const res = await DELETE(createCancelRequest(CORRECTION_REQUEST.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ─── Authorization — Ownership ───────────────────────────

describe('DELETE /api/time-corrections — ownership', () => {
  it('returns 403 when a different user tries to cancel', async () => {
    mockDb.mockReturnValue(createChain([[OTHER_USERS_REQUEST]]));
    const res = await DELETE(createCancelRequest(OTHER_USERS_REQUEST.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('only cancel your own');
  });
});

// ─── State Check ──────────────────────────────────────────

describe('DELETE /api/time-corrections — state check', () => {
  it('returns 422 when the request was already reviewed (not pending)', async () => {
    mockDb.mockReturnValue(createChain([[REVIEWED_REQUEST]]));
    const res = await DELETE(createCancelRequest(REVIEWED_REQUEST.id));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_STATE');
    expect(body.error.message).toContain('already been reviewed');
  });
});

// ─── Success Paths ────────────────────────────────────────

describe('DELETE /api/time-corrections — success', () => {
  it('cancels own pending request and returns success', async () => {
    // Queue: [find request, update status, find manager]
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST],     // Query 1: request found (owned by user-1, pending)
        [],                       // Query 2: status updated to cancelled
        [USER_WITH_MANAGER],      // Query 3: user has a reporting manager
      ]),
    );

    const res = await DELETE(createCancelRequest(CORRECTION_REQUEST.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('cancelled');

    // Verify status was set to cancelled (not approved/rejected)
    expect(mockDb).toHaveBeenCalledTimes(3);
  });

  it('sets status to cancelled (not approved/rejected)', async () => {
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST],
        [],
        [USER_WITH_MANAGER],
      ]),
    );

    await DELETE(createCancelRequest(CORRECTION_REQUEST.id));

    // Extract the update chain call to verify the set() value
    const chain = mockDb.mock.results[0]?.value as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' }),
    );
  });

  it('does NOT update time entries or recalc hours on cancel', async () => {
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST],
        [],
        [USER_WITH_MANAGER],
      ]),
    );

    await DELETE(createCancelRequest(CORRECTION_REQUEST.id));

    // Only correction request update, no time entry updates
    expect(mockRecalcTaskHours).not.toHaveBeenCalled();
  });

  it('notifies manager when user has a reporting manager', async () => {
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST],
        [],
        [USER_WITH_MANAGER],   // User has manager-1 as reporting manager
      ]),
    );

    await DELETE(createCancelRequest(CORRECTION_REQUEST.id));

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      userId: 'manager-1',
      organizationId: 'org-1',
      type: 'time_correction_cancelled',
      title: 'Correction cancelled',
      message: expect.stringContaining('cancelled their time correction request (120m → 150m)'),
      link: '/timer',
      actorId: 'user-1',
      entityType: 'time_correction',
      entityId: CORRECTION_REQUEST.id,
    });
  });

  it('skips notification when user has no reporting manager', async () => {
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST],
        [],
        [USER_WITHOUT_MANAGER],  // User has no reporting manager
      ]),
    );

    await DELETE(createCancelRequest(CORRECTION_REQUEST.id));

    // Notification should not be sent
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('uses the user name in the notification message', async () => {
    // The withAuth mock passes user = { id: 'user-1', name: 'Test User' }
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST],
        [],
        [USER_WITH_MANAGER],
      ]),
    );

    await DELETE(createCancelRequest(CORRECTION_REQUEST.id));

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Test User'),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/time-corrections — List correction requests
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/time-corrections — list', () => {
  it('filters by pending status', async () => {
    mockDb.mockReturnValue(
      createChain([
        [
          {
            ...CORRECTION_REQUEST,
            user: { id: 'user-1', name: 'Employee' },
            task: { id: 'task-1', title: 'Task', taskIdDisplay: 'TASK-1' },
          },
        ],
        [{ count: 1 }],
      ]),
    );
    const res = await GET(createRequest('GET', '', 'status=pending', undefined));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].status).toBe('pending');
    expect(body.pendingCount).toBe(1);
    expect(body.total).toBe(1);
  });

  it('filters by rejected status', async () => {
    mockDb.mockReturnValue(
      createChain([
        [
          {
            ...CORRECTION_REQUEST,
            status: 'rejected',
            reviewedBy: 'manager-1',
            reviewedAt: '2026-07-21T13:00:00Z',
            user: { id: 'user-1', name: 'Employee' },
            task: { id: 'task-1', title: 'Task', taskIdDisplay: 'TASK-1' },
          },
        ],
        [{ count: 0 }],
      ]),
    );
    const res = await GET(createRequest('GET', '', 'status=rejected', undefined));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].status).toBe('rejected');
    expect(body.pendingCount).toBe(0);
  });

  it('silently ignores invalid status filter (no filter applied)', async () => {
    mockDb.mockReturnValue(
      createChain([
        [{ ...CORRECTION_REQUEST, user: { id: 'user-1', name: 'Employee' }, task: { id: 'task-1', title: 'Task', taskIdDisplay: 'TASK-1' } }],
        [{ count: 1 }],
      ]),
    );
    const res = await GET(createRequest('GET', '', 'status=unknown', undefined));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(1);
    // Unknown status is silently skipped — all pending requests still returned
    expect(body.requests[0].status).toBe('pending');
  });

  it('returns empty array when no requests match', async () => {
    mockDb.mockReturnValue(
      createChain([
        [],
        [{ count: 0 }],
      ]),
    );
    const res = await GET(createRequest('GET', '', undefined, undefined));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(0);
    expect(body.pendingCount).toBe(0);
    expect(body.total).toBe(0);
  });

  it('returns 500 when db() throws', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('DB connection failed');
    });
    const res = await GET(createRequest('GET', '', undefined, undefined));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body).toHaveProperty('message');
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/time-corrections — Create correction request
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/time-corrections — create', () => {
  it('returns 400 for missing required fields', async () => {
    const res = await POST(createRequest('POST', '', undefined, {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    // validationError returns the error object directly, not wrapped in { error: ... }
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid timeEntryId (not a UUID)', async () => {
    const res = await POST(
      createRequest('POST', '', undefined, {
        timeEntryId: 'not-a-uuid',
        requestedMinutes: 150,
        reason: 'Test reason',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when time entry does not exist', async () => {
    mockDb.mockReturnValue(createChain([[]])); // Empty result
    const res = await POST(
      createRequest('POST', '', undefined, {
        timeEntryId: '00000000-0000-0000-0000-000000000001',
        requestedMinutes: 150,
        reason: 'Need to adjust',
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when time entry belongs to another organization', async () => {
    mockDb.mockReturnValue(createChain([[CROSS_ORG_TIME_ENTRY]]));
    const res = await POST(
      createRequest('POST', '', undefined, {
        timeEntryId: '00000000-0000-0000-0000-000000000001',
        requestedMinutes: 150,
        reason: 'Need to adjust',
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when trying to correct another user\'s time entry', async () => {
    mockDb.mockReturnValue(createChain([[OTHER_USERS_TIME_ENTRY]]));
    const res = await POST(
      createRequest('POST', '', undefined, {
        timeEntryId: '00000000-0000-0000-0000-000000000001',
        requestedMinutes: 150,
        reason: 'Need to adjust',
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('your own');
  });

  it('returns 500 when insert returns nothing', async () => {
    // DB: [find entry, check duplicate, insert → empty]
    mockDb.mockReturnValue(
      createChain([
        [TIME_ENTRY],
        [],
        [], // insert returns empty → newRequest is undefined
      ]),
    );
    const res = await POST(
      createRequest('POST', '', undefined, {
        timeEntryId: '00000000-0000-0000-0000-000000000001',
        requestedMinutes: 150,
        reason: 'Need to adjust',
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('skips notification when user has no reporting manager', async () => {
    mockDb.mockReturnValue(
      createChain([
        [TIME_ENTRY],
        [],
        [CORRECTION_REQUEST],
        [{ ...USER_WITHOUT_MANAGER }], // No reporting manager
      ]),
    );
    await POST(
      createRequest('POST', '', undefined, {
        timeEntryId: '00000000-0000-0000-0000-000000000001',
        requestedMinutes: 150,
        reason: 'Need to adjust',
      }),
    );
    // Notification should not be sent
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('returns 500 when db() throws', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('DB error');
    });
    const res = await POST(
      createRequest('POST', '', undefined, {
        timeEntryId: '00000000-0000-0000-0000-000000000001',
        requestedMinutes: 150,
        reason: 'Need to adjust',
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('message');
  });
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /api/time-corrections — Approve or reject
// ═══════════════════════════════════════════════════════════════════

describe('PATCH /api/time-corrections — approve/reject', () => {
  it('returns 400 when id param is missing', async () => {
    const res = await PATCH(createRequest('PATCH', '', undefined, { status: 'approved' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid body (missing status)', async () => {
    const res = await PATCH(createRequest('PATCH', '', 'id=123', {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    // validationError returns the error object directly
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid body (unknown status)', async () => {
    const res = await PATCH(
      createRequest('PATCH', '', 'id=00000000-0000-0000-0000-000000000010', { status: 'unknown' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when correction request does not exist', async () => {
    mockDb.mockReturnValue(createChain([[]]));
    const res = await PATCH(
      createRequest('PATCH', '', `id=${CORRECTION_REQUEST.id}`, { status: 'approved' }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when request belongs to another organization', async () => {
    const crossOrgReq = { ...CORRECTION_REQUEST, organizationId: 'org-2' };
    mockDb.mockReturnValue(createChain([[crossOrgReq]]));
    const res = await PATCH(
      createRequest('PATCH', '', `id=${CORRECTION_REQUEST.id}`, { status: 'approved' }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 when request was already reviewed', async () => {
    mockDb.mockReturnValue(createChain([[REVIEWED_REQUEST]]));
    const res = await PATCH(
      createRequest('PATCH', '', `id=${REVIEWED_REQUEST.id}`, { status: 'approved' }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_STATE');
    expect(body.error.message).toContain('already been reviewed');
  });

  it('returns 500 when requirePermission throws', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Permission denied'));
    mockDb.mockReturnValue(createChain([[CORRECTION_REQUEST]]));
    const res = await PATCH(
      createRequest('PATCH', '', `id=${CORRECTION_REQUEST.id}`, { status: 'approved' }),
    );
    expect(res.status).toBe(500);
  });

  it('returns increase correction reason when requestedMinutes > originalMinutes', async () => {
    mockRequirePermission.mockResolvedValue(undefined);
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST], // 120 → 150 (increase)
        [],                   // update time entry
        [],                   // update status
      ]),
    );
    await PATCH(
      createRequest('PATCH', '', `id=${CORRECTION_REQUEST.id}`, { status: 'approved' }),
    );
    // Verify the chain's set method was called with increase reason
    const chain = mockDb.mock.results[0]?.value as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        correctionReason: expect.stringContaining('increased from 120m to 150m'),
      }),
    );
  });

  it('returns decrease correction reason when requestedMinutes < originalMinutes', async () => {
    mockRequirePermission.mockResolvedValue(undefined);
    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST_DECREASE], // 120 → 60 (decrease)
        [],                            // update time entry
        [],                            // update status
      ]),
    );
    await PATCH(
      createRequest('PATCH', '', `id=${CORRECTION_REQUEST_DECREASE.id}`, { status: 'approved' }),
    );
    const chain = mockDb.mock.results[0]?.value as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        correctionReason: expect.stringContaining('decreased from 120m to 60m'),
      }),
    );
  });

  it('returns 500 when db() throws', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('DB error');
    });
    const res = await PATCH(
      createRequest('PATCH', '', `id=${CORRECTION_REQUEST.id}`, { status: 'approved' }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('message');
  });
});

// ─── Error Handling ───────────────────────────────────────

describe('DELETE /api/time-corrections — error handling', () => {
  it('returns 500 when db() throws', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const res = await DELETE(createCancelRequest(CORRECTION_REQUEST.id));
    expect(res.status).toBe(500);
  });

  it('returns consistent error shape on failure', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('DB error');
    });

    const res = await DELETE(createCancelRequest(CORRECTION_REQUEST.id));
    const body = await res.json();
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body).toHaveProperty('message');
  });

  it('calls handleApiError with the correct message', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('DB error');
    });

    await DELETE(createCancelRequest(CORRECTION_REQUEST.id));

    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to cancel correction request',
    );
  });
});
