import { test, expect } from '@playwright/test';

/**
 * Visual snapshot tests for all 11 email template previews.
 *
 * Each test:
 * 1. Navigates to `/api/email/preview/{slug}` at a fixed 1280×900 viewport
 * 2. Waits for the toolbar + iframe to be fully rendered
 * 3. Asserts basic content via text matchers
 * 4. Takes a Playwright-managed snapshot (`toHaveScreenshot`)
 *
 * The Playwright config (maxDiffPixels: 200, threshold: 0.3) allows
 * minor rendering differences across environments.
 */

const ALL_SLUGS = [
  { slug: 'task-assigned', name: 'Task Assigned', actionLabel: 'View Task' },
  { slug: 'task-comment', name: 'Task Comment', actionLabel: 'View Comment' },
  { slug: 'task-status-changed', name: 'Task Status Changed', actionLabel: 'View Task' },
  { slug: 'task-completed', name: 'Task Completed', actionLabel: null },
  { slug: 'task-closed', name: 'Task Closed', actionLabel: null },
  { slug: 'task-reopened', name: 'Task Reopened', actionLabel: 'View Task' },
  { slug: 'task-mention', name: 'Task Mention', actionLabel: null },
  { slug: 'task-due-soon', name: 'Task Due Soon', actionLabel: 'View Task' },
  { slug: 'task-overdue', name: 'Task Overdue', actionLabel: 'View Overdue Task' },
  { slug: 'task-escalated', name: 'Task Escalated', actionLabel: 'View Overdue Task' },
  { slug: 'welcome', name: 'Welcome', actionLabel: 'Get Started' },
] as const;

test.describe('Email Preview — Visual Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  for (const tmpl of ALL_SLUGS) {
    test(`${tmpl.slug} — ${tmpl.name} renders correctly`, async ({ page }) => {
      await page.goto(`/api/email/preview/${tmpl.slug}`);

      // Verify page title for fast-fail on routing bugs
      await expect(page).toHaveTitle(`Preview: ${tmpl.name} — WorkManager`);

      // Wait for the core DOM to settle
      await expect(page.locator('.toolbar')).toBeVisible();
      await expect(page.locator('.toolbar-name')).toContainText(tmpl.name);

      // Wait for iframe (rendered email) to load
      // srcdoc content fires onload synchronously, so body attachment is sufficient
      const iframe = page.frameLocator(`iframe[title="${tmpl.name} preview"]`);
      await expect(iframe.locator('body')).toBeAttached({ timeout: 5000 });

      // Verify the email brand renders inside the iframe
      await expect(iframe.locator('.email-logo')).toBeVisible();

      // Verify the CTA button is present when one is expected
      if (tmpl.actionLabel) {
        const actionBtn = iframe.locator('.email-btn');
        await expect(actionBtn).toBeVisible();
        await expect(actionBtn).toContainText(tmpl.actionLabel);
      }

      // Info bar visible
      await expect(page.locator('.info-bar')).toBeVisible();

      // Take a full-page screenshot managed by Playwright.
      // Playwright stores snapshots in __snapshots__/ relative to this test file.
      // First run creates baselines; subsequent runs compare against them.
      // Uses the config-level maxDiffPixels: 200, threshold: 0.3.
      await expect(page).toHaveScreenshot(`${tmpl.slug}.png`, {
        fullPage: true,
      });
    });
  }
});
