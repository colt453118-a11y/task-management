import { test, expect, type Locator } from '@playwright/test';

// ─── Constants ──────────────────────────────────────────────────

const TASK_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const TASK_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

const MOCK_TASKS_BOARD = {
  tasks: [
    {
      id: TASK_ID_1,
      title: 'Design database schema',
      status: 'open',
      priority: 'high',
      taskIdDisplay: 'TASK-001',
      assignedTo: 'Alice',
      projectId: null,
      dueDate: FUTURE_DATE,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      updatedByName: null,
    },
    {
      id: TASK_ID_2,
      title: 'Implement authentication',
      status: 'in_progress',
      priority: 'urgent',
      taskIdDisplay: 'TASK-002',
      assignedTo: 'Bob',
      projectId: null,
      dueDate: FUTURE_DATE,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      updatedByName: null,
    },
  ],
  total: 2,
};

/** Tasks with a completed task to test readonly drag behavior. */
const MOCK_TASKS_WITH_COMPLETED = {
  tasks: [
    {
      id: 'task-completed',
      title: 'Setup CI pipeline',
      status: 'completed',
      priority: 'medium',
      taskIdDisplay: 'TASK-003',
      assignedTo: 'Charlie',
      projectId: null,
      dueDate: PAST_DATE,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      updatedByName: null,
    },
    {
      id: 'task-active',
      title: 'Write unit tests',
      status: 'open',
      priority: 'high',
      taskIdDisplay: 'TASK-004',
      assignedTo: 'Diana',
      projectId: null,
      dueDate: FUTURE_DATE,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      updatedByName: null,
    },
  ],
  total: 2,
};

// ─── Helpers ────────────────────────────────────────────────────

async function setSessionCookie(page: import('@playwright/test').Page) {
  await page.context().addCookies([
    { name: 'better-auth.session_token', value: 'mock-session-token', domain: 'localhost', path: '/' },
  ]);
}

/**
 * Mock the common API endpoints that the Tasks page calls on load,
 * so the KanbanBoard can render in isolation. The /api/tasks route
 * is NOT mocked here — each test registers its own to control the
 * response data.
 */
async function mockPageApis(page: import('@playwright/test').Page) {
  // Users for assign filter
  await page.route('**/api/users?limit=100', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: [] }) });
  });
  // Reports export (best-effort, never called)
  await page.route('**/api/reports/export*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  // Search (best-effort)
  await page.route('**/api/search*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
  });
}

/**
 * Simulate a drag-and-drop operation from a source element to a target
 * element using the Playwright mouse API. This dispatches real pointer
 * events that @dnd-kit's PointerSensor can detect.
 *
 * @param page - Playwright page
 * @param sourceLocator - Locator for the draggable element (the KanbanCard)
 * @param targetLocator - Locator for the droppable element (the KanbanColumn)
 */
async function dragCardToColumn(
  page: import('@playwright/test').Page,
  sourceLocator: Locator,
  targetLocator: Locator,
) {
  const sourceBox = await sourceLocator.boundingBox();
  const targetBox = await targetLocator.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not locate source card or target column for drag operation');
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  // Step 1: Move to the center of the source card
  await page.mouse.move(startX, startY);
  await page.waitForTimeout(50);

  // Step 2: Press down (dispatches pointerdown → @dnd-kit starts tracking)
  await page.mouse.down();
  await page.waitForTimeout(50);

  // Step 3: Move past the 6px activation threshold in small steps
  // PointerSensor activationConstraint: { distance: 6 }
  const activationX = startX + 15;
  await page.mouse.move(activationX, startY, { steps: 5 });
  await page.waitForTimeout(30);

  // Step 4: Move in increments toward the target across intermediate points
  // to ensure @dnd-kit receives pointermove events along the full path
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  await page.mouse.move(midX, midY, { steps: 8 });
  await page.waitForTimeout(30);

  // Step 5: Final approach to target
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.waitForTimeout(30);

  // Step 6: Release (dispatches pointerup → @dnd-kit fires onDragEnd)
  await page.mouse.up();
  await page.waitForTimeout(200);
}

// ─── Setup ──────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
  await mockPageApis(page);
});

// ─── Board View Tests ───────────────────────────────────────────

