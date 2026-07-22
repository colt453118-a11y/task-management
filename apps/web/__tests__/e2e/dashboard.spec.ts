import { test, expect } from '@playwright/test';
import {
  MOCK_DASHBOARD_TASKS,
  mockDashboardApis,
} from './helpers/dashboard-mocks';
import { setSessionCookie } from './helpers/task-detail-mocks';

// ═══════════════════════════════════════════════════════════════
//  Setup
// ═══════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ═══════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Dashboard', () => {
  test('shows loading shimmer while data is being fetched', async ({ page }) => {
    // Use a delay so we can observe the loading state before it resolves
    await mockDashboardApis(page, { delay: 500 });

    await page.goto('/');

    // Shimmer placeholders should be visible while loading
    await expect(page.locator('.shimmer').first()).toBeVisible({ timeout: 5_000 });

    // Title should appear
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('shows error state with retry button when APIs fail', async ({ page }) => {
    await mockDashboardApis(page, { abort: true });

    await page.goto('/');

    // Error card should appear
    await expect(page.getByText(/failed to load dashboard/i)).toBeVisible({ timeout: 15_000 });

    // Retry button should be present
    const retryButton = page.getByRole('button', { name: /try again/i });
    await expect(retryButton).toBeVisible();

    // Page should not crash — URL stays on dashboard
    expect(page.url()).toContain('/');
  });

  test('shows empty state when no tasks, projects, or users exist', async ({ page }) => {
    await mockDashboardApis(page, {
      tasks: [],
      projects: [],
      users: [],
    });

    await page.goto('/');

    // Wait for the page to hydrate
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });

    // KPI cards should show zeros
    await expect(page.getByText('Total Tasks')).toBeVisible();
    await expect(page.getByText('0').first()).toBeVisible();

    // Upcoming deadlines should show "All caught up!"
    await expect(page.getByText(/all caught up/i)).toBeVisible();
    await expect(page.getByText(/no upcoming deadlines/i)).toBeVisible();

    // Recent activity should show "No activity yet"
    await expect(page.getByText(/no activity yet/i)).toBeVisible();
  });

  test('renders KPI cards with correct data from APIs', async ({ page }) => {
    await mockDashboardApis(page);

    await page.goto('/');

    // Wait for the page to hydrate
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 15_000 });

    // Count tasks by status: 1 in_progress, 1 open, 1 completed, 1 blocked = 5 total (task-1 to task-5)
    await expect(page.getByText('Total Tasks')).toBeVisible();
    // Total = 5 (MOCK_DASHBOARD_TASKS has 5 items)
    await expect(page.getByText('5').first()).toBeVisible();

    // Overdue = 1 (task-4 has past due date)
    // Note: 'Overdue' also appears in task title 'Overdue database migration' in deadlines + activity
    await expect(page.getByText('Overdue').first()).toBeVisible();
    await expect(page.getByText('1').first()).toBeVisible();

    // Blocked = 1 (task-5)
    // Note: 'Blocked' also appears in task title 'Blocked by third-party API' in deadlines + activity
    await expect(page.getByText('Blocked').first()).toBeVisible();

    // Active Projects = 2 (proj-1, proj-2)
    await expect(page.getByText('Active Projects')).toBeVisible();
    await expect(page.getByText('2').first()).toBeVisible();

    // Team Members = 3
    await expect(page.getByText('Team Members')).toBeVisible();
    await expect(page.getByText('3').first()).toBeVisible();
  });

  test('shows welcome message with user name from session', async ({ page }) => {
    await mockDashboardApis(page, {
      session: { user: { name: 'Alice Johnson', id: 'user-1' } },
    });

    await page.goto('/');

    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/alice johnson/i)).toBeVisible();
  });

  test('shows "All systems operational" status indicator', async ({ page }) => {
    await mockDashboardApis(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/all systems operational/i)).toBeVisible();
  });

  test('renders upcoming deadlines with tasks that have due dates', async ({ page }) => {
    await mockDashboardApis(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Upcoming Deadlines section should exist
    await expect(page.getByText(/upcoming deadlines/i)).toBeVisible();

    // Tasks with due dates (not completed/closed) should appear:
    // task-1 (Implement user authentication) — due in 3d, in_progress
    // task-2 (Fix login page CSS) — due in 7d, open
    // task-5 (Blocked by third-party API) — due tomorrow, blocked
    // Note: task-4 is overdue (past due), so it should also appear if not completed/closed
    await expect(page.getByText(/Implement user authentication/i).first()).toBeVisible();
    // Note: task titles appear in both deadlines AND recent activity sections
    await expect(page.getByText(/Fix login page CSS/i).first()).toBeVisible();
    await expect(page.getByText(/Blocked by third-party API/i).first()).toBeVisible();

    // Overdue task should have urgent styling (highlighted with red border)
    await expect(page.getByText(/Overdue database migration/i).first()).toBeVisible();
  });

  test('renders recent activity with recently updated tasks', async ({ page }) => {
    await mockDashboardApis(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Recent Activity section should exist
    await expect(page.getByText(/recent activity/i)).toBeVisible();

    // Most recently updated tasks should be visible (sorted by updatedAt descending)
    // task-4 (updated 30m ago), task-1 (updated 1h ago), task-5 (updated 1h ago)
    await expect(page.getByText(/Overdue database migration/i).first()).toBeVisible();
    // Note: task titles appear in both deadlines AND recent activity sections
    await expect(page.getByText(/Implement user authentication/i).first()).toBeVisible();
    await expect(page.getByText(/Blocked by third-party API/i).first()).toBeVisible();
  });

  test('shows no deadlines message when no tasks have due dates', async ({ page }) => {
    // All tasks without due dates
    const tasksWithoutDates = MOCK_DASHBOARD_TASKS.filter((t) => !t.dueDate);
    await mockDashboardApis(page, { tasks: tasksWithoutDates as unknown as Record<string, unknown>[] });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Should show "All caught up!" and "No upcoming deadlines"
    await expect(page.getByText(/all caught up/i)).toBeVisible();
    await expect(page.getByText(/no upcoming deadlines/i)).toBeVisible();
  });

  test('shows no activity message when only completed tasks exist (empty recent)', async ({ page }) => {
    // Empty tasks array — no activity
    await mockDashboardApis(page, { tasks: [] });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Should show "No activity yet"
    await expect(page.getByText(/no activity yet/i)).toBeVisible();
  });

  test('retry button re-fetches data after error', async ({ page }) => {
    // First render with abort to cause error
    await mockDashboardApis(page, { abort: true });

    await page.goto('/');

    // Wait for error state
    await expect(page.getByText(/failed to load dashboard/i)).toBeVisible({ timeout: 15_000 });

    // Now re-mock with success data and click retry
    // Note: we need to register new routes that take precedence (LIFO)
    await mockDashboardApis(page, {
      tasks: MOCK_DASHBOARD_TASKS.slice(0, 1) as unknown as Record<string, unknown>[],
      projects: [],
      users: [],
    });

    // Click retry
    await page.getByRole('button', { name: /try again/i }).click();

    // Should now show dashboard content, not error
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Implement user authentication/i).first()).toBeVisible();
  });
});
