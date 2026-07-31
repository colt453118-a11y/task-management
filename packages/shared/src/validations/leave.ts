import { z } from 'zod';
import { trimmedString } from './common';

// ─── Leave Request Create ────────────────────────────────────

export const LEAVE_REQUEST_CREATE_SCHEMA = z
  .object({
    leaveTypeId: z.string().uuid('Invalid leave type'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
    isHalfDay: z.boolean().optional().default(false),
    reason: trimmedString(1, 1000),
    attachmentUrl: z.string().url().optional().nullable(),
  })
  .strict()
  .refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    { message: 'End date must be on or after start date', path: ['endDate'] },
  );

export type LeaveRequestCreateInput = z.infer<typeof LEAVE_REQUEST_CREATE_SCHEMA>;

// ─── Leave Request Review ────────────────────────────────────

export const LEAVE_REQUEST_REVIEW_SCHEMA = z
  .object({
    reviewNote: trimmedString(0, 500).optional().nullable(),
  })
  .strict();

export type LeaveRequestReviewInput = z.infer<typeof LEAVE_REQUEST_REVIEW_SCHEMA>;

// ─── Leave Request Filter ────────────────────────────────────

export const LEAVE_REQUEST_FILTER_SCHEMA = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    userId: z.string().optional(),
    leaveTypeId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
  })
  .strict();

export type LeaveRequestFilterInput = z.infer<typeof LEAVE_REQUEST_FILTER_SCHEMA>;

// ─── Leave Balance Create (admin) ────────────────────────────

export const LEAVE_BALANCE_CREATE_SCHEMA = z
  .object({
    userId: z.string().min(1, 'User ID is required'),
    leaveTypeId: z.string().uuid('Invalid leave type'),
    year: z.number().int().min(2020).max(2100),
    allocatedDays: z.number().int().min(0).max(365),
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();

export type LeaveBalanceCreateInput = z.infer<typeof LEAVE_BALANCE_CREATE_SCHEMA>;

// ─── Leave Balance Update (admin) ────────────────────────────

export const LEAVE_BALANCE_UPDATE_SCHEMA = z
  .object({
    allocatedDays: z.number().int().min(0).max(365),
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();

export type LeaveBalanceUpdateInput = z.infer<typeof LEAVE_BALANCE_UPDATE_SCHEMA>;
