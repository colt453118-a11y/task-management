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

const CHECKLIST_ITEMS = [
  { id: 'cl-1', taskId: TASK_ID, content: 'Set up database schema', isChecked: false, checkedBy: null, checkedAt: null, sortOrder: 0, createdAt: new Date(Date.now() - 3600 * 1000).toISOString() },
  { id: 'cl-2', taskId: TASK_ID, content: 'Create API endpoints', isChecked: true, checkedBy: 'user-123', checkedAt: new Date().toISOString(), sortOrder: 1, createdAt: new Date(Date.now() - 1800 * 1000).toISOString() },
  { id: 'cl-3', taskId: TASK_ID, content: 'Write unit tests', isChecked: false, checkedBy: null, checkedAt: null, sortOrder: 2, createdAt: new Date().toISOString() },
];

const HISTORY_ENTRIES = [
  { id: 'hist-1', taskId: TASK_ID, userId: 'user-123', field: 'status', oldValue: 'open', newValue: 'in_progress', changeType: 'status_change', description: 'Changed status from open to in_progress', createdAt: new Date(Date.now() - 600 * 1000).toISOString(), user: { id: 'user-123', name: 'Alice Johnson', avatarUrl: null } },
  { id: 'hist-2', taskId: TASK_ID, userId: 'user-456', field: 'assignedTo', oldValue: null, newValue: 'user-123', changeType: 'assignment', description: 'Assigned to Alice Johnson', createdAt: new Date(Date.now() - 1200 * 1000).toISOString(), user: { id: 'user-456', name: 'Bob Smith', avatarUrl: null } },
  { id: 'hist-3', taskId: TASK_ID, userId: 'user-123', field: 'title', oldValue: null, newValue: 'Implement user authentication', changeType: 'creation', description: 'Created this task', createdAt: new Date(Date.now() - 3600 * 1000).toISOString(), user: { id: 'user-123', name: 'Alice Johnson', avatarUrl: null } },
  { id: 'hist-4', taskId: TASK_ID, userId: 'system', field: 'priority', oldValue: 'medium', newValue: 'high', changeType: 'update', description: 'Changed priority from medium to high', createdAt: new Date(Date.now() - 2400 * 1000).toISOString(), user: null },
];

// ─── Helpers ────────────────────────────────────────────────────

async function setSessionCookie(page: import('@playwright/test').Page) {
  await page.context().addCookies([
    { name: 'better-auth.session_token', value: 'mock-session-token', domain: 'localhost', path: '/' },
  ]);
}

/**
 * Mock all API endpoints the task detail page calls so the
 * TaskChecklist and TaskActivityFeed components can render in isolation.
 *
 * NOTE: Does NOT register a /checklist or /history route — those are
 * registered per-test so each test can control its own response.
 */
async function mockPageApis(page: import('@playwright/test').Page) {
  // Task detail
  await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: MOCK_TASK }) });
  });

  // Comments — empty
  await page.route(`**/api/tasks/${TASK_ID}/comments`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) });
  });

  // Attachments — empty
  await page.route(`**/api/tasks/${TASK_ID}/attachments`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ attachments: [] }) });
  });

  // Dependencies — empty
  await page.route(`**/api/tasks/${TASK_ID}/dependencies`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blockedBy: [], blocking: [] }) });
  });

  // Time entries — empty
  await page.route(`**/api/tasks/${TASK_ID}/time-entries`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) });
  });

  // Watchers — empty/default (needed because TaskWatcherButton is also on the page)
  await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isWatching: false, watcherCount: 0 }) });
  });
}

// ─── Setup ──────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Checklist Tests ────────────────────────────────────────────

