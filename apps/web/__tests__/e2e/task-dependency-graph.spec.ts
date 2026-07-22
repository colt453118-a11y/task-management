import { test, expect } from '@playwright/test';
import { DEP_GRAPH } from '@/lib/test-ids';

// ─── Constants ──────────────────────────────────────────────────

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000';

const MOCK_TASK = {
  id: TASK_ID,
  title: 'Implement user authentication',
  description: '<p>Build the login and registration flow</p>',
  taskIdDisplay: 'TASK-001',
  status: 'in_progress',
  priority: 'high',
  assignedTo: 'user-123',
  projectId: null,
  departmentId: null,
  teamId: null,
  createdBy: 'user-123',
  updatedBy: 'user-123',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  startDate: new Date().toISOString(),
  estimatedHours: '8.00',
  actualHours: null,
  labels: ['frontend', 'auth'],
  tags: null,
  category: 'development',
  createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
} as const;

// ─── Dependency Fixtures ───────────────────────────────────────

const BLOCKED_BY_DEPS = [
  {
    id: 'dep-blockedby-1',
    taskId: TASK_ID,
    dependsOnTaskId: 'task-design',
    dependencyType: 'blocks',
    createdAt: new Date().toISOString(),
    dependsOnTask: {
      id: 'task-design',
      title: 'Design system components',
      taskIdDisplay: 'TASK-002',
      status: 'in_progress',
    },
    blockingTask: null,
  },
  {
    id: 'dep-blockedby-2',
    taskId: TASK_ID,
    dependsOnTaskId: 'task-api',
    dependencyType: 'blocks',
    createdAt: new Date().toISOString(),
    dependsOnTask: {
      id: 'task-api',
      title: 'Build API endpoints',
      taskIdDisplay: 'TASK-003',
      status: 'completed',
    },
    blockingTask: null,
  },
];

const BLOCKING_DEPS = [
  {
    id: 'dep-blocking-1',
    taskId: 'task-tests',
    dependsOnTaskId: TASK_ID,
    dependencyType: 'blocks',
    createdAt: new Date().toISOString(),
    dependsOnTask: null,
    blockingTask: {
      id: 'task-tests',
      title: 'Write integration tests',
      taskIdDisplay: 'TASK-004',
      status: 'todo',
    },
  },
];

const MOCK_SEARCH_RESULTS = [
  {
    id: 'task-search-1',
    title: 'Set up CI pipeline',
    taskIdDisplay: 'TASK-005',
    status: 'todo',
  },
  {
    id: 'task-search-2',
    title: 'Write documentation',
    taskIdDisplay: 'TASK-006',
    status: 'in_progress',
  },
];

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Set the session cookie that Next.js middleware checks.
 *
 * Uses `url` instead of `domain` + `path` for more reliable matching,
 * and also sets the cookie via `addInitScript` as a fallback so it's
 * guaranteed to be available on the very first navigation request.
 *
 * Without this, the middleware redirects to /auth/login and the test
 * page never loads.
 */
async function setSessionCookie(page: import('@playwright/test').Page) {
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'mock-session-token',
      url: 'http://localhost:3000',
    },
  ]);

  await page.addInitScript(() => {
    document.cookie = 'better-auth.session_token=mock-session-token; path=/;';
  });
}

async function mockPageApis(page: import('@playwright/test').Page) {
  await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ task: MOCK_TASK }),
    });
  });

  await page.route(`**/api/tasks/${TASK_ID}/comments`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/attachments`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ attachments: [] }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/time-entries`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isWatching: false, watcherCount: 0 }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/checklist*`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    } else {
      await route.fulfill({ status: 405, body: 'Method not allowed' });
    }
  });
  await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: [] }) });
  });
  // Mock checklist mutations to prevent "Failed to add/delete/update checklist item" errors
  await page.route(`**/api/tasks/${TASK_ID}/checklist*`, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: { id: 'checklist-new', content: 'Test item', isChecked: false, sortOrder: 0 } }) });
    } else if (method === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: { id: 'checklist-item', content: 'Updated', isChecked: true, sortOrder: 0 } }) });
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    }
  });
}

async function registerDepsRoute(page: import('@playwright/test').Page, blockedBy: typeof BLOCKED_BY_DEPS, blocking: typeof BLOCKING_DEPS) {
  // Use function matcher to handle DELETE with query params (e.g., ?dependencyId=...)
  await page.route((url) => url.pathname === `/api/tasks/${TASK_ID}/dependencies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ blockedBy, blocking }),
    });
  });
}

