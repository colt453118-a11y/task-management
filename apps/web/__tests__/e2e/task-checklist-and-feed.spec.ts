import { test, expect } from '@playwright/test';
import { CHECKLIST } from '@/lib/test-ids';
import {
  TASK_ID,
  MOCK_TASK,
  CHECKLIST_ITEMS,
  HISTORY_ENTRIES,
  setSessionCookie,
  mockPageApis,
  registerChecklistRoute,
  registerHistoryRoute,
} from './helpers/task-detail-mocks';

// ─── Setup ──────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Checklist Tests ────────────────────────────────────────────

test.describe('TaskChecklist', () => {
  test('renders checklist items with checkbox, content, and progress', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, { items: CHECKLIST_ITEMS });

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
    await expect(page.getByTestId(CHECKLIST.addInput)).toBeVisible();
  });

  test('adds a new checklist item', async ({ page }) => {
    const newItem = {
      id: 'cl-new',
      taskId: TASK_ID,
      content: 'Write Playwright tests',
      isChecked: false,
      checkedBy: null,
      checkedAt: null,
      sortOrder: 3,
      createdAt: new Date().toISOString(),
    };

    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: [],
      onPost: { status: 201, body: { item: newItem } },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration — empty state should show
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No checklist items yet. Add one below.')).toBeVisible();

    // Type into the add input and submit
    const input = page.getByTestId(CHECKLIST.addInput);
    await input.fill('Write Playwright tests');
    await input.press('Enter');

    // The new item should appear
    await expect(page.getByText('Write Playwright tests')).toBeVisible({ timeout: 5_000 });

    // Progress should update
    await expect(page.getByTestId(CHECKLIST.progress)).toHaveText('0 of 1 done');
  });

  test('toggles a checklist item', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: CHECKLIST_ITEMS,
      onPatch: async (route) => {
        const url = route.request().url();
        if (url.includes('itemId=cl-1')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ item: { ...CHECKLIST_ITEMS[0]!, isChecked: true } }),
          });
        } else {
          await route.fulfill({ status: 405, body: 'Method not allowed' });
        }
      },
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

  test('deletes a checklist item', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: CHECKLIST_ITEMS,
      onDelete: { body: { success: true } },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();

    // Register a waiter for the DELETE response before clicking
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/checklist') && res.request().method() === 'DELETE',
    );

    // Hover the item to reveal the action buttons (group-hover:opacity-100)
    // Use dispatchEvent with MouseEvent to ensure React handles it
    const item = page.getByTestId(CHECKLIST.item('cl-1'));
    await item.hover();
    await page.waitForTimeout(300);

    // Use evaluate to bypass opacity-0
    await page.getByTestId(CHECKLIST.deleteBtn('cl-1')).evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    );

    // Wait for the DELETE API response
    await deleteResponse;
    await page.waitForTimeout(300);

    // Deleted item should disappear due to optimistic removal
    await expect(page.getByText('Set up database schema')).not.toBeVisible({ timeout: 5_000 });

    // Remaining items should still be visible
    await expect(page.getByText('Create API endpoints')).toBeVisible();
    await expect(page.getByText('Write unit tests')).toBeVisible();
  });

  test('edits a checklist item', async ({ page }) => {
    const updatedItem = {
      ...CHECKLIST_ITEMS[0]!,
      content: 'Set up database schema and indexes',
    };

    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: CHECKLIST_ITEMS,
      onPatch: { body: { item: updatedItem } },
    });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();

    // Register a waiter for the PATCH response before clicking
    const patchResponse = page.waitForResponse(
      (res) => res.url().includes('/checklist') && res.request().method() === 'PATCH',
    );

    // Hover the item to reveal the action buttons (group-hover:opacity-100)
    const item = page.getByTestId(CHECKLIST.item('cl-1'));
    await item.hover();
    await page.waitForTimeout(300);

    // Use evaluate to bypass opacity-0
    await page.getByTestId(CHECKLIST.editBtn('cl-1')).evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    );

    // Edit input should appear
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).toBeVisible({ timeout: 5_000 });

    // Clear and type new content
    await page.getByTestId(CHECKLIST.editInput('cl-1')).fill('Set up database schema and indexes');

    // Click save button via evaluate
    await page.getByTestId(CHECKLIST.saveEditBtn('cl-1')).evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    );

    // Wait for the PATCH API response
    const response = await patchResponse;
    expect(response.status()).toBe(200);
    await page.waitForTimeout(300);

    // Updated text should appear — use testid for exact content check
    await expect(page.getByTestId(CHECKLIST.text('cl-1'))).toHaveText('Set up database schema and indexes', { timeout: 5_000 });
    await expect(page.getByText('Set up database schema', { exact: true })).not.toBeVisible();
    // Also verify that 'Set up database schema and indexes' is visible (as a text check)
    await expect(page.getByText('Set up database schema and indexes')).toBeVisible();
  });

  test('reorders checklist items via drag-and-drop', async ({ page }) => {
    // ── Setup ────────────────────────────────────────────────
    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: CHECKLIST_ITEMS,
      onPatch: { body: { item: { ...CHECKLIST_ITEMS[0]!, sortOrder: 0 } } },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();
    await expect(page.getByText('Write unit tests')).toBeVisible();

    // ── Verify drag handle exists for all items ──────────────
    for (const item of ['cl-1', 'cl-2', 'cl-3']) {
      const dragHandle = page.getByTestId(CHECKLIST.item(item)).getByTitle('Drag to reorder');
      await expect(dragHandle).toBeAttached();
    }

    // ── Simulate reorder via pointer events ─────────────────
    const getBoundingBox = async (testId: string) => {
      const el = page.getByTestId(testId);
      await el.scrollIntoViewIfNeeded();
      return el.boundingBox();
    };

    const sourceBox = await getBoundingBox(CHECKLIST.item('cl-1'));
    const targetBox = await getBoundingBox(CHECKLIST.item('cl-3'));

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag-and-drop');
    }

    const sourceX = sourceBox.x + sourceBox.width / 2;
    const targetY = targetBox.y + targetBox.height / 2;

    // Wait for all 3 PATCH responses using a counter-based predicate
    let patchCount = 0;
    const allPatchesDone = page.waitForResponse((res) => {
      if (res.url().includes('/checklist') && res.request().method() === 'PATCH') {
        patchCount++;
        return patchCount >= 3;
      }
      return false;
    });

    const dragHandleBtn = page.getByTestId(CHECKLIST.item('cl-1')).getByTitle('Drag to reorder');
    await dragHandleBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    // Hover the item to reveal drag handle (opacity-0 group-hover:opacity-100)
    await page.getByTestId(CHECKLIST.item('cl-1')).hover();
    await page.waitForTimeout(300);

    // Get drag handle bounding box for precise coordinates
    const handleBox = await dragHandleBtn.boundingBox();
    if (!handleBox) throw new Error('Could not get drag handle bounding box');

    const handleX = handleBox.x + handleBox.width / 2;
    const handleY = handleBox.y + handleBox.height / 2;

    // Use Playwright's page.mouse (trusted events via CDP) to simulate drag
    await page.mouse.move(handleX, handleY);
    await page.mouse.down();

    // Move 10px past activation constraint (needs > 6px)
    await page.mouse.move(handleX, handleY + 10, { steps: 5 });

    // Continue moving down to target item
    await page.mouse.move(sourceX, targetY, { steps: 10 });

    // Drop
    await page.mouse.up();

    // Wait for all 3 PATCH responses
    await allPatchesDone;
    await page.waitForTimeout(300);

    // ── Verify items still render ────────────────────────────
    await expect(page.getByText('Set up database schema')).toBeVisible();
    await expect(page.getByText('Create API endpoints')).toBeVisible();
    await expect(page.getByText('Write unit tests')).toBeVisible();
  });

  test('shows completion celebration when all items checked', async ({ page }) => {
    const allDoneItems = CHECKLIST_ITEMS.map((item) => ({ ...item, isChecked: true }));

    await mockPageApis(page);
    await registerChecklistRoute(page, { items: allDoneItems });

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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ task: closedTask }),
      });
    });
    await registerChecklistRoute(page, { items: CHECKLIST_ITEMS });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Add input should NOT be rendered for closed tasks
    await expect(page.getByTestId(CHECKLIST.addInput)).not.toBeVisible();

    // Items should still render
    await expect(page.getByText('Set up database schema')).toBeVisible();
  });

  test('cancels edit via Escape key', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, { items: CHECKLIST_ITEMS });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();

    // Enter edit mode
    const item = page.getByTestId(CHECKLIST.item('cl-1'));
    await item.hover();
    await page.waitForTimeout(300);
    await page.getByTestId(CHECKLIST.editBtn('cl-1')).evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    );
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).toBeVisible({ timeout: 5_000 });

    // Type new content
    await page.getByTestId(CHECKLIST.editInput('cl-1')).fill('This change will be cancelled');

    // Press Escape to cancel
    await page.getByTestId(CHECKLIST.editInput('cl-1')).press('Escape');
    await page.waitForTimeout(300);

    // Edit mode should be exited, original text restored
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).not.toBeVisible();
    await expect(page.getByTestId(CHECKLIST.text('cl-1'))).toBeVisible();
    await expect(page.getByTestId(CHECKLIST.text('cl-1'))).toHaveText('Set up database schema');
    // The changed content should NOT appear
    await expect(page.getByText('This change will be cancelled')).not.toBeVisible();
  });

  test('cancels edit via Cancel button', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, { items: CHECKLIST_ITEMS });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();

    // Enter edit mode
    const item = page.getByTestId(CHECKLIST.item('cl-1'));
    await item.hover();
    await page.waitForTimeout(300);
    await page.getByTestId(CHECKLIST.editBtn('cl-1')).evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    );
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).toBeVisible({ timeout: 5_000 });

    // Type new content
    await page.getByTestId(CHECKLIST.editInput('cl-1')).fill('This change will be cancelled too');

    // Click the Cancel button
    await page.getByTestId(CHECKLIST.cancelEditBtn('cl-1')).click();
    await page.waitForTimeout(300);

    // Edit mode exited, original text restored
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).not.toBeVisible();
    await expect(page.getByTestId(CHECKLIST.text('cl-1'))).toHaveText('Set up database schema');
    await expect(page.getByText('This change will be cancelled too')).not.toBeVisible();
  });

  test('shows error state when adding item fails (POST 500)', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: [],
      onPost: { status: 500, body: { error: 'Server Error' } },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No checklist items yet. Add one below.')).toBeVisible();

    // Type into the add input and submit
    const input = page.getByTestId(CHECKLIST.addInput);
    await input.fill('This will fail to add');

    // Register a waiter for the POST response
    const postResponse = page.waitForResponse(
      (res) => res.url().includes('/checklist') && res.request().method() === 'POST',
    );

    await input.press('Enter');

    // Wait for the failed POST to complete
    await postResponse;
    await page.waitForTimeout(300);

    // Item should NOT have been added — empty state still visible
    await expect(page.getByText('No checklist items yet. Add one below.')).toBeVisible();
    await expect(page.getByText('This will fail to add')).not.toBeVisible();
    // Adding spinner should have stopped (addBtn re-enabled or input still usable)
    await expect(page.getByTestId(CHECKLIST.addInput)).toBeVisible();
  });

  test('handles delete API error and keeps item', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: CHECKLIST_ITEMS,
      onDelete: { status: 500, body: { error: 'Server Error' } },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();

    // Register waiter for the DELETE response
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/checklist') && res.request().method() === 'DELETE',
    );

    // Click delete button
    const item = page.getByTestId(CHECKLIST.item('cl-1'));
    await item.hover();
    await page.waitForTimeout(300);
    await page.getByTestId(CHECKLIST.deleteBtn('cl-1')).evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    );

    // Wait for the failed DELETE to complete
    await deleteResponse;
    await page.waitForTimeout(300);

    // Item should still be present (component doesn't optimistically remove on error)
    await expect(page.getByText('Set up database schema')).toBeVisible();
    await expect(page.getByText('Create API endpoints')).toBeVisible();
    await expect(page.getByText('Write unit tests')).toBeVisible();

    // All 3 items still present (progress unchanged)
    await expect(page.getByText('1 of 3 done')).toBeVisible();
  });

  test('handles edit API error and stays in edit mode', async ({ page }) => {
    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: CHECKLIST_ITEMS,
      onPatch: { status: 500, body: { error: 'Server Error' } },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Set up database schema')).toBeVisible();

    // Register waiter for the PATCH response
    const patchResponse = page.waitForResponse(
      (res) => res.url().includes('/checklist') && res.request().method() === 'PATCH',
    );

    // Enter edit mode
    const item = page.getByTestId(CHECKLIST.item('cl-1'));
    await item.hover();
    await page.waitForTimeout(300);
    await page.getByTestId(CHECKLIST.editBtn('cl-1')).evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    );
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).toBeVisible({ timeout: 5_000 });

    // Type new content
    await page.getByTestId(CHECKLIST.editInput('cl-1')).fill('Set up database schema with indexes');

    // Click save (will fail)
    await page.getByTestId(CHECKLIST.saveEditBtn('cl-1')).click();

    // Wait for the failed PATCH to complete
    await patchResponse;
    await page.waitForTimeout(300);

    // Edit mode should still be active (component doesn't close edit on error)
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).toBeVisible();
    // The input should still contain the typed text (so user can retry)
    await expect(page.getByTestId(CHECKLIST.editInput('cl-1'))).toHaveValue('Set up database schema with indexes');
    // The original span text should still show the original content
    await expect(page.getByTestId(CHECKLIST.text('cl-1'))).toBeHidden();
  });

  test('navigates checklist items via keyboard', async ({ page }) => {
    const newItem = {
      id: 'cl-new',
      taskId: TASK_ID,
      content: 'Added via keyboard',
      isChecked: false,
      checkedBy: null,
      checkedAt: null,
      sortOrder: 3,
      createdAt: new Date().toISOString(),
    };

    await mockPageApis(page);
    await registerChecklistRoute(page, {
      items: [],
      onPost: { status: 201, body: { item: newItem } },
      onPatch: { body: { item: { ...CHECKLIST_ITEMS[0]!, isChecked: true } } },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No checklist items yet. Add one below.')).toBeVisible();

    // ── Keyboard: Add item via Enter key on the add input ────
    const addInput = page.getByTestId(CHECKLIST.addInput);
    await addInput.focus();
    await expect(addInput).toBeFocused();

    await page.keyboard.type('Added via keyboard');
    await page.keyboard.press('Enter');

    // New item should appear
    await expect(page.getByText('Added via keyboard')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(CHECKLIST.progress)).toHaveText('0 of 1 done');

    // ── Keyboard: Toggle checkbox via keyboard ───────────────
    const checkbox = page.getByTestId(CHECKLIST.checkbox('cl-new'));
    await checkbox.focus();
    await expect(checkbox).toBeFocused();

    // Try Enter first, then fall back to Space
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Check if progress updated — if not, try Space as well
    const progressText = await page.getByTestId(CHECKLIST.progress).textContent();
    if (progressText !== '1 of 1 done') {
      await page.keyboard.press(' ');
      await page.waitForTimeout(300);
    }

    // After toggling, progress should update
    await expect(page.getByTestId(CHECKLIST.progress)).toHaveText('1 of 1 done', { timeout: 5_000 });
  });
});

