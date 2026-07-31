import { test, expect } from '@playwright/test';
import { mockLeaveTypesApi, mockLeaveRequestsApi, mockLeaveBalancesApi } from './helpers/leave-mocks';
import { setSessionCookie } from './helpers/task-detail-mocks';

// ─── Setup ─────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Leave List Page ──────────────────────────────────────────

test.describe('Leave List Page (/leave)', () => {
  test('shows loading state while requests are being fetched', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page, { delay: 500 });

    await page.goto('/leave');

    // Loading spinner should appear
    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5_000 });
  });

  test('shows empty state when no requests exist', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page, { requests: [] });

    await page.goto('/leave');

    // Wait for page to hydrate
    await expect(page.getByText('Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Empty state should appear
    await expect(page.getByText(/no time-off requests yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /request time off/i })).toBeVisible();
  });

  test('renders summary cards with correct counts', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page);

    await page.goto('/leave');

    await expect(page.getByText('Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Summary cards should show
    await expect(page.getByText('Total').first()).toBeVisible();
    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(page.getByText('Approved').first()).toBeVisible();
    await expect(page.getByText('Rejected').first()).toBeVisible();

    // Count values should render (3 total, 1 pending, 1 approved, 1 rejected)
    await expect(page.getByText('3').first()).toBeVisible();
  });

  test('renders leave request list items', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page);

    await page.goto('/leave');

    await expect(page.getByText('Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Leave type names should appear
    await expect(page.getByText('Vacation').first()).toBeVisible();
    await expect(page.getByText('Sick Leave').first()).toBeVisible();
    await expect(page.getByText('Personal Leave').first()).toBeVisible();

    // Date ranges should appear
    await expect(page.getByText(/Aug 10, 2026.*Aug 14, 2026/).first()).toBeVisible();

    // Status badges should render
    await expect(page.getByText('Approved').first()).toBeVisible();
    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(page.getByText('Rejected').first()).toBeVisible();
  });

  test('filters list by status when clicking summary cards', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page);

    await page.goto('/leave');

    await expect(page.getByText('Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Click the Pending filter card
    await page.getByText('Pending').first().click();

    // Only pending requests should show (Sick Leave is pending)
    await expect(page.getByText('Sick Leave').first()).toBeVisible();
  });

  test('shows link to My Balance page', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page);

    await page.goto('/leave');

    await expect(page.getByText('Time Off').first()).toBeVisible({ timeout: 10_000 });

    // My Balance button should exist
    await expect(page.getByRole('button', { name: /my balance/i })).toBeVisible();
  });

  test('shows link to New Request page', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page);

    await page.goto('/leave');

    await expect(page.getByText('Time Off').first()).toBeVisible({ timeout: 10_000 });

    // New Request button should exist
    await expect(page.getByRole('button', { name: /new request/i })).toBeVisible();
  });

  test('navigates to request detail on click', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page);

    await page.goto('/leave');

    await expect(page.getByText('Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Click on the first leave request link (Vacation)
    await page.getByRole('link', { name: /Vacation/ }).first().click();

    // Should navigate to detail page (wait for async navigation)
    await page.waitForURL(/\/leave\/req-1/, { timeout: 10_000 });
  });
});

// ─── New Leave Request Page ────────────────────────────────────

