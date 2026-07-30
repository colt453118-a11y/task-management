import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

export const MOCK_LEAVE_TYPES = [
  { id: 'type-vacation', name: 'Vacation', slug: 'vacation', color: '#6366f1', icon: 'Umbrella', description: 'Annual leave and vacation time', isActive: true, sortOrder: 0 },
  { id: 'type-sick', name: 'Sick Leave', slug: 'sick', color: '#f59e0b', icon: 'Thermometer', description: 'Medical and health-related absences', isActive: true, sortOrder: 1 },
  { id: 'type-personal', name: 'Personal Leave', slug: 'personal', color: '#10b981', icon: 'User', description: 'Personal errands and family matters', isActive: true, sortOrder: 2 },
] as const;

export const MOCK_LEAVE_REQUESTS = [
  {
    id: 'req-1',
    userId: 'user-1',
    leaveTypeId: 'type-vacation',
    startDate: '2026-08-10',
    endDate: '2026-08-14',
    isHalfDay: false,
    daysCount: 5,
    reason: 'Family vacation to the beach',
    status: 'approved',
    reviewedBy: 'user-2',
    reviewedAt: '2026-07-28T10:00:00Z',
    reviewNote: 'Enjoy your vacation!',
    createdAt: '2026-07-25T08:00:00Z',
    updatedAt: '2026-07-28T10:00:00Z',
    user: { id: 'user-1', name: 'Alice Johnson', avatarUrl: null },
    leaveType: { id: 'type-vacation', name: 'Vacation', slug: 'vacation', color: '#6366f1', icon: 'Umbrella' },
  },
  {
    id: 'req-2',
    userId: 'user-1',
    leaveTypeId: 'type-sick',
    startDate: '2026-08-05',
    endDate: '2026-08-06',
    isHalfDay: false,
    daysCount: 2,
    reason: 'Doctor appointment and recovery',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: '2026-08-01T14:00:00Z',
    updatedAt: '2026-08-01T14:00:00Z',
    user: { id: 'user-1', name: 'Alice Johnson', avatarUrl: null },
    leaveType: { id: 'type-sick', name: 'Sick Leave', slug: 'sick', color: '#f59e0b', icon: 'Thermometer' },
  },
  {
    id: 'req-3',
    userId: 'user-3',
    leaveTypeId: 'type-personal',
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    isHalfDay: false,
    daysCount: 1,
    reason: 'Personal errand',
    status: 'rejected',
    reviewedBy: 'user-2',
    reviewedAt: '2026-08-15T09:00:00Z',
    reviewNote: 'Conflict with project deadline',
    createdAt: '2026-08-10T11:00:00Z',
    updatedAt: '2026-08-15T09:00:00Z',
    user: { id: 'user-3', name: 'Bob Smith', avatarUrl: null },
    leaveType: { id: 'type-personal', name: 'Personal Leave', slug: 'personal', color: '#10b981', icon: 'User' },
  },
] as const;

export const MOCK_LEAVE_BALANCES = [
  {
    id: 'bal-1',
    userId: 'user-1',
    leaveTypeId: 'type-vacation',
    year: 2026,
    allocatedDays: 15,
    usedDays: 5,
    pendingDays: 0,
    notes: null,
    leaveType: { id: 'type-vacation', name: 'Vacation', slug: 'vacation', color: '#6366f1', icon: 'Umbrella', description: 'Annual leave and vacation time' },
  },
  {
    id: 'bal-2',
    userId: 'user-1',
    leaveTypeId: 'type-sick',
    year: 2026,
    allocatedDays: 10,
    usedDays: 0,
    pendingDays: 2,
    notes: null,
    leaveType: { id: 'type-sick', name: 'Sick Leave', slug: 'sick', color: '#f59e0b', icon: 'Thermometer', description: 'Medical and health-related absences' },
  },
  {
    id: 'bal-3',
    userId: 'user-1',
    leaveTypeId: 'type-personal',
    year: 2026,
    allocatedDays: 5,
    usedDays: 0,
    pendingDays: 0,
    notes: null,
    leaveType: { id: 'type-personal', name: 'Personal Leave', slug: 'personal', color: '#10b981', icon: 'User', description: 'Personal errands and family matters' },
  },
] as const;

