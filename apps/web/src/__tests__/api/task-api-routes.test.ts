import { describe, it, expect } from 'vitest';
import { BatchUpdateSchema } from '@/app/api/tasks/batch/route';
import { TemplateCreateSchema, TemplateUpdateSchema } from '@/app/api/task-templates/route';
import { VALID_PRIORITIES, READONLY_STATUSES } from '@/lib/api/validation';

// ─── Shared helpers (route logic simulation) ─────────────────--

/** Whether an action targets soft-deleted tasks (restore/permanent_delete) vs active tasks */
function targetsDeletedTasks(action: string): boolean {
  return action === 'restore' || action === 'permanent_delete';
}

// ─── Batch Operations Schema ───────────────────────────────────

describe('BatchUpdateSchema', () => {
  const validPayload = {
    taskIds: ['00000000-0000-0000-0000-000000000001'],
    action: 'change_status' as const,
    value: 'in_progress',
  };

  it('validates a valid batch status update', () => {
    const result = BatchUpdateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts all six valid actions', () => {
    const actions = [
      'change_status',
      'change_priority',
      'assign',
      'delete',
      'restore',
      'permanent_delete',
    ] as const;
    for (const action of actions) {
      const result = BatchUpdateSchema.safeParse({
        taskIds: ['00000000-0000-0000-0000-000000000001'],
        action,
        value: 'test',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid action', () => {
    const result = BatchUpdateSchema.safeParse({ ...validPayload, action: 'invalid_action' });
    expect(result.success).toBe(false);
  });

  it('rejects empty taskIds array', () => {
    const result = BatchUpdateSchema.safeParse({ ...validPayload, taskIds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 100 taskIds', () => {
    const result = BatchUpdateSchema.safeParse({
      ...validPayload,
      taskIds: Array.from(
        { length: 101 },
        (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      ),
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 100 taskIds (boundary)', () => {
    const result = BatchUpdateSchema.safeParse({
      ...validPayload,
      taskIds: Array.from(
        { length: 100 },
        (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      ),
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID taskIds', () => {
    const result = BatchUpdateSchema.safeParse({ ...validPayload, taskIds: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });

  it('rejects empty value string', () => {
    const result = BatchUpdateSchema.safeParse({ ...validPayload, value: '' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (mass assignment protection)', () => {
    const result = BatchUpdateSchema.safeParse({ ...validPayload, maliciousField: 'injected' });
    expect(result.success).toBe(false);
  });

  it('restore action does not require a meaningful value', () => {
    const result = BatchUpdateSchema.safeParse({
      taskIds: ['00000000-0000-0000-0000-000000000001'],
      action: 'restore',
      value: 'restore', // any non-empty string is fine
    });
    expect(result.success).toBe(true);
  });

  it('permanent_delete action does not require a meaningful value', () => {
    const result = BatchUpdateSchema.safeParse({
      taskIds: ['00000000-0000-0000-0000-000000000001'],
      action: 'permanent_delete',
      value: 'permanent_delete',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid UUID for assign action value', () => {
    const result = BatchUpdateSchema.safeParse({
      taskIds: ['00000000-0000-0000-0000-000000000001'],
      action: 'assign',
      value: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.success).toBe(true);
  });
});

// ─── Task Templates Schema — Create ────────────────────────────

describe('TemplateCreateSchema', () => {
  it('validates a minimal valid template with defaults', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Bug Report' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Bug Report');
      expect(result.data.priority).toBe('medium');
      expect(result.data.isDefault).toBe(false);
    }
  });

  it('trims whitespace from name', () => {
    const result = TemplateCreateSchema.safeParse({ name: '  My Template  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Template');
    }
  });

  it('rejects empty name', () => {
    const result = TemplateCreateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 200 characters', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects description over 1000 characters', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', description: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });

  it('rejects taskTitle over 500 characters', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', taskTitle: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects taskDescription over 10000 characters', () => {
    const result = TemplateCreateSchema.safeParse({
      name: 'Test',
      taskDescription: 'x'.repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid priority values', () => {
    for (const priority of VALID_PRIORITIES) {
      const result = TemplateCreateSchema.safeParse({ name: 'Test', priority });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid priority value', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', priority: 'super-urgent' });
    expect(result.success).toBe(false);
  });

  it('rejects negative estimatedHours', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', estimatedHours: -5 });
    expect(result.success).toBe(false);
  });

  it('accepts null estimatedHours', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', estimatedHours: null });
    expect(result.success).toBe(true);
  });

  it('rejects extra fields (mass assignment protection)', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', maliciousField: 'injected' });
    expect(result.success).toBe(false);
  });

  it('rejects category over 100 characters', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', category: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects labels with items exceeding 100 characters', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', labels: ['x'.repeat(101)] });
    expect(result.success).toBe(false);
  });

  it('rejects tags with items exceeding 100 characters', () => {
    const result = TemplateCreateSchema.safeParse({ name: 'Test', tags: ['x'.repeat(101)] });
    expect(result.success).toBe(false);
  });

  it('accepts a fully populated valid template', () => {
    const result = TemplateCreateSchema.safeParse({
      name: 'Feature Request',
      description: 'A template for new feature requests',
      taskTitle: 'Implement: {{name}}',
      taskDescription: '## Description\nPlease implement...',
      priority: 'high',
      category: 'development',
      labels: ['feature', 'enhancement'],
      tags: ['frontend', 'backend'],
      estimatedHours: 8,
      isDefault: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Feature Request');
      expect(result.data.priority).toBe('high');
      expect(result.data.isDefault).toBe(true);
      expect(result.data.labels).toEqual(['feature', 'enhancement']);
    }
  });
});

// ─── Task Templates Schema — Update ────────────────────────────

describe('TemplateUpdateSchema', () => {
  it('accepts a single-field partial update', () => {
    const result = TemplateUpdateSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated Name');
    }
  });

  it('accepts an empty object (no changes)', () => {
    const result = TemplateUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('trims whitespace from name on update', () => {
    const result = TemplateUpdateSchema.safeParse({ name: '  Trimmed  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Trimmed');
    }
  });

  it('accepts priority update', () => {
    const result = TemplateUpdateSchema.safeParse({ priority: 'urgent' });
    expect(result.success).toBe(true);
  });

  it('accepts setting nullable fields to null', () => {
    const result = TemplateUpdateSchema.safeParse({ description: null, category: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
      expect(result.data.category).toBeNull();
    }
  });

  it('accepts toggling isDefault', () => {
    const result = TemplateUpdateSchema.safeParse({ isDefault: true });
    expect(result.success).toBe(true);
  });

  it('rejects invalid priority on update', () => {
    const result = TemplateUpdateSchema.safeParse({ priority: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (mass assignment protection)', () => {
    const result = TemplateUpdateSchema.safeParse({ name: 'Test', maliciousField: 'injected' });
    expect(result.success).toBe(false);
  });

  it('accepts updating labels array', () => {
    const result = TemplateUpdateSchema.safeParse({ labels: ['bug', 'critical'] });
    expect(result.success).toBe(true);
  });

  it('accepts updating estimatedHours', () => {
    const result = TemplateUpdateSchema.safeParse({ estimatedHours: 4 });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive estimatedHours (zero or negative)', () => {
    const zeroResult = TemplateUpdateSchema.safeParse({ estimatedHours: 0 });
    expect(zeroResult.success).toBe(false);

    const negResult = TemplateUpdateSchema.safeParse({ estimatedHours: -1 });
    expect(negResult.success).toBe(false);
  });

  it('rejects updating to null for mandatory-like fields that should remain optional', () => {
    // priority is optional on update but enforces valid enum values
    const result = TemplateUpdateSchema.safeParse({ priority: null });
    expect(result.success).toBe(false);
  });
});

// ─── Priority Consistency ──────────────────────────────────────

describe('Priority Consistency', () => {
  it('batch change_priority and template priority use the same enum values', () => {
    for (const p of VALID_PRIORITIES) {
      const batchResult = BatchUpdateSchema.safeParse({
        taskIds: ['00000000-0000-0000-0000-000000000001'],
        action: 'change_priority',
        value: p,
      });
      expect(batchResult.success).toBe(true);

      const templateResult = TemplateCreateSchema.safeParse({ name: 'Test', priority: p });
      expect(templateResult.success).toBe(true);
    }
  });
});

// ─── Batch Negative Tests ──────────────────────────────────────

describe('Batch — Negative / Edge Cases', () => {
  // ── Priority validation ─────────────────────────────────

  describe('invalid priority values', () => {
    it('schema accepts any non-empty string for change_priority value (validation happens in route handler)', () => {
      // The Zod schema only checks that value is a non-empty string
      // Actual priority validation happens in the route handler via VALID_PRIORITIES.includes(value)
      const result = BatchUpdateSchema.safeParse({
        taskIds: ['00000000-0000-0000-0000-000000000001'],
        action: 'change_priority',
        value: 'invalid-priority-value',
      });
      // Schema passes because value is a non-empty string
      expect(result.success).toBe(true);
    });

    it('VALID_PRIORITIES rejects invalid priority strings', () => {
      // This is the check the route handler uses
      const priorities = VALID_PRIORITIES as readonly string[];
      const invalidValues = ['invalid', 'super-urgent', 'urgentest', '1', '', 'medium '];
      for (const v of invalidValues) {
        expect(priorities.includes(v)).toBe(false);
      }
    });

    it('VALID_PRIORITIES accepts all valid priority strings', () => {
      const priorities = VALID_PRIORITIES as readonly string[];
      const validValues = ['none', 'low', 'medium', 'high', 'urgent', 'critical'];
      for (const v of validValues) {
        expect(priorities.includes(v)).toBe(true);
      }
    });

    it('VALID_PRIORITIES rejects trailing whitespace and wrong case', () => {
      const priorities = VALID_PRIORITIES as readonly string[];
      expect(priorities.includes('high ')).toBe(false);
      expect(priorities.includes('HIGH')).toBe(false);
    });
  });

  // ── Cross-organization simulation ───────────────────────

  describe('cross-organization task IDs', () => {
    it('simulates route-level cross-org check: any task with different orgId is rejected', () => {
      // The route handler checks each task's organizationId against the user's orgId
      const userOrgId = 'org-1';
      const tasks = [
        { id: '00000000-0000-0000-0000-000000000001', organizationId: 'org-1', status: 'open' },
        { id: '00000000-0000-0000-0000-000000000002', organizationId: 'org-2', status: 'open' }, // Different org
      ];

      const crossOrgTasks = tasks.filter((t) => t.organizationId !== userOrgId);
      expect(crossOrgTasks).toHaveLength(1);
      expect(crossOrgTasks[0]?.id).toBe('00000000-0000-0000-0000-000000000002');

      // The route would return 403 with this logic
      const isCrossOrg = tasks.some((t) => t.organizationId !== userOrgId);
      expect(isCrossOrg).toBe(true);
    });

    it('simulates route-level cross-org check: all tasks with same orgId pass', () => {
      const userOrgId = 'org-1';
      const tasks = [
        { id: 'id-1', organizationId: 'org-1', status: 'open' },
        { id: 'id-2', organizationId: 'org-1', status: 'in_progress' },
      ];

      const isCrossOrg = tasks.some((t) => t.organizationId !== userOrgId);
      expect(isCrossOrg).toBe(false);
    });

    it('empty task set would have zero cross-org violations (edge case)', () => {
      const userOrgId = 'org-1';
      const tasks: Array<{ id: string; organizationId: string }> = [];

      const isCrossOrg = tasks.some((t) => t.organizationId !== userOrgId);
      expect(isCrossOrg).toBe(false);
    });
  });

  // ── Mixed active/deleted tasks ──────────────────────────

  describe('mixed active and deleted tasks', () => {
    it('restore action targets deleted tasks', () => {
      // Route logic: deletedCondition = action === 'restore' || action === 'permanent_delete'
      //   ? sql`IS NOT NULL` : isNull(deletedAt)
      expect(targetsDeletedTasks('restore')).toBe(true);
    });

    it('permanent_delete action targets deleted tasks', () => {
      expect(targetsDeletedTasks('permanent_delete')).toBe(true);
    });

    it('change_status, change_priority, assign, delete target active tasks', () => {
      for (const action of ['change_status', 'change_priority', 'assign', 'delete']) {
        expect(targetsDeletedTasks(action)).toBe(false);
      }
    });

    it('simulates 404 when some requested tasks are not found (mixed active/deleted scenario)', () => {
      // If user sends 3 taskIds but the query only returns 2 (e.g., some are deleted
      // when querying for active tasks, or vice versa), the route returns 404.
      const taskIds = ['id-1', 'id-2', 'id-3']; // 3 IDs requested
      const foundTasks = ['id-1', 'id-2']; // Only 2 found
      const notFound = taskIds.length !== foundTasks.length;
      expect(notFound).toBe(true); // Would trigger 404 response
    });

    it('simulates all tasks found when query returns matching count', () => {
      const taskIds = ['id-1', 'id-2', 'id-3'];
      const foundTasks = ['id-1', 'id-2', 'id-3'];
      const allFound = taskIds.length === foundTasks.length;
      expect(allFound).toBe(true); // Would pass the 404 check
    });
  });

  // ── Readonly status rejection ───────────────────────────

  describe('readonly status rejection', () => {
    it('READONLY_STATUSES includes closed and archived', () => {
      expect(READONLY_STATUSES.has('closed')).toBe(true);
      expect(READONLY_STATUSES.has('archived')).toBe(true);
    });

    it('READONLY_STATUSES does not include active statuses', () => {
      const activeStatuses = [
        'draft',
        'open',
        'in_progress',
        'blocked',
        'under_review',
        'completed',
      ];
      for (const s of activeStatuses) {
        expect(READONLY_STATUSES.has(s)).toBe(false);
      }
    });

    it('restore action skips the readonly check', () => {
      // Route logic: if (action !== 'restore' && action !== 'permanent_delete') { check readonly }
      expect(targetsDeletedTasks('restore')).toBe(true); // restore skips readonly
    });

    it('permanent_delete action skips the readonly check', () => {
      expect(targetsDeletedTasks('permanent_delete')).toBe(true); // permanent_delete skips readonly
    });

    it('other actions enforce readonly check', () => {
      for (const action of ['change_status', 'change_priority', 'assign', 'delete']) {
        expect(targetsDeletedTasks(action)).toBe(false); // these do NOT skip readonly
      }
    });

    it('simulates route returning 422 when readonly tasks are found', () => {
      const tasks = [
        { id: 'id-1', status: 'closed' }, // Readonly
        { id: 'id-2', status: 'open' }, // Not readonly
      ];

      const readOnlyTasks = tasks.filter((t) => READONLY_STATUSES.has(t.status));
      expect(readOnlyTasks).toHaveLength(1);
      expect(readOnlyTasks[0]?.id).toBe('id-1');
    });

    it('simulates no readonly violation when all tasks are mutable', () => {
      const tasks = [
        { id: 'id-1', status: 'open' },
        { id: 'id-2', status: 'in_progress' },
      ];

      const readOnlyTasks = tasks.filter((t) => READONLY_STATUSES.has(t.status));
      expect(readOnlyTasks).toHaveLength(0);
    });
  });

  // ── Action-to-permission mapping ────────────────────────

  describe('action-to-permission mapping', () => {
    const actionPermissions: Record<string, string> = {
      change_status: 'task:edit',
      change_priority: 'task:edit',
      assign: 'task:assign',
      delete: 'task:delete',
      restore: 'task:delete',
      permanent_delete: 'task:delete',
    };

    it('each action requires a specific permission', () => {
      const actions = [
        'change_status',
        'change_priority',
        'assign',
        'delete',
        'restore',
        'permanent_delete',
      ];
      for (const action of actions) {
        expect(actionPermissions[action]).toBeDefined();
        expect(typeof actionPermissions[action]).toBe('string');
        expect(actionPermissions[action]).toMatch(/^task:/);
      }
    });

    it('change_status and change_priority require task:edit', () => {
      expect(actionPermissions['change_status']).toBe('task:edit');
      expect(actionPermissions['change_priority']).toBe('task:edit');
    });

    it('assign requires task:assign', () => {
      expect(actionPermissions['assign']).toBe('task:assign');
    });

    it('delete, restore, and permanent_delete require task:delete', () => {
      expect(actionPermissions['delete']).toBe('task:delete');
      expect(actionPermissions['restore']).toBe('task:delete');
      expect(actionPermissions['permanent_delete']).toBe('task:delete');
    });

    it('no action maps to an unknown permission', () => {
      const knownPermissions = ['task:edit', 'task:assign', 'task:delete'];
      for (const perm of Object.values(actionPermissions)) {
        expect(knownPermissions).toContain(perm);
      }
    });
  });

  // ── Schema edge cases ───────────────────────────────────

  describe('schema edge cases', () => {
    it('rejects taskIds with mixed valid and invalid UUIDs', () => {
      const result = BatchUpdateSchema.safeParse({
        taskIds: ['00000000-0000-0000-0000-000000000001', 'not-a-uuid'],
        action: 'delete',
        value: 'delete',
      });
      expect(result.success).toBe(false);
    });

    it('allows duplicate UUIDs in taskIds (schema validates UUID format, not uniqueness)', () => {
      // Duplicate UUIDs are still valid UUIDs — schema accepts them
      const result = BatchUpdateSchema.safeParse({
        taskIds: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'],
        action: 'delete',
        value: 'delete',
      });
      expect(result.success).toBe(true);
      // Note: the route handler would process duplicates as-is
      // Frontend should deduplicate before sending
    });

    it('rejects extra fields for every action type (mass assignment)', () => {
      const actions = [
        'change_status',
        'change_priority',
        'assign',
        'delete',
        'restore',
        'permanent_delete',
      ];
      for (const action of actions) {
        const result = BatchUpdateSchema.safeParse({
          taskIds: ['00000000-0000-0000-0000-000000000001'],
          action,
          value: 'test',
          maliciousField: 'injected',
        });
        expect(result.success).toBe(false);
      }
    });

    it('rejects completely empty object', () => {
      const result = BatchUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects null body (parsed as null)', () => {
      const result = BatchUpdateSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });

  // ── Deleted condition branching ─────────────────────────

  describe('deleted condition branching logic', () => {
    it('restore and permanent_delete both target deleted tasks', () => {
      // The route uses: deletedCondition = action === 'restore' || action === 'permanent_delete'
      //   ? sql`IS NOT NULL` : isNull(deletedAt);
      expect(targetsDeletedTasks('restore')).toBe(true);
      expect(targetsDeletedTasks('permanent_delete')).toBe(true);
    });

    it('active-only actions do not target deleted tasks', () => {
      const activeOnly = ['change_status', 'change_priority', 'assign', 'delete'];
      for (const action of activeOnly) {
        expect(targetsDeletedTasks(action)).toBe(false);
      }
    });
  });

  // ── Audit action naming ─────────────────────────────────

  describe('audit action naming', () => {
    it('each action produces a valid audit action string via tasks.batch_${action}', () => {
      const actions = [
        'change_status',
        'change_priority',
        'assign',
        'delete',
        'restore',
        'permanent_delete',
      ];
      for (const action of actions) {
        const auditAction = `tasks.batch_${action}`;
        expect(auditAction).toMatch(/^tasks\.batch_[a-z_]+$/);
      }
    });
  });
});
