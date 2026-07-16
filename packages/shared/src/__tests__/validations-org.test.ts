import { describe, it, expect } from 'vitest';
import {
  ORGANIZATION_CREATE_SCHEMA,
  ORGANIZATION_UPDATE_SCHEMA,
  DEPARTMENT_CREATE_SCHEMA,
  DEPARTMENT_UPDATE_SCHEMA,
  TEAM_CREATE_SCHEMA,
  TEAM_UPDATE_SCHEMA,
  TEAM_MEMBER_ADD_SCHEMA,
  ROLE_CREATE_SCHEMA,
  ROLE_UPDATE_SCHEMA,
  ROLE_ASSIGN_SCHEMA,
} from '../validations/organization';

// ─── ORGANIZATION_CREATE_SCHEMA ─────────────────────────────

describe('ORGANIZATION_CREATE_SCHEMA', () => {
  it('should accept valid input', () => {
    const result = ORGANIZATION_CREATE_SCHEMA.safeParse({
      name: 'Acme Inc',
      slug: 'acme-inc',
    });
    expect(result.success).toBe(true);
  });

  it('should trim name', () => {
    const result = ORGANIZATION_CREATE_SCHEMA.parse({
      name: '  Acme Inc  ',
      slug: 'acme-inc',
    });
    expect(result.name).toBe('Acme Inc');
  });

  it('should reject empty name', () => {
    const result = ORGANIZATION_CREATE_SCHEMA.safeParse({ name: '', slug: 'acme' });
    expect(result.success).toBe(false);
  });

  it('should reject empty slug', () => {
    const result = ORGANIZATION_CREATE_SCHEMA.safeParse({ name: 'Acme', slug: '' });
    expect(result.success).toBe(false);
  });

  it('should accept domain and logoUrl', () => {
    const result = ORGANIZATION_CREATE_SCHEMA.safeParse({
      name: 'Acme',
      slug: 'acme',
      domain: 'acme.com',
      logoUrl: 'https://acme.com/logo.png',
      maxUsers: 100,
    });
    expect(result.success).toBe(true);
  });
});

// ─── ORGANIZATION_UPDATE_SCHEMA ─────────────────────────────

describe('ORGANIZATION_UPDATE_SCHEMA', () => {
  it('should accept partial update', () => {
    const result = ORGANIZATION_UPDATE_SCHEMA.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('should accept empty update', () => {
    const result = ORGANIZATION_UPDATE_SCHEMA.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept isActive toggle', () => {
    const result = ORGANIZATION_UPDATE_SCHEMA.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});

// ─── DEPARTMENT_CREATE_SCHEMA ───────────────────────────────

describe('DEPARTMENT_CREATE_SCHEMA', () => {
  it('should accept valid input', () => {
    const result = DEPARTMENT_CREATE_SCHEMA.safeParse({ name: 'Engineering' });
    expect(result.success).toBe(true);
  });

  it('should trim name', () => {
    const result = DEPARTMENT_CREATE_SCHEMA.parse({ name: '  Engineering  ' });
    expect(result.name).toBe('Engineering');
  });

  it('should reject empty name', () => {
    const result = DEPARTMENT_CREATE_SCHEMA.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('should accept parentId and headUserId', () => {
    const result = DEPARTMENT_CREATE_SCHEMA.safeParse({
      name: 'Engineering',
      code: 'ENG',
      description: 'Engineering dept',
      headUserId: 'user-1',
      parentId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

// ─── DEPARTMENT_UPDATE_SCHEMA ───────────────────────────────

describe('DEPARTMENT_UPDATE_SCHEMA', () => {
  it('should accept partial update', () => {
    const result = DEPARTMENT_UPDATE_SCHEMA.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('should accept isActive toggle', () => {
    const result = DEPARTMENT_UPDATE_SCHEMA.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});

// ─── TEAM_CREATE_SCHEMA ─────────────────────────────────────

describe('TEAM_CREATE_SCHEMA', () => {
  it('should accept valid input', () => {
    const result = TEAM_CREATE_SCHEMA.safeParse({ name: 'Frontend Team' });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = TEAM_CREATE_SCHEMA.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('should accept leadUserId and departmentId', () => {
    const result = TEAM_CREATE_SCHEMA.safeParse({
      name: 'Frontend Team',
      leadUserId: 'user-1',
      departmentId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

// ─── TEAM_UPDATE_SCHEMA ─────────────────────────────────────

describe('TEAM_UPDATE_SCHEMA', () => {
  it('should accept partial update', () => {
    const result = TEAM_UPDATE_SCHEMA.safeParse({ name: 'Renamed Team' });
    expect(result.success).toBe(true);
  });

  it('should clear department when null', () => {
    const result = TEAM_UPDATE_SCHEMA.safeParse({ departmentId: null });
    expect(result.success).toBe(true);
  });
});

// ─── TEAM_MEMBER_ADD_SCHEMA ─────────────────────────────────

describe('TEAM_MEMBER_ADD_SCHEMA', () => {
  it('should accept valid input', () => {
    const result = TEAM_MEMBER_ADD_SCHEMA.safeParse({ userId: 'user-1' });
    expect(result.success).toBe(true);
  });

  it('should default role to member', () => {
    const result = TEAM_MEMBER_ADD_SCHEMA.parse({ userId: 'user-1' });
    expect(result.role).toBe('member');
  });

  it('should reject empty userId', () => {
    const result = TEAM_MEMBER_ADD_SCHEMA.safeParse({ userId: '' });
    expect(result.success).toBe(false);
  });
});

// ─── ROLE_CREATE_SCHEMA ─────────────────────────────────────

describe('ROLE_CREATE_SCHEMA', () => {
  it('should accept valid input', () => {
    const result = ROLE_CREATE_SCHEMA.safeParse({ name: 'Admin', slug: 'admin' });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = ROLE_CREATE_SCHEMA.safeParse({ name: '', slug: 'admin' });
    expect(result.success).toBe(false);
  });

  it('should accept permissionIds', () => {
    const result = ROLE_CREATE_SCHEMA.safeParse({
      name: 'Manager',
      slug: 'manager',
      permissionIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });
});

// ─── ROLE_UPDATE_SCHEMA ─────────────────────────────────────

describe('ROLE_UPDATE_SCHEMA', () => {
  it('should accept partial update', () => {
    const result = ROLE_UPDATE_SCHEMA.safeParse({ name: 'Updated Role' });
    expect(result.success).toBe(true);
  });

  it('should accept isActive toggle', () => {
    const result = ROLE_UPDATE_SCHEMA.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});

// ─── ROLE_ASSIGN_SCHEMA ─────────────────────────────────────

describe('ROLE_ASSIGN_SCHEMA', () => {
  it('should accept valid roleId', () => {
    const result = ROLE_ASSIGN_SCHEMA.safeParse({
      roleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-uuid roleId', () => {
    const result = ROLE_ASSIGN_SCHEMA.safeParse({ roleId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});
