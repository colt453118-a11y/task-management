import type { Page } from '@playwright/test';

export { setSessionCookie } from './task-detail-mocks';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

export const MOCK_PROJECT = {
  id: 'proj-1',
  name: 'Website Redesign',
  code: 'WR-2026',
  description: 'Complete overhaul of the company website with the new design system.',
  status: 'active',
  priority: 'high',
  progress: 65,
  startDate: new Date(Date.now() - 86400000 * 30).toISOString(),
  endDate: new Date(Date.now() + 86400000 * 60).toISOString(),
  createdAt: new Date(Date.now() - 86400000 * 35).toISOString(),
  owner: { id: 'user-1', name: 'Jordan Rivera', email: 'jordan@example.com' },
} as const;

export const MOCK_TASK_STATS = {
  total: 12,
  completed: 5,
  inProgress: 4,
  overdue: 1,
  byStatus: [
    { status: 'completed', count: 5 },
    { status: 'in_progress', count: 4 },
    { status: 'open', count: 2 },
    { status: 'blocked', count: 1 },
  ],
} as const;

export const MOCK_PROJECT_TASKS = [
  {
    id: 'task-1',
    title: 'Design the new homepage',
    status: 'in_progress',
    priority: 'high',
    taskIdDisplay: 'WM-1001',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
  },
  {
    id: 'task-2',
    title: 'Migrate the blog content',
    status: 'completed',
    priority: 'medium',
    taskIdDisplay: 'WM-1002',
    dueDate: null,
  },
  {
    id: 'task-3',
    title: 'Set up analytics tracking',
    status: 'open',
    priority: 'low',
    taskIdDisplay: 'WM-1003',
    dueDate: new Date(Date.now() + 86400000 * 10).toISOString(),
  },
] as const;

// ═══════════════════════════════════════════════════════════════
//  Mock Helper
// ═══════════════════════════════════════════════════════════════

/**
 * Mock the project-detail endpoints: `GET /api/projects/:id` (project + task
 * stats + milestones) and `GET /api/tasks?projectId=…` (the project's task list).
 */
export async function mockProjectDetailApi(
  page: Page,
  options: {
    project?: Record<string, unknown>;
    taskStats?: Record<string, unknown>;
    milestones?: number;
    tasks?: readonly Record<string, unknown>[];
    /** Delay (ms) before fulfilling the project GET (to test loading state). */
    delay?: number;
    /** Return a 404 for the project. */
    notFound?: boolean;
  } = {},
) {
  const {
    project = MOCK_PROJECT as unknown as Record<string, unknown>,
    taskStats = MOCK_TASK_STATS as unknown as Record<string, unknown>,
    milestones = 3,
    tasks = MOCK_PROJECT_TASKS as unknown as Record<string, unknown>[],
    delay,
    notFound,
  } = options;

  // GET /api/projects/:id — matches /api/projects/proj-1 (not the bare list).
  await page.route(/\/api\/projects\/[a-zA-Z0-9-]+$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (notFound) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Project not found' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ project, taskStats, milestones: { total: milestones } }),
    });
  });

  // GET /api/tasks?projectId=… — the project's task list.
  await page.route(/\/api\/tasks\?/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tasks, total: tasks.length }),
    });
  });
}
