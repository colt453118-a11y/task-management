import { describe, it, expect } from 'vitest';
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  DEFAULT_WORKFLOW,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../constants';
import { PERMISSIONS, ALL_PERMISSIONS } from '../constants/permissions';

// ─── Task Statuses ───────────────────────────────────────────

describe('TASK_STATUSES', () => {
  it('should contain all expected statuses', () => {
    expect(TASK_STATUSES).toEqual([
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
    ]);
  });

  it('should not contain duplicates', () => {
    const unique = new Set(TASK_STATUSES);
    expect(unique.size).toBe(TASK_STATUSES.length);
  });
});

describe('TASK_STATUS_LABELS', () => {
  it('should have an entry for every task status', () => {
    for (const status of TASK_STATUSES) {
      expect(TASK_STATUS_LABELS[status]).toBeDefined();
      expect(typeof TASK_STATUS_LABELS[status]).toBe('string');
    }
  });

  it('should have human-readable labels', () => {
    expect(TASK_STATUS_LABELS.in_progress).toBe('In Progress');
    expect(TASK_STATUS_LABELS.under_review).toBe('Under Review');
    expect(TASK_STATUS_LABELS.on_hold).toBe('On Hold');
  });

  it('should not have extra entries beyond task statuses', () => {
    expect(Object.keys(TASK_STATUS_LABELS).length).toBe(TASK_STATUSES.length);
  });
});

describe('TASK_STATUS_COLORS', () => {
  it('should have a hex color for every task status', () => {
    for (const status of TASK_STATUSES) {
      expect(TASK_STATUS_COLORS[status]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('should not have extra entries beyond task statuses', () => {
    expect(Object.keys(TASK_STATUS_COLORS).length).toBe(TASK_STATUSES.length);
  });
});

// ─── Task Priorities ─────────────────────────────────────────

describe('TASK_PRIORITIES', () => {
  it('should contain all expected priorities', () => {
    expect(TASK_PRIORITIES).toEqual(['none', 'low', 'medium', 'high', 'urgent', 'critical']);
  });

  it('should not contain duplicates', () => {
    const unique = new Set(TASK_PRIORITIES);
    expect(unique.size).toBe(TASK_PRIORITIES.length);
  });
});

describe('TASK_PRIORITY_LABELS', () => {
  it('should have an entry for every priority', () => {
    for (const priority of TASK_PRIORITIES) {
      expect(TASK_PRIORITY_LABELS[priority]).toBeDefined();
      expect(typeof TASK_PRIORITY_LABELS[priority]).toBe('string');
    }
  });

  it('should not have extra entries beyond priorities', () => {
    expect(Object.keys(TASK_PRIORITY_LABELS).length).toBe(TASK_PRIORITIES.length);
  });
});

describe('TASK_PRIORITY_COLORS', () => {
  it('should have a hex color for every priority', () => {
    for (const priority of TASK_PRIORITIES) {
      expect(TASK_PRIORITY_COLORS[priority]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('should not have extra entries beyond priorities', () => {
    expect(Object.keys(TASK_PRIORITY_COLORS).length).toBe(TASK_PRIORITIES.length);
  });
});

// ─── Project Statuses ─────────────────────────────────────────

describe('PROJECT_STATUSES', () => {
  it('should contain all expected project statuses', () => {
    expect(PROJECT_STATUSES).toEqual(['draft', 'active', 'on_hold', 'completed', 'archived']);
  });

  it('should not contain duplicates', () => {
    const unique = new Set(PROJECT_STATUSES);
    expect(unique.size).toBe(PROJECT_STATUSES.length);
  });
});

describe('PROJECT_STATUS_LABELS', () => {
  it('should have an entry for every project status', () => {
    for (const status of PROJECT_STATUSES) {
      expect(PROJECT_STATUS_LABELS[status]).toBeDefined();
      expect(typeof PROJECT_STATUS_LABELS[status]).toBe('string');
    }
  });

  it('should not have extra entries beyond project statuses', () => {
    expect(Object.keys(PROJECT_STATUS_LABELS).length).toBe(PROJECT_STATUSES.length);
  });
});

// ─── Default Workflow ────────────────────────────────────────

describe('DEFAULT_WORKFLOW', () => {
  it('should be a subset of all task statuses', () => {
    for (const step of DEFAULT_WORKFLOW) {
      expect(TASK_STATUSES).toContain(step);
    }
  });

  it('should start with draft and end with archived', () => {
    expect(DEFAULT_WORKFLOW[0]).toBe('draft');
    expect(DEFAULT_WORKFLOW[DEFAULT_WORKFLOW.length - 1]).toBe('archived');
  });
});

// ─── Pagination ──────────────────────────────────────────────

describe('Pagination constants', () => {
  it('DEFAULT_PAGE_LIMIT should be 50', () => {
    expect(DEFAULT_PAGE_LIMIT).toBe(50);
  });

  it('MAX_PAGE_LIMIT should be 100', () => {
    expect(MAX_PAGE_LIMIT).toBe(100);
  });

  it('MAX_PAGE_LIMIT should be greater than DEFAULT_PAGE_LIMIT', () => {
    expect(MAX_PAGE_LIMIT).toBeGreaterThan(DEFAULT_PAGE_LIMIT);
  });
});

// ─── Permissions ─────────────────────────────────────────────

describe('PERMISSIONS', () => {
  it('should have all permission codes in module:action format', () => {
    const codes = Object.values(PERMISSIONS);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });

  it('should not have duplicate values', () => {
    const codes = Object.values(PERMISSIONS);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('should contain task-related permissions', () => {
    expect(PERMISSIONS.TASK_VIEW).toBe('task:view');
    expect(PERMISSIONS.TASK_CREATE).toBe('task:create');
    expect(PERMISSIONS.TASK_EDIT).toBe('task:edit');
    expect(PERMISSIONS.TASK_DELETE).toBe('task:delete');
    expect(PERMISSIONS.TASK_ASSIGN).toBe('task:assign');
  });

  it('should contain organization permissions', () => {
    expect(PERMISSIONS.ORG_VIEW).toBe('org:view');
    expect(PERMISSIONS.ORG_EDIT).toBe('org:edit');
  });

  it('should contain user management permissions', () => {
    expect(PERMISSIONS.USER_INVITE).toBe('user:invite');
    expect(PERMISSIONS.USER_MANAGE).toBe('user:manage');
  });
});

describe('ALL_PERMISSIONS', () => {
  it('should contain every permission code from the PERMISSIONS object', () => {
    const expectedCodes = Object.values(PERMISSIONS);
    expect(ALL_PERMISSIONS).toEqual(expectedCodes);
  });

  it('should not contain duplicates', () => {
    const unique = new Set(ALL_PERMISSIONS);
    expect(unique.size).toBe(ALL_PERMISSIONS.length);
  });
});
