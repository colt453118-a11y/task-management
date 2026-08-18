import { test, expect } from '@playwright/test';
import { mockProjectDetailApi, setSessionCookie } from './helpers/project-detail-mocks';

// ═══════════════════════════════════════════════════════════════
//  Setup
// ═══════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ═══════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Project Detail Page', () => {
  test('shows loading shimmer while the project is being fetched', async ({ page }) => {
    await mockProjectDetailApi(page, { delay: 600 });

    await page.goto('/projects/proj-1');

    await expect(page.locator('.shimmer').first()).toBeVisible({ timeout: 5_000 });
  });

  test('renders the project header, meta, and KPI stats', async ({ page }) => {
    await mockProjectDetailApi(page);

    await page.goto('/projects/proj-1');

    // Header
    await expect(page.getByRole('heading', { name: 'Website Redesign' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('WR-2026').first()).toBeVisible();

    // Breadcrumb back to projects
    await expect(page.getByRole('link', { name: /projects/i }).first()).toBeVisible();

    // Meta rail — owner + milestones (scope to main content; the sidebar also has
    // a "Milestones" nav link)
    const main = page.locator('#main-content');
    await expect(page.getByText('Jordan Rivera')).toBeVisible();
    await expect(main.getByText('Owner')).toBeVisible();
    await expect(main.getByText('Milestones')).toBeVisible();

    // Progress
    await expect(page.getByText('65%')).toBeVisible();

    // KPI stat cards with the correct numbers
    await expect(page.getByText('Total Tasks')).toBeVisible();
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Overdue').first()).toBeVisible();
    await expect(page.getByText('12').first()).toBeVisible(); // total
  });

  test('renders the project task table with rows', async ({ page }) => {
    await mockProjectDetailApi(page);

    await page.goto('/projects/proj-1');

    await expect(page.getByRole('heading', { name: 'Website Redesign' })).toBeVisible({
      timeout: 15_000,
    });

    // Task rows
    await expect(page.getByText('Design the new homepage')).toBeVisible();
    await expect(page.getByText('Migrate the blog content')).toBeVisible();
    await expect(page.getByText('WM-1001').first()).toBeVisible();

    // Task title links to the task detail page
    await expect(page.getByRole('link', { name: 'Design the new homepage' })).toHaveAttribute(
      'href',
      '/tasks/task-1',
    );
  });

  test('shows an empty state when the project has no tasks', async ({ page }) => {
    await mockProjectDetailApi(page, { tasks: [] });

    await page.goto('/projects/proj-1');

    await expect(page.getByRole('heading', { name: 'Website Redesign' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/no tasks in this project/i)).toBeVisible();
  });

  test('shows a not-found state for a missing project', async ({ page }) => {
    await mockProjectDetailApi(page, { notFound: true });

    await page.goto('/projects/does-not-exist');

    await expect(page.getByText(/project not found/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /back to projects/i })).toBeVisible();
  });
});