test.describe('New Leave Request Page (/leave/new)', () => {
  test('renders the request form', async ({ page }) => {
    await mockLeaveTypesApi(page);

    await page.goto('/leave/new');

    await expect(page.getByText('Request Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Leave type buttons should render
    await expect(page.getByText('Vacation').first()).toBeVisible();
    await expect(page.getByText('Sick Leave').first()).toBeVisible();
    await expect(page.getByText('Personal Leave').first()).toBeVisible();

    // Form inputs should exist
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.getByPlaceholder(/briefly describe/i)).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: /submit request/i })).toBeVisible();
  });

  test('shows validation error for empty form submission', async ({ page }) => {
    await mockLeaveTypesApi(page);

    await page.goto('/leave/new');

    await expect(page.getByText('Request Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Submit empty form
    await page.getByRole('button', { name: /submit request/i }).click();

    // Validation error should appear
    await expect(page.getByText(/all fields are required/i)).toBeVisible();
  });

  test('shows validation error when end date precedes start date', async ({ page }) => {
    await mockLeaveTypesApi(page);

    await page.goto('/leave/new');

    await expect(page.getByText('Request Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Fill dates with end before start
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-09-15');
    await dateInputs.nth(1).fill('2026-09-10');

    // Fill reason
    await page.getByPlaceholder(/briefly describe/i).fill('Test');

    // Submit
    await page.getByRole('button', { name: /submit request/i }).click();

    // Validation error should appear
    await expect(page.getByText(/end date must be on or after/i)).toBeVisible();
  });

  test('creates a request and redirects to detail page', async ({ page }) => {
    await mockLeaveTypesApi(page);
    await mockLeaveRequestsApi(page);

    await page.goto('/leave/new');

    await expect(page.getByText('Request Time Off').first()).toBeVisible({ timeout: 10_000 });

    // Fill form
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-09-15');
    await dateInputs.nth(1).fill('2026-09-16');

    await page.getByPlaceholder(/briefly describe/i).fill('Short break');

    // Submit
    await page.getByRole('button', { name: /submit request/i }).click();

    // Should navigate to detail page (mock returns MOCK_CREATED_REQUEST with id 'req-new')
    await expect(page).toHaveURL(/\/leave\/req-new/);
  });

  test('shows back link to leave list', async ({ page }) => {
    await mockLeaveTypesApi(page);

    await page.goto('/leave/new');

    await expect(page.getByText('Request Time Off').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/back to time off/i)).toBeVisible();
  });
});

// ─── Leave Balances Page ──────────────────────────────────────

test.describe('Leave Balances Page (/leave/balances)', () => {
  test('shows loading state', async ({ page }) => {
    await mockLeaveBalancesApi(page, { delay: 500 });

    await page.goto('/leave/balances');

    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5_000 });
  });

  test('shows empty state when no balances exist', async ({ page }) => {
    await mockLeaveBalancesApi(page, { balances: [] });

    await page.goto('/leave/balances');

    await expect(page.getByText(/no balances allocated/i)).toBeVisible({ timeout: 10_000 });
  });

  test('renders balance cards with stats', async ({ page }) => {
    await mockLeaveBalancesApi(page);

    await page.goto('/leave/balances');

    await expect(page.getByText('My Leave Balances').first()).toBeVisible({ timeout: 10_000 });

    // Leave type names should appear
    await expect(page.getByText('Vacation').first()).toBeVisible();
    await expect(page.getByText('Sick Leave').first()).toBeVisible();
    await expect(page.getByText('Personal Leave').first()).toBeVisible();

    // Stats should render: Allocated, Used, Pending, Available
    await expect(page.getByText('15').first()).toBeVisible(); // 15 vacation days allocated
    await expect(page.getByText('10').first()).toBeVisible(); // 10 sick days allocated

    // Labels should appear
    await expect(page.getByText('Allocated').first()).toBeVisible();
    await expect(page.getByText('Used').first()).toBeVisible();
    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(page.getByText('Available').first()).toBeVisible();
  });

  test('shows back link to leave list', async ({ page }) => {
    await mockLeaveBalancesApi(page);

    await page.goto('/leave/balances');

    await expect(page.getByText('My Leave Balances').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/back to time off/i)).toBeVisible();
  });

  test('shows current year in footer', async ({ page }) => {
    await mockLeaveBalancesApi(page);

    await page.goto('/leave/balances');

    await expect(page.getByText('My Leave Balances').first()).toBeVisible({ timeout: 10_000 });

    const currentYear = new Date().getFullYear().toString();
    await expect(page.getByText(new RegExp(currentYear)).first()).toBeVisible();
  });
});

// ─── Leave Detail Page ─────────────────────────────────────────

test.describe('Leave Detail Page (/leave/[id])', () => {
  test('shows loading state', async ({ page }) => {
    await mockLeaveRequestsApi(page, { delay: 500 });

    await page.goto('/leave/req-1');

    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5_000 });
  });

  test('shows 404 when request not found', async ({ page }) => {
    // Mock the detail route to return 404
    await page.route(/\/api\/leave-requests\/[^/]+$/, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Leave request not found' } }),
      });
    });

    await page.goto('/leave/nonexistent-id');

    // Should see error state — component shows 'Failed to load request' for API errors
    await expect(page.getByText(/Failed to load request/i)).toBeVisible({ timeout: 10_000 });
  });

  test('renders request details with status badge', async ({ page }) => {
    await mockLeaveRequestsApi(page);

    await page.goto('/leave/req-1');

    await expect(page.getByText(/Vacation/i).first()).toBeVisible({ timeout: 10_000 });

    // Status badge should render
    await expect(page.getByText('Approved').first()).toBeVisible();

    // Requester name
    await expect(page.getByText('Alice Johnson').first()).toBeVisible();

    // Reason
    await expect(page.getByText(/Family vacation to the beach/i)).toBeVisible();
  });

  test('renders review section for pending requests', async ({ page }) => {
    const pendingRequest = {
      id: 'req-pending',
      userId: 'user-1',
      leaveTypeId: 'type-sick',
      startDate: '2026-08-05',
      endDate: '2026-08-06',
      isHalfDay: false,
      daysCount: 2,
      reason: 'Feeling unwell',
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: '2026-08-01T14:00:00Z',
      updatedAt: '2026-08-01T14:00:00Z',
      user: { id: 'user-1', name: 'Alice Johnson', avatarUrl: null },
      leaveType: { id: 'type-sick', name: 'Sick Leave', slug: 'sick', color: '#f59e0b', icon: 'Thermometer' },
    };

    await mockLeaveRequestsApi(page, { singleRequest: pendingRequest, approveResponse: { request: { ...pendingRequest, status: 'approved' } } });

    await page.goto('/leave/req-pending');

    await expect(page.getByText('Pending').first()).toBeVisible({ timeout: 10_000 });

    // Review section should appear for pending requests
    await expect(page.getByText('Review Request').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /approve/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reject/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel request/i })).toBeVisible();
  });

  test('shows back link to leave list', async ({ page }) => {
    await mockLeaveRequestsApi(page);

    await page.goto('/leave/req-1');

    await expect(page.getByText(/Vacation/i).first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/back to time off/i)).toBeVisible();
  });
});
