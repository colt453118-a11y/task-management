import { z } from 'zod';
import { PROJECT_STATUSES } from '../constants';
import { UUID_OPTIONAL } from './common';
import type { ProjectStatus } from '../types';

// ─── Derive Zod enums from shared constants ──────────────────

const PROJECT_STATUS_ENUM = z.enum(
  PROJECT_STATUSES as unknown as [ProjectStatus, ...ProjectStatus[]],
);

// ─── Project Create ──────────────────────────────────────────

export const PROJECT_CREATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(300)
      .transform((s) => s.trim()),
    code: z
      .string()
      .max(20)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    ownerId: z.string().min(1, 'Owner is required'),
    departmentId: UUID_OPTIONAL,
    teamId: UUID_OPTIONAL,
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    status: PROJECT_STATUS_ENUM.optional().default('active'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    tags: z.array(z.string().max(100)).optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export type ProjectCreateInput = z.infer<typeof PROJECT_CREATE_SCHEMA>;

// ─── Project Update ──────────────────────────────────────────

export const PROJECT_UPDATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1)
      .max(300)
      .transform((s) => s.trim())
      .optional(),
    code: z
      .string()
      .max(20)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    ownerId: z.string().optional(),
    departmentId: UUID_OPTIONAL,
    teamId: UUID_OPTIONAL,
    status: PROJECT_STATUS_ENUM.optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    tags: z.array(z.string().max(100)).optional(),
  })
  .strict();

export type ProjectUpdateInput = z.infer<typeof PROJECT_UPDATE_SCHEMA>;

// ─── Milestone Create ────────────────────────────────────────

export const MILESTONE_CREATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(300)
      .transform((s) => s.trim()),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    dueDate: z.string().optional().nullable(),
    sortOrder: z.number().int().min(0).optional().default(0),
  })
  .strict();

export type MilestoneCreateInput = z.infer<typeof MILESTONE_CREATE_SCHEMA>;

// ─── Milestone Update ────────────────────────────────────────

export const MILESTONE_UPDATE_SCHEMA = z
  .object({
    name: z
      .string()
      .min(1)
      .max(300)
      .transform((s) => s.trim())
      .optional(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    status: z.string().max(50).optional(),
    dueDate: z.string().optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();

export type MilestoneUpdateInput = z.infer<typeof MILESTONE_UPDATE_SCHEMA>;
