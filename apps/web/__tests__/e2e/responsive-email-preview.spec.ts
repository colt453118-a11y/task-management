import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const PREVIEW_URL = '/api/email/preview/task-assigned';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

const SCREENSHOT_DIR = path.join(process.cwd(), '__tests__/e2e/screenshots');

// Ensure screenshot directory exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe('Email Preview — Responsive Layout', () => {

  for (const vp of VIEWPORTS) {
    test.describe(`viewport: ${vp.name} (${vp.width}×${vp.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
      });

      test('page loads with correct title and toolbar', async ({ page }) => {
        await page.goto(PREVIEW_URL);
        await expect(page.locator('body')).toBeAttached();

        const toolbar = page.locator('.toolbar');
        await expect(toolbar).toBeVisible();

        await expect(page.locator('.toolbar-name')).toContainText('Task Assigned');
        await expect(page.locator('.toolbar-subject')).toContainText(
          "You've been assigned",
        );
        await expect(page.locator('.btn-back')).toBeVisible();

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${vp.name}-page-load.png`,
          fullPage: true,
        });
      });

      test('toolbar actions are accessible', async ({ page }) => {
        await page.goto(PREVIEW_URL);
        await expect(page.locator('#raw-toggle')).toBeVisible();
        await expect(page.locator('#download-btn')).toBeVisible();
      });

      test('rendered email iframe is present and contains brand content', async ({
        page,
      }) => {
        await page.goto(PREVIEW_URL);
        const iframe = page.frameLocator('iframe[title="Task Assigned preview"]');

        // Wait for iframe content to load
        await expect(iframe.locator('body')).toBeAttached();

        // Brand and content
        await expect(iframe.locator('.email-logo')).toBeVisible();
        await expect(iframe.getByText('Design system migration')).toBeVisible();

        // Action button (use .email-btn class to target the primary CTA, not the secondary link)
        const viewTaskBtn = iframe.locator('.email-btn');
        await expect(viewTaskBtn).toBeVisible();

        // Verify button is styled as a CTA (has brand color background)
        const btnStyle = await viewTaskBtn.getAttribute('style');
        expect(btnStyle).toContain('background-color');
        expect(btnStyle).toContain('#6366f1');

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${vp.name}-iframe-content.png`,
          fullPage: true,
        });
      });

      test('info bar is visible and contains guidance text', async ({ page }) => {
        await page.goto(PREVIEW_URL);
        const infoBar = page.locator('.info-bar');
        await expect(infoBar).toBeVisible();
        await expect(infoBar).toContainText('preview with sample data');
        await expect(infoBar).toContainText('responsive layout');
      });

      test('raw HTML toggle shows/hides panel and copy button works', async ({
        page,
        context,
      }) => {
        // Grant clipboard permission for this test
        await context.grantPermissions(['clipboard-write']);

        await page.goto(PREVIEW_URL);

        const rawPanel = page.locator('#raw-html');
        await expect(rawPanel).not.toBeVisible();

        // Click toggle to show
        await page.locator('#raw-toggle').click();
        await expect(rawPanel).toBeVisible();

        // Panel contains the email HTML
        const rawContent = page.locator('#raw-content');
        await expect(rawContent).toContainText('<!DOCTYPE');
        await expect(rawContent).toContainText('WorkManager');

        // Copy button works
        await page.locator('#copy-btn').click();
        await expect(page.locator('#copy-btn')).toContainText('Copied!');

        // Toggle again hides panel
        await page.locator('#raw-toggle').click();
        await expect(rawPanel).not.toBeVisible();
      });

      test('download button triggers file download', async ({ page }) => {
        await page.goto(PREVIEW_URL);
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        await page.locator('#download-btn').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/task-assigned.*\.html$/);
      });
    });
  }

  test.describe('responsive behavior across viewports', () => {
    test('toolbar content wraps on mobile (actions move below title)', async ({
      page,
    }) => {
      // Desktop: toolbar-left and toolbar-actions on same row
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(PREVIEW_URL);

      const desktopLeftBox = await page
        .locator('.toolbar-left')
        .boundingBox();
      const desktopActionsBox = await page
        .locator('.toolbar-actions')
        .boundingBox();

      expect(desktopLeftBox).not.toBeNull();
      expect(desktopActionsBox).not.toBeNull();

      if (desktopLeftBox && desktopActionsBox) {
        // On desktop they share the same Y row
        expect(Math.abs(desktopLeftBox.y - desktopActionsBox.y)).toBeLessThan(10);
      }

      // Mobile: toolbar actions wrap below
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(PREVIEW_URL);

      const mobileLeftBox = await page
        .locator('.toolbar-left')
        .boundingBox();
      const mobileActionsBox = await page
        .locator('.toolbar-actions')
        .boundingBox();

      expect(mobileLeftBox).not.toBeNull();
      expect(mobileActionsBox).not.toBeNull();

      if (mobileLeftBox && mobileActionsBox) {
        // On mobile, actions are below the left section
        expect(mobileActionsBox.y).toBeGreaterThan(mobileLeftBox.y + mobileLeftBox.height - 5);
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/mobile-toolbar-wrapping.png`,
        fullPage: true,
      });
    });

    test('email iframe resizes to content height at all viewports', async ({
      page,
    }) => {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(PREVIEW_URL);

        const iframe = page.locator('iframe[title="Task Assigned preview"]');

        // Wait for onload (autoResizeIframe runs), then poll until height stabilizes
        await expect(iframe).toBeAttached();

        const box = await iframe.evaluate(async (el) => {
          const iframe = el as HTMLIFrameElement;
          let prevHeight = 0;
          let stableCount = 0;
          // Poll until height stabilizes (2 consecutive same values, max 2s)
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 100));
            const currentHeight = iframe.contentWindow?.document.documentElement.scrollHeight ?? 0;
            if (currentHeight === prevHeight) {
              stableCount++;
              if (stableCount >= 2) break;
            } else {
              stableCount = 0;
            }
            prevHeight = currentHeight;
          }
          return iframe.getBoundingClientRect();
        });

        expect(box).not.toBeNull();

        if (box) {
          // Height should be reasonable for content (not 0, not viewport-sized)
          expect(box.height).toBeGreaterThan(200);
          expect(box.height).toBeLessThan(2000);
        }

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${vp.name}-iframe-resize.png`,
          fullPage: true,
        });
      }
    });
  });
});
