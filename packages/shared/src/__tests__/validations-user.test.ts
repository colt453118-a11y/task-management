import { describe, it, expect } from 'vitest';
import {
  USER_CREATE_SCHEMA,
  USER_INVITE_SCHEMA,
  USER_UPDATE_SCHEMA,
  USER_PROFILE_UPDATE_SCHEMA,
  USER_STATUS_UPDATE_SCHEMA,
  PASSWORD_UPDATE_SCHEMA,
} from '../validations/user';

// ─── USER_CREATE_SCHEMA ─────────────────────────────────────

describe('USER_CREATE_SCHEMA', () => {
  it('should accept valid input', () => {
    const result = USER_CREATE_SCHEMA.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('should normalize email to lowercase', () => {
    const result = USER_CREATE_SCHEMA.parse({ email: '  User@Example.COM  ' });
    expect(result.email).toBe('user@example.com');
  });

  it('should reject invalid email', () => {
    const result = USER_CREATE_SCHEMA.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should reject empty email', () => {
    const result = USER_CREATE_SCHEMA.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  it('should accept optional name fields', () => {
    const result = USER_CREATE_SCHEMA.safeParse({
      email: 'user@example.com',
      firstName: '  John  ',
      lastName: '  Doe  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('John');
      expect(result.data.lastName).toBe('Doe');
    }
  });
});

// ─── USER_INVITE_SCHEMA ─────────────────────────────────────

describe('USER_INVITE_SCHEMA', () => {
  it('should accept valid invite', () => {
    const result = USER_INVITE_SCHEMA.safeParse({ email: 'invite@example.com' });
    expect(result.success).toBe(true);
  });

  it('should normalize email', () => {
    const result = USER_INVITE_SCHEMA.parse({ email: '  INVITE@Example.COM  ' });
    expect(result.email).toBe('invite@example.com');
  });

  it('should accept optional roleId', () => {
    const result = USER_INVITE_SCHEMA.safeParse({
      email: 'invite@example.com',
      roleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = USER_INVITE_SCHEMA.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});

// ─── USER_UPDATE_SCHEMA ─────────────────────────────────────

describe('USER_UPDATE_SCHEMA', () => {
  it('should accept partial update', () => {
    const result = USER_UPDATE_SCHEMA.safeParse({ firstName: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('should accept empty update', () => {
    const result = USER_UPDATE_SCHEMA.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should trim string fields', () => {
    const result = USER_UPDATE_SCHEMA.parse({ firstName: '  John  ' });
    expect(result.firstName).toBe('John');
  });

  it('should accept department assignment', () => {
    const result = USER_UPDATE_SCHEMA.safeParse({
      departmentId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

// ─── USER_PROFILE_UPDATE_SCHEMA ─────────────────────────────

describe('USER_PROFILE_UPDATE_SCHEMA', () => {
  it('should accept profile updates', () => {
    const result = USER_PROFILE_UPDATE_SCHEMA.safeParse({
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty update', () => {
    const result = USER_PROFILE_UPDATE_SCHEMA.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should not allow sensitive fields via profile update', () => {
    const result = USER_PROFILE_UPDATE_SCHEMA.safeParse({ designation: 'manager' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Unrecognized');
    }
  });

  it('should accept avatar URL', () => {
    const result = USER_PROFILE_UPDATE_SCHEMA.safeParse({
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(result.success).toBe(true);
  });
});

// ─── USER_STATUS_UPDATE_SCHEMA ─────────────────────────────

describe('USER_STATUS_UPDATE_SCHEMA', () => {
  it('should accept suspension', () => {
    const result = USER_STATUS_UPDATE_SCHEMA.safeParse({
      isSuspended: true,
      suspensionReason: 'Violated policy',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid employment status', () => {
    const result = USER_STATUS_UPDATE_SCHEMA.safeParse({ employmentStatus: 'active' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid employment status', () => {
    const result = USER_STATUS_UPDATE_SCHEMA.safeParse({ employmentStatus: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('should accept isActive toggle', () => {
    const result = USER_STATUS_UPDATE_SCHEMA.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});

// ─── PASSWORD_UPDATE_SCHEMA ────────────────────────────────

describe('PASSWORD_UPDATE_SCHEMA', () => {
  it('should accept valid password change', () => {
    const result = PASSWORD_UPDATE_SCHEMA.safeParse({
      currentPassword: 'old-pass',
      newPassword: 'new-secure-pass',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short new password', () => {
    const result = PASSWORD_UPDATE_SCHEMA.safeParse({
      currentPassword: 'old',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing current password', () => {
    const result = PASSWORD_UPDATE_SCHEMA.safeParse({
      currentPassword: '',
      newPassword: 'new-password-here',
    });
    expect(result.success).toBe(false);
  });
});
