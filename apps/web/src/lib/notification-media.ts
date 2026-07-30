/**
 * Notification media feedback orchestrator.
 *
 * Coordinates sound (Web Audio API chime) and haptic (vibration) feedback
 * when new notifications arrive. Respects user preferences stored in
 * localStorage so they can be read synchronously — no API roundtrip needed
 * for the SSE notification handler.
 *
 * Preferences key:  `notif-media-prefs`
 * Schema:           `{ soundEnabled: boolean; hapticEnabled: boolean }`
 *
 * Defaults:         Both enabled (`true`).
 */

import { playNotificationChime } from '@/lib/notification-sound';
import { triggerHaptic } from '@/lib/haptics';

// ─── Types ───────────────────────────────────────

export interface NotificationMediaPrefs {
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

const STORAGE_KEY = 'notif-media-prefs';

const DEFAULT_PREFS: NotificationMediaPrefs = {
  soundEnabled: true,
  hapticEnabled: true,
};

// ─── Preferences ─────────────────────────────────

/**
 * Read notification media preferences from localStorage.
 * Returns defaults if nothing is stored or if localStorage is unavailable.
 */
export function getMediaPrefs(): NotificationMediaPrefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationMediaPrefs>;
    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_PREFS.soundEnabled,
      hapticEnabled:
        typeof parsed.hapticEnabled === 'boolean'
          ? parsed.hapticEnabled
          : DEFAULT_PREFS.hapticEnabled,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/**
 * Persist notification media preferences to localStorage.
 */
export function setMediaPrefs(prefs: NotificationMediaPrefs): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

// ─── Feedback ────────────────────────────────────

/**
 * Trigger sound and/or haptic feedback for a new notification,
 * respecting the user's current preferences.
 *
 * Call this when a new notification arrives via SSE (or any real-time channel).
 * It's safe to call at any time — all underlying operations are non-blocking
 * and gracefully no-op on unsupported platforms.
 */
export function triggerNotificationFeedback(): void {
  const prefs = getMediaPrefs();

  if (prefs.soundEnabled) {
    playNotificationChime();
  }
  if (prefs.hapticEnabled) {
    triggerHaptic('drop');
  }
}
