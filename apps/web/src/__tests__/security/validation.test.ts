import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  READONLY_STATUSES,
  COMPLETED_STATUSES,
  TASK_STATUS_TRANSITIONS,
  BLOCKED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  VALID_PRIORITIES,
  TaskCreateSchema,
  TaskUpdateSchema,
  CommentCreateSchema,
  AttachmentCreateSchema,
} from '@/lib/api/validation';
import type { TaskStatus } from '@/lib/api/validation';

// ─── Task Status Transitions ───────────────────────────────────

describe('isValidTransition', () => {
  it('allows draft → open', () => {
    expect(isValidTransition('draft', 'open')).toBe(true);
  });

  it('allows open → assigned', () => {
    expect(isValidTransition('open', 'assigned')).toBe(true);
  });

  it('allows in_progress → under_review', () => {
    expect(isValidTransition('in_progress', 'under_review')).toBe(true);
  });

  it('allows completed → closed', () => {
    expect(isValidTransition('completed', 'closed')).toBe(true);
  });

  it('allows closed → reopened', () => {
    expect(isValidTransition('closed', 'reopened')).toBe(true);
  });

  it('allows reopened → assigned', () => {
    expect(isValidTransition('reopened', 'assigned')).toBe(true);
  });

  it('rejects invalid forward transition: draft → completed', () => {
    expect(isValidTransition('draft', 'completed')).toBe(false);
  });

  it('rejects invalid backward transition: completed → in_progress', () => {
    expect(isValidTransition('completed', 'in_progress')).toBe(false);
  });

  it('rejects transition from archived to any other status', () => {
    const statuses: TaskStatus[] = ['draft', 'open', 'assigned', 'in_progress', 'blocked', 'on_hold', 'under_review', 'completed', 'closed', 'reopened', 'cancelled'];
    for (const status of statuses) {
      expect(isValidTransition('archived', status)).toBe(false);
    }
  });

  it('rejects transition to unknown status', () => {
    expect(isValidTransition('open', 'nonexistent')).toBe(false);
  });

  it('rejects transition from unknown status', () => {
    expect(isValidTransition('nonexistent', 'open')).toBe(false);
  });

  it('allows all valid transitions defined in the map', () => {
    // Verify each defined transition passes
    for (const [from, toList] of Object.entries(TASK_STATUS_TRANSITIONS)) {
      for (const to of toList) {
        expect(isValidTransition(from, to)).toBe(true);
      }
    }
  });
});

// ─── Readonly / Completed Statuses ─────────────────────────────

describe('READONLY_STATUSES', () => {
  it('includes closed and archived', () => {
    expect(READONLY_STATUSES.has('closed')).toBe(true);
    expect(READONLY_STATUSES.has('archived')).toBe(true);
  });

  it('does not include other active statuses', () => {
    expect(READONLY_STATUSES.has('open')).toBe(false);
    expect(READONLY_STATUSES.has('in_progress')).toBe(false);
    expect(READONLY_STATUSES.has('completed')).toBe(false);
  });
});

describe('COMPLETED_STATUSES', () => {
  it('includes completed and closed', () => {
    expect(COMPLETED_STATUSES.has('completed')).toBe(true);
    expect(COMPLETED_STATUSES.has('closed')).toBe(true);
  });

  it('does not include draft or open', () => {
    expect(COMPLETED_STATUSES.has('draft')).toBe(false);
    expect(COMPLETED_STATUSES.has('open')).toBe(false);
  });
});

// ─── File Upload Security ──────────────────────────────────────

describe('BLOCKED_EXTENSIONS', () => {
  const dangerousExtensions = ['.exe', '.js', '.sh', '.bat', '.cmd', '.php', '.html', '.htm', '.svg', '.msi', '.dll', '.ps1', '.jar', '.vbs', '.scr'];

  for (const ext of dangerousExtensions) {
    it(`blocks dangerous extension: ${ext}`, () => {
      expect(BLOCKED_EXTENSIONS.has(ext)).toBe(true);
    });
  }

  it('allows safe extensions', () => {
    expect(BLOCKED_EXTENSIONS.has('.pdf')).toBe(false);
    expect(BLOCKED_EXTENSIONS.has('.docx')).toBe(false);
    expect(BLOCKED_EXTENSIONS.has('.png')).toBe(false);
    expect(BLOCKED_EXTENSIONS.has('.txt')).toBe(false);
    expect(BLOCKED_EXTENSIONS.has('.csv')).toBe(false);
  });
});

