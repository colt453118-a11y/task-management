/**
 * Date formatting utilities for the work management platform.
 *
 * Centralizes all `toLocaleDateString` and date formatting logic
 * that was scattered across the web app components.
 */

// ─── Default locale & options ────────────────────────────────

const DEFAULT_LOCALE = 'en-US';

export type DateStyle = 'short' | 'medium' | 'long' | 'full';

const STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { month: 'short', day: 'numeric' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
};

/**
 * Formats a date string or Date into a human-readable date string.
 * Returns `null` when the input is null/undefined.
 *
 * @example
 * formatDate('2024-03-15')                    // "Mar 15"
 * formatDate('2024-03-15', 'medium')          // "Mar 15, 2024"
 * formatDate(null)                             // null
 */
export function formatDate(
  date: string | Date | null | undefined,
  style: DateStyle = 'short',
): string | null {
  if (date == null) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(DEFAULT_LOCALE, STYLE_OPTIONS[style]);
}

/**
 * Formats a date string into a relative "time ago" string.
 * Returns "just now" for <60s, then "Xm ago", "Xh ago", "Xd ago",
 * and falls back to a short date for 7+ days.
 *
 * @example
 * formatTimeAgo(new Date().toISOString())  // "just now"
 * formatTimeAgo(tenMinutesAgo)             // "10m ago"
 * formatTimeAgo(lastWeek)                  // "Mar 8"
 */
export function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr) ?? 'just now';
}

/**
 * Formats a total number of seconds into HH:MM:SS.
 *
 * @example
 * formatElapsed(3661)  // "01:01:01"
 * formatElapsed(0)     // "00:00:00"
 */
export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Formats a duration in minutes into a human-readable string.
 *
 * @example
 * formatDuration(90)   // "1h 30m"
 * formatDuration(45)   // "45m"
 * formatDuration(0)    // "0m"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Formats a file size in bytes into a human-readable string.
 *
 * @example
 * formatFileSize(1024)        // "1.0 KB"
 * formatFileSize(1500000)     // "1.4 MB"
 * formatFileSize(null)        // "—"
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
