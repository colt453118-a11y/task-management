import { test, expect } from '@playwright/test';
import {
  TASK_ID,
  MOCK_TASK,
  setSessionCookie,
  mockPageApis,
  registerCommentsRoute,
} from './helpers/task-detail-mocks';

// ─── Fixtures ──────────────────────────────────────────────────

const MOCK_COMMENT = {
  id: 'cmt-1',
  taskId: TASK_ID,
  content: 'This is a sample comment to test the UI.',
  isEdited: false,
  createdAt: new Date(Date.now() - 600 * 1000).toISOString(),
  user: { id: 'user-123', name: 'Alice Johnson', avatarUrl: null },
};

// ─── Setup ──────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Tests ─────────────────────────────────────────────────────

test.describe('TaskComments', () => {
  test('shows empty state when no comments exist', async ({ page }) => {
    // mockPageApis already returns { comments: [] } for GET /comments
    await mockPageApis(page);

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Comments section header — use role selector to avoid strict mode ("Comments" also matches "No comments yet")
    await expect(page.getByRole('heading', { name: /^Comments/ })).toBeVisible();

    // Empty state
    await expect(page.getByText('No comments yet')).toBeVisible();
    await expect(page.getByText('Start the conversation.')).toBeVisible();

    // Comment input should be visible
    const textarea = page.getByPlaceholder('Write a comment...');
    await expect(textarea).toBeVisible();

    // Send button should be disabled when textarea is empty
    const sendButton = page.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeDisabled();
  });

  test('renders a single comment with user name and content', async ({ page }) => {
    await mockPageApis(page);
    await registerCommentsRoute(page, { comments: [MOCK_COMMENT] });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Wait a bit for framer-motion enter animations to complete
    await page.waitForTimeout(1000);

    // The user name should appear
    await expect(page.getByText('Alice Johnson')).toBeVisible({ timeout: 5_000 });
    // Comment content should appear
    await expect(page.getByText('This is a sample comment to test the UI.')).toBeVisible();

    // Comment count badge should show (1)
    await expect(page.getByRole('heading', { name: /Comments.*\(1\)/ })).toBeVisible();
  });

  test('posts a new comment via Send button', async ({ page }) => {
    const newComment = {
      id: 'cmt-new',
      taskId: TASK_ID,
      content: 'Newly posted comment content.',
      isEdited: false,
      createdAt: new Date().toISOString(),
      user: { id: 'user-123', name: 'Alice Johnson', avatarUrl: null },
    };

    await mockPageApis(page);
    await registerCommentsRoute(page, {
      comments: [],
      onPost: { status: 201, body: { comment: newComment } },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No comments yet')).toBeVisible();

    // Type into the textarea
    const textarea = page.getByPlaceholder('Write a comment...');
    await textarea.fill('Newly posted comment content.');

    // Send button should now be enabled
    const sendButton = page.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeEnabled();

    // Register a waiter for the POST response
    const postResponse = page.waitForResponse(
      (res) => res.url().includes('/comments') && res.request().method() === 'POST',
    );

    // Click Send
    await sendButton.click();

    // Wait for the POST to complete
    await postResponse;
    await page.waitForTimeout(300);

    // New comment should appear
    await expect(page.getByText('Newly posted comment content.')).toBeVisible({ timeout: 5_000 });

    // Textarea should be cleared after posting
    await expect(textarea).toHaveValue('');

    // Empty state should be gone
    await expect(page.getByText('No comments yet')).not.toBeVisible();
  });

  test('posts a new comment via Enter key', async ({ page }) => {
    const newComment = {
      id: 'cmt-enter',
      taskId: TASK_ID,
      content: 'Posted via Enter key.',
      isEdited: false,
      createdAt: new Date().toISOString(),
      user: { id: 'user-123', name: 'Alice Johnson', avatarUrl: null },
    };

    await mockPageApis(page);
    await registerCommentsRoute(page, {
      comments: [],
      onPost: { status: 201, body: { comment: newComment } },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No comments yet')).toBeVisible();

    // Type and press Enter to submit
    const textarea = page.getByPlaceholder('Write a comment...');
    await textarea.fill('Posted via Enter key.');

    // Register waiter for POST response
    const postResponse = page.waitForResponse(
      (res) => res.url().includes('/comments') && res.request().method() === 'POST',
    );

    // Press Enter (without Shift) to submit
    await textarea.press('Enter');

    await postResponse;
    await page.waitForTimeout(300);

    // Comment should appear
    await expect(page.getByText('Posted via Enter key.')).toBeVisible({ timeout: 5_000 });
    await expect(textarea).toHaveValue('');
  });

  test('deletes a comment', async ({ page }) => {
    await mockPageApis(page);
    await registerCommentsRoute(page, {
      comments: [MOCK_COMMENT],
      onDelete: { body: { success: true } },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('This is a sample comment to test the UI.')).toBeVisible();

    // Register waiter for DELETE response
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/comments') && res.request().method() === 'DELETE',
    );

    // Hover the comment area to reveal the Delete button (group-hover:opacity-100)
    const commentCard = page.getByText('This is a sample comment to test the UI.').locator('xpath=ancestor::div[contains(@class, "group")]');
    await commentCard.hover();
    await page.waitForTimeout(300);

    // Click Delete button
    await page.getByRole('button', { name: 'Delete' }).click();

    // Wait for the DELETE to complete
    await deleteResponse;
    await page.waitForTimeout(300);

    // Comment should be removed and empty state shown
    await expect(page.getByText('No comments yet')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('This is a sample comment to test the UI.')).not.toBeVisible();
  });

  test('shows error when posting comment fails', async ({ page }) => {
    await mockPageApis(page);
    await registerCommentsRoute(page, {
      comments: [],
      onPost: { status: 500, body: { error: 'Server Error' } },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No comments yet')).toBeVisible();

    // Type and attempt to submit
    const textarea = page.getByPlaceholder('Write a comment...');
    await textarea.fill('This will fail to post.');

    const postResponse = page.waitForResponse(
      (res) => res.url().includes('/comments') && res.request().method() === 'POST',
    );

    await page.getByRole('button', { name: 'Send' }).click();

    await postResponse;
    await page.waitForTimeout(300);

    // Comment should NOT have been added — empty state persists
    // (The textarea still shows the typed text for retry, but no comment appears in the list)
    await expect(page.getByText('No comments yet')).toBeVisible({ timeout: 5_000 });
    // Input should still be usable and retain the typed text for retry
    await expect(page.getByPlaceholder('Write a comment...')).toBeVisible();
    await expect(page.getByPlaceholder('Write a comment...')).toHaveValue('This will fail to post.');
  });
});
