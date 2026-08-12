import { describe, it, expect } from 'vitest';
import { isUniqueViolation, PG_UNIQUE_VIOLATION } from '../db-errors';

describe('isUniqueViolation (WM-011)', () => {
  it('matches a 23505 error regardless of constraint when none is given', () => {
    expect(isUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(true);
    expect(isUniqueViolation({ code: '23505', constraint_name: 'anything' })).toBe(true);
  });

  it('matches only the named constraint when one is given', () => {
    const err = { code: '23505', constraint_name: 'idx_time_entries_one_running_timer' };
    expect(isUniqueViolation(err, 'idx_time_entries_one_running_timer')).toBe(true);
    expect(isUniqueViolation(err, 'some_other_index')).toBe(false);
  });

  it('is false for other SQLSTATE codes', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false); // FK violation
    expect(isUniqueViolation({ code: '23502' })).toBe(false); // not-null violation
  });

  it('unwraps a Drizzle-wrapped error (23505 on .cause) — WM-015', () => {
    // Drizzle throws a DrizzleQueryError with the raw driver error on `.cause`;
    // a top-level-only check would miss it (real DB integration test caught this).
    const wrapped = {
      name: 'Error',
      query: 'insert into ...',
      cause: { code: '23505', constraint_name: 'idx_time_entries_one_running_timer' },
    };
    expect(isUniqueViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(wrapped, 'idx_time_entries_one_running_timer')).toBe(true);
    expect(isUniqueViolation(wrapped, 'some_other_index')).toBe(false);
  });

  it('is false for non-error / non-object inputs', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});
