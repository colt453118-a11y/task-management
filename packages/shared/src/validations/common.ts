import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants';

// ─── UUID ────────────────────────────────────────────────────

/**
 * A UUID v4 string.
 */
export const UUID_SCHEMA = z.string().uuid();

/**
 * An optional UUID — accepts a valid uuid, null, or undefined.
 */
export const UUID_OPTIONAL = z.string().uuid().optional().nullable();

// ─── Timestamp ───────────────────────────────────────────────

/**
 * ISO 8601 timestamp string.
 */
export const TIMESTAMP_SCHEMA = z.string().datetime({ offset: true }).or(z.string().datetime());

/**
 * Optional ISO 8601 timestamp.
 */
export const TIMESTAMP_OPTIONAL = TIMESTAMP_SCHEMA.optional().nullable();

// ─── Pagination ──────────────────────────────────────────────

export const SORT_ORDER = z.enum(['asc', 'desc']).default('desc');

export const PAGINATION_SCHEMA = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
    sortBy: z.string().optional(),
    sortOrder: SORT_ORDER,
  })
  .strict();

export type PaginationInput = z.infer<typeof PAGINATION_SCHEMA>;

// ─── Date Range Filter ───────────────────────────────────────

export const DATE_RANGE_SCHEMA = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .optional()
  .nullable();

export type DateRange = z.infer<typeof DATE_RANGE_SCHEMA>;

// ─── Trimmed String ──────────────────────────────────────────

/**
 * A non-empty trimmed string with min/max validation.
 */
export function trimmedString(min = 1, max = 500) {
  return z
    .string()
    .min(min)
    .max(max)
    .transform((s) => s.trim());
}

/**
 * An optional trimmed string (accepts null/undefined, trims if present).
 */
export function trimmedOptional(max = 500) {
  return z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .optional()
    .nullable();
}

// ─── Search Query ────────────────────────────────────────────

export const SEARCH_QUERY_SCHEMA = z
  .object({
    q: z
      .string()
      .max(200)
      .transform((s) => s.trim())
      .optional(),
  })
  .strict();
