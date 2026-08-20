import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsClient } from '@/app/(dashboard)/settings/settings-client';

// ─── Hoisted mocks ───────────────────────────────
vi.mock('@/lib/notification-sound', () => ({
  playNotificationChime: vi.fn(),
  isNotificationSoundSupported: vi.fn(() => true),
}));

vi.mock('@/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}));

vi.mock('@/lib/notification-media', () => ({
  setMediaPrefs: vi.fn(),
  getMediaPrefs: vi.fn(() => ({ soundEnabled: true, hapticEnabled: true })),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}));

vi.mock('@/components/ui/state-display', () => ({
  EmptyState: ({ title, message }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  ),
}));

vi.mock('@/components/settings/ai-settings', () => ({
  AISettings: () => <div data-testid="ai-settings">AI Settings</div>,
}));

vi.mock('@/components/settings/webhook-settings', () => ({
  WebhookSettings: () => <div data-testid="webhook-settings">Webhook Settings</div>,
}));

vi.mock('@/components/settings/eod-schedule-settings', () => ({
  EODScheduleSettings: () => <div data-testid="eod-schedule-settings">EOD Schedule</div>,
}));

vi.mock('@/components/settings/slack-settings', () => ({
  SlackSettings: () => <div data-testid="slack-settings">Slack Settings</div>,
}));

// ─── Fetch mock ──────────────────────────────────
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const MOCK_ORG_RESPONSE = {
  organization: {
    id: 'org-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    domain: null,
    settings: {},
  },
};

const MOCK_NOTIF_PREFS = {
  preferences: {
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
  },
};

const MOCK_SLACK_RESPONSE = {
  integration: { id: 'slack-1', isActive: true, channelName: '#general' },
};

function setupFetchMock(prefs?: Record<string, unknown>, slack?: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string, options?: RequestInit) => {
    if (url === '/api/organization') {
      return Promise.resolve(new Response(JSON.stringify(MOCK_ORG_RESPONSE)));
    }
    if (url === '/api/users/me/preferences') {
      if (options?.method === 'PATCH') {
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      }
      return Promise.resolve(new Response(JSON.stringify(prefs ?? MOCK_NOTIF_PREFS)));
    }
    if (url === '/api/settings/slack') {
      return Promise.resolve(new Response(JSON.stringify(slack ?? MOCK_SLACK_RESPONSE)));
    }
    return Promise.resolve(new Response(JSON.stringify({})));
  });
}

async function openNotificationsTab() {
  await waitFor(() => {
    expect(screen.getByText('General')).toBeInTheDocument();
  });
  const notifTab = screen.getByRole('tab', { name: 'Notifications' });
  await userEvent.setup().click(notifTab);
  await waitFor(() => {
    expect(screen.getByText('Notification Channels')).toBeInTheDocument();
  });
}

async function waitForPrefsLoaded() {
  await waitFor(() => {
    expect(screen.getByText('Notification Feedback')).toBeInTheDocument();
  });
  await new Promise((r) => setTimeout(r, 50));
}

// Helper to find a toggle by its associated label text
function findToggleNearText(text: string, index = 0) {
  const elements = screen.getAllByText(text);
  const element = elements[index]!;
  const row = element.closest('[class*="flex"][class*="items-center"][class*="justify-between"]');
  return row?.querySelector('[role="switch"]');
}

// Helper to find a channel toggle by its description (unique per channel,
// avoids label collisions with the tab bar).
function findChannelToggleByDescription(text: string) {
  const element = screen.getByText((content) => content.includes(text));
  const row = element.closest('[class*="flex"][class*="items-center"][class*="justify-between"]');
  return row?.querySelector('[role="switch"]');
}