// ─── Activity Feed Tests ────────────────────────────────────────

test.describe('TaskActivityFeed', () => {
  test('shows empty state when no activity exists', async ({ page }) => {
    await mockPageApis(page);
    await registerHistoryRoute(page);

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
    await registerHistoryRoute(page, { entries: HISTORY_ENTRIES });

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
    await registerHistoryRoute(page, { abort: true });

    await page.goto(`/tasks/${TASK_ID}`);

    // Wait for page hydration
    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // Error state should render
    await expect(page.getByText('Failed to load activity history')).toBeVisible();
  });

  test('renders multiple entries from different users in the timeline', async ({ page }) => {
    const manyEntries = [
      ...HISTORY_ENTRIES,
      {
        id: 'hist-5',
        taskId: TASK_ID,
        userId: 'user-789',
        field: 'dueDate',
        oldValue: null,
        newValue: '2026-08-01',
        changeType: 'update',
        description: 'Set due date to Aug 1, 2026',
        createdAt: new Date(Date.now() - 100 * 1000).toISOString(),
        user: { id: 'user-789', name: 'Carol Williams', avatarUrl: null },
      },
    ];

    await mockPageApis(page);
    await registerHistoryRoute(page, { entries: manyEntries });

    await page.goto(`/tasks/${TASK_ID}`);

    await expect(page.getByText(MOCK_TASK.title)).toBeVisible({ timeout: 15_000 });

    // All three users should appear
    await expect(page.getByText('Alice Johnson').first()).toBeVisible();
    await expect(page.getByText('Bob Smith')).toBeVisible();
    await expect(page.getByText('Carol Williams')).toBeVisible();
  });
});
