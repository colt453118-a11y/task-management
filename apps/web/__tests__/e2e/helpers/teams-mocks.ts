import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

export const MOCK_TEAMS = [
  {
    id: 'team-1',
    name: 'Frontend',
    code: 'FE',
    description: 'Frontend web development team',
    leadUserId: 'user-1',
    departmentId: 'dept-1',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  {
    id: 'team-2',
    name: 'Backend',
    code: 'BE',
    description: 'Backend API and services team',
    leadUserId: 'user-2',
    departmentId: 'dept-1',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
  },
  {
    id: 'team-3',
    name: 'Design',
    code: null,
    description: null,
    leadUserId: null,
    departmentId: null,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'team-4',
    name: 'QA',
    code: 'QA',
    description: 'Quality assurance and testing',
    leadUserId: 'user-3',
    departmentId: 'dept-2',
    isActive: false,
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
  },
] as const;

export const MOCK_DEPARTMENTS = [
  {
    id: 'dept-1',
    name: 'Engineering',
    code: 'ENG',
    description: 'All engineering disciplines',
    headUserId: 'user-1',
    isActive: true,
  },
  {
    id: 'dept-2',
    name: 'Quality',
    code: null,
    description: 'Testing and quality assurance',
    headUserId: null,
    isActive: true,
  },
] as const;

export const MOCK_CREATED_TEAM = {
  id: 'team-new',
  name: 'DevOps',
  code: 'DO',
  description: 'Infrastructure and deployment',
  leadUserId: null,
  departmentId: null,
  isActive: true,
  createdAt: new Date().toISOString(),
} as const;

// ═══════════════════════════════════════════════════════════════
//  Mock Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Mock the teams API endpoint — returns both teams and departments for GET,
 * and handles POST (create team).
 *
 * @example
 *   await mockTeamsApi(page);
 *   await page.goto('/teams');
 *   // Now the departments and teams sections render with mock data
 */
export async function mockTeamsApi(
  page: Page,
  options: {
    teams?: readonly Record<string, unknown>[];
    departments?: readonly Record<string, unknown>[];
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
    teams = MOCK_TEAMS as unknown as Record<string, unknown>[],
    departments = MOCK_DEPARTMENTS as unknown as Record<string, unknown>[],
    abort: shouldAbort,
    delay,
    createErrorStatus,
    createErrorBody,
  } = options;

  // GET /api/teams — list teams and departments
  await page.route('**/api/teams', async (route) => {
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
      body: JSON.stringify({ teams, departments }),
    });
  });

  // POST /api/teams — create team
  await page.route('**/api/teams', async (route) => {
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
      body: JSON.stringify({ team: MOCK_CREATED_TEAM }),
    });
  });
}
