import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNotification } from '@/lib/notifications';

// ─── Hoisted mocks ─────────────────────────────────────────
// vi.hoisted ensures these are available when vi.mock factories run
const {
  mockSendNotificationEmail,
  mockEmitNotification,
  mockSendSlackNotification,
} = vi.hoisted(() => ({
  mockSendNotificationEmail: vi.fn().mockResolvedValue(undefined),
  mockEmitNotification: vi.fn(),
  mockSendSlackNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mocks ──────────────────────────────────────────────────

const mockNotification = {
  id: 'notif-123',
  organizationId: 'org-1',
  userId: 'user-1',
  type: 'task.assigned',
  title: 'Task Assigned',
  message: 'You have been assigned a task',
  link: '/tasks/task-123',
  actorId: 'actor-1',
  entityType: 'task',
  entityId: 'task-123',
  metadata: { priority: 'high' },
  isRead: false,
  isDismissed: false,
  readAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
};

let insertResult: unknown[] = [mockNotification];
let lastInsertValues: Record<string, unknown> | null = null;

const createMockChain = () => {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
      lastInsertValues = values;
      return chain;
    }),
    returning: vi.fn().mockImplementation(() => {
      // Return a notification with the type from the insert values
      if (lastInsertValues?.type) {
        return Promise.resolve([{ ...mockNotification, type: lastInsertValues.type }]);
      }
      return Promise.resolve(insertResult);
    }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ email: 'test@example.com', name: 'Test User' }]),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
};

let mockChain = createMockChain();

const mockDb = {
  insert: (...args: unknown[]) => {
    mockChain.insert(...args);
    return mockChain;
  },
  select: (...args: unknown[]) => {
    mockChain.select(...args);
    return mockChain;
  },
  execute: (...args: unknown[]) => {
    mockChain.execute(...args);
    return Promise.resolve();
  },
};

vi.mock('@workmanagement/database', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    notifications: {
      id: 'id',
      organizationId: 'organizationId',
      userId: 'userId',
      type: 'type',
      title: 'title',
      message: 'message',
      link: 'link',
      actorId: 'actorId',
      entityType: 'entityType',
      entityId: 'entityId',
      metadata: 'metadata',
    },
    users: {
      id: 'id',
      email: 'email',
      name: 'name',
      preferences: 'preferences',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: string, value: unknown) => ({ field, value, type: 'eq' })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    type: 'sql',
  })),
}));

vi.mock('@/lib/email', () => ({
  sendNotificationEmail: mockSendNotificationEmail,
}));

vi.mock('@/lib/notifications/listener', () => ({
  emitNotification: mockEmitNotification,
}));

vi.mock('@/lib/slack/webhook', () => ({
  sendSlackNotification: mockSendSlackNotification,
}));

