import { test, expect, type Page } from '@playwright/test';
import { mockDashboardApis, MOCK_DASHBOARD_USERS } from './helpers/dashboard-mocks';
import { mockSearchApi } from './helpers/search-mocks';
import {
  TASK_ID,
  MOCK_TASK,
  setSessionCookie,
  mockPageApis,
} from './helpers/task-detail-mocks';

// ═══════════════════════════════════════════════════════════════
//  Setup
// ═══════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

/** Open the palette with ⌘K from the dashboard and wait for the input. */
async function openPalette(page: Page) {
  await page.keyboard.press('Control+KeyK');
  const input = page.getByPlaceholder(
    /search tasks, projects, people, or type a command/i,
  );
  await expect(input).toBeVisible({ timeout: 10_000 });
  return input;
}

// ═══════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Command Palette (⌘K)', () => {
  test('opens with ⌘K and shows navigation commands', async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    await openPalette(page);

    // Nav commands render in the "Jump to" group
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Jump to')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Tasks' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Projects' })).toBeVisible();

    // Action commands render in the "Actions" group
    await expect(dialog.getByText('Actions')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /new task/i })).toBeVisible();
  });

  test('types a query and shows cross-entity search results', async ({ page }) => {
    await mockDashboardApis(page);
    await mockSearchApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    const input = await openPalette(page);
    await input.fill('pay');

    // All three entity groups render with their hits
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Tasks')).toBeVisible();
    await expect(page.getByText('Payroll integration')).toBeVisible();
    await expect(dialog.getByText('Projects')).toBeVisible();
    await expect(page.getByText('Payments API')).toBeVisible();
    await expect(dialog.getByText('People')).toBeVisible();
    await expect(page.getByText('Payal Sharma')).toBeVisible();
  });

  test('New Task action opens the quick-create dialog', async ({ page }) => {
    await mockDashboardApis(page);
    // The create-task dialog fetches users for the assignee dropdown on open
    await page.route('**/api/users?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_DASHBOARD_USERS }),
      });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    await openPalette(page);

    // Run the New Task action command
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /new task/i })
      .click();

    // The palette dispatches open-quick-create → the quick-create dialog opens
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder(/what needs to be done/i),
    ).toBeVisible();

    // Assignee dropdown populated from the mocked users API.
    // The label isn't programmatically linked (no htmlFor/id), so locate the
    // select structurally instead of by accessible name; options inside a
    // collapsed native <select> are attached, not visible.
    await expect(
      page
        .getByRole('combobox')
        .filter({ has: page.getByRole('option', { name: /alice johnson/i }) }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /alice johnson/i }),
    ).toBeAttached();
  });

  test('quick-create form submits and navigates to the new task page', async ({ page }) => {
    await mockDashboardApis(page);
    // The task detail page renders after navigation — mock its APIs. Override
    // the detail GET (registered after mockPageApis, so last-wins) to return a
    // title unique to this test: MOCK_TASK.title would collide with
    // MOCK_DASHBOARD_TASKS[0].title during the dashboard→detail transition,
    // which is a strict-mode ambiguity risk for getByText.
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { ...MOCK_TASK, title: 'Ship the palette' } }),
      });
    });
    // The create-task dialog fetches users for the assignee dropdown on open
    await page.route('**/api/users?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_DASHBOARD_USERS }),
      });
    });

    // Capture the POST payload and return a created task whose id matches
    // mockPageApis (TASK_ID) so the detail page renders after navigation.
    let postedBody: Record<string, unknown> | null = null;
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      postedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { id: TASK_ID } }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open palette → run the New Task action → dialog opens
    await openPalette(page);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /new task/i })
      .click();
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Fill the form
    await page.getByPlaceholder(/what needs to be done/i).fill('Ship the palette');
    await page
      .getByPlaceholder(/add a description/i)
      .fill('Created from the command palette quick-create');
    await page
      .getByRole('combobox')
      .filter({ has: page.getByRole('option', { name: 'High' }) })
      .selectOption('high');
    await page
      .getByRole('combobox')
      .filter({ has: page.getByRole('option', { name: /alice johnson/i }) })
      .selectOption('user-1');

    // Submit
    await page.getByRole('button', { name: /^create$/i }).click();

    // The POST carried the filled form data
    await expect.poll(() => postedBody).toMatchObject({
      title: 'Ship the palette',
      description: 'Created from the command palette quick-create',
      priority: 'high',
      assignedTo: 'user-1',
    });

    // Dialog closed and we navigated to the new task's detail page
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).not.toBeVisible();
    // Generous timeout: on a cold firefox CI runner Next.js compiles the
    // target route on first navigation, which can exceed the 5s default.
    await expect(page).toHaveURL(new RegExp(`/tasks/${TASK_ID}`), {
      timeout: 15_000,
    });
    await expect(page.getByText('Ship the palette')).toBeVisible({ timeout: 15_000 });
  });

  test('quick-create shows an inline error and stays open when POST /api/tasks fails', async ({ page }) => {
    await mockDashboardApis(page);
    // The create-task dialog fetches users for the assignee dropdown on open
    await page.route('**/api/users?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_DASHBOARD_USERS }),
      });
    });

    // POST /api/tasks fails with 500 → the dialog renders the API error inline
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Mock server error creating task' },
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open palette → run the New Task action → dialog opens
    await openPalette(page);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /new task/i })
      .click();
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Fill the title and submit
    await page.getByPlaceholder(/what needs to be done/i).fill('This will fail');
    await page.getByRole('button', { name: /^create$/i }).click();

    // The API error message renders inline in the dialog
    await expect(page.getByText('Mock server error creating task')).toBeVisible({
      timeout: 10_000,
    });

    // Dialog stays open — no navigation happened
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    // The typed title is retained so the user can retry
    await expect(
      page.getByPlaceholder(/what needs to be done/i),
    ).toHaveValue('This will fail');
  });

  test('quick-create form submits with Enter (header: "Press Enter to submit")', async ({ page }) => {
    await mockDashboardApis(page);
    // The task detail page renders after navigation — mock its APIs. Override
    // the detail GET (registered after mockPageApis, so last-wins) to return a
    // title unique to this test: MOCK_TASK.title would collide with
    // MOCK_DASHBOARD_TASKS[0].title during the dashboard→detail transition,
    // which is a strict-mode ambiguity risk for getByText.
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { ...MOCK_TASK, title: 'Created with Enter' } }),
      });
    });
    // The create-task dialog fetches users for the assignee dropdown on open
    await page.route('**/api/users?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_DASHBOARD_USERS }),
      });
    });

    // Capture the POST payload and return a created task whose id matches
    // mockPageApis (TASK_ID) so the detail page renders after navigation.
    let postedBody: Record<string, unknown> | null = null;
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      postedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { id: TASK_ID } }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open palette → run the New Task action → dialog opens
    await openPalette(page);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /new task/i })
      .click();
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Fill the title and submit with Enter — the header says "Press Enter to
    // submit", so the native form submit fires (no Create click needed)
    const titleInput = page.getByPlaceholder(/what needs to be done/i);
    await titleInput.fill('Created with Enter');
    await titleInput.press('Enter');

    // The POST carried the filled title
    await expect.poll(() => postedBody).toMatchObject({
      title: 'Created with Enter',
    });

    // Dialog closed and we navigated to the new task's detail page
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).not.toBeVisible();
    // Generous timeout: on a cold firefox CI runner Next.js compiles the
    // target route on first navigation, which can exceed the 5s default.
    await expect(page).toHaveURL(new RegExp(`/tasks/${TASK_ID}`), {
      timeout: 15_000,
    });
    await expect(page.getByText('Created with Enter')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('quick-create opens via ⌘T shortcut and submits', async ({ page }) => {
    await mockDashboardApis(page);
    // The task detail page renders after navigation — mock its APIs. Override
    // the detail GET (registered after mockPageApis, so last-wins) to return a
    // title unique to this test: MOCK_TASK.title would collide with
    // MOCK_DASHBOARD_TASKS[0].title during the dashboard→detail transition,
    // which is a strict-mode ambiguity risk for getByText.
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { ...MOCK_TASK, title: 'Created via Cmd-T' } }),
      });
    });
    // The create-task dialog fetches users for the assignee dropdown on open
    await page.route('**/api/users?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_DASHBOARD_USERS }),
      });
    });

    // Capture the POST payload and return a created task whose id matches
    // mockPageApis (TASK_ID) so the detail page renders after navigation.
    let postedBody: Record<string, unknown> | null = null;
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      postedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { id: TASK_ID } }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // ⌘T (Ctrl+T on Linux/Windows) opens the quick-create dialog directly —
    // the shortcuts-provider dispatches open-quick-create and the topbar
    // handles the keydown itself; no palette involved.
    await page.keyboard.press('Control+KeyT');
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Fill the title and submit with Enter
    const titleInput = page.getByPlaceholder(/what needs to be done/i);
    await titleInput.fill('Created via Cmd-T');
    await titleInput.press('Enter');

    // The POST carried the filled title
    await expect.poll(() => postedBody).toMatchObject({
      title: 'Created via Cmd-T',
    });

    // Dialog closed and we navigated to the new task's detail page
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).not.toBeVisible();
    // Generous timeout: on a cold firefox CI runner Next.js compiles the
    // target route on first navigation, which can exceed the 5s default.
    await expect(page).toHaveURL(new RegExp(`/tasks/${TASK_ID}`), {
      timeout: 15_000,
    });
    await expect(page.getByText('Created via Cmd-T')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('quick-create shows validation error when title is empty', async ({ page }) => {
    await mockDashboardApis(page);
    // The create-task dialog fetches users for the assignee dropdown on open
    await page.route('**/api/users?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_DASHBOARD_USERS }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open palette → run the New Task action → dialog opens
    await openPalette(page);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /new task/i })
      .click();
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The Create button is disabled when title is empty (prevents implicit
    // submission via Enter — the HTML spec says a disabled default button
    // blocks implicit submission). Verify the disabled state, then re-enable
    // the button via evaluate and click it to trigger React's handleSubmit.
    const createBtn = page.getByRole('button', { name: /^create$/i });
    await expect(createBtn).toBeDisabled();

    // Remove the disabled attribute so clicking the button triggers the
    // form's onSubmit handler, which calls handleSubmit → checks
    // !title.trim() → setTitleError('Title is required').
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.removeAttribute('disabled');
    });
    await createBtn.click();

    // The inline validation error appears
    await expect(page.getByText('Title is required')).toBeVisible();

    // Typing clears the error
    await page.getByPlaceholder(/what needs to be done/i).fill('Now it has a title');
    await expect(page.getByText('Title is required')).not.toBeVisible();

    // The button is re-enabled (React's state controls the disabled prop;
    // after the evaluate removal, React re-renders and sets it back based
    // on title state — since title is now non-empty, it's enabled)
    await expect(createBtn).toBeEnabled();
  });

  test('quick-create opens via the topbar Quick button (⌘T-labeled) and submits', async ({ page }) => {
    await mockDashboardApis(page);
    // The task detail page renders after navigation — mock its APIs. Override
    // the detail GET (registered after mockPageApis, so last-wins) to return a
    // title unique to this test: MOCK_TASK.title would collide with
    // MOCK_DASHBOARD_TASKS[0].title during the dashboard→detail transition,
    // which is a strict-mode ambiguity risk for getByText.
    await mockPageApis(page);
    await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { ...MOCK_TASK, title: 'Created via Quick btn' } }),
      });
    });
    // The create-task dialog fetches users for the assignee dropdown on open
    await page.route('**/api/users?limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_DASHBOARD_USERS }),
      });
    });

    // Capture the POST payload and return a created task whose id matches
    // mockPageApis (TASK_ID) so the detail page renders after navigation.
    let postedBody: Record<string, unknown> | null = null;
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      postedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: { id: TASK_ID } }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // The topbar Quick button opens the quick-create dialog directly — same as
    // ⌘T shortcut but via a click. The accessible name differs by viewport:
    // - Desktop: visible text "Quick ⌘T" (the <span>Quick</span> is visible)
    // - Mobile: the visible text is hidden (sparkle icon only), so the title
    //   attribute "Quick create task (⌘T)" becomes the accessible-name fallback.
    // The mobile bottom nav has a different button with aria-label="Quick create
    // task" (no ⌘T suffix), so match the ⌘T/suffix to stay unambiguous.
    await page.getByRole('button', { name: /quick.*⌘T|quick create task \(⌘T\)/i }).click();
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Fill the title and submit with Enter
    const titleInput = page.getByPlaceholder(/what needs to be done/i);
    await titleInput.fill('Created via Quick btn');
    await titleInput.press('Enter');

    // The POST carried the filled title
    await expect.poll(() => postedBody).toMatchObject({
      title: 'Created via Quick btn',
    });

    // Dialog closed and we navigated to the new task's detail page
    await expect(
      page.getByRole('heading', { name: /quick create task/i }),
    ).not.toBeVisible();
    // Generous timeout: on a cold firefox CI runner Next.js compiles the
    // target route on first navigation, which can exceed the 5s default.
    await expect(page).toHaveURL(new RegExp(`/tasks/${TASK_ID}`), {
      timeout: 15_000,
    });
    await expect(page.getByText('Created via Quick btn')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('opens via the topbar search button (mobile path, no keyboard)', async ({ page }) => {
    await mockDashboardApis(page);
    await mockSearchApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Mobile users have no ⌘K — the topbar search button is the entry point.
    // The button's label differs by breakpoint ("Search tasks..." / "Search..."),
    // so match the shared prefix. The sidebar "Search" nav item is a link, not
    // a button, so this locator is unambiguous.
    await page.getByRole('button', { name: /^search/i }).click();

    const input = page.getByPlaceholder(
      /search tasks, projects, people, or type a command/i,
    );
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Typing and search still work once open
    await input.fill('pay');
    await expect(page.getByText('Payroll integration')).toBeVisible();
  });

  test('navigates with arrow keys and runs a nav command on Enter', async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    const input = await openPalette(page);
    await input.focus();

    // Default selection is the first nav command (Dashboard).
    // ArrowDown ×1 → Tasks (the second nav command).
    await page.keyboard.press('ArrowDown');

    // The Tasks row should now show the active indicator (ArrowRight icon)
    const dialog = page.getByRole('dialog');
    const tasksRow = dialog.getByRole('button', { name: 'Tasks' });
    await expect(tasksRow.locator('svg.lucide-arrow-right')).toBeVisible();

    // Enter runs the selected command → navigates to /tasks
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tasks/, { timeout: 15_000 });
  });

  test('closes on Escape and resets query + results when reopened', async ({ page }) => {
    await mockDashboardApis(page);
    await mockSearchApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open, type a query, confirm results
    const input = await openPalette(page);
    await input.fill('pay');
    await expect(page.getByText('Payroll integration')).toBeVisible();

    // Escape closes the palette
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Reopen — query, results, and selection are all reset to a clean slate
    await page.keyboard.press('Control+KeyK');
    const reopenedInput = page.getByPlaceholder(
      /search tasks, projects, people, or type a command/i,
    );
    await expect(reopenedInput).toBeVisible({ timeout: 10_000 });
    await expect(reopenedInput).toHaveValue('');

    // No stale results — nav commands are back in the Jump to group
    await expect(page.getByText('Payroll integration')).not.toBeVisible();
    await expect(page.getByRole('dialog').getByText('Jump to')).toBeVisible();

    // Selection reset to the top — the first nav command (Dashboard) is active again
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Dashboard' }).locator('svg.lucide-arrow-right'),
    ).toBeVisible();

    // ArrowDown moves to the next command (Tasks); Enter runs it → navigates to /tasks
    await reopenedInput.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tasks/, { timeout: 15_000 });
  });
});