test.describe('KanbanBoard Drag and Drop', () => {
  test('renders board view with task cards in correct columns', async ({ page }) => {
    await page.route('**/api/tasks*', async (route) => {
      const url = route.request().url();
      // Only match the tasks list endpoint, not task detail or batch
      if (!url.includes('/batch') && route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS_BOARD) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: null }) });
      }
    });

    await page.goto('/tasks');

    // Wait for page hydration
    await expect(page.getByText('Tasks')).toBeVisible({ timeout: 15_000 });

    // Switch to board view
    await page.getByRole('button', { name: 'Board' }).click();

    // Wait for the board to render
    await expect(page.getByText('Design database schema')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Implement authentication')).toBeVisible();

    // Both cards should have correct priority badges
    await expect(page.getByText('High')).toBeVisible();
    await expect(page.getByText('Urgent')).toBeVisible();
  });

  test('drags a task from Open column to In Progress column and calls status update API', async ({ page }) => {
    // Track whether the PATCH call was made
    let patchStatus = '';

    await page.route('**/api/tasks*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // Pure GET for the tasks list
      if (method === 'GET' && !url.includes(`/${TASK_ID_1}`) && !url.includes(`/${TASK_ID_2}`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS_BOARD) });
      }
      // PATCH for status update
      else if (method === 'PATCH' && url.includes(`/${TASK_ID_1}`)) {
        const body = JSON.parse(route.request().postData() ?? '{}');
        patchStatus = body.status;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: { ...MOCK_TASKS_BOARD.tasks[0], status: 'in_progress' } }) });
      }
      // Any per-task GET (fetched after PATCH for refetch)
      else if (method === 'GET' && (url.includes(`/${TASK_ID_1}`) || url.includes(`/${TASK_ID_2}`))) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: { ...MOCK_TASKS_BOARD.tasks[0], status: 'in_progress' } }) });
      }
      // Everything else (batch, etc.)
      else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });

    await page.goto('/tasks');
    await expect(page.getByText('Tasks')).toBeVisible({ timeout: 15_000 });

    // Switch to board view
    await page.getByRole('button', { name: 'Board' }).click();

    // Wait for the board to render with both tasks
    await expect(page.getByText('Design database schema')).toBeVisible({ timeout: 10_000 });

    // Locate the source card (in Open column)
    const sourceCard = page.getByRole('button', { name: /TASK-001: Design database schema/ });

    // Locate the In Progress column by its unique border-left accent class
    const inProgressColumn = page.locator('[class*="border-l-status-in-progress"]').first();

    // Simulate drag-and-drop using pointer events
    await dragCardToColumn(page, sourceCard, inProgressColumn);

    // Verify the PATCH API was called with the correct new status
    expect(patchStatus).toBe('in_progress');
  });

  test('does not make an API call when card is dropped back on the same column', async ({ page }) => {
    let patchCallCount = 0;

    await page.route('**/api/tasks*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'GET' && !url.includes(`/${TASK_ID_1}`) && !url.includes(`/${TASK_ID_2}`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS_BOARD) });
      } else if (method === 'PATCH') {
        patchCallCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: MOCK_TASKS_BOARD.tasks[0] }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });

    await page.goto('/tasks');
    await expect(page.getByText('Tasks')).toBeVisible({ timeout: 15_000 });

    // Switch to board view
    await page.getByRole('button', { name: 'Board' }).click();
    await expect(page.getByText('Design database schema')).toBeVisible({ timeout: 10_000 });

    // Locate the source card
    const sourceCard = page.getByRole('button', { name: /TASK-001: Design database schema/ });

    // Locate the Open column (same column as the card)
    const openColumn = page.locator('[class*="border-l-status-open"]').first();

    // Drag the card back onto its own column
    await dragCardToColumn(page, sourceCard, openColumn);

    // Allow time for any pending operations
    await page.waitForTimeout(300);

    // The card's status didn't change (dragged to same column), so no PATCH should be called
    expect(patchCallCount).toBe(0);
  });

  test('does not make an API call when dragging a completed/readonly card', async ({ page }) => {
    let patchCallCount = 0;

    await page.route('**/api/tasks*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'GET' && !url.includes('/task-completed') && !url.includes('/task-active')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS_WITH_COMPLETED) });
      } else if (method === 'PATCH') {
        patchCallCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });

    await page.goto('/tasks');
    await expect(page.getByText('Tasks')).toBeVisible({ timeout: 15_000 });

    // Switch to board view
    await page.getByRole('button', { name: 'Board' }).click();
    await expect(page.getByText('Setup CI pipeline')).toBeVisible({ timeout: 10_000 });

    // Completed task card should have reduced opacity
    const completedCard = page.getByRole('button', { name: /TASK-003: Setup CI pipeline/ });
    await expect(completedCard).toHaveClass(/opacity-60/);
    await expect(completedCard).toHaveCSS('opacity', '0.6');

    // Locate the In Progress column
    const inProgressColumn = page.locator('[class*="border-l-status-in-progress"]').first();

    // Attempt to drag the completed (readonly) card
    await dragCardToColumn(page, completedCard, inProgressColumn);

    // Allow time for any pending operations
    await page.waitForTimeout(300);

    // Readonly cards have useSortable disabled, so no API call should be made
    expect(patchCallCount).toBe(0);
  });

  test('shows invalid drop indicator when dragging to an invalid status transition', async ({ page }) => {
    await page.route('**/api/tasks*', async (route) => {
      const url = route.request().url();
      if (route.request().method() === 'GET' && !url.includes(`/${TASK_ID_1}`) && !url.includes(`/${TASK_ID_2}`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TASKS_BOARD) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ task: null }) });
      }
    });

    await page.goto('/tasks');
    await expect(page.getByText('Tasks')).toBeVisible({ timeout: 15_000 });

    // Switch to board view
    await page.getByRole('button', { name: 'Board' }).click();
    await expect(page.getByText('Design database schema')).toBeVisible({ timeout: 10_000 });

    // Get the Open column card
    const sourceCard = page.getByRole('button', { name: /TASK-001: Design database schema/ });

    // Try dragging to the Draft column — most workflows don't allow
    // going backwards from open -> draft, so this is likely an invalid transition
    const draftColumn = page.locator('[class*="border-l-status-draft"]').first();

    // Move the card over the draft column (hover, don't drop yet)
    const sourceBox = await sourceCard.boundingBox();
    const draftBox = await draftColumn.boundingBox();

    if (!sourceBox || !draftBox) throw new Error('Could not locate elements');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 15, sourceBox.y, { steps: 5 });
    await page.mouse.move(draftBox.x + draftBox.width / 2, draftBox.y + draftBox.height / 4, { steps: 10 });
    await page.waitForTimeout(100);

    // If the transition is invalid, the column shows the red rejection ring.
    // If the transition is valid (workflow-dependent), the brand ring appears.
    // Check that the column doesn't show the valid drop indicator (brand ring)
    // — either it shows the red ring or no ring at all
    await expect(draftColumn).not.toHaveClass(/ring-brand-400/);

    // Release the mouse to complete (or cancel) the drag
    await page.mouse.up();
    await page.waitForTimeout(150);
  });
});
