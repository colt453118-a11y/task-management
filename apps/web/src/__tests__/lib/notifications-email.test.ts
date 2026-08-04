import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldSendEmailForType } from '@/lib/notifications';

// ─── Mocks ──────────────────────────────────────────────────

// Mock database chain helpers
const createMockChain = (finalResult: unknown) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(finalResult),
  };
  return chain;
};

let mockChain = createMockChain([undefined]);

const mockDb = {
  select: (...args: unknown[]) => {
    mockChain.select(...args);
    return mockChain;
  },
};

// Mock getDb to return our mock database
vi.mock('@workmanagement/database', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    users: {
      id: 'id',
      preferences: 'preferences',
    },
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: string, value: unknown) => ({ field, value, type: 'eq' })),
  sql: vi.fn(),
}));

// Mock other dependencies that are imported but not used in tests
vi.mock('@/lib/email', () => ({
  sendNotificationEmail: vi.fn(),
}));

vi.mock('@/lib/notifications/listener', () => ({
  emitNotification: vi.fn(),
}));

vi.mock('@/lib/slack/webhook', () => ({
  sendSlackNotification: vi.fn(),
}));

// ─── Test Suite ─────────────────────────────────────────────

describe('shouldSendEmailForType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createMockChain([undefined]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('force parameter', () => {
    it('should return true when force is true', async () => {
      const result = await shouldSendEmailForType('user-1', 'task.assigned', true);
      expect(result).toBe(true);
    });

    it('should return true when force is true even with no preferences', async () => {
      mockChain = createMockChain([{ preferences: null }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned', true);
      expect(result).toBe(true);
    });
  });

  describe('unknown notification type', () => {
    it('should return true for unknown type (email is opt-out)', async () => {
      const result = await shouldSendEmailForType('user-1', 'unknown.type');
      expect(result).toBe(true);
    });
  });

  describe('no user preferences', () => {
    it('should return true when user not found (email is opt-out)', async () => {
      mockChain = createMockChain([undefined]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });

    it('should return true when user has no preferences', async () => {
      mockChain = createMockChain([{ preferences: null }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });

    it('should return true when preferences is empty object', async () => {
      mockChain = createMockChain([{ preferences: {} }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });
  });

  describe('per-type channel override', () => {
    it('should use typeChannels.email override when set to false', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            typeChannels: {
              task_assigned: { email: false },
            },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(false);
    });

    it('should use typeChannels.email override when set to true', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: false },
            typeChannels: {
              task_assigned: { email: true },
            },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });

    it('should fall back to global when typeChannels.email is undefined', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: false },
            typeChannels: {
              task_assigned: { slack: true },
            },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(false);
    });
  });

  describe('global channel settings', () => {
    it('should return true when global email is enabled and type is enabled', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: true },
            types: { task_assigned: true },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });

    it('should return false when global email is disabled', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: false },
            types: { task_assigned: true },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(false);
    });

    it('should return true when global email is not set (defaults to true)', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            types: { task_assigned: true },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });

    it('should return false when notification type is disabled', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: true },
            types: { task_assigned: false },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(false);
    });

    it('should return true when type is not in types map (defaults to true)', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: true },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });
  });

  describe('different notification types', () => {
    it('should handle task.comment type', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: true },
            types: { task_comment: true },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.comment');
      expect(result).toBe(true);
    });

    it('should handle task.mention type', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: true },
            types: { task_mention: true },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'task.mention');
      expect(result).toBe(true);
    });

    it('should handle report.eod_ready type', async () => {
      mockChain = createMockChain([{
        preferences: {
          notifications: {
            channels: { email: true },
            types: { report_eod_ready: true },
          },
        },
      }]);
      const result = await shouldSendEmailForType('user-1', 'report.eod_ready');
      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return true on database error (fail-safe for email)', async () => {
      mockChain = createMockChain([undefined]);
      mockChain.select.mockRejectedValueOnce(new Error('DB error'));
      const result = await shouldSendEmailForType('user-1', 'task.assigned');
      expect(result).toBe(true);
    });
  });
});
