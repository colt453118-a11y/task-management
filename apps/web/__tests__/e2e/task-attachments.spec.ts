import { test, expect } from '@playwright/test';
import {
  TASK_ID,
  MOCK_TASK,
  MOCK_ATTACHMENTS,
  setSessionCookie,
  mockPageApis,
  registerAttachmentsRoute,
} from './helpers/task-detail-mocks';

// ═══════════════════════════════════════════════════════════════
//  Setup
// ═══════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ═══════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Task Attachments', () => {
  test('shows empty state when no attachments exist', async ({ page }) => {
    await mockPageApis(page);
    await registerAttachmentsRoute(page, { attachments: [] });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // The attachment count should be 0
    const sectionHeading = page.getByRole('heading', { name: /attachments/i });
    await expect(sectionHeading).toBeVisible();
    await expect(sectionHeading).toContainText('(0)');

    // Empty state message should be visible
    await expect(page.getByText('No attachments yet.')).toBeVisible();

    // Upload button should be visible
    await expect(page.getByText('Upload file')).toBeVisible();
  });

  test('shows attachments list with file metadata', async ({ page }) => {
    await mockPageApis(page);
    await registerAttachmentsRoute(page, {
      attachments: MOCK_ATTACHMENTS as unknown as Record<string, unknown>[],
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // The attachment count should reflect the mock data
    const sectionHeading = page.getByRole('heading', { name: /attachments/i });
    await expect(sectionHeading).toContainText('(2)');

    // File names should be visible
    await expect(page.getByText('design-spec.pdf')).toBeVisible();
    await expect(page.getByText('screenshot.png')).toBeVisible();

    // File sizes should be formatted correctly (245760 B = 240.0 KB, 1048576 B = 1.0 MB)
    await expect(page.getByText('240.0 KB')).toBeVisible();
    await expect(page.getByText('1.0 MB')).toBeVisible();

    // Uploader names should be visible (use .first() since both mock attachments have the same uploader)
    await expect(page.getByText('Alice Johnson').first()).toBeVisible();
  });

  test('uploads a file via file input', async ({ page }) => {
    // Track that the POST handler was called
    let postCalled = false;

    await mockPageApis(page);
    await registerAttachmentsRoute(page, {
      attachments: [],
      onPost: async (route) => {
        postCalled = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            attachment: {
              id: 'att-new',
              taskId: TASK_ID,
              userId: 'user-123',
              fileName: 'uploaded-file.txt',
              fileSize: 1_024,
              mimeType: 'text/plain',
              storageKey: `tasks/${TASK_ID}/new-uploaded-file.txt`,
              downloadUrl: 'https://minio.local/workmanagement-files/tasks/...',
              createdAt: new Date().toISOString(),
              user: { id: 'user-123', name: 'Alice Johnson' },
            },
          }),
        });
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Simulate file selection via the hidden input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'report.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('mock file content'),
    });

    // After upload, the new file should appear in the list
    await expect(page.getByText('uploaded-file.txt')).toBeVisible({ timeout: 5_000 });

    // File size should be displayed
    await expect(page.getByText('1.0 KB')).toBeVisible();

    // POST was called
    expect(postCalled).toBe(true);
  });

  test('shows upload error message on failure', async ({ page }) => {
    await mockPageApis(page);
    await registerAttachmentsRoute(page, {
      attachments: [],
      onPost: async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: 'File exceeds maximum size of 50MB' },
          }),
        });
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Simulate file selection
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'huge-file.zip',
      mimeType: 'application/zip',
      buffer: Buffer.alloc(1024),
    });

    // The error message should appear
    await expect(page.getByText('File exceeds maximum size of 50MB')).toBeVisible({
      timeout: 5_000,
    });

    // The empty state should still be shown (upload failed, no attachments)
    await expect(page.getByText('No attachments yet.')).toBeVisible();
  });

  test('deletes an attachment', async ({ page }) => {
    // Track DELETE calls
    let deleteCalled = false;

    await mockPageApis(page);
    await registerAttachmentsRoute(page, {
      attachments: MOCK_ATTACHMENTS as unknown as Record<string, unknown>[],
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

    // Verify attachments are listed
    await expect(page.getByText('design-spec.pdf')).toBeVisible();

    // Click delete button — use XPath to find the closest ancestor div
    // that contains both the file name text and a button (the attachment
    // row motion.div), avoiding Playwright's recursive filter matching
    // the outermost page container.
    const attachmentRow = page.locator(
      'xpath=//*[text()="design-spec.pdf"]/ancestor::div[.//button][1]',
    );
    await attachmentRow.locator('button').click();

    // After delete, the attachment should be removed from the UI
    await expect(page.getByText('design-spec.pdf')).not.toBeVisible({ timeout: 5_000 });

    // The remaining attachment should still be visible
    await expect(page.getByText('screenshot.png')).toBeVisible();

    expect(deleteCalled).toBe(true);
  });

  test('deleting the last attachment shows empty state', async ({ page }) => {
    let deleteCount = 0;

    await mockPageApis(page);
    await registerAttachmentsRoute(page, {
      attachments: (MOCK_ATTACHMENTS.slice(0, 1) as unknown as Record<string, unknown>[]),
      onDelete: async (route) => {
        deleteCount++;
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

    // Verify the single attachment is shown
    await expect(page.getByText('design-spec.pdf')).toBeVisible();

    // Click delete — use XPath ancestor traversal to find the attachment row
    const attachmentRow = page.locator(
      'xpath=//*[text()="design-spec.pdf"]/ancestor::div[.//button][1]',
    );
    await attachmentRow.locator('button').click();

    // After deleting the last attachment, empty state should appear
    await expect(page.getByText('No attachments yet.')).toBeVisible({ timeout: 5_000 });

    expect(deleteCount).toBe(1);
  });

  test('handles network error when uploading gracefully', async ({ page }) => {
    await mockPageApis(page);
    await registerAttachmentsRoute(page, {
      attachments: [],
      onPost: async (route) => {
        await route.abort('connectionrefused');
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Simulate file selection
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'lost-connection.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test'),
    });

    // An error message should appear. When the fetch is aborted via
    // route.abort('connectionrefused'), browsers throw different errors:
    // - Chromium: "Failed to fetch"
    // - Firefox: "NetworkError when attempting to fetch resource"
    await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5_000 });

    // Page should not crash — task details should still be visible
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible();
    await expect(page.getByText('TASK-001')).toBeVisible();
  });

  test('delete button is accessible on each attachment', async ({ page }) => {
    await mockPageApis(page);
    await registerAttachmentsRoute(page, {
      attachments: MOCK_ATTACHMENTS as unknown as Record<string, unknown>[],
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for the page to hydrate
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Both delete buttons should be present (one per attachment row).
    // Find the card by going up from the Attachments heading to its
    // nearest ancestor div with "rounded-2xl" class (the card container),
    // then count SVG-containing buttons within just that card.
    const attachmentHeading = page.getByRole('heading', { name: /attachments/i });
    const attachmentCard = attachmentHeading.locator(
      'xpath=ancestor::div[contains(@class, "rounded-2xl")][1]',
    );
    const deleteButtons = attachmentCard.locator('button').filter({ has: page.locator('svg') });
    await expect(deleteButtons).toHaveCount(2);
  });
});