async function registerSearchRoute(page: import('@playwright/test').Page, results: typeof MOCK_SEARCH_RESULTS | []) {
  await page.route(/\/api\/tasks\?search=/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: results }) });
  });
}

// ─── Deps Route Helper ─────────────────────────────────────────

interface DepsData {
  blockedBy: readonly { id: string; taskId: string; dependsOnTaskId: string; dependencyType: string; createdAt: string; dependsOnTask?: unknown; blockingTask?: unknown }[];
  blocking: readonly { id: string; taskId: string; dependsOnTaskId: string; dependencyType: string; createdAt: string; dependsOnTask?: unknown; blockingTask?: unknown }[];
}

function createDepsMutationRoute(
  page: import('@playwright/test').Page,
  beforeData: DepsData,
  afterData: DepsData,
  onMutation?: (route: import('@playwright/test').Route) => Promise<void>,
) {
  let mutated = false;

  page.route(
    (url) => url.pathname === `/api/tasks/${TASK_ID}/dependencies`,
    async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mutated ? afterData : beforeData),
        });
      } else {
        mutated = true;
        if (onMutation) {
          await onMutation(route);
        } else {
          await route.fulfill({
            status: method === 'POST' ? 201 : 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        }
      }
    },
  );

  return { wasMutated: () => mutated };
}

// ─── Setup ──────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Tests ──────────────────────────────────────────────────────

