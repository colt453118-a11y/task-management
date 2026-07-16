import { z } from 'zod';
import { UUID_OPTIONAL } from './common';

// ─── User Create / Invite ────────────────────────────────────

export const USER_CREATE_SCHEMA = z
  .object({
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .max(255)
      .transform((s) => s.toLowerCase()),
    firstName: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    lastName: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    displayName: z
      .string()
      .max(200)
      .transform((s) => s.trim())
      .optional(),
    passwordHash: z.string().optional(), // Server-set; for direct creates only
  })
  .strict();

export type UserCreateInput = z.infer<typeof USER_CREATE_SCHEMA>;

// ─── User Invite ─────────────────────────────────────────────

export const USER_INVITE_SCHEMA = z
  .object({
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .max(255)
      .transform((s) => s.toLowerCase()),
    roleId: z.string().uuid().optional(),
  })
  .strict();

export type UserInviteInput = z.infer<typeof USER_INVITE_SCHEMA>;

// ─── User Update ─────────────────────────────────────────────

export const USER_UPDATE_SCHEMA = z
  .object({
    firstName: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    lastName: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    displayName: z
      .string()
      .max(200)
      .transform((s) => s.trim())
      .optional(),
    phone: z
      .string()
      .max(50)
      .transform((s) => s.trim())
      .optional(),
    designation: z
      .string()
      .max(200)
      .transform((s) => s.trim())
      .optional(),
    departmentId: UUID_OPTIONAL,
    teamId: UUID_OPTIONAL,
    location: z
      .string()
      .max(255)
      .transform((s) => s.trim())
      .optional(),
    timezone: z.string().max(50).optional(),
    avatarUrl: z.string().url().optional().nullable(),
  })
  .strict();

export type UserUpdateInput = z.infer<typeof USER_UPDATE_SCHEMA>;

// ─── User Profile (self-service update) ──────────────────────

export const USER_PROFILE_UPDATE_SCHEMA = z
  .object({
    firstName: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    lastName: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    displayName: z
      .string()
      .max(200)
      .transform((s) => s.trim())
      .optional(),
    phone: z
      .string()
      .max(50)
      .transform((s) => s.trim())
      .optional(),
    location: z
      .string()
      .max(255)
      .transform((s) => s.trim())
      .optional(),
    timezone: z.string().max(50).optional(),
    avatarUrl: z.string().url().optional().nullable(),
  })
  .strict();

export type UserProfileUpdateInput = z.infer<typeof USER_PROFILE_UPDATE_SCHEMA>;

// ─── User Status (admin) ──────────────────────────────────────

export const USER_STATUS_UPDATE_SCHEMA = z
  .object({
    isActive: z.boolean().optional(),
    isSuspended: z.boolean().optional(),
    suspensionReason: z.string().max(500).optional().nullable(),
    employmentStatus: z.enum(['active', 'suspended', 'archived', 'terminated']).optional(),
  })
  .strict();

export type UserStatusUpdateInput = z.infer<typeof USER_STATUS_UPDATE_SCHEMA>;

// ─── Password Update ─────────────────────────────────────────

export const PASSWORD_UPDATE_SCHEMA = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
  })
  .strict();

export type PasswordUpdateInput = z.infer<typeof PASSWORD_UPDATE_SCHEMA>;
