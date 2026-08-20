import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsClient } from '@/app/(dashboard)/settings/settings-client';
import { isNotificationSoundSupported } from '@/lib/notification-sound';

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
  Badge: ({ children }: any) => <span>{children}</span>,
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
    channels: { inApp: true, email: true, push: false },
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

// ─── Helpers ─────────────────────────────────────

function setupFetchMock(prefs?: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/organization') {
      return Promise.resolve(new Response(JSON.stringify(MOCK_ORG_RESPONSE)));
    }
    if (url === '/api/users/me/preferences') {
      return Promise.resolve(
        new Response(
          JSON.stringify(prefs ?? MOCK_NOTIF_PREFS),
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({})));
  });
}

async function openNotificationsTab() {
  const notifTab = screen.getByRole('tab', { name: 'Notifications' });
  await userEvent.setup().click(notifTab);

  // Wait for notification content to render (static text, always present)
  await waitFor(() => {
    expect(screen.getByText('Notification Channels')).toBeInTheDocument();
  });
}

async function waitForPrefsLoaded() {
  // Wait for the "Notification Feedback" subsection heading to be visible
  // which is rendered inside the notifications tab
  await waitFor(() => {
    expect(screen.getByText('Notification Feedback')).toBeInTheDocument();
  });
  // Small extra wait for React state updates to settle
  await new Promise((r) => setTimeout(r, 50));
}

/**
 * Find a preview button by its aria-label and return it along with its sibling
 * toggle switch. Both preview buttons (Sound chime, Vibration) share the same
 * DOM layout: a `div.flex.items-center.gap-1.5` containing the preview button
 * followed by a `button[role="switch"]`.
 *
 * @param label - RegExp matching the button's aria-label
 *   (e.g. `/preview notification chime/i` or `/preview vibration feedback/i`)
 */
function findPreviewRow(label: RegExp) {
  const previewBtn = screen.getByRole('button', { name: label });
  const container = previewBtn.parentElement;
  const toggle = container?.querySelector('[role="switch"]');
  return { previewBtn, toggle };
}

