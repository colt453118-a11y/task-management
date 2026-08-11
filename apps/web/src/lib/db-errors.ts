// ─── Postgres error helpers ────────────────────────────────────
//
// The app uses postgres.js, whose errors expose the SQLSTATE `code` and, for
// constraint violations, the `constraint_name`. These helpers let routes turn
// a specific violation into a friendly response (e.g. a 409) instead of a
// generic 500 — and, together with a DB constraint, close check-then-write
// races that an app-level check alone cannot (see WM-011).

/** SQLSTATE for a unique-constraint / unique-index violation. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * True when `err` is a Postgres unique-violation (SQLSTATE 23505). If
 * `constraint` is given, it must also match the violated constraint/index name.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; constraint_name?: unknown };
  if (e.code !== PG_UNIQUE_VIOLATION) return false;
  return constraint === undefined || e.constraint_name === constraint;
}
