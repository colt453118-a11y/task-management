import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTimeAgo,
  formatElapsed,
  formatDuration,
  formatFileSize,
} from '../utils/date';

// ─── formatDate ──────────────────────────────────────────────

describe('formatDate', () => {
  it('should format a date string with short style by default', () => {
    const result = formatDate('2024-03-15');
    expect(result).toBe('Mar 15');
  });

  it('should format with medium style', () => {
    const result = formatDate('2024-03-15', 'medium');
    expect(result).toBe('Mar 15, 2024');
  });

  it('should format with long style', () => {
    const result = formatDate('2024-03-15', 'long');
    expect(result).toContain('March');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should format with full style', () => {
    const result = formatDate('2024-03-15', 'full');
    expect(result).toContain('2024');
    expect(result).toContain('March');
    expect(result).toContain('15');
    // Should include weekday
    expect(result!).toBeDefined();
    expect(result!.length).toBeGreaterThan(15);
  });

  it('should accept a Date object', () => {
    const result = formatDate(new Date('2024-06-01'), 'medium');
    expect(result).toBe('Jun 1, 2024');
  });

  it('should return null for null input', () => {
    expect(formatDate(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(formatDate(undefined)).toBeNull();
  });

  it('should return null for invalid date string', () => {
    expect(formatDate('not-a-date')).toBeNull();
  });
});

// ─── formatTimeAgo ───────────────────────────────────────────

describe('formatTimeAgo', () => {
  it('should return "just now" for dates in the future', () => {
    const future = new Date(Date.now() + 100000).toISOString();
    expect(formatTimeAgo(future)).toBe('just now');
  });

  it('should return "just now" for less than 60 seconds ago', () => {
    const recent = new Date(Date.now() - 30000).toISOString();
    expect(formatTimeAgo(recent)).toBe('just now');
  });

  it('should return "Xm ago" for minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('should return "Xh ago" for hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('should return "Xd ago" for days (less than 7)', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
  });

  it('should return a formatted date for 7+ days ago', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const result = formatTimeAgo(oldDate.toISOString());
    // Should be a short date like "Jan 5" — contains month and day
    expect(result).toMatch(/[A-Z][a-z]{2,} \d{1,2}/);
  });

  it('should handle single-digit minutes', () => {
    const result = formatTimeAgo(new Date(Date.now() - 60000).toISOString());
    expect(result).toBe('1m ago');
  });
});

// ─── formatElapsed ───────────────────────────────────────────

describe('formatElapsed', () => {
  it('should format zero seconds', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
  });

  it('should format seconds only', () => {
    expect(formatElapsed(5)).toBe('00:00:05');
  });

  it('should format minutes and seconds', () => {
    expect(formatElapsed(125)).toBe('00:02:05');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatElapsed(3661)).toBe('01:01:01');
  });

  it('should pad single-digit values', () => {
    expect(formatElapsed(1)).toBe('00:00:01');
    expect(formatElapsed(61)).toBe('00:01:01');
    expect(formatElapsed(3601)).toBe('01:00:01');
  });

  it('should handle large values', () => {
    expect(formatElapsed(99999)).toBe('27:46:39');
  });
});

// ─── formatDuration ──────────────────────────────────────────

describe('formatDuration', () => {
  it('should format minutes only', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('should format whole hours', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('should return "0m" for zero or negative', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-5)).toBe('0m');
  });

  it('should handle single-digit minutes', () => {
    expect(formatDuration(5)).toBe('5m');
    expect(formatDuration(61)).toBe('1h 1m');
  });
});

// ─── formatFileSize ──────────────────────────────────────────

describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('should format megabytes', () => {
    const oneMB = 1024 * 1024;
    expect(formatFileSize(oneMB)).toBe('1.0 MB');
    expect(formatFileSize(oneMB * 1.5)).toBe('1.5 MB');
  });

  it('should return em dash for null', () => {
    expect(formatFileSize(null)).toBe('—');
  });

  it('should return em dash for undefined', () => {
    expect(formatFileSize(undefined)).toBe('—');
  });

  it('should handle 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});
