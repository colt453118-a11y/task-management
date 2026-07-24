/**
 * Lightweight haptic feedback utility for mobile touch interactions.
 *
 * Uses `navigator.vibrate()` on supported devices (Android Chrome, Samsung Internet, etc.)
 * and gracefully no-ops on unsupported platforms (iOS, desktop, older browsers).
 *
 * Haptic patterns (duration in ms):
 *   - light:   10ms  — subtle tap
 *   - pickup:  15ms  — drag start
 *   - drop:    [10, 30, 10] — double tap (confirmation)
 *   - error:   [30, 20, 30] — buzz (invalid drop)
 */

type HapticPattern = 'light' | 'pickup' | 'drop' | 'error';

const PATTERNS: Record<HapticPattern, VibratePattern> = {
  light: 10,
  pickup: 15,
  drop: [10, 30, 10],
  error: [30, 20, 30],
};

let canVibrate: boolean | null = null;

function checkSupport(): boolean {
  if (canVibrate !== null) return canVibrate;
  // Only vibrate on touch-capable devices to avoid annoying desktop users
  if (typeof window === 'undefined') {
    canVibrate = false;
    return false;
  }
  canVibrate =
    'vibrate' in navigator &&
    typeof navigator.vibrate === 'function' &&
    // Exclude desktop — match against coarse/fine pointer
    (matchMedia?.('(pointer: coarse)').matches ?? false);
  return canVibrate;
}

/**
 * Trigger a haptic feedback pattern on supported mobile devices.
 * Safe to call on any device — no-ops where vibration is unavailable.
 */
export function triggerHaptic(pattern: HapticPattern = 'light'): void {
  if (!checkSupport()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Silently ignore — some environments restrict vibration
  }
}
