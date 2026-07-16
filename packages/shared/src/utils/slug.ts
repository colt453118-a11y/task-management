/**
 * Slug utilities for generating URL-safe slugs from user-provided strings.
 *
 * Centralizes the inline `toLowerCase().replace(/\s+/g, '-')` pattern
 * seen in settings pages and the database seed scripts.
 */

// ─── Slug Generation ─────────────────────────────────────────

/**
 * Converts any string into a URL-safe slug.
 *
 * - Lowercases the input
 * - Replaces whitespace runs with a single hyphen
 * - Strips leading/trailing hyphens
 * - Removes any character that isn't alphanumeric, hyphen, or underscore
 *
 * @example
 * createSlug('Project Manager')      // "project-manager"
 * createSlug('  Hello   World!  ')   // "hello-world"
 * createSlug('Task #123')            // "task-123"
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns `true` if the given string is a valid slug (lowercase
 * alphanumeric characters, hyphens, and underscores only).
 *
 * @example
 * isValidSlug('project-manager')   // true
 * isValidSlug('Project Manager')   // false — contains uppercase + space
 * isValidSlug('')                  // false
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(slug);
}
