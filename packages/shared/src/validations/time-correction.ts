import { z } from 'zod';

// ─── Create ─────────────────────────────────────────────────

export const TIME_CORRECTION_CREATE_SCHEMA = z
  .object({
    timeEntryId: z.string().uuid('Invalid time entry ID'),
    requestedMinutes: z
      .number()
      .int('Must be a whole number')
      .positive('Duration must be positive')
      .max(1440, 'Duration cannot exceed 24 hours'),
    reason: z
      .string()
      .min(1, 'Reason is required')
      .max(1000, 'Reason too long')
      .transform((s) => s.trim()),
  })
  .strict();

export type TimeCorrectionCreateInput = z.infer<
  typeof TIME_CORRECTION_CREATE_SCHEMA
>;

// ─── Review (Approve / Reject) ─────────────────────────────

export const TIME_CORRECTION_REVIEW_SCHEMA = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reviewNote: z
      .string()
      .max(1000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
  })
  .strict();

export type TimeCorrectionReviewInput = z.infer<
  typeof TIME_CORRECTION_REVIEW_SCHEMA
>;