describe('Preview chime button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset isNotificationSoundSupported to return true by default
    // (clearAllMocks clears call history but NOT mockReturnValue overrides)
    vi.mocked(isNotificationSoundSupported).mockReturnValue(true);
  });

  it('renders the preview chime button next to the Sound toggle', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview notification chime/i);
    expect(previewBtn).toBeInTheDocument();
    expect(previewBtn).toHaveAttribute('title', 'Preview chime');
  });

  it('calls playNotificationChime when clicked', async () => {
    const { playNotificationChime } = await import('@/lib/notification-sound');
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview notification chime/i);
    await userEvent.setup().click(previewBtn);

    expect(playNotificationChime).toHaveBeenCalledTimes(1);
  });

  it('is enabled by default when sound is on', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview notification chime/i);
    expect(previewBtn).not.toBeDisabled();
  });

  it('is disabled when sound is toggled off', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn, toggle } = findPreviewRow(/preview notification chime/i);
    expect(toggle).toBeTruthy();

    // Toggle sound off
    await userEvent.setup().click(toggle!);

    expect(previewBtn).toBeDisabled();
  });

  it('is disabled when isNotificationSoundSupported returns false', async () => {
    vi.mocked(isNotificationSoundSupported).mockReturnValue(false);
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();

    // On first render with sound unsupported, the notification feedback
    // section renders with the button disabled from the start
    const { previewBtn } = findPreviewRow(/preview notification chime/i);
    expect(previewBtn).toBeDisabled();
  });

  it('is enabled even when haptic is off, as long as sound is on', async () => {
    setupFetchMock({
      preferences: {
        ...MOCK_NOTIF_PREFS.preferences,
        media: { soundEnabled: true, hapticEnabled: false },
      },
    });
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview notification chime/i);
    expect(previewBtn).not.toBeDisabled();
  });

  it('starts disabled when sound is off, then becomes re-enabled when toggled back on', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Toggle sound off — re-query element after each interaction to avoid stale DOM refs
    const { previewBtn: btn1, toggle: toggle1 } = findPreviewRow(/preview notification chime/i);
    expect(toggle1).toBeTruthy();
    await userEvent.setup().click(toggle1!);
    expect(btn1).toBeDisabled();

    // Toggle sound back on — re-query to get fresh DOM references
    const { previewBtn: btn2, toggle: toggle2 } = findPreviewRow(/preview notification chime/i);
    expect(toggle2).toBeTruthy();
    await userEvent.setup().click(toggle2!);
    // Use waitFor to handle React async state update timing
    await waitFor(() => {
      expect(btn2).not.toBeDisabled();
    });
  });

  it('toggles sound off after toggling it on twice (round-trip)', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Toggle sound off
    const { toggle: t1 } = findPreviewRow(/preview notification chime/i);
    await userEvent.setup().click(t1!);

    // Toggle sound back on
    const { toggle: t2 } = findPreviewRow(/preview notification chime/i);
    await userEvent.setup().click(t2!);

    // Toggle sound off again
    const { previewBtn, toggle: t3 } = findPreviewRow(/preview notification chime/i);
    await userEvent.setup().click(t3!);
    expect(previewBtn).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════
//  Preview vibration button tests
// ═══════════════════════════════════════════════════════════════

describe('Preview vibration button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isNotificationSoundSupported).mockReturnValue(true);
  });

  it('renders the preview vibration button next to the Vibration toggle', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview vibration feedback/i);
    expect(previewBtn).toBeInTheDocument();
    expect(previewBtn).toHaveAttribute('title', 'Preview vibration');
  });

  it('calls triggerHaptic with "light" when clicked', async () => {
    const { triggerHaptic } = await import('@/lib/haptics');
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview vibration feedback/i);
    await userEvent.setup().click(previewBtn);

    expect(triggerHaptic).toHaveBeenCalledTimes(1);
    expect(triggerHaptic).toHaveBeenCalledWith('light');
  });

  it('is enabled by default when haptic is on', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview vibration feedback/i);
    expect(previewBtn).not.toBeDisabled();
  });

  it('is disabled when haptic is toggled off', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn, toggle } = findPreviewRow(/preview vibration feedback/i);
    expect(toggle).toBeTruthy();
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Toggle haptic off
    await userEvent.setup().click(toggle!);

    expect(previewBtn).toBeDisabled();
  });

  it('is enabled even when sound is off, as long as haptic is on', async () => {
    setupFetchMock({
      preferences: {
        ...MOCK_NOTIF_PREFS.preferences,
        media: { soundEnabled: false, hapticEnabled: true },
      },
    });
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    const { previewBtn } = findPreviewRow(/preview vibration feedback/i);
    expect(previewBtn).not.toBeDisabled();
  });

  it('starts disabled when haptic is off, then becomes re-enabled when toggled back on', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Toggle haptic off — re-query after each interaction
    const { previewBtn: btn1, toggle: toggle1 } = findPreviewRow(/preview vibration feedback/i);
    expect(toggle1).toBeTruthy();
    await userEvent.setup().click(toggle1!);
    expect(btn1).toBeDisabled();

    // Toggle haptic back on — re-query to get fresh DOM references
    const { previewBtn: btn2, toggle: toggle2 } = findPreviewRow(/preview vibration feedback/i);
    expect(toggle2).toBeTruthy();
    await userEvent.setup().click(toggle2!);
    await waitFor(() => {
      expect(btn2).not.toBeDisabled();
    });
  });

  it('toggles haptic off after toggling it on twice (round-trip)', async () => {
    setupFetchMock();
    render(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await openNotificationsTab();
    await waitForPrefsLoaded();

    // Toggle haptic off
    const { toggle: t1 } = findPreviewRow(/preview vibration feedback/i);
    await userEvent.setup().click(t1!);

    // Toggle haptic back on
    const { toggle: t2 } = findPreviewRow(/preview vibration feedback/i);
    await userEvent.setup().click(t2!);

    // Toggle haptic off again
    const { previewBtn, toggle: t3 } = findPreviewRow(/preview vibration feedback/i);
    await userEvent.setup().click(t3!);
    expect(previewBtn).toBeDisabled();
  });
});
