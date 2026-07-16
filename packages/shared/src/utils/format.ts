/**
 * General formatting utilities.
 *
 * Provides helpers for generating IDs, truncating text, and
 * basic pluralization that are used across the application.
 */

// ─── ID Generation ───────────────────────────────────────────

/**
 * Generates a UUID v4 string using `crypto.randomUUID()`.
 * Falls back to a timestamp-based ID if crypto is unavailable.
 *
 * @example
 * generateId()  // "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random (not cryptographically secure)
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// ─── Text Truncation ─────────────────────────────────────────

/**
 * Truncates a string to a maximum length, appending an ellipsis if truncated.
 *
 * @example
 * truncateText('Hello World', 8)    // "Hello..."
 * truncateText('Hi', 10)            // "Hi"
 * truncateText(null)                // ""
 */
export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

// ─── Pluralization ───────────────────────────────────────────

/**
 * Simple pluralization helper. Returns the singular or plural form
 * based on the count.
 *
 * @example
 * pluralize(1, 'task')        // "1 task"
 * pluralize(3, 'task')        // "3 tasks"
 * pluralize(0, 'task')        // "0 tasks"
 * pluralize(2, 'category', 'categories')  // "2 categories"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}
