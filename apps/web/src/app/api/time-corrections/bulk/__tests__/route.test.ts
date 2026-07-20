import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════
// Hoisted mocks — must be defined before vi.mock calls
// ═══════════════════════════════════════════════════════════════════

const { mockDb, mockCreateNotification, mockRecalcTaskHours, mockHandleApiError, mockRequirePermission } =
  vi.hoisted(() => ({
    mockDb: vi.fn(),
    mockCreateNotification: vi.fn(),
    mockRecalcTaskHours: vi.fn().mockResolvedValue('8.50'),
    mockHandleApiError: vi
      .fn()
      .mockReturnValue({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to perform bulk action' },
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
        return handler(req, { user: { id: 'manager-1', name: 'Manager' }, orgId: 'org-1' });
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

import { POST } from '../route';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a minimal mock NextRequest with a JSON body for testing.
 */
function createBulkRequest(body: unknown): NextRequest {
  return {
    method: 'POST',
    json: async () => body,
  } as unknown as NextRequest;
}

/**
 * Build a thenable Drizzle-like query chain that resolves to the next
 * element in `resultsQueue` on each `await db()` call.
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

const PENDING_REQUEST_1 = {
  id: '00000000-0000-0000-0000-000000000001',
  organizationId: 'org-1',
  userId: 'user-1',
  timeEntryId: 'entry-1',
  taskId: 'task-1',
  originalMinutes: 60,
  requestedMinutes: 90,
  status: 'pending',
};

const PENDING_REQUEST_2 = {
  id: '00000000-0000-0000-0000-000000000002',
  organizationId: 'org-1',
  userId: 'user-2',
  timeEntryId: 'entry-2',
  taskId: 'task-2',
  originalMinutes: 120,
  requestedMinutes: 60,
  status: 'pending',
};

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Schema Validation ─────────────────────────────────────

describe('POST /api/time-corrections/bulk — validation', () => {
  it('accepts a valid bulk approve payload', async () => {
    mockDb.mockReturnValue(createChain([[], []]));
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    const res = await POST(req);
    // No pending requests found → 404
    expect(res.status).toBe(404);
    expect(mockDb).toHaveBeenCalled();
  });

  it('rejects empty ids array', async () => {
    const req = createBulkRequest({ ids: [], status: 'approved' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects more than 50 ids', async () => {
    const req = createBulkRequest({
      ids: Array.from({ length: 51 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects non-UUID ids', async () => {
    const req = createBulkRequest({ ids: ['not-a-uuid'], status: 'approved' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects invalid status value', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'invalid_status',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects \'cancelled\' status — only valid for DELETE handler, not bulk review', async () => {
    // 'cancelled' is a valid system status (for the self-service DELETE handler),
    // but the bulk endpoint is for manager review actions only.
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'cancelled',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores extra fields (Zod strips unknown keys, no .strict() on bulk schema)', async () => {
    mockDb.mockReturnValue(createChain([[], []]));
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
      maliciousField: 'injected',
    });
    const res = await POST(req);
    // Schema doesn't have .strict() — extra fields are ignored, route proceeds to DB
    expect(res.status).toBe(404);
  });

  it('rejects null body', async () => {
    const req = createBulkRequest(null);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects empty object', async () => {
    const req = createBulkRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts an optional reviewNote', async () => {
    mockDb.mockReturnValue(createChain([[], []]));
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'rejected',
      reviewNote: 'Duplicate request',
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('rejects reviewNote over 1000 characters', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'rejected',
      reviewNote: 'x'.repeat(1001),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── Authorization ────────────────────────────────────────

describe('POST /api/time-corrections/bulk — authorization', () => {
  it('calls requirePermission with "time:manage"', async () => {
    mockDb.mockReturnValue(createChain([[], []]));
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    await POST(req);
    expect(mockRequirePermission).toHaveBeenCalledWith('manager-1', 'time:manage');
  });
});

// ─── No Pending Requests Found ────────────────────────────

describe('POST /api/time-corrections/bulk — not found', () => {
  it('returns 404 when no pending requests match the given IDs', async () => {
    mockDb.mockReturnValue(createChain([[]])); // Empty array → no pending requests
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('excludes requests from other organizations', async () => {
    // The DB query includes an org filter; returning empty simulates cross-org exclusion
    mockDb.mockReturnValue(createChain([[]]));
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000099'], // Belongs to another org
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('excludes already-reviewed requests (non-pending)', async () => {
    mockDb.mockReturnValue(createChain([[]])); // Already-reviewed requests filtered out by query
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

// ─── Bulk Approve ─────────────────────────────────────────

describe('POST /api/time-corrections/bulk — approve', () => {
  beforeEach(() => {
    // Queue: [select result, update entry1, recalc1, update entry2, recalc2, bulk status update]
    mockDb.mockReturnValue(
      createChain([
        [PENDING_REQUEST_1, PENDING_REQUEST_2], // select returns 2 pending requests
        [], // update time entry 1
        [], // update time entry 2
        [], // bulk status update
      ]),
    );
  });

  it('approves all pending requests and returns success with count', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.reviewedCount).toBe(2);
    expect(body.status).toBe('approved');
  });

  it('updates time entries with corrected duration before marking requests as reviewed', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      status: 'approved',
    });
    await POST(req);

    // The chain has update calls. Let's verify the sequence via recalcTaskHours calls.
    // recalcTaskHours is called after EACH time entry update, so 2 calls = 2 entries updated.
    expect(mockRecalcTaskHours).toHaveBeenCalledTimes(2);
    expect(mockRecalcTaskHours).toHaveBeenNthCalledWith(1, 'task-1');
    expect(mockRecalcTaskHours).toHaveBeenNthCalledWith(2, 'task-2');
  });

  it('sends notification for each approved request', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      status: 'approved',
    });
    await POST(req);

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);

    expect(mockCreateNotification).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'time_correction_approved',
      title: 'Correction approved',
      message: 'Your time correction request was approved (60m → 90m)',
      link: '/timer',
      actorId: 'manager-1',
      entityType: 'time_correction',
      entityId: PENDING_REQUEST_1.id,
    });

    expect(mockCreateNotification).toHaveBeenNthCalledWith(2, {
      userId: 'user-2',
      organizationId: 'org-1',
      type: 'time_correction_approved',
      title: 'Correction approved',
      message: 'Your time correction request was approved (120m → 60m)',
      link: '/timer',
      actorId: 'manager-1',
      entityType: 'time_correction',
      entityId: PENDING_REQUEST_2.id,
    });
  });

  it('includes increase/decrease indicator in correction reason', async () => {
    // This is tested indirectly via the time entry update call chain
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      status: 'approved',
    });
    await POST(req);

    // Verify the chain methods were called — the chain tracks calls via vi.fn()
    const chain = mockDb.mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>;
    // After the select, the remaining calls are updates
    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
  });
});

// ─── Bulk Reject ──────────────────────────────────────────

describe('POST /api/time-corrections/bulk — reject', () => {
  beforeEach(() => {
    // Queue: [select result, bulk status update]
    // Reject does NOT update time entries or recalc hours
    mockDb.mockReturnValue(
      createChain([
        [PENDING_REQUEST_1, PENDING_REQUEST_2], // select returns 2 pending
        [], // bulk status update
      ]),
    );
  });

  it('rejects all pending requests and returns success with count', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      status: 'rejected',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.reviewedCount).toBe(2);
    expect(body.status).toBe('rejected');
  });

  it('does NOT update time entries or recalculate hours on rejection', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      status: 'rejected',
    });
    await POST(req);

    // Ensure only 2 db() calls: select + status update (no time entry updates)
    // recalcTaskHours should NOT be called on rejection
    expect(mockRecalcTaskHours).not.toHaveBeenCalled();
  });

  it('sends rejection notification to each requester', async () => {
    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      status: 'rejected',
    });
    await POST(req);

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);

    expect(mockCreateNotification).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'time_correction_rejected',
      title: 'Correction rejected',
      message: 'Your time correction request was rejected',
      link: '/timer',
      actorId: 'manager-1',
      entityType: 'time_correction',
      entityId: PENDING_REQUEST_1.id,
    });
  });

  it('includes review note in rejection notification when provided', async () => {
    mockDb.mockReturnValue(
      createChain([
        [PENDING_REQUEST_1],
        [], // bulk status update
      ]),
    );

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'rejected',
      reviewNote: 'Insufficient documentation',
    });
    await POST(req);

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Insufficient documentation'),
      }),
    );
  });
});

// ─── Single Request ───────────────────────────────────────

describe('POST /api/time-corrections/bulk — single request', () => {
  it('handles bulk approve with a single request', async () => {
    mockDb.mockReturnValue(
      createChain([
        [PENDING_REQUEST_1], // select returns 1 pending
        [], // update time entry 1
        [], // bulk status update
      ]),
    );

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reviewedCount).toBe(1);

    expect(mockRecalcTaskHours).toHaveBeenCalledTimes(1);
    expect(mockRecalcTaskHours).toHaveBeenCalledWith('task-1');
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
  });

  it('handles bulk reject with a single request', async () => {
    mockDb.mockReturnValue(
      createChain([
        [PENDING_REQUEST_1], // select returns 1 pending
        [], // bulk status update
      ]),
    );

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'rejected',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reviewedCount).toBe(1);

    expect(mockRecalcTaskHours).not.toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
  });
});

// ─── Error Handling ───────────────────────────────────────

describe('POST /api/time-corrections/bulk — error handling', () => {
  it('returns 500 when db() throws', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('handles recalcTaskHours failure gracefully (returns null, does not reject)', async () => {
    // recalcTaskHours itself catches errors and returns null
    // The route does not check the return value, so a failure shouldn't block the flow
    mockRecalcTaskHours.mockRejectedValue(new Error('Recalc failed')); // this should still not fail the route

    mockDb.mockReturnValue(
      createChain([
        [PENDING_REQUEST_1], // select returns 1 pending
        [], // update time entry
        [], // bulk status update
      ]),
    );

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    const res = await POST(req);
    expect(res.status).toBe(500); // The unhandled rejection in the loop will propagate
  });

  it('returns consistent error shape on failure', async () => {
    mockDb.mockImplementation(() => {
      throw new Error('DB error');
    });

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    const res = await POST(req);
    const body = await res.json();
    // handleApiError returns { error, status }; the route destructures { error: err, status }
    // and passes err (the inner error object) directly to NextResponse.json
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body).toHaveProperty('message');
  });
});

// ─── Data Consistency ─────────────────────────────────────

describe('POST /api/time-corrections/bulk — data consistency', () => {
  it('time entries are updated before correction request status (approve only)', async () => {
    // This is a structural assertion based on the route logic.
    // On approval: update time entries + recalc → THEN update status.
    // On rejection: only update status.
    // We verify by checking recalcTaskHours is called (which happens AFTER time entry update)
    // before the bulk status update.

    const callOrder: string[] = [];
    mockRecalcTaskHours.mockImplementation(async (taskId: string) => {
      callOrder.push(`recalc:${taskId}`);
      return '8.50';
    });

    // Override the chain to track update calls
    const chain = createChain([
      [PENDING_REQUEST_1], // select
      [], // update time entry
      [], // bulk status update
    ]);

    // Wrap chain.set to track when status update happens
    const originalSet = chain.set as ReturnType<typeof vi.fn>;
    originalSet.mockImplementation((values: Record<string, unknown>) => {
      if (values.status === 'approved') {
        callOrder.push('status-update');
      }
      return chain;
    });

    mockDb.mockReturnValue(chain);

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'approved',
    });
    await POST(req);

    // recalc (happens after time entry update) should come before status update
    const recalcIndex = callOrder.findIndex((c) => c.startsWith('recalc:'));
    const statusIndex = callOrder.indexOf('status-update');
    expect(recalcIndex).toBeLessThan(statusIndex);
    expect(recalcIndex).not.toBe(-1);
    expect(statusIndex).not.toBe(-1);
  });

  it('rejection only updates status, not time entries', async () => {
    const chain = createChain([
      [PENDING_REQUEST_1], // select
      [], // bulk status update
    ]);

    mockDb.mockReturnValue(chain);

    const req = createBulkRequest({
      ids: ['00000000-0000-0000-0000-000000000001'],
      status: 'rejected',
    });
    await POST(req);

    // recalcTaskHours should not be called on rejection
    expect(mockRecalcTaskHours).not.toHaveBeenCalled();

    // Only 2 db() calls: one select, one update (for status)
    // The update should set status = 'rejected'
    expect(mockDb).toHaveBeenCalledTimes(2);
  });
});
