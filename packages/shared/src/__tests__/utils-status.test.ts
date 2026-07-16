import { describe, it, expect } from 'vitest';
import {
  getStatusBadgeVariant,
  getStatusLabel,
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
  getPriorityBadgeConfig,
  formatEnumValue,
  getInitials,
} from '../utils/status';

// ─── getStatusBadgeVariant ───────────────────────────────────

describe('getStatusBadgeVariant', () => {
  it('should return "default" for draft', () => {
    expect(getStatusBadgeVariant('draft')).toBe('default');
  });

  it('should return "warning" for in_progress', () => {
    expect(getStatusBadgeVariant('in_progress')).toBe('warning');
  });

  it('should return "danger" for blocked', () => {
    expect(getStatusBadgeVariant('blocked')).toBe('danger');
  });

  it('should return "success" for completed', () => {
    expect(getStatusBadgeVariant('completed')).toBe('success');
  });

  it('should return "info" for under_review', () => {
    expect(getStatusBadgeVariant('under_review')).toBe('info');
  });

  it('should return "default" for unknown status', () => {
    // @ts-expect-error — Testing runtime fallback for unexpected values
    expect(getStatusBadgeVariant('unknown_status')).toBe('default');
  });

  it('should provide a variant for every status in TASK_STATUSES', () => {
    const statuses: string[] = [
      'draft',
      'open',
      'assigned',
      'in_progress',
      'blocked',
      'on_hold',
      'under_review',
      'approved',
      'completed',
      'closed',
      'archived',
      'rejected',
      'cancelled',
      'reopened',
    ];
    for (const s of statuses) {
      const variant = getStatusBadgeVariant(s as any);
      expect(['default', 'primary', 'success', 'warning', 'danger', 'info']).toContain(variant);
    }
  });
});

// ─── getStatusLabel ──────────────────────────────────────────

describe('getStatusLabel', () => {
  it('should return "In Progress" for in_progress', () => {
    expect(getStatusLabel('in_progress')).toBe('In Progress');
  });

  it('should return "Under Review" for under_review', () => {
    expect(getStatusLabel('under_review')).toBe('Under Review');
  });

  it('should return "Approved" for approved', () => {
    expect(getStatusLabel('approved')).toBe('Approved');
  });

  it('should fall back to formatting for unknown status', () => {
    expect(getStatusLabel('unknown_status' as any)).toBe('unknown status');
  });
});

// ─── getStatusColor ──────────────────────────────────────────

describe('getStatusColor', () => {
  it('should return a hex color for in_progress', () => {
    expect(getStatusColor('in_progress')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('should return a fallback gray for unknown status', () => {
    expect(getStatusColor('unknown_status' as any)).toBe('#6b7280');
  });
});

// ─── getPriorityLabel ────────────────────────────────────────

describe('getPriorityLabel', () => {
  it('should return "High" for high', () => {
    expect(getPriorityLabel('high')).toBe('High');
  });

  it('should return "Critical" for critical', () => {
    expect(getPriorityLabel('critical')).toBe('Critical');
  });

  it('should return "None" for none', () => {
    expect(getPriorityLabel('none')).toBe('None');
  });
});

// ─── getPriorityColor ────────────────────────────────────────

describe('getPriorityColor', () => {
  it('should return red for urgent', () => {
    expect(getPriorityColor('urgent')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('should return green for low', () => {
    expect(getPriorityColor('low')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('should return fallback for unknown priority', () => {
    expect(getPriorityColor('unknown' as any)).toBe('#9ca3af');
  });
});

// ─── getPriorityBadgeConfig ──────────────────────────────────

describe('getPriorityBadgeConfig', () => {
  it('should return "critical" severity for critical', () => {
    const config = getPriorityBadgeConfig('critical');
    expect(config.severity).toBe('critical');
    expect(config.label).toBe('Critical');
    expect(config.className).toContain('bg-red-500');
  });

  it('should return "critical" severity for urgent', () => {
    expect(getPriorityBadgeConfig('urgent').severity).toBe('critical');
  });

  it('should return "high" severity for high', () => {
    expect(getPriorityBadgeConfig('high').severity).toBe('high');
  });

  it('should return "medium" severity for medium', () => {
    expect(getPriorityBadgeConfig('medium').severity).toBe('medium');
  });

  it('should return "low" severity for low and none', () => {
    expect(getPriorityBadgeConfig('low').severity).toBe('low');
    expect(getPriorityBadgeConfig('none').severity).toBe('low');
  });
});

// ─── formatEnumValue ─────────────────────────────────────────

describe('formatEnumValue', () => {
  it('should convert snake_case to Title Case', () => {
    expect(formatEnumValue('in_progress')).toBe('In Progress');
  });

  it('should convert kebab-case to Title Case', () => {
    expect(formatEnumValue('under-review')).toBe('Under Review');
  });

  it('should handle single word', () => {
    expect(formatEnumValue('draft')).toBe('Draft');
  });

  it('should handle multiple underscores', () => {
    expect(formatEnumValue('very_important_status')).toBe('Very Important Status');
  });

  it('should handle already formatted strings', () => {
    expect(formatEnumValue('Hello')).toBe('Hello');
  });

  it('should handle empty string', () => {
    expect(formatEnumValue('')).toBe('');
  });
});

// ─── getInitials ─────────────────────────────────────────────

describe('getInitials', () => {
  it('should extract initials from first and last name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should extract single initial for one name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('should return "?" for null', () => {
    expect(getInitials(null)).toBe('?');
  });

  it('should return "?" for undefined', () => {
    expect(getInitials(undefined)).toBe('?');
  });

  it('should return "?" for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('should handle names with extra whitespace', () => {
    expect(getInitials('  Jane   Smith  ')).toBe('JS');
  });

  it('should handle middle names by using first+last', () => {
    expect(getInitials('John Michael Doe')).toBe('JD');
  });

  it('should handle lowercase names', () => {
    expect(getInitials('john doe')).toBe('JD');
  });
});