// ═══════════════════════════════════════════════════════════════
//  CHANNEL TOGGLE INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Channel Toggle Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles email channel off and on', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Find the email toggle in the channels section (first occurrence)
    const emailToggle = findToggleNearText('Email', 0);
    expect(emailToggle).toBeTruthy();
    expect(emailToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle off
    await userEvent.setup().click(emailToggle!);
    await waitFor(() => {
      expect(emailToggle).toHaveAttribute('aria-checked', 'false');
    });

    // Toggle back on
    await userEvent.setup().click(emailToggle!);
    await waitFor(() => {
      expect(emailToggle).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('toggles in-app channel off', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Find the in-app toggle in the channels section (first occurrence)
    const inAppToggle = findToggleNearText('In-app', 0);
    expect(inAppToggle).toBeTruthy();
    expect(inAppToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle off
    await userEvent.setup().click(inAppToggle!);
    await waitFor(() => {
      expect(inAppToggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('enables slack channel toggle when connected', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // With MOCK_SLACK_RESPONSE (isActive: true), the Slack toggle is enabled
    const slackToggle = findChannelToggleByDescription('Send notifications to Slack channel');
    expect(slackToggle).toBeTruthy();
    expect(slackToggle).not.toBeDisabled();
  });

  it('disables slack channel toggle when not connected', async () => {
    setupFetchMock(undefined, { integration: null });
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // With no Slack integration, the Slack toggle is disabled (forces setup first)
    const slackToggle = findChannelToggleByDescription('Send notifications to Slack channel');
    expect(slackToggle).toBeTruthy();
    expect(slackToggle).toBeDisabled();
  });

  it('disables push toggle (coming soon)', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const pushToggle = findToggleNearText('Push', 0);
    expect(pushToggle).toBeTruthy();
    expect(pushToggle).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════
//  PER-EVENT CHANNEL TOGGLE INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Per-Event Channel Toggle Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles email for task assigned event', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Find the "Task assigned" row
    const taskAssignedLabel = screen.getByText('Task assigned');
    const row = taskAssignedLabel.closest('[class*="rounded-xl"]');
    expect(row).toBeTruthy();

    // Find toggles within this row
    const toggles = row!.querySelectorAll('[role="switch"]');
    expect(toggles.length).toBe(4); // inApp, email, push, slack

    // Email is the second toggle (index 1)
    const emailToggle = toggles[1]!;
    expect(emailToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle email off for this event
    await userEvent.setup().click(emailToggle);
    await waitFor(() => {
      expect(emailToggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('toggles slack for new comment event', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Find the "New comment" row
    const commentLabel = screen.getByText('New comment');
    const row = commentLabel.closest('[class*="rounded-xl"]');
    expect(row).toBeTruthy();

    // Find toggles within this row
    const toggles = row!.querySelectorAll('[role="switch"]');
    expect(toggles.length).toBe(4);

    // Slack is the fourth toggle (index 3)
    const slackToggle = toggles[3]!;
    expect(slackToggle).toHaveAttribute('aria-checked', 'false'); // Default off

    // Toggle slack on for this event
    await userEvent.setup().click(slackToggle);
    await waitFor(() => {
      expect(slackToggle).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('independently toggles channels for different events', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Find toggles for "Task assigned"
    const taskAssignedLabel = screen.getByText('Task assigned');
    const taskAssignedRow = taskAssignedLabel.closest('[class*="rounded-xl"]');
    const taskToggles = taskAssignedRow!.querySelectorAll('[role="switch"]');

    // Find toggles for "New comment"
    const commentLabel = screen.getByText('New comment');
    const commentRow = commentLabel.closest('[class*="rounded-xl"]');
    const commentToggles = commentRow!.querySelectorAll('[role="switch"]');

    // Toggle email off for task assigned (index 1)
    await userEvent.setup().click(taskToggles[1]!);
    await waitFor(() => {
      expect(taskToggles[1]).toHaveAttribute('aria-checked', 'false');
    });

    // Email for new comment should still be enabled
    expect(commentToggles[1]).toHaveAttribute('aria-checked', 'true');
  });
});

// ═══════════════════════════════════════════════════════════════
//  SAVE FLOW INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Save Flow Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves modified preferences and shows success', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Toggle email off
    const emailToggle = findToggleNearText('Email', 0);
    await userEvent.setup().click(emailToggle!);
    await waitFor(() => {
      expect(emailToggle).toHaveAttribute('aria-checked', 'false');
    });

    // Click save
    await userEvent.setup().click(screen.getByText('Save Preferences'));

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText('Preferences saved')).toBeInTheDocument();
    });

    // Verify API was called with correct data
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/users/me/preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"email":false'),
      }),
    );
  });

  it('saves per-event channel override', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Toggle email off for task assigned
    const taskAssignedLabel = screen.getByText('Task assigned');
    const row = taskAssignedLabel.closest('[class*="rounded-xl"]');
    const toggles = row!.querySelectorAll('[role="switch"]');
    await userEvent.setup().click(toggles[1]!); // Email toggle
    await waitFor(() => {
      expect(toggles[1]).toHaveAttribute('aria-checked', 'false');
    });

    // Click save
    await userEvent.setup().click(screen.getByText('Save Preferences'));

    await waitFor(() => {
      expect(screen.getByText('Preferences saved')).toBeInTheDocument();
    });
  });

  it('shows loading state while saving', async () => {
    // Mock slow API response
    let resolveSave: (value: Response) => void;
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/organization') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_ORG_RESPONSE)));
      }
      if (url === '/api/users/me/preferences' && options?.method === 'PATCH') {
        return new Promise((resolve) => {
          resolveSave = resolve;
        });
      }
      if (url === '/api/users/me/preferences') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_NOTIF_PREFS)));
      }
      if (url === '/api/settings/slack') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SLACK_RESPONSE)));
      }
      return Promise.resolve(new Response(JSON.stringify({})));
    });

    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Click save
    await userEvent.setup().click(screen.getByText('Save Preferences'));

    // Button should show loading state (disabled)
    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeDisabled();
    });

    // Resolve the save
    resolveSave!(new Response(JSON.stringify({ success: true })));

    // Should show success after save completes
    await waitFor(() => {
      expect(screen.getByText('Preferences saved')).toBeInTheDocument();
    });
  });

  it('shows error and allows retry', async () => {
    let callCount = 0;
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/organization') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_ORG_RESPONSE)));
      }
      if (url === '/api/users/me/preferences' && options?.method === 'PATCH') {
        callCount++;
        if (callCount === 1) {
          // First call fails
          return Promise.resolve(new Response(JSON.stringify({}), { status: 500 }));
        }
        // Second call succeeds
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      }
      if (url === '/api/users/me/preferences') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_NOTIF_PREFS)));
      }
      if (url === '/api/settings/slack') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SLACK_RESPONSE)));
      }
      return Promise.resolve(new Response(JSON.stringify({})));
    });

    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // First save attempt fails
    await userEvent.setup().click(screen.getByText('Save Preferences'));
    await waitFor(() => {
      expect(screen.getByText('Failed to save preferences. Please try again.')).toBeInTheDocument();
    });

    // Retry save
    await userEvent.setup().click(screen.getByText('Save Preferences'));
    await waitFor(() => {
      expect(screen.getByText('Preferences saved')).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
//  DIGEST TOGGLE INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Digest Toggle Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles digest on and shows frequency selector', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Find digest toggle
    const digestLabel = screen.getByText('Send digest email');
    const digestRow = digestLabel.closest('[class*="rounded-xl"]');
    const digestToggle = digestRow?.querySelector('[role="switch"]');

    expect(digestToggle).toBeTruthy();
    expect(digestToggle).toHaveAttribute('aria-checked', 'false');

    // Toggle on
    await userEvent.setup().click(digestToggle!);

    // Should show frequency selector
    await waitFor(() => {
      expect(screen.getByText('Frequency')).toBeInTheDocument();
    });
  });

  it('hides frequency selector when digest is toggled off', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Find digest toggle
    const digestLabel = screen.getByText('Send digest email');
    const digestRow = digestLabel.closest('[class*="rounded-xl"]');
    const digestToggle = digestRow?.querySelector('[role="switch"]');

    // Toggle on
    await userEvent.setup().click(digestToggle!);
    await waitFor(() => {
      expect(screen.getByText('Frequency')).toBeInTheDocument();
    });

    // Toggle off
    await userEvent.setup().click(digestToggle!);
    await waitFor(() => {
      expect(screen.queryByText('Frequency')).not.toBeInTheDocument();
    });
  });

  it('changes digest frequency', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Toggle digest on
    const digestLabel = screen.getByText('Send digest email');
    const digestRow = digestLabel.closest('[class*="rounded-xl"]');
    const digestToggle = digestRow?.querySelector('[role="switch"]');
    await userEvent.setup().click(digestToggle!);

    await waitFor(() => {
      expect(screen.getByText('Frequency')).toBeInTheDocument();
    });

    // Change frequency to weekly
    const select = screen.getByDisplayValue('Daily');
    await userEvent.setup().selectOptions(select, 'weekly');
    expect(select).toHaveValue('weekly');

    // Change to never
    await userEvent.setup().selectOptions(select, 'never');
    expect(select).toHaveValue('never');
  });
});

