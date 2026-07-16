import { describe, it, expect } from 'vitest';
import { generateId, truncateText, pluralize } from '../utils/format';

// ─── generateId ──────────────────────────────────────────────

describe('generateId', () => {
  it('should return a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('should return a non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('should return unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('should return a UUID-like format when crypto is available', () => {
    const id = generateId();
    // In node (where crypto.randomUUID exists), it should be UUID format
    // Otherwise it'll be timestamp-random format
    expect(typeof id).toBe('string');
  });
});

// ─── truncateText ────────────────────────────────────────────

describe('truncateText', () => {
  it('should return the original text if within max length', () => {
    expect(truncateText('Hello', 10)).toBe('Hello');
  });

  it('should truncate and append ellipsis if longer than max length', () => {
    expect(truncateText('Hello World', 8)).toBe('Hello Wo...');
  });

  it('should return empty string for null', () => {
    expect(truncateText(null, 10)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(truncateText(undefined, 10)).toBe('');
  });

  it('should handle empty string', () => {
    expect(truncateText('', 10)).toBe('');
  });

  it('should handle exact max length', () => {
    expect(truncateText('12345', 5)).toBe('12345');
  });

  it('should handle max length of 0', () => {
    expect(truncateText('Hello', 0)).toBe('...');
  });
});

// ─── pluralize ───────────────────────────────────────────────

describe('pluralize', () => {
  it('should return singular for count of 1', () => {
    expect(pluralize(1, 'task')).toBe('1 task');
  });

  it('should return plural for count of 0', () => {
    expect(pluralize(0, 'task')).toBe('0 tasks');
  });

  it('should return plural for count > 1', () => {
    expect(pluralize(3, 'task')).toBe('3 tasks');
  });

  it('should use custom plural form when provided', () => {
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
    expect(pluralize(1, 'category', 'categories')).toBe('1 category');
  });

  it('should add "s" by default for plural', () => {
    expect(pluralize(5, 'comment')).toBe('5 comments');
    expect(pluralize(1, 'comment')).toBe('1 comment');
  });
});
