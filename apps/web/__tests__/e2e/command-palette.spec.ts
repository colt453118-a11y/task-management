import { test, expect, type Page } from '@playwright/test';
import { mockDashboardApis, MOCK_DASHBOARD_USERS } from './helpers/dashboard-mocks';
import { mockSearchApi } from './helpers/search-mocks';
import { setSessionCookie } from './helpers/task-detail-mocks';

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

    // Default selection is the first nav command (Search).
    // ArrowDown ×3 → Dashboard, Milestones, then Tasks.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // The Tasks row should now show the active indicator (ArrowRight icon)
    const dialog = page.getByRole('dialog');
    const tasksRow = dialog.getByRole('button', { name: 'Tasks' });
    await expect(tasksRow.locator('svg.lucide-arrow-right')).toBeVisible();

    // Enter runs the selected command → navigates to /tasks
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tasks/);
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

    // Selection reset — Enter runs the first command (Search → /search)
    await reopenedInput.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/search/);
  });
});
