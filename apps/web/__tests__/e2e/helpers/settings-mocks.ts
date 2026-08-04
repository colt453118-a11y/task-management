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

// ═══════════════════════════════════════════════════════════════
//  Slack Integration Mocks
// ═══════════════════════════════════════════════════════════════

/**
 * A connected Slack integration as returned by GET/POST /api/settings/slack.
 */
export const MOCK_SLACK_INTEGRATION = {
  id: 'slack-int-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  channelName: '#general',
  isActive: true,
  hasWebhookUrl: true,
  lastUsedAt: '2026-08-01T12:00:00.000Z',
  lastError: null,
  createdAt: '2026-07-15T09:30:00.000Z',
} as const;

export interface SlackMockOptions {
  /** Payload for GET /api/settings/slack (default: null — not connected). */
  integration?: Record<string, unknown> | null;
  /** Body for POST /api/settings/slack/test (default: { success: true }). */
  testResult?: { success: boolean; error?: string };
  /** Body for POST /api/settings/slack/preview (default: { success: true }). */
  previewResult?: { success: boolean; error?: string };
  /** Full response for POST /api/settings/slack (save/connect). */
  saveResponse?: { status: number; body: Record<string, unknown> };
  /** Full response for DELETE /api/settings/slack (disconnect). */
  deleteResponse?: { status: number; body: Record<string, unknown> };
}

/**
 * Mock the Slack settings endpoints for the Slack tab in E2E tests.
 *
 * Intercepts:
 *   - GET  /api/settings/slack          → integration status
 *   - POST /api/settings/slack          → save/connect webhook
 *   - DELETE /api/settings/slack        → disconnect
 *   - POST /api/settings/slack/test     → webhook test result
 *   - POST /api/settings/slack/preview  → preview send result
 *
 * Call this alongside mockSettingsApis() (the settings page needs the
 * organization/preferences mocks too).
 */
export async function mockSlackSettingsApis(page: Page, options: SlackMockOptions = {}) {
  const {
    integration = null,
    testResult = { success: true },
    previewResult = { success: true },
    saveResponse = {
      status: 200,
      body: { integration: { ...MOCK_SLACK_INTEGRATION } },
    },
    deleteResponse = { status: 200, body: { success: true } },
  } = options;

  // ── CRUD /api/settings/slack ────────────────────────────
  await page.route('**/api/settings/slack', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ integration }),
      });
      return;
    }
    if (method === 'POST') {
      await route.fulfill({
        status: saveResponse.status,
        contentType: 'application/json',
        body: JSON.stringify(saveResponse.body),
      });
      return;
    }
    if (method === 'DELETE') {
      await route.fulfill({
        status: deleteResponse.status,
        contentType: 'application/json',
        body: JSON.stringify(deleteResponse.body),
      });
      return;
    }
    await route.fallback();
  });

  // ── POST /api/settings/slack/test ───────────────────────
  await page.route('**/api/settings/slack/test', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(testResult),
    });
  });

  // ── POST /api/settings/slack/preview ────────────────────
  await page.route('**/api/settings/slack/preview', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(previewResult),
    });
  });
}
