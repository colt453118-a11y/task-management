import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMediaPrefs,
  setMediaPrefs,
  triggerNotificationFeedback,
  type NotificationMediaPrefs,
} from '@/lib/notification-media';
import { playNotificationChime } from '@/lib/notification-sound';
import { triggerHaptic } from '@/lib/haptics';

// ─── Mocks (hoisted by vitest) ───────────────────

vi.mock('@/lib/notification-sound', () => ({
  playNotificationChime: vi.fn(),
  isNotificationSoundSupported: vi.fn(() => true),
}));

vi.mock('@/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}));

// ─── Tests ───────────────────────────────────────

describe('getMediaPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when no preferences are stored', () => {
    const prefs = getMediaPrefs();
    expect(prefs.soundEnabled).toBe(true);
    expect(prefs.hapticEnabled).toBe(true);
  });

  it('returns stored preferences', () => {
    localStorage.setItem(
      'notif-media-prefs',
      JSON.stringify({ soundEnabled: false, hapticEnabled: true }),
    );
    const prefs = getMediaPrefs();
    expect(prefs.soundEnabled).toBe(false);
    expect(prefs.hapticEnabled).toBe(true);
  });

  it('returns defaults when localStorage is unavailable', () => {
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
    });

    const prefs = getMediaPrefs();
    expect(prefs.soundEnabled).toBe(true);
    expect(prefs.hapticEnabled).toBe(true);

    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  it('gracefully handles corrupt JSON', () => {
    localStorage.setItem('notif-media-prefs', 'not-valid-json');
    const prefs = getMediaPrefs();
    expect(prefs.soundEnabled).toBe(true);
    expect(prefs.hapticEnabled).toBe(true);
  });

  it('gracefully handles partial preferences', () => {
    localStorage.setItem('notif-media-prefs', JSON.stringify({ soundEnabled: false }));
    const prefs = getMediaPrefs();
    expect(prefs.soundEnabled).toBe(false);
    expect(prefs.hapticEnabled).toBe(true); // Uses default
  });
});

describe('setMediaPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists preferences to localStorage', () => {
    const prefs: NotificationMediaPrefs = { soundEnabled: false, hapticEnabled: true };
    setMediaPrefs(prefs);

    const stored = JSON.parse(localStorage.getItem('notif-media-prefs') ?? '{}');
    expect(stored.soundEnabled).toBe(false);
    expect(stored.hapticEnabled).toBe(true);
  });

  it('no-ops when localStorage is unavailable', () => {
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
    });

    expect(() =>
      setMediaPrefs({ soundEnabled: false, hapticEnabled: false }),
    ).not.toThrow();

    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  it('stores then retrieves correctly (round-trip)', () => {
    setMediaPrefs({ soundEnabled: false, hapticEnabled: false });
    expect(getMediaPrefs()).toEqual({ soundEnabled: false, hapticEnabled: false });

    setMediaPrefs({ soundEnabled: true, hapticEnabled: false });
    expect(getMediaPrefs()).toEqual({ soundEnabled: true, hapticEnabled: false });

    setMediaPrefs({ soundEnabled: true, hapticEnabled: true });
    expect(getMediaPrefs()).toEqual({ soundEnabled: true, hapticEnabled: true });
  });
});

describe('triggerNotificationFeedback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('plays sound and haptic when both are enabled', () => {
    setMediaPrefs({ soundEnabled: true, hapticEnabled: true });
    triggerNotificationFeedback();

    expect(playNotificationChime).toHaveBeenCalledTimes(1);
    expect(triggerHaptic).toHaveBeenCalledWith('drop');
  });

  it('plays only sound when haptic is disabled', () => {
    setMediaPrefs({ soundEnabled: true, hapticEnabled: false });
    triggerNotificationFeedback();

    expect(playNotificationChime).toHaveBeenCalledTimes(1);
    expect(triggerHaptic).not.toHaveBeenCalled();
  });

  it('plays only haptic when sound is disabled', () => {
    setMediaPrefs({ soundEnabled: false, hapticEnabled: true });
    triggerNotificationFeedback();

    expect(playNotificationChime).not.toHaveBeenCalled();
    expect(triggerHaptic).toHaveBeenCalledWith('drop');
  });

  it('plays nothing when both are disabled', () => {
    setMediaPrefs({ soundEnabled: false, hapticEnabled: false });
    triggerNotificationFeedback();

    expect(playNotificationChime).not.toHaveBeenCalled();
    expect(triggerHaptic).not.toHaveBeenCalled();
  });

  it('plays both by default when no prefs are set', () => {
    triggerNotificationFeedback();

    expect(playNotificationChime).toHaveBeenCalledTimes(1);
    expect(triggerHaptic).toHaveBeenCalledWith('drop');
  });
});
