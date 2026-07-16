import { describe, it, expect } from 'vitest';
import {
  TASK_CREATE_SCHEMA,
  TASK_UPDATE_SCHEMA,
  TASK_STATUS_TRANSITION_SCHEMA,
  TASK_FILTER_SCHEMA,
  COMMENT_CREATE_SCHEMA,
  ATTACHMENT_CREATE_SCHEMA,
  CHECKLIST_ITEM_CREATE_SCHEMA,
  CHECKLIST_ITEM_UPDATE_SCHEMA,
  TIME_ENTRY_CREATE_SCHEMA,
  DEPENDENCY_CREATE_SCHEMA,
} from '../validations/task';

// ─── TASK_CREATE_SCHEMA ──────────────────────────────────────

describe('TASK_CREATE_SCHEMA', () => {
  it('should accept valid minimal input', () => {
    const result = TASK_CREATE_SCHEMA.safeParse({ title: 'My task' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My task');
      expect(result.data.priority).toBe('medium'); // default
    }
  });

  it('should trim the title', () => {
    const result = TASK_CREATE_SCHEMA.parse({ title: '  My Task  ' });
    expect(result.title).toBe('My Task');
  });

  it('should reject empty title', () => {
    const result = TASK_CREATE_SCHEMA.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('should reject title over 500 chars', () => {
    const result = TASK_CREATE_SCHEMA.safeParse({ title: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('should accept all valid priorities', () => {
    for (const priority of ['low', 'medium', 'high', 'urgent', 'critical', 'none'] as const) {
      const result = TASK_CREATE_SCHEMA.safeParse({ title: 'Task', priority });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid priority', () => {
    const result = TASK_CREATE_SCHEMA.safeParse({ title: 'Task', priority: 'super-urgent' });
    expect(result.success).toBe(false);
  });

  it('should accept all optional fields', () => {
    const input = {
      title: 'Full task',
      description: 'A description',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      milestoneId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 'high',
      assignedTo: 'user-1',
      dueDate: '2024-12-31',
      category: 'feature',
      labels: ['frontend', 'urgent'],
      tags: ['sprint-12'],
      estimatedHours: '8.5',
    };
    const result = TASK_CREATE_SCHEMA.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject extra fields (strict mode)', () => {
    const result = TASK_CREATE_SCHEMA.safeParse({ title: 'Task', unknownField: 'x' });
    expect(result.success).toBe(false);
  });
});

// ─── TASK_UPDATE_SCHEMA ──────────────────────────────────────

describe('TASK_UPDATE_SCHEMA', () => {
  it('should accept partial update with just status', () => {
    const result = TASK_UPDATE_SCHEMA.safeParse({ status: 'in_progress' });
    expect(result.success).toBe(true);
  });

  it('should accept empty update', () => {
    const result = TASK_UPDATE_SCHEMA.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = TASK_UPDATE_SCHEMA.safeParse({ status: 'nonexistent' });
    expect(result.success).toBe(false);
  });
});

// ─── TASK_STATUS_TRANSITION_SCHEMA ───────────────────────────

describe('TASK_STATUS_TRANSITION_SCHEMA', () => {
  it('should accept a valid transition (draft → open)', () => {
    const result = TASK_STATUS_TRANSITION_SCHEMA.safeParse({ from: 'draft', to: 'open' });
    expect(result.success).toBe(true);
  });

  it('should accept a valid transition (in_progress → blocked)', () => {
    const result = TASK_STATUS_TRANSITION_SCHEMA.safeParse({ from: 'in_progress', to: 'blocked' });
    expect(result.success).toBe(true);
  });

  it('should reject an invalid transition (draft → completed)', () => {
    const result = TASK_STATUS_TRANSITION_SCHEMA.safeParse({ from: 'draft', to: 'completed' });
    expect(result.success).toBe(false);
  });

  it('should reject transition from archived', () => {
    const result = TASK_STATUS_TRANSITION_SCHEMA.safeParse({ from: 'archived', to: 'open' });
    expect(result.success).toBe(false);
  });
});

// ─── TASK_FILTER_SCHEMA ──────────────────────────────────────

describe('TASK_FILTER_SCHEMA', () => {
  it('should accept empty filter', () => {
    const result = TASK_FILTER_SCHEMA.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should set includeDeleted default to false', () => {
    const result = TASK_FILTER_SCHEMA.parse({});
    expect(result.includeDeleted).toBe(false);
  });

  it('should accept filter with multiple fields', () => {
    const result = TASK_FILTER_SCHEMA.safeParse({
      status: 'open',
      priority: 'high',
      assignedTo: 'user-1',
    });
    expect(result.success).toBe(true);
  });
});

// ─── COMMENT_CREATE_SCHEMA ──────────────────────────────────

describe('COMMENT_CREATE_SCHEMA', () => {
  it('should accept valid comment', () => {
    const result = COMMENT_CREATE_SCHEMA.safeParse({ content: 'Nice work!' });
    expect(result.success).toBe(true);
  });

  it('should trim content', () => {
    const result = COMMENT_CREATE_SCHEMA.parse({ content: '  Nice work!  ' });
    expect(result.content).toBe('Nice work!');
  });

  it('should reject empty content', () => {
    const result = COMMENT_CREATE_SCHEMA.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('should default isInternalNote to false', () => {
    const result = COMMENT_CREATE_SCHEMA.parse({ content: 'Hello' });
    expect(result.isInternalNote).toBe(false);
  });
});

// ─── ATTACHMENT_CREATE_SCHEMA ───────────────────────────────

describe('ATTACHMENT_CREATE_SCHEMA', () => {
  it('should accept valid attachment', () => {
    const result = ATTACHMENT_CREATE_SCHEMA.safeParse({
      fileName: 'report.pdf',
      storageKey: 'uploads/abc-123.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing storageKey', () => {
    const result = ATTACHMENT_CREATE_SCHEMA.safeParse({
      fileName: 'report.pdf',
    });
    expect(result.success).toBe(false);
  });

  it('should reject file size over 50MB', () => {
    const result = ATTACHMENT_CREATE_SCHEMA.safeParse({
      fileName: 'big.mp4',
      storageKey: 'key',
      fileSize: 100 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });
});

// ─── CHECKLIST_ITEM_CREATE_SCHEMA ───────────────────────────

describe('CHECKLIST_ITEM_CREATE_SCHEMA', () => {
  it('should accept valid item', () => {
    const result = CHECKLIST_ITEM_CREATE_SCHEMA.safeParse({ content: 'Buy milk' });
    expect(result.success).toBe(true);
  });

  it('should reject empty content', () => {
    const result = CHECKLIST_ITEM_CREATE_SCHEMA.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });
});

// ─── CHECKLIST_ITEM_UPDATE_SCHEMA ───────────────────────────

describe('CHECKLIST_ITEM_UPDATE_SCHEMA', () => {
  it('should accept content update', () => {
    const result = CHECKLIST_ITEM_UPDATE_SCHEMA.safeParse({ content: 'Updated item' });
    expect(result.success).toBe(true);
  });

  it('should accept checked state', () => {
    const result = CHECKLIST_ITEM_UPDATE_SCHEMA.safeParse({ isChecked: true });
    expect(result.success).toBe(true);
  });
});

// ─── TIME_ENTRY_CREATE_SCHEMA ───────────────────────────────

describe('TIME_ENTRY_CREATE_SCHEMA', () => {
  it('should default entryType to manual', () => {
    const result = TIME_ENTRY_CREATE_SCHEMA.parse({});
    expect(result.entryType).toBe('manual');
  });

  it('should accept timer entry type', () => {
    const result = TIME_ENTRY_CREATE_SCHEMA.safeParse({ entryType: 'timer' });
    expect(result.success).toBe(true);
  });

  it('should accept duration minutes', () => {
    const result = TIME_ENTRY_CREATE_SCHEMA.safeParse({ durationMinutes: 60 });
    expect(result.success).toBe(true);
  });

  it('should reject negative duration', () => {
    const result = TIME_ENTRY_CREATE_SCHEMA.safeParse({ durationMinutes: -5 });
    expect(result.success).toBe(false);
  });
});

// ─── DEPENDENCY_CREATE_SCHEMA ───────────────────────────────

describe('DEPENDENCY_CREATE_SCHEMA', () => {
  it('should accept valid dependency', () => {
    const result = DEPENDENCY_CREATE_SCHEMA.safeParse({
      dependsOnTaskId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should default dependencyType to blocks', () => {
    const result = DEPENDENCY_CREATE_SCHEMA.parse({
      dependsOnTaskId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.dependencyType).toBe('blocks');
  });

  it('should reject non-uuid task ID', () => {
    const result = DEPENDENCY_CREATE_SCHEMA.safeParse({ dependsOnTaskId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});
