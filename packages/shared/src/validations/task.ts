import { z } from 'zod';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_STATUS_TRANSITION_MAP } from '../constants';
import { UUID_OPTIONAL } from './common';

// ─── Derive Zod enums from shared constants ──────────────────

/**
 * Zod enum derived from the shared TASK_STATUSES constant.
 * This ensures status validation stays in sync with the canonical list.
 */
const STATUS_ENUM = z.enum(TASK_STATUSES);

const PRIORITY_ENUM = z.enum(TASK_PRIORITIES);

// ─── Task Create ─────────────────────────────────────────────

export const TASK_CREATE_SCHEMA = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(500)
      .transform((s) => s.trim()),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    projectId: UUID_OPTIONAL,
    milestoneId: UUID_OPTIONAL,
    priority: PRIORITY_ENUM.optional().default('medium'),
    assignedTo: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    labels: z.array(z.string().max(100)).optional().nullable(),
    tags: z.array(z.string().max(100)).optional().nullable(),
    estimatedHours: z.coerce.number().nonnegative().max(99999).optional().nullable(),
    parentTaskId: UUID_OPTIONAL,
  })
  .strict();

export type TaskCreateInput = z.infer<typeof TASK_CREATE_SCHEMA>;

// ─── Task Update ─────────────────────────────────────────────

export const TASK_UPDATE_SCHEMA = z
  .object({
    title: z
      .string()
      .min(1)
      .max(500)
      .transform((s) => s.trim())
      .optional(),
    description: z
      .string()
      .max(10000)
      .transform((s) => s.trim())
      .optional()
      .nullable(),
    status: STATUS_ENUM.optional(),
    priority: PRIORITY_ENUM.optional(),
    assignedTo: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    projectId: UUID_OPTIONAL,
    milestoneId: UUID_OPTIONAL,
    category: z.string().max(100).optional().nullable(),
    labels: z.array(z.string().max(100)).optional().nullable(),
    tags: z.array(z.string().max(100)).optional().nullable(),
    estimatedHours: z.coerce.number().nonnegative().max(99999).optional().nullable(),
  })
  .strict();

export type TaskUpdateInput = z.infer<typeof TASK_UPDATE_SCHEMA>;

// ─── Task Status Transition ──────────────────────────────────

export const TASK_STATUS_TRANSITION_SCHEMA = z
  .object({
    from: STATUS_ENUM,
    to: STATUS_ENUM,
  })
  .refine(
    (data) => {
      const allowed: readonly string[] = TASK_STATUS_TRANSITION_MAP[data.from] ?? [];
      return allowed.includes(data.to);
    },
    {
      message: 'Invalid status transition',
      path: ['to'],
    },
  );

export type StatusTransition = z.infer<typeof TASK_STATUS_TRANSITION_SCHEMA>;

// ─── Task Filter ─────────────────────────────────────────────

export const TASK_FILTER_SCHEMA = z
  .object({
    status: STATUS_ENUM.optional(),
    priority: PRIORITY_ENUM.optional(),
    projectId: UUID_OPTIONAL,
    milestoneId: UUID_OPTIONAL,
    assignedTo: z.string().optional(),
    category: z.string().max(100).optional(),
    labels: z.array(z.string().max(100)).optional(),
    search: z.string().max(200).optional(),
    dueDateFrom: z.string().optional(),
    dueDateTo: z.string().optional(),
    includeDeleted: z.boolean().optional().default(false),
  })
  .strict();

export type TaskFilterInput = z.infer<typeof TASK_FILTER_SCHEMA>;

// ─── Comment ─────────────────────────────────────────────────

export const COMMENT_CREATE_SCHEMA = z
  .object({
    content: z
      .string()
      .min(1, 'Comment is required')
      .max(10000)
      .transform((s) => s.trim()),
    parentId: UUID_OPTIONAL,
    isInternalNote: z.boolean().optional().default(false),
  })
  .strict();

export type CommentCreateInput = z.infer<typeof COMMENT_CREATE_SCHEMA>;

// ─── Attachment ──────────────────────────────────────────────

export const ATTACHMENT_CREATE_SCHEMA = z
  .object({
    fileName: z.string().min(1, 'File name is required').max(500),
    fileSize: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024)
      .optional()
      .nullable(),
    mimeType: z.string().max(100).optional().nullable(),
    storageKey: z.string().min(1, 'Storage key is required'),
  })
  .strict();

export type AttachmentCreateInput = z.infer<typeof ATTACHMENT_CREATE_SCHEMA>;

// ─── Checklist ───────────────────────────────────────────────

export const CHECKLIST_ITEM_CREATE_SCHEMA = z
  .object({
    content: z
      .string()
      .min(1, 'Content is required')
      .max(1000)
      .transform((s) => s.trim()),
  })
  .strict();

export type ChecklistItemCreateInput = z.infer<typeof CHECKLIST_ITEM_CREATE_SCHEMA>;

export const CHECKLIST_ITEM_UPDATE_SCHEMA = z
  .object({
    content: z
      .string()
      .min(1)
      .max(1000)
      .transform((s) => s.trim())
      .optional(),
    isChecked: z.boolean().optional(),
  })
  .strict();

export type ChecklistItemUpdateInput = z.infer<typeof CHECKLIST_ITEM_UPDATE_SCHEMA>;

// ─── Time Entry ──────────────────────────────────────────────

export const TIME_ENTRY_CREATE_SCHEMA = z
  .object({
    entryType: z.enum(['timer', 'manual']).optional().default('manual'),
    durationMinutes: z.number().int().positive('Duration must be positive').optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
  })
  .strict();

export type TimeEntryCreateInput = z.infer<typeof TIME_ENTRY_CREATE_SCHEMA>;

// ─── Dependency ──────────────────────────────────────────────

export const DEPENDENCY_CREATE_SCHEMA = z
  .object({
    dependsOnTaskId: z.string().uuid('Invalid task ID'),
    dependencyType: z.enum(['blocks', 'relates_to', 'duplicates']).default('blocks'),
  })
  .strict();

export type DependencyCreateInput = z.infer<typeof DEPENDENCY_CREATE_SCHEMA>;
