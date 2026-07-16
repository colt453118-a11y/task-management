import { describe, it, expect } from 'vitest';
import {
  PROJECT_CREATE_SCHEMA,
  PROJECT_UPDATE_SCHEMA,
  MILESTONE_CREATE_SCHEMA,
  MILESTONE_UPDATE_SCHEMA,
} from '../validations/project';

// ─── PROJECT_CREATE_SCHEMA ──────────────────────────────────

describe('PROJECT_CREATE_SCHEMA', () => {
  it('should accept valid minimal input', () => {
    const result = PROJECT_CREATE_SCHEMA.safeParse({
      name: 'My Project',
      ownerId: 'user-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('should trim the name', () => {
    const result = PROJECT_CREATE_SCHEMA.parse({
      name: '  My Project  ',
      ownerId: 'user-1',
    });
    expect(result.name).toBe('My Project');
  });

  it('should reject empty name', () => {
    const result = PROJECT_CREATE_SCHEMA.safeParse({ name: '', ownerId: 'user-1' });
    expect(result.success).toBe(false);
  });

  it('should reject missing ownerId', () => {
    const result = PROJECT_CREATE_SCHEMA.safeParse({ name: 'Project' });
    expect(result.success).toBe(false);
  });

  it('should accept all valid statuses', () => {
    for (const status of ['draft', 'active', 'on_hold', 'completed', 'archived'] as const) {
      const result = PROJECT_CREATE_SCHEMA.safeParse({
        name: 'Project',
        ownerId: 'user-1',
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = PROJECT_CREATE_SCHEMA.safeParse({
      name: 'Project',
      ownerId: 'user-1',
      status: 'invalid_status',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all optional fields', () => {
    const result = PROJECT_CREATE_SCHEMA.safeParse({
      name: 'Full project',
      code: 'PROJ-1',
      description: 'A description',
      ownerId: 'user-1',
      departmentId: '550e8400-e29b-41d4-a716-446655440000',
      teamId: '550e8400-e29b-41d4-a716-446655440001',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'active',
      priority: 'high',
      tags: ['important'],
      isActive: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─── PROJECT_UPDATE_SCHEMA ──────────────────────────────────

describe('PROJECT_UPDATE_SCHEMA', () => {
  it('should accept partial update', () => {
    const result = PROJECT_UPDATE_SCHEMA.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('should accept empty update', () => {
    const result = PROJECT_UPDATE_SCHEMA.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept progress value', () => {
    const result = PROJECT_UPDATE_SCHEMA.safeParse({ progress: 50 });
    expect(result.success).toBe(true);
  });

  it('should reject progress over 100', () => {
    const result = PROJECT_UPDATE_SCHEMA.safeParse({ progress: 150 });
    expect(result.success).toBe(false);
  });

  it('should reject negative progress', () => {
    const result = PROJECT_UPDATE_SCHEMA.safeParse({ progress: -1 });
    expect(result.success).toBe(false);
  });
});

// ─── MILESTONE_CREATE_SCHEMA ────────────────────────────────

describe('MILESTONE_CREATE_SCHEMA', () => {
  it('should accept valid minimal input', () => {
    const result = MILESTONE_CREATE_SCHEMA.safeParse({ name: 'MVP Release' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it('should trim the name', () => {
    const result = MILESTONE_CREATE_SCHEMA.parse({ name: '  MVP Release  ' });
    expect(result.name).toBe('MVP Release');
  });

  it('should reject empty name', () => {
    const result = MILESTONE_CREATE_SCHEMA.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

// ─── MILESTONE_UPDATE_SCHEMA ────────────────────────────────

describe('MILESTONE_UPDATE_SCHEMA', () => {
  it('should accept partial update', () => {
    const result = MILESTONE_UPDATE_SCHEMA.safeParse({ name: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('should accept status update', () => {
    const result = MILESTONE_UPDATE_SCHEMA.safeParse({ status: 'completed' });
    expect(result.success).toBe(true);
  });

  it('should accept empty update', () => {
    const result = MILESTONE_UPDATE_SCHEMA.safeParse({});
    expect(result.success).toBe(true);
  });
});