test.describe('TaskDependencyGraph', () => {
  test('renders empty state when no dependencies exist', async ({ page }) => {
    await mockPageApis(page);
    await registerDepsRoute(page, [], []);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('No dependencies')).toBeVisible();
    await expect(page.getByText('Link this task to others')).toBeVisible();
    await expect(page.getByText('Add dependency').first()).toBeVisible();
  });

  test('renders blockedBy and blocking dependencies in graph mode', async ({ page }) => {
    await mockPageApis(page);
    await registerDepsRoute(page, BLOCKED_BY_DEPS, BLOCKING_DEPS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Graph mode active by default
    await expect(page.getByTestId(DEP_GRAPH.toggleGraph)).toHaveClass(/bg-brand-500/);

    // Header shows dependency count
    await expect(page.getByTestId(DEP_GRAPH.count)).toBeVisible();

    // Blocked by section
    await expect(page.getByText('Blocked by').first()).toBeVisible();
    await expect(page.getByText('Design system components')).toBeVisible();
    await expect(page.getByText('Build API endpoints')).toBeVisible();
    await expect(page.getByText('TASK-002')).toBeVisible();
    await expect(page.getByText('TASK-003')).toBeVisible();

    // Status badges — use .first()/.last() to avoid strict mode (status text appears
    // in both the badge and the task's own dropdown)
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Completed').last()).toBeVisible();

    // Blocking section
    await expect(page.getByText('Blocking').first()).toBeVisible();
    await expect(page.getByText('Write integration tests')).toBeVisible();
    await expect(page.getByText('TASK-004')).toBeVisible();
    await expect(page.getByText('To Do').first()).toBeVisible();
  });

  test('toggles between graph and list views', async ({ page }) => {
    await mockPageApis(page);
    await registerDepsRoute(page, BLOCKED_BY_DEPS, BLOCKING_DEPS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Graph view visible
    await expect(page.getByText('Blocked by').first()).toBeVisible();

    // Click "List" toggle
    await page.getByTestId(DEP_GRAPH.toggleList).click();
    await expect(page.getByTestId(DEP_GRAPH.toggleList)).toHaveClass(/bg-brand-500/);

    // List view shows count headers
    await expect(page.getByText('Blocked by (2)')).toBeVisible();
    await expect(page.getByText('Blocking (1)')).toBeVisible();
    await expect(page.getByText('Design system components')).toBeVisible();
    await expect(page.getByText('Write integration tests')).toBeVisible();

    // Switch back to graph view
    await page.getByTestId(DEP_GRAPH.toggleGraph).click();
    await expect(page.getByTestId(DEP_GRAPH.toggleGraph)).toHaveClass(/bg-brand-500/);

    // List-specific count headers disappear
    await expect(page.getByText('Blocked by (2)')).not.toBeVisible();
  });

  test('opens the add dialog and searches for tasks', async ({ page }) => {
    await mockPageApis(page);
    await registerDepsRoute(page, [], []);
    await registerSearchRoute(page, MOCK_SEARCH_RESULTS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Open dialog via header Plus icon
    await page.getByTestId(DEP_GRAPH.addBtn).click();
    const searchInput = page.getByTestId(DEP_GRAPH.searchInput);
    await expect(searchInput).toBeVisible();

    // Initial helper text
    await expect(page.getByText('Type to search for a task to link')).toBeVisible();

    // Search
    await searchInput.fill('CI');
    await expect(page.getByTestId(DEP_GRAPH.searchResult('task-search-1'))).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(DEP_GRAPH.searchResult('task-search-2'))).toBeVisible();
    await expect(page.getByText('TASK-005')).toBeVisible();
    await expect(page.getByText('TASK-006')).toBeVisible();
  });

  test('shows no results message when search matches nothing', async ({ page }) => {
    await mockPageApis(page);
    await registerDepsRoute(page, [], []);
    await registerSearchRoute(page, []);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId(DEP_GRAPH.addBtn).click();
    const searchInput = page.getByTestId(DEP_GRAPH.searchInput);
    await searchInput.fill('xyznonexistenttask');
    await expect(page.getByText(/No tasks found for/)).toBeVisible({ timeout: 5_000 });
  });

  test('adds a dependency via dialog search and select', async ({ page }) => {
    await mockPageApis(page);

    const afterDep = {
      id: 'dep-new', taskId: TASK_ID, dependsOnTaskId: 'task-search-1',
      dependencyType: 'blocks', createdAt: new Date().toISOString(),
      dependsOnTask: { id: 'task-search-1', title: 'Set up CI pipeline', taskIdDisplay: 'TASK-005', status: 'todo' },
      blockingTask: null,
    };
    const { wasMutated } = createDepsMutationRoute(
      page,
      { blockedBy: [], blocking: [] },
      { blockedBy: [afterDep], blocking: [] },
    );
    await registerSearchRoute(page, MOCK_SEARCH_RESULTS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No dependencies')).toBeVisible();

    // Open dialog, search, select
    await page.getByTestId(DEP_GRAPH.addBtn).click();
    await page.getByTestId(DEP_GRAPH.searchInput).fill('CI');
    await expect(page.getByTestId(DEP_GRAPH.searchResult('task-search-1'))).toBeVisible({ timeout: 5_000 });
    await page.getByTestId(DEP_GRAPH.searchResult('task-search-1')).click();

    // After add, dialog closes and dep appears (dep item uses id 'dep-new')
    await expect(page.getByTestId(DEP_GRAPH.item('dep-new'))).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Blocked by').first()).toBeVisible();
    expect(wasMutated()).toBe(true);
  });

  test('adds a dependency via the empty state button', async ({ page }) => {
    await mockPageApis(page);

    const afterDep = {
      id: 'dep-empty-add', taskId: TASK_ID, dependsOnTaskId: 'task-search-1',
      dependencyType: 'blocks', createdAt: new Date().toISOString(),
      dependsOnTask: { id: 'task-search-1', title: 'Set up CI pipeline', taskIdDisplay: 'TASK-005', status: 'todo' },
      blockingTask: null,
    };
    const { wasMutated } = createDepsMutationRoute(
      page,
      { blockedBy: [], blocking: [] },
      { blockedBy: [afterDep], blocking: [] },
    );
    await registerSearchRoute(page, MOCK_SEARCH_RESULTS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(DEP_GRAPH.emptyState)).toBeVisible();

    // Click "Add dependency" button in the empty state (not the header + button)
    await page.getByTestId(DEP_GRAPH.addFromEmpty).click();
    await expect(page.getByTestId(DEP_GRAPH.searchInput)).toBeVisible();

    // Search and select
    await page.getByTestId(DEP_GRAPH.searchInput).fill('CI');
    await expect(page.getByTestId(DEP_GRAPH.searchResult('task-search-1'))).toBeVisible({ timeout: 5_000 });
    await page.getByTestId(DEP_GRAPH.searchResult('task-search-1')).click();

    // After add, dialog closes and dep appears (dep item uses id 'dep-empty-add')
    await expect(page.getByTestId(DEP_GRAPH.item('dep-empty-add'))).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Blocked by').first()).toBeVisible();
    expect(wasMutated()).toBe(true);
  });

  test('shows error message in add dialog when API fails', async ({ page }) => {
    await mockPageApis(page);

    await page.route((url) => url.pathname === `/api/tasks/${TASK_ID}/dependencies`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blockedBy: [], blocking: [] }) });
      } else if (method === 'POST') {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Circular dependency detected' } }) });
      } else {
        await route.fulfill({ status: 405 });
      }
    });
    await registerSearchRoute(page, MOCK_SEARCH_RESULTS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Open dialog, search, try to add
    await page.getByTestId(DEP_GRAPH.addBtn).click();
    await page.getByTestId(DEP_GRAPH.searchInput).fill('CI');
    await expect(page.getByTestId(DEP_GRAPH.searchResult('task-search-1'))).toBeVisible({ timeout: 5_000 });
    await page.getByTestId(DEP_GRAPH.searchResult('task-search-1')).click();

    // Error message appears in dialog
    await expect(page.getByText('Circular dependency detected')).toBeVisible({ timeout: 3_000 });

    // Dialog still open; Cancel button
    await expect(page.getByTestId(DEP_GRAPH.searchInput)).toBeVisible();
    await page.getByTestId(DEP_GRAPH.dialogCancel).click();
    await expect(page.getByTestId(DEP_GRAPH.searchInput)).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
//  REMOVE TESTS (via data-testid to bypass group-hover CSS)
// ═══════════════════════════════════════════════════════════════

test.describe('TaskDependencyGraph — Remove Interactions', () => {
  test('removes a blockedBy dependency via list view', async ({ page }) => {
    await mockPageApis(page);

    createDepsMutationRoute(
      page,
      { blockedBy: BLOCKED_BY_DEPS, blocking: BLOCKING_DEPS },
      { blockedBy: [BLOCKED_BY_DEPS[1]!], blocking: BLOCKING_DEPS },
    );

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Switch to list view
    await page.getByTestId(DEP_GRAPH.toggleList).click();
    await expect(page.getByText('Blocked by (2)')).toBeVisible();

    // Register the response listener BEFORE clicking to avoid race conditions
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/dependencies') && res.request().method() === 'DELETE',
    );

    // Click the remove button directly via data-testid (no hover needed)
    await page.getByTestId(DEP_GRAPH.remove('dep-blockedby-1')).click();

    await deleteResponse;

    // After removal + refetch, "Design system components" should disappear
    await expect(page.getByText('Design system components')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Build API endpoints')).toBeVisible();
    await expect(page.getByText('Blocked by (1)')).toBeVisible();
  });

  test('removes a blocking dependency via list view', async ({ page }) => {
    await mockPageApis(page);

    createDepsMutationRoute(
      page,
      { blockedBy: BLOCKED_BY_DEPS, blocking: BLOCKING_DEPS },
      { blockedBy: BLOCKED_BY_DEPS, blocking: [] },
    );

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Switch to list view
    await page.getByTestId(DEP_GRAPH.toggleList).click();
    await expect(page.getByText('Blocking (1)')).toBeVisible();

    // Register listener first, then click to avoid race condition
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/dependencies') && res.request().method() === 'DELETE',
    );

    // Click the remove button directly via data-testid
    await page.getByTestId(DEP_GRAPH.remove('dep-blocking-1')).click();

    await deleteResponse;

    // Blocking section should disappear
    await expect(page.getByText('Blocking (1)')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Blocked by (2)')).toBeVisible();
  });

  test('removes the last dependency and shows empty state', async ({ page }) => {
    await mockPageApis(page);

    createDepsMutationRoute(
      page,
      { blockedBy: [BLOCKED_BY_DEPS[0]!], blocking: [] },
      { blockedBy: [], blocking: [] },
    );

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Should show a single dep
    await expect(page.getByText('Design system components')).toBeVisible();

    // Switch to list view for easier remove interaction
    await page.getByTestId(DEP_GRAPH.toggleList).click();
    await expect(page.getByText('Blocked by (1)')).toBeVisible();

    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/dependencies') && res.request().method() === 'DELETE',
    );

    await page.getByTestId(DEP_GRAPH.remove('dep-blockedby-1')).click();
    await deleteResponse;

    // After removing the last dep, should see empty state
    await expect(page.getByText('Design system components')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(DEP_GRAPH.emptyState)).toBeVisible();
    await expect(page.getByText('No dependencies')).toBeVisible();
    await expect(page.getByText('Link this task to others')).toBeVisible();
  });

  test('removes a blockedBy dependency via graph view', async ({ page }) => {
    await mockPageApis(page);

    createDepsMutationRoute(
      page,
      { blockedBy: BLOCKED_BY_DEPS, blocking: BLOCKING_DEPS },
      { blockedBy: [BLOCKED_BY_DEPS[1]!], blocking: BLOCKING_DEPS },
    );

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // In graph view (default), graph view should be visible
    await expect(page.getByTestId(DEP_GRAPH.graphView)).toBeVisible();

    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/dependencies') && res.request().method() === 'DELETE',
    );

    // Click remove button via data-testid (Playwright can click opacity-0 elements)
    await page.getByTestId(DEP_GRAPH.remove('dep-blockedby-1')).click();
    await deleteResponse;

    // After removal, the dep should disappear
    await expect(page.getByText('Design system components')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Build API endpoints')).toBeVisible();
  });

  test('handles API error when removing a dependency', async ({ page }) => {
    let deleteAttempted = false;

    await mockPageApis(page);

    await page.route((url) => url.pathname === `/api/tasks/${TASK_ID}/dependencies`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ blockedBy: BLOCKED_BY_DEPS, blocking: [] }),
        });
      } else if (method === 'DELETE') {
        deleteAttempted = true;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Server error' } }) });
      } else {
        await route.fulfill({ status: 405 });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Switch to list view
    await page.getByTestId(DEP_GRAPH.toggleList).click();
    await expect(page.getByText('Blocked by (2)')).toBeVisible();

    // Register listener first, then click to avoid race condition
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/dependencies') && res.request().method() === 'DELETE',
    );

    // Click the remove button directly via data-testid
    await page.getByTestId(DEP_GRAPH.remove('dep-blockedby-1')).click();

    await deleteResponse;

    // Dependency should still be visible (no refetch since error caught)
    await expect(page.getByText('Design system components')).toBeVisible();
    await expect(page.getByText('Blocked by (2)')).toBeVisible();
    expect(deleteAttempted).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  VISUAL REGRESSION TESTS
