// ─── Postgres error helpers ────────────────────────────────────
//
// The app uses postgres.js, whose errors expose the SQLSTATE `code` and, for
// constraint violations, the `constraint_name`. Drizzle wraps those errors in a
// DrizzleQueryError with the real driver error on `.cause`, so these helpers
// walk the cause chain. They let routes turn a specific violation into a
// friendly response (e.g. a 409) instead of a generic 500 — and, together with
// a DB constraint, close check-then-write races that an app-level check alone
// cannot (see WM-011).

/** SQLSTATE for a unique-constraint / unique-index violation. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * True when `err` is a Postgres unique-violation (SQLSTATE 23505). If
 * `constraint` is given, it must also match the violated constraint/index name.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  // Walk the (bounded) cause chain: the SQLSTATE lives on the raw driver error,
  // which Drizzle nests under `.cause` — a top-level-only check misses it.
  for (
    let e: unknown = err, depth = 0;
    e && typeof e === 'object' && depth < 5;
    e = (e as { cause?: unknown }).cause, depth++
  ) {
    const o = e as { code?: unknown; constraint_name?: unknown };
    if (o.code === PG_UNIQUE_VIOLATION) {
      return constraint === undefined || o.constraint_name === constraint;
    }
  }
  return false;
}