export const MOCK_CREATED_REQUEST = {
  id: 'req-new',
  userId: 'user-1',
  leaveTypeId: 'type-vacation',
  startDate: '2026-09-15',
  endDate: '2026-09-16',
  isHalfDay: false,
  daysCount: 2,
  reason: 'Short break',
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  attachmentUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as const;

// ═══════════════════════════════════════════════════════════════
//  Mock Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Mock the leave-types API endpoint.
 */
export async function mockLeaveTypesApi(
  page: Page,
  options: {
    types?: readonly Record<string, unknown>[];
    abort?: boolean;
    delay?: number;
  } = {},
) {
  const { types = MOCK_LEAVE_TYPES as unknown as Record<string, unknown>[], abort: shouldAbort, delay } = options;

  await page.route('**/api/leave-types', async (route) => {
    if (shouldAbort) {
      await route.abort('connectionrefused');
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ types }),
    });
  });
}

/**
 * Mock the leave-requests API endpoints.
 */
export async function mockLeaveRequestsApi(
  page: Page,
  options: {
    requests?: readonly Record<string, unknown>[];
    /** If true, abort GET to simulate network failure. */
    abort?: boolean;
    /** Delay in ms before fulfilling GET. */
    delay?: number;
    /** Status code for POST failure. */
    createErrorStatus?: number;
    /** Body for POST failure. */
    createErrorBody?: Record<string, unknown>;
    /** Mock for GET single request (detail page). */
    singleRequest?: Record<string, unknown>;
    /** Mock POST approve response. */
    approveResponse?: Record<string, unknown>;
    /** Mock POST reject response. */
    rejectResponse?: Record<string, unknown>;
  } = {},
) {
  const {
    requests = MOCK_LEAVE_REQUESTS as unknown as Record<string, unknown>[],
    abort: shouldAbort,
    delay,
    createErrorStatus,
    createErrorBody,
    singleRequest,
    approveResponse,
    rejectResponse,
  } = options;

  // GET /api/leave-requests — list
  // Use function-based matching so query params (?limit=50) don't break the glob
  await page.route(
    (url) => url.pathname === '/api/leave-requests',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      if (shouldAbort) {
        await route.abort('connectionrefused');
        return;
      }
      if (delay) await new Promise((r) => setTimeout(r, delay));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ requests }),
      });
    },
  );

  // POST /api/leave-requests — create
  await page.route(
    (url) => url.pathname === '/api/leave-requests',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      if (createErrorStatus) {
        await route.fulfill({
          status: createErrorStatus,
          contentType: 'application/json',
          body: JSON.stringify(createErrorBody ?? { error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ request: MOCK_CREATED_REQUEST }),
      });
    },
  );

  // GET /api/leave-requests/[id] — single request
  await page.route(/\/api\/leave-requests\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ request: singleRequest ?? MOCK_LEAVE_REQUESTS[0] }),
    });
  });

  // POST /api/leave-requests/[id]/approve
  if (approveResponse) {
    await page.route(/\/api\/leave-requests\/[^/]+\/approve/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(approveResponse),
      });
    });
  }

  // POST /api/leave-requests/[id]/reject
  if (rejectResponse) {
    await page.route(/\/api\/leave-requests\/[^/]+\/reject/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rejectResponse),
      });
    });
  }
}

/**
 * Mock the leave-balances API endpoint.
 */
export async function mockLeaveBalancesApi(
  page: Page,
  options: {
    balances?: readonly Record<string, unknown>[];
    abort?: boolean;
    delay?: number;
  } = {},
) {
  const { balances = MOCK_LEAVE_BALANCES as unknown as Record<string, unknown>[], abort: shouldAbort, delay } = options;

  await page.route('**/api/leave-balances', async (route) => {
    if (shouldAbort) {
      await route.abort('connectionrefused');
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ balances }),
    });
  });
}
