import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

export const MOCK_DASHBOARD_TASKS = [
  {
    id: 'task-1',
    title: 'Implement user authentication',
    status: 'in_progress',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    assignedTo: 'user-1',
    projectId: 'proj-1',
  },
  {
    id: 'task-2',
    title: 'Fix login page CSS',
    status: 'open',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    assignedTo: null,
    projectId: null,
  },
  {
    id: 'task-3',
    title: 'Set up CI pipeline',
    status: 'completed',
    priority: 'critical',
    dueDate: null,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    assignedTo: 'user-1',
    projectId: 'proj-1',
  },
  {
    id: 'task-4',
    title: 'Overdue database migration',
    status: 'in_progress',
    priority: 'urgent',
    dueDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    assignedTo: 'user-2',
    projectId: 'proj-2',
  },
  {
    id: 'task-5',
    title: 'Blocked by third-party API',
    status: 'blocked',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    assignedTo: 'user-1',
    projectId: 'proj-2',
  },
] as const;

export const MOCK_DASHBOARD_PROJECTS = [
  { id: 'proj-1', name: 'Website Redesign', status: 'active' },
  { id: 'proj-2', name: 'Backend Migration', status: 'active' },
  { id: 'proj-3', name: 'Legacy Archive', status: 'archived' },
] as const;

export const MOCK_DASHBOARD_USERS = [
  { id: 'user-1', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob Smith', email: 'bob@example.com' },
  { id: 'user-3', name: 'Carol Williams', email: 'carol@example.com' },
] as const;

// ═══════════════════════════════════════════════════════════════
//  Mock Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Mock the dashboard API endpoints — tasks, projects, users, and session.
 * The dashboard fetches all three in parallel then optionally reads the session.
 *
 * @example
 *   await mockDashboardApis(page);
 *   await page.goto('/');
 *   // Now all KPI cards, deadlines, and activity render with mock data
 */
export async function mockDashboardApis(
  page: Page,
  options: {
    tasks?: readonly Record<string, unknown>[];
    projects?: readonly Record<string, unknown>[];
    users?: readonly Record<string, unknown>[];
    session?: { user?: { name?: string; id?: string } } | null;
    /** If true, abort ALL API calls to simulate network failure. */
    abort?: boolean;
    /** Delay in ms before fulfilling requests (to test loading state). */
    delay?: number;
  } = {},
) {
  const {
    tasks = MOCK_DASHBOARD_TASKS as unknown as Record<string, unknown>[],
    projects = MOCK_DASHBOARD_PROJECTS as unknown as Record<string, unknown>[],
    users = MOCK_DASHBOARD_USERS as unknown as Record<string, unknown>[],
    session = { user: { name: 'Alice Johnson', id: 'user-1' } },
    abort: shouldAbort,
    delay,
  } = options;

  // Tasks API
  await page.route('**/api/tasks?limit=500', async (route) => {
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

  // Projects API
  await page.route('**/api/projects?limit=500', async (route) => {
    if (shouldAbort) {
      await route.abort('connectionrefused');
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ projects }),
    });
  });

  // Users API
  await page.route('**/api/users?limit=500', async (route) => {
    if (shouldAbort) {
      await route.abort('connectionrefused');
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users }),
    });
  });

  // Session API (best-effort, may fail silently in the dashboard)
  if (session) {
    await page.route('**/api/auth/get-session', async (route) => {
      if (shouldAbort) {
        await route.abort('connectionrefused');
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
    });
  }
}
