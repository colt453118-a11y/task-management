import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════

/**
 * Default notification preferences returned by GET /api/users/me/preferences.
 * Includes the `media` field for sound/haptic toggles.
 */
export const MOCK_NOTIFICATION_PREFS = {
  channels: { inApp: true, email: true, push: false, slack: false },
  types: {
    task_assigned: true,
    task_comment: true,
    task_status_changed: true,
    task_mention: true,
    task_due_soon: true,
    task_overdue: true,
    task_escalated: true,
    task_completed: false,
    task_closed: false,
    task_reopened: false,
  },
  typeChannels: {},
  digest: { enabled: false, frequency: 'daily' },
  media: { soundEnabled: true, hapticEnabled: true },
} as const;

/**
 * Notification preferences with sound disabled, haptic enabled.
 */
export const MOCK_PREFS_SOUND_OFF_HAPTIC_ON = {
  ...MOCK_NOTIFICATION_PREFS,
  media: { soundEnabled: false, hapticEnabled: true },
};

/**
 * Notification preferences with sound enabled, haptic disabled.
 */
export const MOCK_PREFS_SOUND_ON_HAPTIC_OFF = {
  ...MOCK_NOTIFICATION_PREFS,
  media: { soundEnabled: true, hapticEnabled: false },
};

/**
 * Notification preferences with both sound and haptic disabled.
 */
export const MOCK_PREFS_BOTH_OFF = {
  ...MOCK_NOTIFICATION_PREFS,
  media: { soundEnabled: false, hapticEnabled: false },
};

// ═══════════════════════════════════════════════════════════════
//  Mock Setup
// ═══════════════════════════════════════════════════════════════

export interface SettingsMockOptions {
  /** Custom preferences returned by GET (defaults to MOCK_NOTIFICATION_PREFS). */
  preferences?: Record<string, unknown> | null;
  /** Whether to simulate network delay (ms). */
  delay?: number;
  /** Whether to abort the API request (simulate network failure). */
  abort?: boolean;
}

/**
 * Mock the settings page API endpoints for E2E tests.
 *
 * Intercepts the following routes:
 *   - GET /api/users/me/preferences  → notification preferences
 *   - PATCH /api/users/me/preferences → save preferences
 *   - GET /api/organization           → organization data (needed by settings page)
 *   - GET /api/users?limit=100        → user list (needed by roles tab)
 *   - GET /api/roles                  → roles list (needed by roles tab)
 *   - GET /api/permissions            → permissions list (needed by roles tab)
 *
 * Call this in beforeEach or at the start of each test.
 */
export async function mockSettingsApis(
  page: Page,
  options: SettingsMockOptions = {},
) {
  const {
    preferences = MOCK_NOTIFICATION_PREFS as unknown as Record<string, unknown>,
    delay,
    abort,
  } = options;

  // ── GET /api/users/me/preferences ──────────────────────
  await page.route('**/api/users/me/preferences', async (route) => {
    if (route.request().method() !== 'GET') {
      // Let PATCH requests fall through to the next handler below
      await route.fallback();
      return;
    }
    if (abort) {
      await route.abort('connectionrefused');
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ preferences }),
    });
  });

  // ── PATCH /api/users/me/preferences (save) ─────────────
  await page.route('**/api/users/me/preferences', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    if (abort) {
      await route.abort('connectionrefused');
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));

    // Accept the body and return success
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ preferences: body }),
    });
  });

  // ── GET /api/organization ──────────────────────────────
  await page.route('**/api/organization', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organization: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          domain: null,
          settings: {},
        },
      }),
    });
  });

  // ── GET /api/users?limit=100 ───────────────────────────
  await page.route('**/api/users?limit=100', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users: [] }),
    });
  });

  // ── GET /api/roles ─────────────────────────────────────
  await page.route('**/api/roles', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ roles: [] }),
    });
  });

  // ── GET /api/permissions ───────────────────────────────
  await page.route('**/api/permissions', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ permissions: [] }),
    });
  });
}
