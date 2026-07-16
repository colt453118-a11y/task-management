import { z } from 'zod';
import { UUID_OPTIONAL } from './common';

// ─── Organization Create ─────────────────────────────────────

export const ORGANIZATION_CREATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(255)
      .transform((s) => s.trim()),
    slug: z
      .string()
      .min(1)
      .max(100)
      .transform((s) => s.trim()),
    domain: z.string().max(255).optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    maxUsers: z.number().int().positive().optional().nullable(),
  })
  .strict();

export type OrganizationCreateInput = z.infer<typeof ORGANIZATION_CREATE_SCHEMA>;

// ─── Organization Update ─────────────────────────────────────

export const ORGANIZATION_UPDATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1)
      .max(255)
      .transform((s) => s.trim())
      .optional(),
    domain: z.string().max(255).optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    maxUsers: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type OrganizationUpdateInput = z.infer<typeof ORGANIZATION_UPDATE_SCHEMA>;

// ─── Department Create ───────────────────────────────────────

export const DEPARTMENT_CREATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(200)
      .transform((s) => s.trim()),
    code: z
      .string()
      .max(50)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    headUserId: z.string().optional().nullable(),
    parentId: UUID_OPTIONAL,
  })
  .strict();

export type DepartmentCreateInput = z.infer<typeof DEPARTMENT_CREATE_SCHEMA>;

// ─── Department Update ───────────────────────────────────────

export const DEPARTMENT_UPDATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((s) => s.trim())
      .optional(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    headUserId: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type DepartmentUpdateInput = z.infer<typeof DEPARTMENT_UPDATE_SCHEMA>;

// ─── Team Create ─────────────────────────────────────────────

export const TEAM_CREATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(200)
      .transform((s) => s.trim()),
    code: z
      .string()
      .max(50)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    departmentId: UUID_OPTIONAL,
    leadUserId: z.string().optional().nullable(),
  })
  .strict();

export type TeamCreateInput = z.infer<typeof TEAM_CREATE_SCHEMA>;

// ─── Team Update ─────────────────────────────────────────────

export const TEAM_UPDATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((s) => s.trim())
      .optional(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    departmentId: UUID_OPTIONAL,
    leadUserId: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type TeamUpdateInput = z.infer<typeof TEAM_UPDATE_SCHEMA>;

// ─── Team Member Add ─────────────────────────────────────────

export const TEAM_MEMBER_ADD_SCHEMA = z
  .object({
    userId: z.string().min(1, 'User ID is required'),
    role: z.string().max(50).optional().default('member'),
  })
  .strict();

export type TeamMemberAddInput = z.infer<typeof TEAM_MEMBER_ADD_SCHEMA>;

// ─── Role Create ─────────────────────────────────────────────

export const ROLE_CREATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100)
      .transform((s) => s.trim()),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(100)
      .transform((s) => s.trim()),
    description: z
      .string()
      .max(500)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    permissionIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export type RoleCreateInput = z.infer<typeof ROLE_CREATE_SCHEMA>;

// ─── Role Update ─────────────────────────────────────────────

export const ROLE_UPDATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    description: z
      .string()
      .max(500)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    permissionIds: z.array(z.string().uuid()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type RoleUpdateInput = z.infer<typeof ROLE_UPDATE_SCHEMA>;

// ─── Role Assignment ─────────────────────────────────────────

export const ROLE_ASSIGN_SCHEMA = z
  .object({
    roleId: z.string().uuid('Invalid role ID'),
  })
  .strict();

export type RoleAssignInput = z.infer<typeof ROLE_ASSIGN_SCHEMA>;