describe('ALLOWED_MIME_TYPES', () => {
  const safeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
  ];

  for (const mime of safeTypes) {
    it(`allows safe MIME type: ${mime}`, () => {
      expect(ALLOWED_MIME_TYPES.has(mime)).toBe(true);
    });
  }

  it('rejects dangerous MIME types', () => {
    expect(ALLOWED_MIME_TYPES.has('text/html')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('application/javascript')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('image/svg+xml')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('application/x-msdownload')).toBe(false);
  });
});

describe('MAX_FILE_SIZE', () => {
  it('is set to 50MB', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });
});

describe('VALID_PRIORITIES', () => {
  it('includes all priority levels', () => {
    expect(VALID_PRIORITIES).toEqual(['none', 'low', 'medium', 'high', 'urgent', 'critical']);
  });
});

// ─── Zod Schema Validation ─────────────────────────────────────

describe('TaskCreateSchema', () => {
  it('validates a minimal valid task', () => {
    const result = TaskCreateSchema.safeParse({ title: 'Fix login bug' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Fix login bug');
    }
  });

  it('trims whitespace from title', () => {
    const result = TaskCreateSchema.safeParse({ title: '  My Task  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Task');
    }
  });

  it('rejects empty title', () => {
    const result = TaskCreateSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 500 characters', () => {
    const result = TaskCreateSchema.safeParse({ title: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields not in schema', () => {
    const result = TaskCreateSchema.safeParse({
      title: 'Test',
      maliciousField: 'injected',
    });
    expect(result.success).toBe(false);
  });

  it('allows optional fields', () => {
    const result = TaskCreateSchema.safeParse({
      title: 'Test',
      description: 'A description',
      priority: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid priority values', () => {
    const result = TaskCreateSchema.safeParse({
      title: 'Test',
      priority: 'super-urgent',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID projectId', () => {
    const result = TaskCreateSchema.safeParse({
      title: 'Test',
      projectId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('defaults priority to medium', () => {
    const result = TaskCreateSchema.safeParse({ title: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium');
    }
  });
});

describe('TaskUpdateSchema', () => {
  it('validates partial update with single field', () => {
    const result = TaskUpdateSchema.safeParse({ title: 'Updated Title' });
    expect(result.success).toBe(true);
  });

  it('validates empty update object', () => {
    const result = TaskUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects extra fields (mass assignment protection)', () => {
    const result = TaskUpdateSchema.safeParse({
      title: 'Test',
      completedAt: new Date().toISOString(), // Should not be settable by client
    });
    expect(result.success).toBe(false);
  });

  it('allows valid status update', () => {
    const result = TaskUpdateSchema.safeParse({ status: 'in_progress' });
    expect(result.success).toBe(true);
  });

  it('allows null description', () => {
    const result = TaskUpdateSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });
});

describe('CommentCreateSchema', () => {
  it('validates a valid comment', () => {
    const result = CommentCreateSchema.safeParse({ content: 'Great work!' });
    expect(result.success).toBe(true);
  });

  it('rejects empty comment', () => {
    const result = CommentCreateSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields', () => {
    const result = CommentCreateSchema.safeParse({
      content: 'Valid',
      maliciousField: 'injected',
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from comment', () => {
    const result = CommentCreateSchema.safeParse({ content: '  My comment  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe('My comment');
    }
  });
});

describe('AttachmentCreateSchema', () => {
  it('validates a valid attachment', () => {
    const result = AttachmentCreateSchema.safeParse({
      fileName: 'report.pdf',
      storageKey: 'uploads/abc-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty fileName', () => {
    const result = AttachmentCreateSchema.safeParse({
      fileName: '',
      storageKey: 'uploads/abc-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fileName over 500 characters', () => {
    const result = AttachmentCreateSchema.safeParse({
      fileName: 'x'.repeat(501) + '.pdf',
      storageKey: 'uploads/abc-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative file size', () => {
    const result = AttachmentCreateSchema.safeParse({
      fileName: 'test.pdf',
      fileSize: -100,
      storageKey: 'uploads/abc-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects file size over limit', () => {
    const result = AttachmentCreateSchema.safeParse({
      fileName: 'test.pdf',
      fileSize: MAX_FILE_SIZE + 1,
      storageKey: 'uploads/abc-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty storageKey', () => {
    const result = AttachmentCreateSchema.safeParse({
      fileName: 'test.pdf',
      storageKey: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields', () => {
    const result = AttachmentCreateSchema.safeParse({
      fileName: 'test.pdf',
      storageKey: 'uploads/abc-123',
      maliciousHeader: 'injected',
    });
    expect(result.success).toBe(false);
  });
});
