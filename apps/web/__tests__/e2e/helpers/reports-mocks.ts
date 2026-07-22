import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

/** Tasks for reports — varied statuses to produce distinct KPI metrics. */
export const MOCK_REPORT_TASKS = [
  { id: 't1', title: 'User auth', status: 'in_progress', priority: 'high', dueDate: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 't2', title: 'Login page', status: 'open', priority: 'medium', dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 't3', title: 'CI pipeline', status: 'completed', priority: 'critical', dueDate: null, updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 't4', title: 'DB migration', status: 'in_progress', priority: 'urgent', dueDate: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 't5', title: 'API integration', status: 'blocked', priority: 'high', dueDate: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 't6', title: 'Docs update', status: 'completed', priority: 'low', dueDate: null, updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 't7', title: 'Deploy v2', status: 'closed', priority: 'critical', dueDate: new Date(Date.now() + 1 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 't8', title: 'Legacy cleanup', status: 'archived', priority: 'none', dueDate: null, updatedAt: new Date(Date.now() - 10 * 86400000).toISOString() },
] as const;

/** Projects for reports. */
export const MOCK_REPORT_PROJECTS = [
  { id: 'p1', name: 'Website', status: 'active', code: 'WEB', description: 'Website overhaul', priority: 'high', progress: 65 },
  { id: 'p2', name: 'Backend', status: 'active', code: 'BEM', description: 'Backend migration', priority: 'critical', progress: 30 },
  { id: 'p3', name: 'Legacy', status: 'archived', code: 'ARCH', description: 'Archive', priority: 'low', progress: 100 },
] as const;

/** A mock report snapshot returned by GET /api/reports/snapshots. */
export const MOCK_SNAPSHOTS = [
  {
    id: 'snap-1',
    snapshotDate: new Date(Date.now() - 86400000).toISOString().split('T')[0]!,
    snapshotType: 'eod',
    label: 'EOD Report - Jul 21, 2026',
    summary: { totalTasks: 8, completedCount: 2, overdueCount: 1, activeProjects: 2, totalUsers: 3, completionRate: 25 },
    generatedBy: 'user-1',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'snap-2',
    snapshotDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]!,
    snapshotType: 'weekly',
    label: 'Weekly Review - Jul 15',
    summary: { totalTasks: 7, completedCount: 3, overdueCount: 0, activeProjects: 2, totalUsers: 3, completionRate: 43 },
    generatedBy: 'user-1',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
] as const;

/** A mock time report for the Time Tracking tab. */
export const MOCK_TIME_REPORT = {
  period: 'week',
  periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
  periodEnd: new Date().toISOString(),
  totalHours: 42.5,
  totalMinutes: 2550,
  entryCount: 38,
  avgSessionMinutes: 45,
  dailyHours: [
    { date: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]!, hours: 5.5, totalMinutes: 330, count: 4 },
    { date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]!, hours: 7.0, totalMinutes: 420, count: 6 },
    { date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0]!, hours: 6.5, totalMinutes: 390, count: 5 },
    { date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]!, hours: 8.0, totalMinutes: 480, count: 7 },
    { date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]!, hours: 4.0, totalMinutes: 240, count: 3 },
    { date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0]!, hours: 6.0, totalMinutes: 360, count: 5 },
    { date: new Date().toISOString().split('T')[0]!, hours: 5.5, totalMinutes: 330, count: 8 },
  ],
  byUser: [
    { userId: 'u1', userName: 'Alice Johnson', hours: 20.5, totalMinutes: 1230, entryCount: 18 },
    { userId: 'u2', userName: 'Bob Smith', hours: 12.0, totalMinutes: 720, entryCount: 10 },
    { userId: 'u3', userName: 'Carol Williams', hours: 10.0, totalMinutes: 600, entryCount: 10 },
  ],
  byProject: [
    { projectId: 'p1', projectName: 'Website Redesign', hours: 25.0, totalMinutes: 1500, entryCount: 20 },
    { projectId: 'p2', projectName: 'Backend Migration', hours: 17.5, totalMinutes: 1050, entryCount: 18 },
  ],
  topTasks: [
    { taskId: 't1', title: 'User auth', taskIdDisplay: 'TASK-001', hours: 8.5, totalMinutes: 510, entryCount: 5 },
    { taskId: 't4', title: 'DB migration', taskIdDisplay: 'TASK-004', hours: 6.0, totalMinutes: 360, entryCount: 4 },
    { taskId: 't5', title: 'API integration', taskIdDisplay: 'TASK-005', hours: 5.5, totalMinutes: 330, entryCount: 3 },
  ],
} as const;