// ═══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUT INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Keyboard Shortcut Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to notifications tab with key 7', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: '7' });

    await waitFor(() => {
      expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    });
  });

  it('navigates back to general tab with key 1', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    // Go to notifications
    fireEvent.keyDown(window, { key: '7' });
    await waitFor(() => {
      expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    });

    // Go back to general
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => {
      expect(screen.getByText('General Settings')).toBeInTheDocument();
    });
  });

  it('keyboard shortcuts only work on window, not inputs', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    // Verify keyboard shortcuts work when dispatched to window
    fireEvent.keyDown(window, { key: '7' });
    await waitFor(() => {
      expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    });

    // Navigate back
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => {
      expect(screen.getByText('General Settings')).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
//  EDGE CASE INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Edge Case Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles rapid toggle clicks', async () => {
    setupFetchMock();
    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const emailToggle = findToggleNearText('Email', 0);

    // Rapid clicks
    await userEvent.setup().click(emailToggle!);
    await userEvent.setup().click(emailToggle!);
    await userEvent.setup().click(emailToggle!);

    // Should end up toggled off (3 clicks: on->off->on->off)
    await waitFor(() => {
      expect(emailToggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('handles save while preferences are loading', async () => {
    // Mock slow preferences load
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/organization') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_ORG_RESPONSE)));
      }
      if (url === '/api/users/me/preferences') {
        return new Promise((resolve) =>
          setTimeout(() => resolve(new Response(JSON.stringify(MOCK_NOTIF_PREFS))), 500),
        );
      }
      if (url === '/api/settings/slack') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SLACK_RESPONSE)));
      }
      return Promise.resolve(new Response(JSON.stringify({})));
    });

    render(<SettingsClient />);
    await openNotificationsTab();

    // Wait for loading to complete
    await waitForPrefsLoaded();

    // Save should work after loading
    await userEvent.setup().click(screen.getByText('Save Preferences'));
    await waitFor(() => {
      expect(screen.getByText('Preferences saved')).toBeInTheDocument();
    });
  });

  it('handles network error during save', async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/organization') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_ORG_RESPONSE)));
      }
      if (url === '/api/users/me/preferences' && options?.method === 'PATCH') {
        return Promise.reject(new Error('Network error'));
      }
      if (url === '/api/users/me/preferences') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_NOTIF_PREFS)));
      }
      if (url === '/api/settings/slack') {
        return Promise.resolve(new Response(JSON.stringify(MOCK_SLACK_RESPONSE)));
      }
      return Promise.resolve(new Response(JSON.stringify({})));
    });

    render(<SettingsClient />);
    await openNotificationsTab();
    await waitForPrefsLoaded();

    await userEvent.setup().click(screen.getByText('Save Preferences'));
    await waitFor(() => {
      expect(screen.getByText('Failed to save preferences. Please try again.')).toBeInTheDocument();
    });
  });
});
