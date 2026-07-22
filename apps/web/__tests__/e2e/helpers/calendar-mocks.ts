import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

/**
 * Tasks for calendar testing.
 * - task-1: due today → shows on calendar
 * - task-2: due tomorrow → shows on calendar
 * - task-3: due in 7 days → shows on calendar
 * - task-4: no due date → hidden from calendar
 * - task-5: due 2 days ago (overdue) → shows on calendar
 */
export const MOCK_CALENDAR_TASKS = [
  {
    id: 'task-1',
    title: 'Review Q3 roadmap',
    status: 'in_progress',
    priority: 'high',
    dueDate: new Date().toISOString(),
  },
  {
    id: 'task-2',
    title: 'Update onboarding docs',
    status: 'open',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: 'task-3',
    title: 'Security audit findings',
    status: 'in_progress',
    priority: 'urgent',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
  },
  {
    id: 'task-4',
    title: 'Hidden task (no due date)',
    status: 'open',
    priority: 'low',
    dueDate: null,
  },
  {
    id: 'task-5',
    title: 'Past due API migration',
    status: 'blocked',
    priority: 'critical',
    dueDate: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
] as const;

/**
 * Milestones for calendar testing.
 * - milestone-1: due today → shows on calendar (paired with task-1)
 * - milestone-2: due in 7 days → shows on calendar (paired with task-3)
 * - milestone-3: no due date → hidden from calendar
 */
export const MOCK_MILESTONES = [
  {
    id: 'ms-1',
    projectId: 'proj-1',
    projectName: 'Website Redesign',
    name: 'Beta launch milestone',
    description: 'Complete beta launch of the new website',
    status: 'in_progress',
    dueDate: new Date().toISOString(),
    completedDate: null,
  },
  {
    id: 'ms-2',
    projectId: 'proj-2',
    projectName: 'Backend Migration',
    name: 'Database migration complete',
    description: 'All data migrated to new schema',
    status: 'pending',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    completedDate: null,
  },
  {
    id: 'ms-3',
    projectId: 'proj-3',
    projectName: 'Legacy Archive',
    name: 'Hidden milestone (no due date)',
    description: null,
    status: 'cancelled',
    dueDate: null,
    completedDate: null,
  },
] as const;

// ═══════════════════════════════════════════════════════════════
//  Mock Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Mock the calendar API endpoints — tasks and milestones.
 * The calendar page fetches both in parallel on mount.
 *
 * IMPORTANT: Registers routes for bare /api/tasks and /api/milestones
 * (no query params). If other tests register more specific routes with
 * query params (e.g. /api/tasks?limit=500), those take precedence
 * over the bare routes registered here.
 *
 * @example
 *   await mockCalendarApis(page);
 *   await page.goto('/calendar');
 *   // Now badges render on the calendar grid with mock data
 */
export async function mockCalendarApis(
  page: Page,
  options: {
    tasks?: readonly Record<string, unknown>[];
    milestones?: readonly Record<string, unknown>[];
    /** If true, abort ALL API calls to simulate network failure. */
    abort?: boolean;
    /** Delay in ms before fulfilling requests (to test loading state). */
    delay?: number;
  } = {},
) {
  const {
    tasks = MOCK_CALENDAR_TASKS as unknown as Record<string, unknown>[],
    milestones = MOCK_MILESTONES as unknown as Record<string, unknown>[],
    abort: shouldAbort,
    delay,
  } = options;

  // Tasks API — bare route (no query params)
  await page.route('**/api/tasks', async (route) => {
    // Only handle GET — other methods fall through
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
      body: JSON.stringify({ tasks }),
    });
  });

  // Milestones API — bare route (no query params)
  await page.route('**/api/milestones', async (route) => {
    // Only handle GET — other methods fall through
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
      body: JSON.stringify({ milestones }),
    });
  });
}