test.describe('TaskChecklist', () => {
  test('renders checklist items with checkbox, content, and progress', async ({ page }) => {
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/checklist`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: CHECKLIST_ITEMS }) });
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the task detail page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Checklist items should render
    await expect(page.getByText('Set up database schema')).toBeVisible();
    await expect(page.getByText('Create API endpoints')).toBeVisible();
    await expect(page.getByText('Write unit tests')).toBeVisible();

    // Progress should show 1 of 3 done (checked item with line-through)
    await expect(page.getByText('1 of 3 done')).toBeVisible();
    await expect(page.getByText('33%')).toBeVisible();
    await expect(page.getByText('Create API endpoints')).toHaveClass(/line-through/);

    // Add input should be visible (status is in_progress, not closed/archived)
    await expect(page.getByPlaceholder('Add checklist item...')).toBeVisible();
  });

  test('adds a new checklist item', async ({ page }) => {
    const newItem = { id: 'cl-new', taskId: TASK_ID, content: 'Write Playwright tests', isChecked: false, checkedBy: null, checkedAt: null, sortOrder: 3, createdAt: new Date().toISOString() };

    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/checklist`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
      } else if (method === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: newItem }) });
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration — empty state should show
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No checklist items yet. Add one below.')).toBeVisible();

    // Type into the add input and submit
    const input = page.getByPlaceholder('Add checklist item...');
    await input.fill('Write Playwright tests');
    await input.press('Enter');

    // The new item should appear
    await expect(page.getByText('Write Playwright tests')).toBeVisible({ timeout: 5_000 });

    // Progress should update
    await expect(page.getByText('0 of 1 done')).toBeVisible();
  });

  test('toggles a checklist item', async ({ page }) => {
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/checklist`, async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: CHECKLIST_ITEMS }) });
      } else if (method === 'PATCH' && url.includes('itemId=cl-1')) {
        // Return the toggled item
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: { ...CHECKLIST_ITEMS[0]!, isChecked: true } }) });
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();

    // The first checkbox should be unchecked
    const checkboxes = page.getByRole('checkbox');
    await expect(checkboxes.nth(0)).not.toBeChecked();

    // Click the first checkbox to check it
    await checkboxes.nth(0).click();

    // After toggling, progress should go from 1 of 3 to 2 of 3
    await expect(page.getByText('2 of 3 done')).toBeVisible({ timeout: 5_000 });
    await expect(checkboxes.nth(0)).toBeChecked();
  });

  test('shows completion celebration when all items checked', async ({ page }) => {
    const allDoneItems = CHECKLIST_ITEMS.map((item) => ({ ...item, isChecked: true }));

    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/checklist`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: allDoneItems }) });
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // All items should be checked (line-through)
    await expect(page.getByText('Set up database schema')).toHaveClass(/line-through/);
    await expect(page.getByText('Create API endpoints')).toHaveClass(/line-through/);
    await expect(page.getByText('Write unit tests')).toHaveClass(/line-through/);

    // Progress should show 100%
    await expect(page.getByText('3 of 3 done')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();

    // Completion celebration
    await expect(page.getByText('✓ All done!')).toBeVisible();
  });

  test('hides add input and action buttons when task is closed', async ({ page }) => {
    const closedTask = { ...MOCK_TASK, status: 'closed' };

    await mockPageApis(page);
    // Override the task detail to return a closed task
    await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: closedTask }) });
    });
    await page.route(`**/api/tasks/${TASK_ID}/checklist`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: CHECKLIST_ITEMS }) });
      } else {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Add input should NOT be rendered for closed tasks
    await expect(page.getByPlaceholder('Add checklist item...')).not.toBeVisible();

    // Items should still render
    await expect(page.getByText('Set up database schema')).toBeVisible();
  });
});

// ─── Activity Feed Tests ────────────────────────────────────────

test.describe('TaskActivityFeed', () => {
  test('shows empty state when no activity exists', async ({ page }) => {
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: [] }) });
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Activity section header
    await expect(page.getByText('Activity')).toBeVisible();

    // Empty state
    await expect(page.getByText('No activity yet')).toBeVisible();
    await expect(page.getByText('Changes to this task will appear here')).toBeVisible();
  });

  test('renders history entries with user names and descriptions', async ({ page }) => {
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: HISTORY_ENTRIES }) });
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // User names should appear
    await expect(page.getByText('Alice Johnson').first()).toBeVisible();
    await expect(page.getByText('Bob Smith')).toBeVisible();

    // Descriptions should appear
    await expect(page.getByText('Changed status from open to in_progress')).toBeVisible();
    await expect(page.getByText('Assigned to Alice Johnson')).toBeVisible();
    await expect(page.getByText('Created this task')).toBeVisible();
    await expect(page.getByText('Changed priority from medium to high')).toBeVisible();

    // "System" should appear for entries with no user
    await expect(page.getByText('System')).toBeVisible();
  });

  test('shows error state when history fetch fails', async ({ page }) => {
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
      await route.abort('connectionrefused');
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Error state should render
    await expect(page.getByText('Failed to load activity history')).toBeVisible();
  });

  test('renders multiple entries from different users in the timeline', async ({ page }) => {
    const manyEntries = [
      ...HISTORY_ENTRIES,
      { id: 'hist-5', taskId: TASK_ID, userId: 'user-789', field: 'dueDate', oldValue: null, newValue: '2026-08-01', changeType: 'update', description: 'Set due date to Aug 1, 2026', createdAt: new Date(Date.now() - 100 * 1000).toISOString(), user: { id: 'user-789', name: 'Carol Williams', avatarUrl: null } },
    ];

    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ history: manyEntries }) });
    });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // All three users should appear
    await expect(page.getByText('Alice Johnson').first()).toBeVisible();
    await expect(page.getByText('Bob Smith')).toBeVisible();
    await expect(page.getByText('Carol Williams')).toBeVisible();
  });
});
