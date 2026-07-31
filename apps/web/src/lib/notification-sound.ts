/**
 * Notification sound utility using the Web Audio API.
 *
 * Generates a gentle ascending two-tone chime (C5 → E5) that sounds
 * pleasant and non-intrusive — suitable for desktop notification alerts.
 *
 * The AudioContext is created lazily on first user interaction to comply
 * with browser autoplay policies. All functions are safe to call even if
 * the Web Audio API is unavailable (no-ops gracefully).
 *
 * Usage:
 *   import { playNotificationChime } from '@/lib/notification-sound';
 *   playNotificationChime();
 */

let audioCtx: AudioContext | null = null;

/**
 * Get or create a shared AudioContext.
 * Returns null if the Web Audio API is unavailable.
 */
function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const WebKitAC = (globalThis as unknown as Record<string, unknown>).webkitAudioContext;
  if (typeof AudioContext === 'undefined' && typeof WebKitAC === 'undefined') {
    return null;
  }
  try {
    const AC = (AudioContext ?? WebKitAC) as typeof AudioContext;
    audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a single tone with a smooth attack/decay envelope.
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gainValue: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startTime);

  // Smooth envelope: attack 10ms, sustain, then decay
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
  gain.gain.setValueAtTime(gainValue, startTime + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Play a gentle notification chime using the Web Audio API.
 *
 * The chime consists of two ascending tones:
 *   - C5 (523 Hz) for 100ms  — gentle intro
 *   - E5 (659 Hz) for 150ms  — pleasant resolution
 *
 * Total duration ≈ 350ms. The chime is designed to be heard but not startling.
 *
 * This function checks for browser autoplay restrictions. If the AudioContext
 * is in a "suspended" state (common before user interaction), it will attempt
 * to resume it. The chime is still played — it just may not be audible until
 * the user interacts with the page.
 *
 * Safe to call on any browser — no-ops gracefully where the Web Audio API
 * is unavailable.
 */
export function playNotificationChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  // Ascending two-tone chime: C5 → E5
  playTone(ctx, 523.25, now, 0.1, 0.15);     // C5 — short intro
  playTone(ctx, 659.25, now + 0.08, 0.15, 0.12); // E5 — slightly quieter, delayed
}

/**
 * Check whether the Web Audio API is available in the current browser.
 * Useful for testing or deciding whether to show sound-related UI.
 */
/** @internal Used by tests to reset the singleton AudioContext between tests. */
export function __resetAudioCtx(): void {
  audioCtx?.close();
  audioCtx = null;
}

export function isNotificationSoundSupported(): boolean {
  return (
    typeof AudioContext !== 'undefined' ||
    typeof (globalThis as unknown as Record<string, unknown>).webkitAudioContext !== 'undefined'
  );
}
