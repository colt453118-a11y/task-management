import { describe, it, expect } from 'vitest';
import {
  UUID_SCHEMA,
  UUID_OPTIONAL,
  TIMESTAMP_SCHEMA,
  PAGINATION_SCHEMA,
  SORT_ORDER,
  DATE_RANGE_SCHEMA,
  SEARCH_QUERY_SCHEMA,
  trimmedString,
  trimmedOptional,
} from '../validations/common';

// ─── UUID_SCHEMA ─────────────────────────────────────────────

describe('UUID_SCHEMA', () => {
  it('should accept a valid UUID', () => {
    const result = UUID_SCHEMA.safeParse('550e8400-e29b-41d4-a716-446655440000');
    expect(result.success).toBe(true);
  });

  it('should reject an invalid UUID', () => {
    const result = UUID_SCHEMA.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = UUID_SCHEMA.safeParse('');
    expect(result.success).toBe(false);
  });
});

// ─── UUID_OPTIONAL ───────────────────────────────────────────

describe('UUID_OPTIONAL', () => {
  it('should accept a valid UUID', () => {
    const result = UUID_OPTIONAL.safeParse('550e8400-e29b-41d4-a716-446655440000');
    expect(result.success).toBe(true);
  });

  it('should accept null', () => {
    const result = UUID_OPTIONAL.safeParse(null);
    expect(result.success).toBe(true);
  });

  it('should reject invalid string', () => {
    const result = UUID_OPTIONAL.safeParse('not-a-uuid');
    expect(result.success).toBe(false);
  });
});

// ─── TIMESTAMP_SCHEMA ────────────────────────────────────────

describe('TIMESTAMP_SCHEMA', () => {
  it('should accept an ISO 8601 datetime', () => {
    const result = TIMESTAMP_SCHEMA.safeParse('2024-03-15T10:30:00.000Z');
    expect(result.success).toBe(true);
  });

  it('should accept a datetime with offset', () => {
    const result = TIMESTAMP_SCHEMA.safeParse('2024-03-15T10:30:00+05:00');
    expect(result.success).toBe(true);
  });

  it('should reject a plain date string', () => {
    const result = TIMESTAMP_SCHEMA.safeParse('2024-03-15');
    expect(result.success).toBe(false);
  });
});

// ─── SORT_ORDER ─────────────────────────────────────────────

describe('SORT_ORDER', () => {
  it('should default to "desc"', () => {
    const result = SORT_ORDER.parse(undefined);
    expect(result).toBe('desc');
  });

  it('should accept "asc"', () => {
    const result = SORT_ORDER.parse('asc');
    expect(result).toBe('asc');
  });

  it('should accept "desc"', () => {
    const result = SORT_ORDER.parse('desc');
    expect(result).toBe('desc');
  });
});

// ─── PAGINATION_SCHEMA ───────────────────────────────────────

describe('PAGINATION_SCHEMA', () => {
  it('should use defaults for empty input', () => {
    const result = PAGINATION_SCHEMA.parse({});
    expect(result.limit).toBe(50);
    expect(result.sortOrder).toBe('desc');
    expect(result.cursor).toBeUndefined();
  });

  it('should accept custom limit', () => {
    const result = PAGINATION_SCHEMA.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('should reject limit over 100', () => {
    const result = PAGINATION_SCHEMA.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });

  it('should reject negative limit', () => {
    const result = PAGINATION_SCHEMA.safeParse({ limit: '-5' });
    expect(result.success).toBe(false);
  });

  it('should accept cursor', () => {
    const result = PAGINATION_SCHEMA.parse({ cursor: 'abc123' });
    expect(result.cursor).toBe('abc123');
  });

  it('should accept sortBy', () => {
    const result = PAGINATION_SCHEMA.parse({ sortBy: 'createdAt' });
    expect(result.sortBy).toBe('createdAt');
  });
});

// ─── DATE_RANGE_SCHEMA ───────────────────────────────────────

describe('DATE_RANGE_SCHEMA', () => {
  it('should accept valid date range', () => {
    const result = DATE_RANGE_SCHEMA.parse({ from: '2024-01-01', to: '2024-12-31' });
    expect(result).toEqual({ from: '2024-01-01', to: '2024-12-31' });
  });

  it('should accept null', () => {
    const result = DATE_RANGE_SCHEMA.parse(null);
    expect(result).toBeNull();
  });
});

// ─── SEARCH_QUERY_SCHEMA ────────────────────────────────────

describe('SEARCH_QUERY_SCHEMA', () => {
  it('should parse and trim search query', () => {
    const result = SEARCH_QUERY_SCHEMA.parse({ q: '  hello  ' });
    expect(result.q).toBe('hello');
  });

  it('should handle empty object', () => {
    const result = SEARCH_QUERY_SCHEMA.parse({});
    expect(result.q).toBeUndefined();
  });
});

// ─── trimmedString ───────────────────────────────────────────

describe('trimmedString', () => {
  it('should create a schema that trims input', () => {
    const schema = trimmedString(1, 100);
    const result = schema.parse('  hello  ');
    expect(result).toBe('hello');
  });

  it('should reject strings shorter than min', () => {
    const schema = trimmedString(3, 100);
    expect(() => schema.parse('ab')).toThrow();
  });

  it('should reject strings longer than max', () => {
    const schema = trimmedString(1, 5);
    expect(() => schema.parse('toolong')).toThrow();
  });
});

// ─── trimmedOptional ─────────────────────────────────────────

describe('trimmedOptional', () => {
  it('should accept null', () => {
    const schema = trimmedOptional(500);
    const result = schema.parse(null);
    expect(result).toBeNull();
  });

  it('should accept undefined', () => {
    const schema = trimmedOptional(500);
    const result = schema.parse(undefined);
    expect(result).toBeUndefined();
  });

  it('should trim string value', () => {
    const schema = trimmedOptional(500);
    const result = schema.parse('  hello  ');
    expect(result).toBe('hello');
  });
});
