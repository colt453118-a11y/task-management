import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

export const MOCK_PROJECTS = [
  {
    id: 'proj-1',
    name: 'Website Redesign',
    code: 'WR-2026',
    description: 'Complete overhaul of the company website with new design system',
    status: 'active',
    priority: 'high',
    progress: 65,
    ownerId: 'user-1',
    startDate: new Date(Date.now() - 86400000 * 30).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 60).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 35).toISOString(),
  },
  {
    id: 'proj-2',
    name: 'Backend Migration',
    code: 'BEM-2026',
    description: 'Migrate legacy backend services to new architecture',
    status: 'active',
    priority: 'critical',
    progress: 30,
    ownerId: 'user-2',
    startDate: new Date(Date.now() - 86400000 * 14).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 90).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'proj-3',
    name: 'Mobile App v2',
    code: null,
    description: null,
    status: 'on_hold',
    priority: 'medium',
    progress: 15,
    ownerId: 'user-1',
    startDate: null,
    endDate: null,
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  {
    id: 'proj-4',
    name: 'Data Analytics Platform',
    code: 'DAP-2026',
    description: 'Internal analytics dashboard for business intelligence',
    status: 'completed',
    priority: 'high',
    progress: 100,
    ownerId: 'user-3',
    startDate: new Date(Date.now() - 86400000 * 120).toISOString(),
    endDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 130).toISOString(),
  },
  {
    id: 'proj-5',
    name: 'Legacy Archive',
    code: 'ARCH-2025',
    description: 'Archiving old projects and data retention cleanup',
    status: 'archived',
    priority: 'low',
    progress: 85,
    ownerId: 'user-2',
    startDate: null,
    endDate: null,
    createdAt: new Date(Date.now() - 86400000 * 200).toISOString(),
  },
] as const;

export const MOCK_CREATED_PROJECT = {
  id: 'proj-new',
  name: 'Q4 Product Launch',
  code: 'Q4-2026',
  description: 'Coordinate Q4 product launch across all teams',
  status: 'active',
  priority: 'medium',
  progress: 0,
  ownerId: 'user-1',
  startDate: new Date(Date.now() + 86400000 * 7).toISOString(),
  endDate: new Date(Date.now() + 86400000 * 120).toISOString(),
  createdAt: new Date().toISOString(),
} as const;

// ═══════════════════════════════════════════════════════════════
//  Mock Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Mock the projects API endpoints — both list (GET) and create (POST).
 *
 * @example
 *   await mockProjectsApi(page);
 *   await page.goto('/projects');
 *   // Now the project grid renders with mock data
 */
export async function mockProjectsApi(
  page: Page,
  options: {
    projects?: readonly Record<string, unknown>[];
    /** If true, abort the GET request to simulate network failure. */
    abort?: boolean;
    /** Delay in ms before fulfilling GET request (to test loading state). */
    delay?: number;
    /** If set, the POST endpoint will fulfill with this error status. */
    createErrorStatus?: number;
    /** If set, the POST endpoint will fulfill with this error body. */
    createErrorBody?: Record<string, unknown>;
  } = {},
) {
  const {
    projects = MOCK_PROJECTS as unknown as Record<string, unknown>[],
    abort: shouldAbort,
    delay,
    createErrorStatus,
    createErrorBody,
  } = options;

  // GET /api/projects — list projects
  await page.route('**/api/projects', async (route) => {
    // Only handle GET — POST is handled by a more specific route below
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
      body: JSON.stringify({ projects }),
    });
  });

  // POST /api/projects — create project
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    if (createErrorStatus) {
      await route.fulfill({
        status: createErrorStatus,
        contentType: 'application/json',
        body: JSON.stringify(
          createErrorBody ?? { error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        ),
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ project: MOCK_CREATED_PROJECT }),
    });
  });
}