// ═══════════════════════════════════════════════════════════════
//  Mock Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Mock the reports page API endpoints.
 *
 * Registers routes for:
 * - GET /api/tasks — bare route
 * - GET /api/projects — bare route
 * - GET /api/reports/snapshots?limit=5 — snapshots list
 * - POST /api/reports/snapshots — create snapshot
 * - GET /api/reports/time?period=... — time report
 *
 * @example
 *   await mockReportsApis(page);
 *   await page.goto('/reports');
 *   // KPI cards, snapshots, and time tab all render with mock data
 */
export async function mockReportsApis(
  page: Page,
  options: {
    tasks?: readonly Record<string, unknown>[];
    projects?: readonly Record<string, unknown>[];
    snapshots?: readonly Record<string, unknown>[];
    timeReport?: Record<string, unknown> | null;
    /** If true, abort API calls to simulate network failure. */
    abort?: boolean;
    /** Delay in ms before fulfilling requests (to test loading state). */
    delay?: number;
    /** If true, snapshot POST will return an error response. */
    snapshotError?: boolean;
    /** Custom snapshot POST response body. */
    snapshotResponse?: Record<string, unknown>;
    /** Custom session user. */
    session?: { user?: { name?: string; id?: string } } | null;
  } = {},
) {
  const {
    tasks = MOCK_REPORT_TASKS as unknown as Record<string, unknown>[],
    projects = MOCK_REPORT_PROJECTS as unknown as Record<string, unknown>[],
    snapshots = MOCK_SNAPSHOTS as unknown as Record<string, unknown>[],
    timeReport = MOCK_TIME_REPORT as unknown as Record<string, unknown>,
    abort: shouldAbort,
    delay,
    snapshotError,
    snapshotResponse,
  } = options;

  // ── GET /api/tasks ─────────────────────────────────────
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (shouldAbort) { await route.abort('connectionrefused'); return; }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tasks }),
    });
  });

  // ── GET /api/projects ──────────────────────────────────
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (shouldAbort) { await route.abort('connectionrefused'); return; }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ projects }),
    });
  });

  // ── GET /api/reports/snapshots?limit=5 ────────────────
  await page.route('**/api/reports/snapshots?limit=5', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (shouldAbort) { await route.abort('connectionrefused'); return; }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ snapshots, total: snapshots.length, limit: 5, offset: 0 }),
    });
  });

  // ── POST /api/reports/snapshots (create snapshot) ──────
  await page.route('**/api/reports/snapshots', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    if (snapshotError) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify(
          snapshotResponse ?? { error: { code: 'VALIDATION_ERROR', message: 'Failed to generate snapshot' } },
        ),
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(
        snapshotResponse ?? {
          snapshot: {
            id: 'snap-new',
            snapshotDate: new Date().toISOString().split('T')[0]!,
            snapshotType: 'eod',
            label: `EOD Report - ${new Date().toLocaleDateString()}`,
            summary: { totalTasks: 8, completedCount: 2, overdueCount: 1, activeProjects: 2, totalUsers: 3, completionRate: 25 },
            generatedBy: 'user-1',
            createdAt: new Date().toISOString(),
          },
        },
      ),
    });
  });

  // ── GET /api/reports/time?period=... ──────────────────
  await page.route('**/api/reports/time?period=week', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    if (shouldAbort) { await route.abort('connectionrefused'); return; }
    if (timeReport === null) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(timeReport),
    });
  });

  // Also handle month and quarter periods
  await page.route('**/api/reports/time?period=month', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    if (timeReport === null) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(timeReport),
    });
  });

  await page.route('**/api/reports/time?period=quarter', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    if (timeReport === null) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(timeReport),
    });
  });
}
