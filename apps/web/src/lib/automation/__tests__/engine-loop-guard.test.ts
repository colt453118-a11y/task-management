import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────
const { mockDb, mockExecuteAction, rulesBox } = vi.hoisted(() => ({
  mockDb: vi.fn(),
  mockExecuteAction: vi.fn().mockResolvedValue(undefined),
  rulesBox: { rules: [] as unknown[] },
}));

// A minimal drizzle-ish db: select() resolves the current rules array;
// update()/insert() resolve undefined. Reusable for any number of rules.
function makeDb() {
  return {
    select: vi.fn(() => ({
      from: () => ({ where: () => Promise.resolve(rulesBox.rules) }),
    })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
    insert: vi.fn(() => ({ values: () => Promise.resolve(undefined) })),
  };
}

vi.mock('@workmanagement/database', () => ({
  getDb: () => mockDb(),
  schema: { automationRules: {}, automationLogs: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
}));

vi.mock('@/lib/automation/actions', () => ({ executeAction: mockExecuteAction }));
vi.mock('@/lib/automation/conditions', () => ({ evaluateConditions: () => true }));

import {
  evaluateAutomationRules,
  MAX_CHAIN_DEPTH,
  MAX_RULES_PER_EVENT,
  MAX_ACTIONS_PER_EVENT,
  type AutomationContext,
} from '../engine';

const ctx = (over: Partial<AutomationContext> = {}): AutomationContext => ({
  organizationId: 'org-1',
  triggeredByUserId: 'user-1',
  entityType: 'task',
  entityId: 'task-1',
  data: {},
  ...over,
});

function rule(id: number, actionCount = 1) {
  return {
    id: `rule-${id}`,
    name: `Rule ${id}`,
    enabled: true,
    conditions: [],
    actions: Array.from({ length: actionCount }, () => ({ type: 'notify', config: {} })),
    cooldownMinutes: 0,
    lastTriggeredAt: null,
    executionCount: 0,
  };
}

describe('automation engine — runaway/loop protection (WM-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.mockImplementation(() => makeDb());
    rulesBox.rules = [];
  });

  it('hard-stops (and never touches the DB) past MAX_CHAIN_DEPTH', async () => {
    const results = await evaluateAutomationRules(
      'task.updated',
      ctx({ chainDepth: MAX_CHAIN_DEPTH + 1 }),
    );
    expect(results).toEqual([]);
    expect(mockDb).not.toHaveBeenCalled();
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('runs normally at the boundary depth', async () => {
    rulesBox.rules = [rule(1)];
    const results = await evaluateAutomationRules(
      'task.updated',
      ctx({ chainDepth: MAX_CHAIN_DEPTH }),
    );
    expect(results).toHaveLength(1);
    expect(mockExecuteAction).toHaveBeenCalledTimes(1);
  });

  it('caps rule fan-out at MAX_RULES_PER_EVENT', async () => {
    rulesBox.rules = Array.from({ length: MAX_RULES_PER_EVENT + 3 }, (_, i) => rule(i));
    const results = await evaluateAutomationRules('task.updated', ctx());
    expect(results).toHaveLength(MAX_RULES_PER_EVENT);
    expect(mockExecuteAction).toHaveBeenCalledTimes(MAX_RULES_PER_EVENT);
  });

  it('caps total actions at MAX_ACTIONS_PER_EVENT and marks the rest skipped', async () => {
    rulesBox.rules = [rule(1, MAX_ACTIONS_PER_EVENT + 5)];
    const results = await evaluateAutomationRules('task.updated', ctx());
    expect(mockExecuteAction).toHaveBeenCalledTimes(MAX_ACTIONS_PER_EVENT);
    const skipped = results[0]!.actionsResults.filter((a) =>
      a.message?.includes('action budget'),
    );
    expect(skipped).toHaveLength(5);
    expect(skipped.every((a) => !a.success)).toBe(true);
  });

  it('passes an incremented chainDepth down to executeAction', async () => {
    rulesBox.rules = [rule(1)];
    await evaluateAutomationRules('task.updated', ctx({ chainDepth: 0 }));
    const passedContext = mockExecuteAction.mock.calls[0]![1] as AutomationContext;
    expect(passedContext.chainDepth).toBe(1);
  });
});
