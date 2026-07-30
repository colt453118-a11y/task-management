import { test, expect } from '@playwright/test';
import { mockReportsApis } from './helpers/reports-mocks';
import { setSessionCookie } from './helpers/task-detail-mocks';

// ─── Setup ─────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await setSessionCookie(page);
});

// ─── Tests ─────────────────────────────────────────────────────

test.describe('Reports', () => {
  test('shows loading shimmer while data is being fetched', async ({ page }) => {
    await mockReportsApis(page, { delay: 500 });

    await page.goto('/reports');

    // Shimmer placeholders should be visible while loading
    await expect(page.locator('.shimmer').first()).toBeVisible({ timeout: 5_000 });

    // Title should appear after loading
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows KPI zeros when no tasks or projects exist', async ({ page }) => {
    await mockReportsApis(page, { tasks: [], projects: [] });

    await page.goto('/reports');

    // Wait for page to hydrate
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // KPI cards should be visible with zero values
    // Note: the page always computes metrics (even if zero), so the grid always shows
    await expect(page.getByText(/total tasks/i)).toBeVisible();
    await expect(page.getByText(/completion rate/i)).toBeVisible();

    // Zero values should appear
    await expect(page.getByText('0').first()).toBeVisible();

    // With no tasks and no projects, the KPI cards show zeros
    await expect(page.getByText(/no data available/i)).not.toBeVisible();
  });

  test('renders KPI cards with correct metrics from task data', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    // Wait for page to hydrate
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // KPI card labels should be visible
    await expect(page.getByText(/total tasks/i)).toBeVisible();
    await expect(page.getByText(/in progress/i).first()).toBeVisible();
    await expect(page.getByText(/completed/i).first()).toBeVisible();
    await expect(page.getByText(/blocked/i).first()).toBeVisible();
    await expect(page.getByText(/overdue/i).first()).toBeVisible();
    await expect(page.getByText(/completion rate/i)).toBeVisible();

    // Verify metric values based on MOCK_REPORT_TASKS:
    // totalTasks: 8, inProgress: 2, completed: 2, closed: 1, blocked: 1, overdue: 1
    await expect(page.getByText('8').first()).toBeVisible();
    await expect(page.getByText('2').first()).toBeVisible();
    await expect(page.getByText('1').first()).toBeVisible();
  });

  test('shows trend indicators on KPI cards', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Trend indicators: Total Tasks has +12%, Completed has +18%, Overdue has -5%
    await expect(page.getByText('+12%')).toBeVisible();
    await expect(page.getByText('+18%')).toBeVisible();
    await expect(page.getByText('-5%')).toBeVisible();
  });

  test('renders snapshot button and recent snapshots list', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Snapshot button should be visible
    await expect(page.getByRole('button', { name: /snapshot/i })).toBeVisible();

    // Recent snapshots section should render with mock data
    await expect(page.getByText(/recent report snapshots/i)).toBeVisible();

    // Snapshot labels should appear
    // Note: /EOD/i matches both the label "EOD Report..." and the badge "EOD", use .first()
    await expect(page.getByText(/EOD/i).first()).toBeVisible();

    // Snapshot type badges should appear
    await expect(page.getByText(/WEEKLY/i).first()).toBeVisible();
  });

  test('generates snapshot on button click and shows success', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Click the Snapshot button
    await page.getByRole('button', { name: /snapshot/i }).click();

    // Should show success toast
    await expect(page.getByText(/snapshot generated/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('opens export dropdown with correct options', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Click the Export button to open dropdown
    await page.getByRole('button', { name: /export/i }).click();

    // Export options should appear
    await expect(page.getByText(/export as csv/i)).toBeVisible();

    // Each export type should be present
    await expect(page.getByText(/^Tasks$/).first()).toBeVisible();
    await expect(page.getByText(/^Projects$/).first()).toBeVisible();
    await expect(page.getByText(/^Users$/).first()).toBeVisible();
  });

  test('switches to Time Tracking tab and shows period selector', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Click the Time Tracking tab
    await page.getByRole('tab', { name: /time tracking/i }).click();

    // Time tracking section should be visible
    // Note: /time tracking/i matches sidebar link + tab button + kbd hint, use .first()
    await expect(page.getByText(/time tracking/i).first()).toBeVisible();

    // Period selector buttons should be visible
    await expect(page.getByRole('button', { name: /^week$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^month$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^quarter$/i }).first()).toBeVisible();

    // Time data summary stats should appear (total hours, entries, avg session)
    await expect(page.getByText(/total hours/i)).toBeVisible();
    await expect(page.getByText(/entries/i).first()).toBeVisible();
    await expect(page.getByText(/avg session/i)).toBeVisible();
  });

  test('switches time period between week, month, and quarter', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Switch to Time Tracking tab
    await page.getByRole('tab', { name: /time tracking/i }).click();

    // Default should be Week (active)
    // Click Month
    await page.getByRole('button', { name: /^month$/i }).first().click();

    // Month button should now appear selected (active state)
    // Click Quarter
    await page.getByRole('button', { name: /^quarter$/i }).first().click();

    // Quarter should now be selected
    // Total Hours should still be visible after switching
    await expect(page.getByText(/total hours/i)).toBeVisible();
  });

  test('renders time report data with daily hours, top users, and top tasks', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Switch to Time Tracking tab
    await page.getByRole('tab', { name: /time tracking/i }).click();

    // Wait for time report to load
    await expect(page.getByText(/total hours/i)).toBeVisible({ timeout: 10_000 });

    // Total hours should show 42.5
    await expect(page.getByText('42.5').first()).toBeVisible();

    // Entry count should show 38
    await expect(page.getByText('38').first()).toBeVisible();

    // Daily hours chart section should exist
    await expect(page.getByText(/hours by day/i)).toBeVisible();

    // Top users section should exist
    await expect(page.getByText(/top users by hours/i)).toBeVisible();

    // User names should appear
    await expect(page.getByText(/Alice Johnson/i).first()).toBeVisible();

    // Top tasks section should exist
    await expect(page.getByText(/top tasks by time/i)).toBeVisible();

    // Task titles should appear
    await expect(page.getByText(/User auth/i).first()).toBeVisible();

    // Hours by project section should exist
    await expect(page.getByText(/hours by project/i)).toBeVisible();
  });

  test('shows empty state in Time Tracking tab when no time data exists', async ({ page }) => {
    await mockReportsApis(page, { timeReport: null });

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Switch to Time Tracking tab
    await page.getByRole('tab', { name: /time tracking/i }).click();

    // Empty state should appear
    await expect(page.getByText(/no time data for this period/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/start tracking time on tasks/i)).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
//  Snapshot Detail Page & Export Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Snapshot Detail Page', () => {
  test('navigates to snapshot detail page and renders snapshot header', async ({ page }) => {
    await mockReportsApis(page);

    // Navigate directly to the snapshot detail page
    await page.goto('/reports/snapshots/snap-1');

    // Wait for page to hydrate
    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // Snapshot type badge should appear
    await expect(page.getByText(/EOD/i).first()).toBeVisible();

    // Back button should be present
    await expect(page.getByLabel(/back to reports/i)).toBeVisible();
  });

  test('renders KPI stat cards with snapshot summary metrics', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports/snapshots/snap-1');

    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // KPI stat cards should appear with summary values
    await expect(page.getByText(/total tasks/i).first()).toBeVisible();
    await expect(page.getByText(/completed/i).first()).toBeVisible();
    await expect(page.getByText(/overdue/i).first()).toBeVisible();
    await expect(page.getByText(/active projects/i).first()).toBeVisible();
    await expect(page.getByText(/team members/i).first()).toBeVisible();
    await expect(page.getByText(/completion rate/i).first()).toBeVisible();

    // Metric values should be visible
    await expect(page.getByText('8').first()).toBeVisible();
    await expect(page.getByText('25%').first()).toBeVisible();
  });

  test('shows AI summary card with generated text', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports/snapshots/snap-1');

    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // AI Summary section should be visible
    await expect(page.getByRole('heading', { name: /ai summary/i })).toBeVisible();

    // The mock AI summary text should appear
    await expect(page.getByText(/team completed 2 of 8 tasks/i)).toBeVisible();
  });

  test('regenerates AI summary on button click', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports/snapshots/snap-1');

    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // Regenerate button should be visible
    await expect(page.getByRole('button', { name: /regenerate/i })).toBeVisible();

    // Click the regenerate button
    await page.getByRole('button', { name: /regenerate/i }).click();

    // Should show regenerating state then the new summary
    await expect(page.getByText(/regenerated:/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('shows task breakdown with status and priority distributions', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports/snapshots/snap-1');

    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // Task Status Distribution section
    await expect(page.getByRole('heading', { name: /task status distribution/i })).toBeVisible();

    // Task Priority Distribution section
    await expect(page.getByRole('heading', { name: /task priority distribution/i })).toBeVisible();

    // Status labels should appear (from mock data: open, in_progress, completed, etc.)
    await expect(page.getByText(/^open$/i).first()).toBeVisible();
    await expect(page.getByText(/^completed$/i).first()).toBeVisible();
    await expect(page.getByText(/^in progress$/i).first()).toBeVisible();
  });

  test('shows task activity, project status, and people sections', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports/snapshots/snap-1');

    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // Task Activity section
    await expect(page.getByRole('heading', { name: /task activity/i })).toBeVisible();
    await expect(page.getByText(/created today/i)).toBeVisible();
    await expect(page.getByText(/completed today/i)).toBeVisible();

    // Project Status section
    await expect(page.getByRole('heading', { name: /project status/i })).toBeVisible();
    await expect(page.getByText(/total projects/i)).toBeVisible();

    // People & Teams section
    await expect(page.getByRole('heading', { name: /people & teams/i })).toBeVisible();
    await expect(page.getByText(/total users/i)).toBeVisible();
    await expect(page.getByText(/active users/i)).toBeVisible();
  });

  test('shows comparison section when previous snapshot exists', async ({ page }) => {
    await mockReportsApis(page, {
      snapshots: [
        {
          id: 'snap-1',
          snapshotDate: '2026-07-21',
          snapshotType: 'eod',
          label: 'EOD Report - Jul 21, 2026',
          summary: { totalTasks: 8, completedCount: 2, overdueCount: 1, activeProjects: 2, totalUsers: 3, completionRate: 25 },
          generatedBy: 'user-1',
          createdAt: '2026-07-21T17:00:00.000Z',
        },
        {
          id: 'snap-0',
          snapshotDate: '2026-07-20',
          snapshotType: 'eod',
          label: 'EOD Report - Jul 20, 2026',
          summary: { totalTasks: 6, completedCount: 1, overdueCount: 2, activeProjects: 2, totalUsers: 3, completionRate: 17 },
          generatedBy: 'user-1',
          createdAt: '2026-07-20T17:00:00.000Z',
        },
      ],
    });

    await page.goto('/reports/snapshots/snap-1');

    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // Comparison section should appear
    await expect(page.getByText(/vs previous snapshot/i)).toBeVisible();

    // Delta indicators should show (total tasks: 8 vs 6 = +2)
    await expect(page.getByText(/previous: 6/i).first()).toBeVisible();
  });

  test('downloads CSV export on button click', async ({ page }) => {
    await mockReportsApis(page);

    await page.goto('/reports/snapshots/snap-1');

    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 15_000,
    });

    // Export CSV button should be visible
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();

    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });

    // Click the export button
    await page.getByRole('button', { name: /export csv/i }).click();

    // Wait for the download to start
    const download = await downloadPromise;

    // Verify the download has a filename
    expect(download.suggestedFilename()).toContain('snapshot-');

    // Read the downloaded content via Playwright's createReadStream
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    expect(content).toContain('Snapshot Export');
  });

  test('shows loading shimmer during page load', async ({ page }) => {
    await mockReportsApis(page, { delay: 500 });

    await page.goto('/reports/snapshots/snap-1');

    // Shimmer should be visible during load
    await expect(page.locator('.shimmer').first()).toBeVisible({ timeout: 5_000 });

    // After loading, the heading should appear
    await expect(page.getByRole('heading', { name: /EOD Report/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows error state for non-existent snapshot', async ({ page }) => {
    await mockReportsApis(page, { snapshotDetail: null });

    await page.goto('/reports/snapshots/nonexistent-id');

    // Error state should appear
    await expect(page.getByText(/snapshot not found/i)).toBeVisible({ timeout: 10_000 });

    // Back button should be available
    await expect(page.getByRole('button', { name: /back to reports/i })).toBeVisible();
  });
});