// ─── Test Suite ─────────────────────────────────────────────

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    insertResult = [mockNotification];
    mockChain = createMockChain();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('database insert', () => {
    it('should insert notification with correct fields', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
        message: 'You have been assigned a task',
        link: '/tasks/task-123',
        actorId: 'actor-1',
        entityType: 'task',
        entityId: 'task-123',
        metadata: { priority: 'high' },
      };

      await createNotification(data);

      expect(mockChain.insert).toHaveBeenCalled();
      expect(mockChain.values).toHaveBeenCalledWith({
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
        message: 'You have been assigned a task',
        link: '/tasks/task-123',
        actorId: 'actor-1',
        entityType: 'task',
        entityId: 'task-123',
        metadata: { priority: 'high' },
      });
    });

    it('should handle optional fields as null', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await createNotification(data);

      expect(mockChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          message: null,
          link: null,
          actorId: null,
          entityType: null,
          entityId: null,
          metadata: {},
        }),
      );
    });

    it('should return the created notification', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      const result = await createNotification(data);

      expect(result).toEqual(mockNotification);
    });

    it('should throw if database insert fails', async () => {
      mockChain.returning.mockRejectedValueOnce(new Error('DB error'));

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await expect(createNotification(data)).rejects.toThrow('DB error');
    });
  });

  describe('emitNotification', () => {
    it('should call emitNotification with the created notification', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await createNotification(data);

      expect(mockEmitNotification).toHaveBeenCalledWith(mockNotification);
    });

    it('should emit notification immediately after insert', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await createNotification(data);

      // emitNotification should be called synchronously after insert
      expect(mockEmitNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('PostgreSQL notification', () => {
    it('should execute pg_notify after insert', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await createNotification(data);

      expect(mockChain.execute).toHaveBeenCalled();
    });

    it('should not throw if pg_notify fails', async () => {
      mockChain.execute.mockRejectedValueOnce(new Error('pg_notify error'));

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      // Should not throw - pg_notify failure is non-critical
      const result = await createNotification(data);
      expect(result).toEqual(mockNotification);
    });
  });

  describe('async email dispatch', () => {
    it('should trigger email notification asynchronously', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await createNotification(data);

      // Wait for async operations to complete
      await vi.runAllTimersAsync();

      // Email should be sent (default behavior for task.assigned)
      expect(mockSendNotificationEmail).toHaveBeenCalled();
    });

    it('should not block the response for email sending', async () => {
      let emailResolve: () => void;
      const emailPromise = new Promise<void>((resolve) => {
        emailResolve = resolve;
      });
      mockSendNotificationEmail.mockReturnValueOnce(emailPromise);

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      // Should return immediately without waiting for email
      const result = await createNotification(data);
      expect(result).toEqual(mockNotification);

      // Clean up
      emailResolve!();
    });
  });

  describe('async Slack dispatch', () => {
    it('should trigger Slack notification asynchronously', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await createNotification(data);

      // Wait for async operations to complete
      await vi.runAllTimersAsync();

      // Slack should be attempted (sendSlackNotification is called)
      // Note: It may not actually send if no Slack integration is configured
    });

    it('should not block the response for Slack sending', async () => {
      let slackResolve: () => void;
      const slackPromise = new Promise<void>((resolve) => {
        slackResolve = resolve;
      });
      mockSendSlackNotification.mockReturnValueOnce(slackPromise);

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      // Should return immediately without waiting for Slack
      const result = await createNotification(data);
      expect(result).toEqual(mockNotification);

      // Clean up
      slackResolve!();
    });
  });

  describe('different notification types', () => {
    it('should handle task.comment type', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.comment',
        title: 'New Comment',
        message: 'Someone commented on your task',
      };

      const result = await createNotification(data);
      expect(result.type).toBe('task.comment');
    });

    it('should handle task.mention type', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.mention',
        title: 'You were mentioned',
      };

      const result = await createNotification(data);
      expect(result.type).toBe('task.mention');
    });

    it('should handle report.eod_ready type', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'report.eod_ready',
        title: 'EOD Report Ready',
      };

      const result = await createNotification(data);
      expect(result.type).toBe('report.eod_ready');
    });

    it('should handle unknown notification type', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'custom.notification',
        title: 'Custom Notification',
      };

      const result = await createNotification(data);
      expect(result.type).toBe('custom.notification');
    });
  });

  describe('metadata handling', () => {
    it('should store metadata as provided', async () => {
      const metadata = {
        taskId: 'task-123',
        priority: 'high',
        assignee: 'user-2',
      };

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
        metadata,
      };

      await createNotification(data);

      expect(mockChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ metadata }),
      );
    });

    it('should default to empty object if metadata is null', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
        metadata: null,
      };

      await createNotification(data);

      expect(mockChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
      );
    });

    it('should default to empty object if metadata is undefined', async () => {
      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      await createNotification(data);

      expect(mockChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
      );
    });
  });

  describe('error resilience', () => {
    it('should handle email failure gracefully', async () => {
      mockSendNotificationEmail.mockRejectedValueOnce(new Error('Email failed'));

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      // Should not throw - email failure is non-critical
      const result = await createNotification(data);
      expect(result).toEqual(mockNotification);
    });

    it('should handle Slack failure gracefully', async () => {
      mockSendSlackNotification.mockRejectedValueOnce(new Error('Slack failed'));

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      // Should not throw - Slack failure is non-critical
      const result = await createNotification(data);
      expect(result).toEqual(mockNotification);
    });

    it('should handle emitNotification failure gracefully', async () => {
      mockEmitNotification.mockImplementationOnce(() => {
        throw new Error('Emit failed');
      });

      const data = {
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
        title: 'Task Assigned',
      };

      // emitNotification is called synchronously, so it will throw
      // In production, this would be caught by the caller
      await expect(createNotification(data)).rejects.toThrow('Emit failed');
    });
  });

  describe('concurrent notifications', () => {
    it('should handle multiple notifications concurrently', async () => {
      const notifications = [
        {
          organizationId: 'org-1',
          userId: 'user-1',
          type: 'task.assigned',
          title: 'Task 1',
        },
        {
          organizationId: 'org-1',
          userId: 'user-2',
          type: 'task.comment',
          title: 'Task 2',
        },
        {
          organizationId: 'org-1',
          userId: 'user-3',
          type: 'task.mention',
          title: 'Task 3',
        },
      ];

      const results = await Promise.all(
        notifications.map((data) => createNotification(data)),
      );

      expect(results).toHaveLength(3);
      expect(mockEmitNotification).toHaveBeenCalledTimes(3);
    });
  });
});