//  (Uses static dates to avoid flakiness from Date.now() changes)
// ═══════════════════════════════════════════════════════════════

/** Static task data for reproducible screenshots (no Date.now() drift). */
const STATIC_TASK = {
  ...MOCK_TASK,
  dueDate: '2026-07-24T00:00:00.000Z',
  startDate: '2026-07-17T00:00:00.000Z',
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-17T12:00:00.000Z',
};

async function mockPageApisStatic(page: import('@playwright/test').Page) {
  // Same as mockPageApis but uses STATIC_TASK instead of MOCK_TASK
  await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: STATIC_TASK }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/comments`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/attachments`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ attachments: [] }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/time-entries`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isWatching: false, watcherCount: 0 }) });
  });
  await page.route(`**/api/tasks/${TASK_ID}/checklist*`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    } else {
      await route.fulfill({ status: 405, body: 'Method not allowed' });
    }
  });
  // Mock checklist mutations to prevent "Failed to add/delete/update checklist item" errors
  await page.route(`**/api/tasks/${TASK_ID}/checklist*`, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: { id: 'checklist-new', content: 'Test item', isChecked: false, sortOrder: 0 } }) });
    } else if (method === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: { id: 'checklist-item', content: 'Updated', isChecked: true, sortOrder: 0 } }) });
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    }
  });
  await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: [] }) });
  });
}

test.describe('TaskDependencyGraph — Visual Regression', () => {
  // Visual regression only runs on Chromium to avoid maintaining snapshots
  // for every browser. The UI is identical across browsers.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Visual regression on Chromium only');
  });

  test('empty state screenshot', async ({ page }) => {
    await mockPageApisStatic(page);
    await registerDepsRoute(page, [], []);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(STATIC_TASK.title).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No dependencies')).toBeVisible();

    await expect(page).toHaveScreenshot('dependency-graph-empty.png', {
      animations: 'disabled',
      fullPage: false,
    });
  });

  test('graph view with dependencies screenshot', async ({ page }) => {
    await mockPageApisStatic(page);
    await registerDepsRoute(page, BLOCKED_BY_DEPS, BLOCKING_DEPS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(STATIC_TASK.title).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Blocked by').first()).toBeVisible();

    await expect(page).toHaveScreenshot('dependency-graph-with-deps.png', {
      animations: 'disabled',
      fullPage: false,
    });
  });

  test('list view screenshot', async ({ page }) => {
    await mockPageApisStatic(page);
    await registerDepsRoute(page, BLOCKED_BY_DEPS, BLOCKING_DEPS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(STATIC_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId(DEP_GRAPH.toggleList).click();
    await expect(page.getByText('Blocked by (2)')).toBeVisible();

    await expect(page).toHaveScreenshot('dependency-graph-list-view.png', {
      animations: 'disabled',
      fullPage: false,
    });
  });

  test('add dialog open screenshot', async ({ page }) => {
    await mockPageApisStatic(page);
    await registerDepsRoute(page, [], []);
    await registerSearchRoute(page, MOCK_SEARCH_RESULTS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(STATIC_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId(DEP_GRAPH.addBtn).click();
    await expect(page.getByTestId(DEP_GRAPH.searchInput)).toBeVisible();

    // Type a search query so the dialog shows results
    await page.getByTestId(DEP_GRAPH.searchInput).fill('CI');
    await expect(page.getByText('Set up CI pipeline')).toBeVisible({ timeout: 5_000 });

    await expect(page).toHaveScreenshot('dependency-graph-add-dialog.png', {
      animations: 'disabled',
      fullPage: false,
    });
  });

  test('graph view with single blockedBy dependency screenshot', async ({ page }) => {
    await mockPageApisStatic(page);
    await registerDepsRoute(page, [BLOCKED_BY_DEPS[0]!], []);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(STATIC_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Graph view (default) with one blocked-by dep
    await expect(page.getByTestId(DEP_GRAPH.graphView)).toBeVisible();
    await expect(page.getByText('Blocked by').first()).toBeVisible();
    await expect(page.getByText('Design system components')).toBeVisible();

    await expect(page).toHaveScreenshot('dependency-graph-single-dep.png', {
      animations: 'disabled',
      fullPage: false,
    });
  });

  test('graph view after removing one dependency screenshot', async ({ page }) => {
    await mockPageApisStatic(page);
    // Simulates state after removing one blockedBy: 1 remaining + 1 blocking
    await registerDepsRoute(page, [BLOCKED_BY_DEPS[1]!], BLOCKING_DEPS);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(STATIC_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Both blocked-by (remaining) and blocking sections visible
    await expect(page.getByText('Blocked by').first()).toBeVisible();
    await expect(page.getByText('Blocking').first()).toBeVisible();
    await expect(page.getByText('Build API endpoints')).toBeVisible();
    await expect(page.getByText('Write integration tests')).toBeVisible();

    await expect(page).toHaveScreenshot('dependency-graph-after-removal.png', {
      animations: 'disabled',
      fullPage: false,
    });
  });

  test('list view empty state screenshot', async ({ page }) => {
    await mockPageApisStatic(page);
    await registerDepsRoute(page, [], []);

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(STATIC_TASK.title).first()).toBeVisible({ timeout: 15_000 });

    // Switch to list view while empty — view toggle shows \"List\" active
    // but content shows empty state since there are no deps
    await page.getByTestId(DEP_GRAPH.toggleList).click();
    await expect(page.getByTestId(DEP_GRAPH.toggleList)).toHaveClass(/bg-brand-500/);
    await expect(page.getByTestId(DEP_GRAPH.emptyState)).toBeVisible();

    await expect(page).toHaveScreenshot('dependency-graph-list-empty.png', {
      animations: 'disabled',
      fullPage: false,
    });
  });
});
