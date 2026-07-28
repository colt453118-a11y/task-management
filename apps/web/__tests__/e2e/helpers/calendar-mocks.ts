import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Return the number of calendar days left in the current month.
 * Used to ensure mock due dates always fall within the visible month view.
 */
function daysLeftInMonth(date: Date = new Date()): number {
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return endOfMonth.getDate() - date.getDate();
}

/**
 * Generate mock tasks with safe due dates that stay within the current month
 * (the Calendar page only renders the current month view initially).
 *
 * - task-1: due today → shows on calendar
 * - task-2: due tomorrow → shows on calendar
 * - task-3: due 2 days from now → shows on calendar
 * - task-4: no due date → hidden from calendar
 * - task-5: due 2 days ago (overdue) → shows on calendar
 */
export function getMockCalendarTasks(): Record<string, unknown>[] {
  const now = Date.now();
  const msInDay = 86_400_000;
  const safeOffset = Math.min(2, Math.max(1, daysLeftInMonth() - 1));

  return [
    {
      id: 'task-1',
      title: 'Review Q3 roadmap',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date(now).toISOString(),
    },
    {
      id: 'task-2',
      title: 'Update onboarding docs',
      status: 'open',
      priority: 'medium',
      dueDate: new Date(now + msInDay).toISOString(),
    },
    {
      id: 'task-3',
      title: 'Security audit findings',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: new Date(now + msInDay * safeOffset).toISOString(),
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
      dueDate: new Date(now - msInDay * 2).toISOString(),
    },
  ];
}

/**
 * Generate mock milestones with safe due dates (same reasoning as tasks).
 * - milestone-1: due today → shows on calendar
 * - milestone-2: due in 2 days → shows on calendar
 * - milestone-3: no due date → hidden from calendar
 */
export function getMockMilestones(): Record<string, unknown>[] {
  const now = Date.now();
  const msInDay = 86_400_000;
  const safeOffset = Math.min(2, Math.max(1, daysLeftInMonth() - 1));

  return [
    {
      id: 'ms-1',
      projectId: 'proj-1',
      projectName: 'Website Redesign',
      name: 'Beta launch milestone',
      description: 'Complete beta launch of the new website',
      status: 'in_progress',
      dueDate: new Date(now).toISOString(),
      completedDate: null,
    },
    {
      id: 'ms-2',
      projectId: 'proj-2',
      projectName: 'Backend Migration',
      name: 'Database migration complete',
      description: 'All data migrated to new schema',
      status: 'pending',
      dueDate: new Date(now + msInDay * safeOffset).toISOString(),
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
  ];
}

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
    tasks = getMockCalendarTasks(),
    milestones = getMockMilestones(),
    abort: shouldAbort,
    delay,
  } = options;

  // Tasks API — use function matcher so query params (e.g. ?dueDateStart=...)
  // don't cause the route to fall through. Glob patterns like '**/api/tasks'
  // match against the full URL including query string, so with query params
  // the endpoint would not be intercepted.
  await page.route(
    (url) => url.pathname.startsWith('/api/tasks'),
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
        body: JSON.stringify({ tasks }),
      });
    },
  );

  // Milestones API — use function matcher (same reason)
  await page.route(
    (url) => url.pathname.startsWith('/api/milestones'),
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
        body: JSON.stringify({ milestones }),
      });
    },
  );
}
