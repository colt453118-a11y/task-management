import { test, expect } from '@playwright/test';

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
};

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Set a mock session cookie so the middleware allows access to
 * protected routes. The value just needs to be non-empty — the
 * task detail page and watchers endpoint are all mocked via route
 * interception.
 */
async function setSessionCookie(page: import('@playwright/test').Page) {
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * Mock all non-watcher API endpoints the task detail page calls so the
 * TaskWatcherButton component can render in isolation.
 *
 * NOTE: Does NOT register a /watchers route — each test registers its
 * own to avoid Playwright's last-registered-wins route override issue.
 */
async function mockPageApis(page: import('@playwright/test').Page) {
  // Task detail
  await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ task: MOCK_TASK }),
    });
  });

  // Comments — empty
  await page.route(`**/api/tasks/${TASK_ID}/comments`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ comments: [] }),
    });
  });

  // Attachments — empty
  await page.route(`**/api/tasks/${TASK_ID}/attachments`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ attachments: [] }),
    });
  });

  // Dependencies — empty
  await page.route(`**/api/tasks/${TASK_ID}/dependencies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ blockedBy: [], blocking: [] }),
    });
  });

  // Time entries — empty
  await page.route(`**/api/tasks/${TASK_ID}/time-entries`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [] }),
    });
  });

  // Activity history — empty
  await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ history: [] }),
    });
  });
}

/** Register a simple GET-only watchers endpoint returning the given state. */
async function mockWatchersGet(
  page: import('@playwright/test').Page,
  isWatching: boolean,
  watcherCount: number,
) {
  await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
    await route.fulfill({
      status: route.request().method() === 'GET' ? 200 : 201,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().method() === 'GET'
          ? { isWatching, watcherCount }
          : { success: true },
      ),
    });
  });
}

// ─── Setup ──────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Tests ──────────────────────────────────────────────────────

test.describe('TaskWatcherButton', () => {
  test('renders "Watch" button when not watching', async ({ page }) => {
    await mockPageApis(page);
    await mockWatchersGet(page, false, 0);

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate — task title is a reliable indicator
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // The button should say "Watch" (not Watching).
    // When watcherCount is 0, no badge is rendered, so accessible name is "Watch".
    const watchButton = page.getByRole('button', { name: 'Watch' });
    await expect(watchButton).toBeVisible();
    await expect(watchButton).not.toBeDisabled();
  });

  test('renders "Watching" button with count when watching', async ({ page }) => {
    await mockPageApis(page);
    await mockWatchersGet(page, true, 5);

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // The button should say "Watching" — accessible name is "Watching 5"
    // (the count badge contributes to the accessible name).
    const watchingButton = page.getByRole('button', { name: /watching/i });
    await expect(watchingButton).toBeVisible();
    await expect(watchingButton).not.toBeDisabled();
    await expect(watchingButton).toContainText('5');
  });

  test('clicking Watch sends POST and updates to Watching with incremented count', async ({ page }) => {
    // Track POST calls
    let postCalled = false;

    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ isWatching: false, watcherCount: 3 }),
        });
      } else if (method === 'POST') {
        postCalled = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // The button should say "Watch 3" (accessible name includes the count badge).
    // Use a negative lookahead to match "Watch" but not "Watching".
    const watchButton = page.getByRole('button', { name: /Watch(?!ing)/ });
    await expect(watchButton).toBeVisible();
    await watchButton.click();

    // After clicking, the button should show "Watching" with incremented count
    const watchingButton = page.getByRole('button', { name: /watching/i });
    await expect(watchingButton).toBeVisible({ timeout: 5_000 });
    await expect(watchingButton).toContainText('4');
    expect(postCalled).toBe(true);
  });

  test('clicking Watching sends DELETE and reverts to Watch with decremented count', async ({ page }) => {
    // Track DELETE calls
    let deleteCalled = false;

    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ isWatching: true, watcherCount: 5 }),
        });
      } else if (method === 'DELETE') {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // The button should say "Watching 5" (accessible name includes the count badge).
    const watchingButton = page.getByRole('button', { name: /watching/i });
    await expect(watchingButton).toBeVisible();
    await watchingButton.click();

    // After clicking, the button should revert to "Watch" with decremented count.
    // Use a negative lookahead to match "Watch" but not "Watching".
    const watchButton = page.getByRole('button', { name: /Watch(?!ing)/ });
    await expect(watchButton).toBeVisible({ timeout: 5_000 });
    await expect(watchButton).toContainText('4');
    expect(deleteCalled).toBe(true);
  });

  test('shows shimmer loading state while fetching watchers', async ({ page }) => {
    await mockPageApis(page);
    // Register a delayed watcher route — registers AFTER mockPageApis so it takes precedence
    await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isWatching: false, watcherCount: 0 }),
      });
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // The TaskWatcherButton is rendered inside a flex container alongside the
    // Duplicate button. Look for a shimmer element that follows the Duplicate button.
    const shimmer = page.locator(
      'button:has-text("Duplicate") + div.shimmer, button:has-text("Duplicate") ~ div.shimmer',
    );
    await expect(shimmer).toBeVisible({ timeout: 2_000 });

    // After the delayed response resolves, the actual button should appear (count is 0,
    // so accessible name is just "Watch").
    const watchButton = page.getByRole('button', { name: 'Watch' });
    await expect(watchButton).toBeVisible({ timeout: 3_000 });
    await expect(shimmer).not.toBeVisible();
  });

  test('handles API error gracefully without crashing the page', async ({ page }) => {
    await mockPageApis(page);
    // Register a failing watcher route — registers AFTER mockPageApis so it takes precedence
    await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.abort('connectionrefused');
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate — the task should still render
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // After a failed fetch, the component falls back to default state:
    // not watching, watcherCount=0, so accessible name is just "Watch".
    const watchButton = page.getByRole('button', { name: 'Watch' });
    await expect(watchButton).toBeVisible({ timeout: 5_000 });
    await expect(watchButton).not.toBeDisabled();

    // The task metadata should still be visible (page did not crash)
    await expect(page.getByText('TASK-001')).toBeVisible();
  });
});
