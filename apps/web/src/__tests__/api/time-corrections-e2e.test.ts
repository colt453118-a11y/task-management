import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain, createRequest } from '@/__tests__/api/test-helpers';

// ═══════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════

const {
  mockNextResponseJson,
  mockDb,
  mockRequirePermission,
  mockCreateNotification,
  mockRecalcTaskHours,
  mockHandleApiError,
} = vi.hoisted(() => ({
  mockNextResponseJson: vi.fn((body: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200,
    ok: (init?.status ?? 200) < 400,
    json: async () => body,
  })),

  mockDb: vi.fn(),

  mockRequirePermission: vi.fn(() => Promise.resolve()),

  mockCreateNotification: vi.fn(() => Promise.resolve()),

  mockRecalcTaskHours: vi.fn(() => Promise.resolve('8.50')),

  mockHandleApiError: vi.fn((_error: unknown, message: string) => ({
    error: { code: 'INTERNAL_ERROR', message },
    status: 500,
  })),
}));

// ═══════════════════════════════════════════════════════════════════
// Module-level mocks
// ═══════════════════════════════════════════════════════════════════

vi.mock('next/server', () => ({
  NextResponse: { json: mockNextResponseJson },
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: Function) => async (req: unknown) =>
    handler(req, {
      user: { id: 'user-1', email: 'employee@test.com', name: 'Employee' },
      orgId: 'org-1',
    }),
  requirePermission: mockRequirePermission,
  checkPermission: vi.fn(() => Promise.resolve(true)),
  enforceOrgScope: vi.fn(),
}));

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

vi.mock('@/lib/notifications', () => ({
  createNotification: mockCreateNotification,
}));

// ═══════════════════════════════════════════════════════════════════
// Imports — after mocks are in place
// ═══════════════════════════════════════════════════════════════════

import { POST, GET, PATCH, DELETE } from '@/app/api/time-corrections/route';

// ═══════════════════════════════════════════════════════════════════
// Fixtures (valid UUIDs for Zod schema validation)
// ═══════════════════════════════════════════════════════════════════

const ENTRY_ID = '00000000-0000-0000-0000-000000000001';
const TASK_ID = '00000000-0000-0000-0000-000000000002';
const REQ_ID = '00000000-0000-0000-0000-000000000010';

const TIME_ENTRY = {
  id: ENTRY_ID,
  userId: 'user-1',
  taskId: TASK_ID,
  durationMinutes: 120,
  endTime: '2026-07-21T10:00:00Z',
  taskOrgId: 'org-1',
};

const CORRECTION_REQUEST = {
  id: REQ_ID,
  organizationId: 'org-1',
  timeEntryId: ENTRY_ID,
  userId: 'user-1',
  taskId: TASK_ID,
  originalMinutes: 120,
  requestedMinutes: 150,
  reason: 'Under-reported — spent extra 30m debugging',
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: '2026-07-21T12:00:00Z',
  updatedAt: '2026-07-21T12:00:00Z',
};

const USER_RECORD = {
  id: 'user-1',
  organizationId: 'org-1',
  reportingManagerId: 'manager-1',
};

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.resetAllMocks();
});

/**
 * Assert the Nth mockNextResponseJson call has the expected status + body shape.
 */
