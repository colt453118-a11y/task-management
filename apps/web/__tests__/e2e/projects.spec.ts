import { test, expect } from '@playwright/test';
import {
  MOCK_PROJECTS,
  mockProjectsApi,
} from './helpers/projects-mocks';
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

test.describe('Projects Page', () => {
  test('shows loading shimmer while projects are being fetched', async ({ page }) => {
    await mockProjectsApi(page, { delay: 500 });

    await page.goto('/projects');

    // Shimmer placeholders should be visible while loading
    await expect(page.locator('.shimmer').first()).toBeVisible({ timeout: 5_000 });

    // Title should appear
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  });

  test('shows error state with retry button when API fails', async ({ page }) => {
    await mockProjectsApi(page, { abort: true });

    await page.goto('/projects');

    // Error card should appear
    await expect(page.getByText(/failed to load projects/i)).toBeVisible({ timeout: 15_000 });

    // Retry button should be present
    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();

    // Page should not crash — URL stays on projects
    expect(page.url()).toContain('/projects');
  });

  test('shows empty state when no projects exist', async ({ page }) => {
    await mockProjectsApi(page, { projects: [] });

    await page.goto('/projects');

    // Wait for the page to hydrate
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Empty state should show
    await expect(page.getByText(/no projects yet/i)).toBeVisible();
    await expect(page.getByText(/organize your work into projects/i)).toBeVisible();

    // Create button should exist in empty state
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible();
  });

  test('renders project cards with correct data from API', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    // Wait for page to hydrate
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Project count should show
    await expect(page.getByText(/5 projects?/i)).toBeVisible();

    // Each project name should be visible
    await expect(page.getByText(/Website Redesign/i)).toBeVisible();
    await expect(page.getByText(/Backend Migration/i)).toBeVisible();
    await expect(page.getByText(/Mobile App v2/i)).toBeVisible();
    await expect(page.getByText(/Data Analytics Platform/i)).toBeVisible();
    await expect(page.getByText(/Legacy Archive/i).first()).toBeVisible();

    // Project codes should be visible
    for (const proj of MOCK_PROJECTS) {
      if (proj.code) {
        await expect(page.getByText(proj.code).first()).toBeVisible();
      }
    }

    // Status badges should be visible (Title-Cased labels)
    await expect(page.getByText('Active').first()).toBeVisible();
    await expect(page.getByText('On Hold').first()).toBeVisible();
    await expect(page.getByText('Completed').first()).toBeVisible();
    await expect(page.getByText('Archived').first()).toBeVisible();

    // Each card links to its project detail page
    await expect(page.getByRole('link', { name: 'Open Website Redesign' })).toHaveAttribute(
      'href',
      '/projects/proj-1',
    );
  });

  test('shows progress bars with correct percentages', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Progress percentages should be rendered
    await expect(page.getByText('65%')).toBeVisible();
    await expect(page.getByText('30%')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
  });

  test('renders project date ranges when available', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Projects with dates should show date text
    // Website Redesign has both start and end dates
    await expect(page.getByText(/Start:/).first()).toBeVisible();
    await expect(page.getByText(/End:/).first()).toBeVisible();
  });

  test('filters projects by search query (name match)', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Search for a specific project
    const searchInput = page.getByPlaceholder(/search projects/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Redesign');

    // Should show matching project
    await expect(page.getByText(/Website Redesign/i).first()).toBeVisible();

    // Non-matching projects should not be visible (note: the page filters but may
    // still render hidden items in the motion layout — check the search results text)
    await expect(page.getByText(/Backend Migration/i)).not.toBeVisible();
  });

  test('shows no results message when search yields no matches', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Search for something that doesn't match
    const searchInput = page.getByPlaceholder(/search projects/i);
    await searchInput.fill('zzzzzzzzz');

    // Should show no results message
    await expect(page.getByText(/no projects match your search/i)).toBeVisible();
  });

  test('opens create project modal and shows validation error for empty name', async ({
    page,
  }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Click New Project button
    await page.getByRole('button', { name: /new project/i }).click();

    // Modal should appear
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();

    // Click create with empty name
    await page.getByRole('button', { name: /create$/i }).first().click();

    // Validation error should appear
    await expect(page.getByText(/project name is required/i)).toBeVisible();
  });

  test('creates a project successfully via modal', async ({ page }) => {
    // Set up mock that handles both GET and POST
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Open create modal
    await page.getByRole('button', { name: /new project/i }).click();
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();

    // Fill the form
    const nameInput = page.getByPlaceholder(/e\.g\. Q4 Product Launch/i);
    await nameInput.fill('Q4 Product Launch');

    const codeInput = page.getByPlaceholder(/e\.g\. Q4-2026/i);
    await codeInput.fill('Q4-2026');

    const descInput = page.getByPlaceholder(/optional description/i);
    await descInput.fill('Coordinate Q4 product launch across all teams');

    // Submit
    // On mobile, sidebar may add extra Create-like buttons, so use first()
    await page.getByRole('button', { name: /create$/i }).first().click();

    // Wait for modal to close and new project to appear in the list
    // Note: text also appears in the closed modal's input value, use .first()
    await expect(page.getByText('Q4 Product Launch').first()).toBeVisible({ timeout: 5_000 });

    // Modal should be closed
    await expect(page.getByRole('heading', { name: /new project/i })).not.toBeVisible();
  });

  test('shows error message when project creation fails', async ({ page }) => {
    await mockProjectsApi(page, {
      createErrorStatus: 400,
      createErrorBody: { error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
    });

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Open create modal
    await page.getByRole('button', { name: /new project/i }).click();
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();

    // Fill the form and submit
    const nameInput = page.getByPlaceholder(/e\.g\. Q4 Product Launch/i);
    await nameInput.fill('Some Project');
    await page.getByRole('button', { name: /create$/i }).first().click();

    // Error should appear in the modal
    await expect(page.getByText(/Name is required/i)).toBeVisible({ timeout: 5_000 });

    // Modal should still be open
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();
  });

  test('closes create modal on cancel', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Open modal
    await page.getByRole('button', { name: /new project/i }).click();
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();

    // Click Cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Modal should close
    await expect(page.getByRole('heading', { name: /new project/i })).not.toBeVisible();
  });

  test('edits a project via the edit button and prefilled modal', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Open the edit modal for a specific project (hover-revealed button)
    await page.getByRole('button', { name: 'Edit Website Redesign' }).click();
    await expect(page.getByRole('heading', { name: /edit project/i })).toBeVisible();

    // The form should be prefilled with the project's current values
    const nameInput = page.getByPlaceholder(/e\.g\. Q4 Product Launch/i);
    await expect(nameInput).toHaveValue('Website Redesign');

    // Change the name and save
    await nameInput.fill('Website Redesign v2');
    await page.getByRole('button', { name: /save$/i }).first().click();

    // Modal closes and the card reflects the new name
    await expect(page.getByRole('heading', { name: /edit project/i })).not.toBeVisible();
    await expect(page.getByText('Website Redesign v2').first()).toBeVisible({ timeout: 5_000 });
  });

  test('deletes a project via the delete confirmation', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Backend Migration').first()).toBeVisible();

    // Open the delete confirmation for a specific project
    await page.getByRole('button', { name: 'Delete Backend Migration' }).click();
    await expect(page.getByRole('heading', { name: /delete project/i })).toBeVisible();

    // Confirm the deletion (exact "Delete" — the card buttons are "Delete <name>")
    await page.getByRole('button', { name: /^delete$/i }).click();

    // Modal closes and the project is removed from the list
    await expect(page.getByRole('heading', { name: /delete project/i })).not.toBeVisible();
    await expect(page.getByText('Backend Migration')).not.toBeVisible({ timeout: 5_000 });
  });

  test('cancels the delete confirmation without removing the project', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Delete Backend Migration' }).click();
    await expect(page.getByRole('heading', { name: /delete project/i })).toBeVisible();

    // Cancel keeps the project
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: /delete project/i })).not.toBeVisible();
    await expect(page.getByText('Backend Migration').first()).toBeVisible();
  });

  test('shows an error when deleting a project fails', async ({ page }) => {
    await mockProjectsApi(page, { deleteErrorStatus: 500 });

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Delete Website Redesign' }).click();
    await expect(page.getByRole('heading', { name: /delete project/i })).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();

    // The error surfaces and the modal stays open
    await expect(page.getByText(/delete failed/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /delete project/i })).toBeVisible();
  });
});
