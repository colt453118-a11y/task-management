import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ─── Hoisted mocks ──────────────────────────────────────────────
const { mockGetDb, mockRequirePermission, mockHandleApiError } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequirePermission: vi.fn().mockResolvedValue(undefined),
  mockHandleApiError: vi.fn().mockReturnValue({
    error: { code: 'INTERNAL_ERROR', message: 'boom' },
    status: 500,
  }),
}));

vi.mock('@workmanagement/database', () => ({
  getDb: mockGetDb,
  schema: {
    leaveRequests: {
      id: 'lr.id',
      organizationId: 'lr.org',
      status: 'lr.status',
      startDate: 'lr.startDate',
      userId: 'lr.userId',
      leaveTypeId: 'lr.leaveTypeId',
    },
    leaveBalances: {
      userId: 'lb.userId',
      leaveTypeId: 'lb.leaveTypeId',
      year: 'lb.year',
      organizationId: 'lb.org',
      usedDays: 'lb.usedDays',
      pendingDays: 'lb.pendingDays',
    },
  },
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => unknown) => (req: NextRequest) =>
    handler(req, { user: { id: 'mgr-1', name: 'Manager' }, orgId: 'org-A' }),
  requirePermission: mockRequirePermission,
}));

vi.mock('@/lib/api/db', () => ({ handleApiError: mockHandleApiError }));

import { POST } from '../route';

// ─── Chainable DB / transaction mock ────────────────────────────
// selectResult = the row `SELECT ... LIMIT 1` returns (existence/status gate).
// updateResult = what the conditional `UPDATE ... WHERE status='pending' RETURNING`
//   returns: [] means another concurrent review already won the race.
function buildDb(selectResult: unknown[], updateResult: unknown[]) {
  const balanceUpdate = vi.fn();
  const tx = {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(selectResult) }) }),
    }),
    update: () => ({
      set: () => ({
        where: () => {
          // Awaitable (balance update) AND carries `.returning()` (conditional transition).
          const node: {
            returning: () => Promise<unknown[]>;
            then: (r: (v: undefined) => void) => void;
          } = {
            returning: () => Promise.resolve(updateResult),
            then: (resolve) => {
              balanceUpdate();
              resolve(undefined);
            },
          };
          return node;
        },
      }),
    }),
  };
  const db = { transaction: (cb: (t: typeof tx) => unknown) => cb(tx) };
  mockGetDb.mockReturnValue(db);
  return { balanceUpdate };
}

function req(id = 'req-1'): NextRequest {
  return {
    nextUrl: { pathname: `/api/leave-requests/${id}/approve` },
    json: async () => ({}),
  } as unknown as NextRequest;
}

const pending = {
  id: 'req-1',
  status: 'pending',
  organizationId: 'org-A',
  startDate: '2026-09-01',
  userId: 'emp-1',
  leaveTypeId: 'lt-1',
  daysCount: 5,
};

describe('POST /api/leave-requests/[id]/approve — atomicity/race guard (regression)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lost race: conditional UPDATE affects 0 rows → 400, no balance mutation', async () => {
    const { balanceUpdate } = buildDb([pending], []); // update matched nothing
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'INVALID_STATE' } });
    expect(balanceUpdate).not.toHaveBeenCalled(); // balance must NOT be touched
  });

  it('winner: conditional UPDATE returns the row → 200 and balance is moved', async () => {
    const { balanceUpdate } = buildDb([pending], [{ ...pending, status: 'approved' }]);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(balanceUpdate).toHaveBeenCalledTimes(1);
  });

  it('already reviewed: gate sees non-pending status → 400', async () => {
    const { balanceUpdate } = buildDb([{ ...pending, status: 'approved' }], []);
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(balanceUpdate).not.toHaveBeenCalled();
  });

  it('not found (or cross-org) → 404', async () => {
    buildDb([], []);
    const res = await POST(req());
    expect(res.status).toBe(404);
  });
});