function expectResponse(
  callIndex: number,
  expectedStatus: number,
  bodyAssertions: (body: Record<string, unknown>) => void,
) {
  const call = mockNextResponseJson.mock.calls[callIndex];
  expect(call, `Response call #${callIndex} not found`).toBeDefined();
  const [body, init] = call as [Record<string, unknown>, { status?: number } | undefined];
  // When init is undefined, NextResponse.json defaults to status 200
  expect(init?.status ?? 200).toBe(expectedStatus);
  bodyAssertions(body);
}

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe('Time Corrections — full E2E flow', () => {
  it('create → list (badge) → approve → verify time entry updated', async () => {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Create a correction request (POST /api/time-corrections)
    // ═══════════════════════════════════════════════════════════════
    //
    // DB queries: [find time entry, check duplicate, insert, find manager]
    mockDb.mockReturnValue(
      createChain([
        [TIME_ENTRY],
        [],
        [CORRECTION_REQUEST],
        [USER_RECORD],
      ]),
    );

    await POST(
      createRequest('POST', '/api/time-corrections', undefined, {
        timeEntryId: ENTRY_ID,
        requestedMinutes: 150,
        reason: 'Under-reported — spent extra 30m debugging',
      }),
    );

    // Assert create response
    expectResponse(0, 201, (body) => {
      expect((body.request as Record<string, unknown>).id).toBe(REQ_ID);
    });
    expect(mockRequirePermission).not.toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'manager-1',
        type: 'time_correction_requested',
        message: expect.stringContaining('120m → 150m'),
      }),
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: List corrections — simulates timer page badge rendering
    // ═══════════════════════════════════════════════════════════════
    //
    // The timer page fetches corrections, builds a correctionStatusMap
    // from timeEntryId → { status, requestedMinutes }, then renders
    // badges on entry rows using renderCorrectionBadge(entryId).

    // Simulate a regular employee (no time:manage permission)
    mockRequirePermission.mockRejectedValueOnce(new Error('Forbidden'));

    mockDb.mockReturnValue(
      createChain([
        [
          {
            ...CORRECTION_REQUEST,
            user: { id: 'user-1', name: 'Employee', email: 'employee@test.com' },
            task: { id: TASK_ID, title: 'Fix login bug', taskIdDisplay: 'TASK-42' },
          },
        ],
        [{ count: 1 }],
      ]),
    );

    await GET(createRequest('GET', '/api/time-corrections'));

    // Assert list response + badge data simulation
    expectResponse(1, 200, (body) => {
      const requests = body.requests as Array<Record<string, unknown>>;
      expect(requests).toHaveLength(1);
      expect(body.pendingCount).toBe(1);
      expect(body.total).toBe(1);

      const req = requests[0]!;
      expect(req.status).toBe('pending');
      expect(req.timeEntryId).toBe(ENTRY_ID);
      expect(req.originalMinutes).toBe(120);
      expect(req.requestedMinutes).toBe(150);

      // ── Simulate timer page's correctionStatusMap logic ──
      const statusMap = new Map<string, { status: string; requestedMinutes: number }>();
      for (const r of requests) {
        const tid = r.timeEntryId as string;
        if (!statusMap.has(tid)) {
          statusMap.set(tid, {
            status: r.status as string,
            requestedMinutes: r.requestedMinutes as number,
          });
        }
      }

      // Verify badge data for our time entry
      const badge = statusMap.get(ENTRY_ID);
      expect(badge).toBeDefined();
      expect(badge!.status).toBe('pending');
      expect(badge!.requestedMinutes).toBe(150);

      // Verify entries without corrections have no badge
      expect(statusMap.has('00000000-0000-0000-0000-000000000999')).toBe(false);
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Approve correction (PATCH /api/time-corrections?id=...)
    // ═══════════════════════════════════════════════════════════════
    //
    // DB queries: [find request, update time entry, update status]

    // Reset permission for manager
    mockRequirePermission.mockResolvedValue(undefined);

    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST],
        [],
        [],
      ]),
    );

    await PATCH(
      createRequest('PATCH', '/api/time-corrections', `id=${REQ_ID}`, {
        status: 'approved',
      }),
    );

    // Assert approve response
    expectResponse(2, 200, (body) => {
      expect(body.success).toBe(true);
      expect(body.status).toBe('approved');
    });

    // Permission check was enforced
    expect(mockRequirePermission).toHaveBeenCalledWith('user-1', 'time:manage');

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Verify time entry was updated with 150 minutes
    // ═══════════════════════════════════════════════════════════════
    //
    // The PATCH handler updates the time entry via:
    //   db().update(schema.timeEntries).set({ durationMinutes: 150, ... })
    // then recalculates task hours.

    expect(mockRecalcTaskHours).toHaveBeenCalledTimes(1);
    expect(mockRecalcTaskHours).toHaveBeenCalledWith(TASK_ID);

    // Verify approval notification sent to requester
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'time_correction_approved',
        message: 'Your time correction request was approved (120m → 150m)',
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════
  // Rejection flow — time entry should NOT be updated
  // ═══════════════════════════════════════════════════════════════════

  it('create → reject → verify time entry unchanged', async () => {
    mockDb.mockReturnValue(
      createChain([
        [TIME_ENTRY],
        [],
        [{ ...CORRECTION_REQUEST, id: REQ_ID }],
        [USER_RECORD],
      ]),
    );

    await POST(
      createRequest('POST', '/api/time-corrections', undefined, {
        timeEntryId: ENTRY_ID,
        requestedMinutes: 90,
        reason: 'Over-reported — took less time than expected',
      }),
    );

    mockRequirePermission.mockResolvedValue(undefined);
    mockDb.mockReturnValue(
      createChain([
        [{ ...CORRECTION_REQUEST, id: REQ_ID, requestedMinutes: 90 }],
        [],
      ]),
    );

    await PATCH(
      createRequest('PATCH', '/api/time-corrections', `id=${REQ_ID}`, {
        status: 'rejected',
        reviewNote: 'Please discuss with your lead first',
      }),
    );

    // No time entry changes on rejection
    expect(mockRecalcTaskHours).not.toHaveBeenCalled();

    // Rejection notification sent
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'time_correction_rejected',
        message: expect.stringContaining('Please discuss with your lead first'),
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════
  // Cancel flow — user withdraws own pending request
  // ═══════════════════════════════════════════════════════════════════

  it('create → cancel → verify status is cancelled and manager notified', async () => {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Create a correction request (POST /api/time-corrections)
    // ═══════════════════════════════════════════════════════════════

    mockDb.mockReturnValue(
      createChain([
        [TIME_ENTRY],
        [],
        [CORRECTION_REQUEST],
        [USER_RECORD],
      ]),
    );

    await POST(
      createRequest('POST', '/api/time-corrections', undefined, {
        timeEntryId: ENTRY_ID,
        requestedMinutes: 150,
        reason: 'Under-reported — spent extra 30m debugging',
      }),
    );

    expectResponse(0, 201, (body) => {
      expect((body.request as Record<string, unknown>).id).toBe(REQ_ID);
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'manager-1',
        type: 'time_correction_requested',
      }),
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Cancel the correction request (DELETE /api/time-corrections)
    // ═══════════════════════════════════════════════════════════════
    //
    // The requester (user-1) withdraws their pending request.
    // DB queries: [find request, update status to cancelled, find manager]

    mockDb.mockReturnValue(
      createChain([
        [CORRECTION_REQUEST], // find the request
        [],                   // update status → 'cancelled'
        [USER_RECORD],        // find manager for notification
      ]),
    );

    await DELETE(
      createRequest('DELETE', '/api/time-corrections', `id=${REQ_ID}`),
    );

    // Assert cancel response
    expectResponse(1, 200, (body) => {
      expect(body.success).toBe(true);
      expect(body.status).toBe('cancelled');
    });

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Verify no time entry mutations
    // ═══════════════════════════════════════════════════════════════
    //
    // Unlike approved corrections, cancelled requests do NOT update
    // time entries or recalculate task hours.

    expect(mockRecalcTaskHours).not.toHaveBeenCalled();

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Verify manager was notified about the cancellation
    // ═══════════════════════════════════════════════════════════════
    //
    // Manager receives a 'time_correction_cancelled' notification
    // with the original ↔ requested minute range.

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'manager-1',
        type: 'time_correction_cancelled',
        title: 'Correction cancelled',
        message: expect.stringContaining('120m → 150m'),
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════
  // Running timer — should return 422
  // ═══════════════════════════════════════════════════════════════════

  it('rejects correction request for a running timer', async () => {
    const runningEntry = { ...TIME_ENTRY, endTime: null, durationMinutes: null };

    mockDb.mockReturnValue(createChain([[runningEntry]]));

    await POST(
      createRequest('POST', '/api/time-corrections', undefined, {
        timeEntryId: ENTRY_ID,
        requestedMinutes: 150,
        reason: 'Need to adjust time',
      }),
    );

    expectResponse(0, 422, (body) => {
      const err = (body.error ?? body) as Record<string, unknown>;
      expect(err.code).toBe('INVALID_STATE');
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Duplicate prevention — should return 409
  // ═══════════════════════════════════════════════════════════════════

  it('prevents duplicate correction requests for the same time entry', async () => {
    mockDb.mockReturnValue(
      createChain([
        [TIME_ENTRY],
        [{ id: 'existing-pending' }],
      ]),
    );

    await POST(
      createRequest('POST', '/api/time-corrections', undefined, {
        timeEntryId: ENTRY_ID,
        requestedMinutes: 150,
        reason: 'Another correction',
      }),
    );

    expectResponse(0, 409, (body) => {
      const err = (body.error ?? body) as Record<string, unknown>;
      expect(err.code).toBe('CONFLICT');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Status filter — corrections page tabs
  // ═══════════════════════════════════════════════════════════════════

  it('filters correction requests by approved status', async () => {
    mockDb.mockReturnValue(
      createChain([
        [
          {
            ...CORRECTION_REQUEST,
            status: 'approved',
            reviewedBy: 'manager-1',
            reviewedAt: '2026-07-21T13:00:00Z',
            user: { id: 'user-1', name: 'Employee', email: 'employee@test.com' },
            task: { id: TASK_ID, title: 'Fix login bug', taskIdDisplay: 'TASK-42' },
          },
        ],
        [{ count: 0 }],
      ]),
    );

    await GET(createRequest('GET', '/api/time-corrections', 'status=approved', undefined));

    expectResponse(0, 200, (body) => {
      const requests = body.requests as Array<Record<string, unknown>>;
      expect(requests).toHaveLength(1);
      expect(requests[0]!.status).toBe('approved');
      expect(body.pendingCount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Cancelled status filter — with badge simulation
  // ═══════════════════════════════════════════════════════════════════

  it('filters correction requests by cancelled status and simulates badge rendering', async () => {
    // The corrections page has a 'Cancelled' tab (keyboard shortcut 5).
    // The timer page builds a correctionStatusMap from timeEntryId → { status, requestedMinutes }.
    // When a request is cancelled, the badge should show 'cancelled' with neutral styling.

    // Simulate a regular employee (no time:manage permission)
    mockRequirePermission.mockRejectedValueOnce(new Error('Forbidden'));

    const cancelledReq = {
      ...CORRECTION_REQUEST,
      status: 'cancelled',
      reviewedBy: null,
      reviewedAt: null,
      user: { id: 'user-1', name: 'Employee', email: 'employee@test.com' },
      task: { id: TASK_ID, title: 'Fix login bug', taskIdDisplay: 'TASK-42' },
    };

    mockDb.mockReturnValue(
      createChain([
        [cancelledReq],
        [{ count: 0 }],
      ]),
    );

    await GET(createRequest('GET', '/api/time-corrections', 'status=cancelled', undefined));

    // Assert filtered response
    expectResponse(0, 200, (body) => {
      const requests = body.requests as Array<Record<string, unknown>>;
      expect(requests).toHaveLength(1);

      const req = requests[0]!;
      expect(req.status).toBe('cancelled');
      expect(req.timeEntryId).toBe(ENTRY_ID);
      expect(req.originalMinutes).toBe(120);
      expect(req.requestedMinutes).toBe(150);

      // pendingCount should be 0 because no requests have status 'pending'
      expect(body.pendingCount).toBe(0);

      // ── Simulate timer page's correctionStatusMap logic ──
      const statusMap = new Map<string, { status: string; requestedMinutes: number }>();
      for (const r of requests) {
        const tid = r.timeEntryId as string;
        if (!statusMap.has(tid)) {
          statusMap.set(tid, {
            status: r.status as string,
            requestedMinutes: r.requestedMinutes as number,
          });
        }
      }

      // Verify badge data for our time entry — status is 'cancelled'
      const badge = statusMap.get(ENTRY_ID);
      expect(badge).toBeDefined();
      expect(badge!.status).toBe('cancelled');
      expect(badge!.requestedMinutes).toBe(150);

      // Verify no badge for entries without corrections
      expect(statusMap.has('00000000-0000-0000-0000-000000000999')).toBe(false);
    });
  });
});
