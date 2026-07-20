import { test, expect } from '@playwright/test';
import {
  TASK_ID,
  MOCK_TASK,
  setSessionCookie,
  mockPageApis,
  registerWatcherRoute,
} from './helpers/task-detail-mocks';

// ─── Setup ──────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Tests ──────────────────────────────────────────────────────

test.describe('TaskWatcherButton', () => {
  test('renders "Watch" button when not watching', async ({ page }) => {
    await mockPageApis(page);
    await registerWatcherRoute(page, { state: { isWatching: false, watcherCount: 0 } });

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
    await registerWatcherRoute(page, { state: { isWatching: true, watcherCount: 5 } });

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

  test('clicking Watch sends POST and updates to Watching with incremented count', async ({
    page,
  }) => {
    // Track POST calls
    let postCalled = false;

    await mockPageApis(page);
    await registerWatcherRoute(page, {
      state: { isWatching: false, watcherCount: 3 },
      onPost: async (route) => {
        postCalled = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      },
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

  test('clicking Watching sends DELETE and reverts to Watch with decremented count', async ({
    page,
  }) => {
    // Track DELETE calls
    let deleteCalled = false;

    await mockPageApis(page);
    await registerWatcherRoute(page, {
      state: { isWatching: true, watcherCount: 5 },
      onDelete: async (route) => {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      },
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
    await registerWatcherRoute(page, {
      state: { isWatching: false, watcherCount: 0 },
      delay: 600,
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
    await registerWatcherRoute(page, { abort: true });

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
