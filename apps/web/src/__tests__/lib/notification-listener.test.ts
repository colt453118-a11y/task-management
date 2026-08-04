import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  emitNotification,
  subscribeToBus,
  registerSSEConnection,
  getActiveConnectionCount,
  shutdownListener,
} from '@/lib/notifications/listener';
import type { NotificationEvent } from '@/lib/notifications/listener';

// ─── Mocks ──────────────────────────────────────────────────

// Mock database module
vi.mock('@workmanagement/database', () => ({
  getDb: vi.fn(),
  schema: {
    notifications: {
      id: 'id',
      userId: 'userId',
      isRead: 'isRead',
      isDismissed: 'isDismissed',
    },
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: string, value: unknown) => ({ field, value, type: 'eq' })),
  and: vi.fn((...args: unknown[]) => ({ args, type: 'and' })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    type: 'sql',
  })),
}));

// Mock postgres
vi.mock('postgres', () => ({
  default: vi.fn(() => ({
    listen: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
    end: vi.fn(),
  })),
}));

// ─── Test Helpers ────────────────────────────────────────────

function createMockNotification(overrides?: Partial<NotificationEvent>): NotificationEvent {
  return {
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
    ...overrides,
  };
}

function createMockController(): ReadableStreamDefaultController {
  const mockEnqueue = vi.fn();
  const mockClose = vi.fn();
  return {
    enqueue: mockEnqueue,
    close: mockClose,
    desiredSize: 1,
    error: vi.fn(),
  } as unknown as ReadableStreamDefaultController;
}

// ─── Test Suite ─────────────────────────────────────────────

describe('Notification Listener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up shared state between tests
    await shutdownListener();
  });

  // ═══════════════════════════════════════════════════════════════
  //  emitNotification
  // ═══════════════════════════════════════════════════════════════

  describe('emitNotification', () => {
    it('should emit notification to subscribed handlers', async () => {
      const notification = createMockNotification();
      const handler = vi.fn();

      subscribeToBus('user-1', handler);
      emitNotification(notification);

      expect(handler).toHaveBeenCalledWith(notification);
    });

    it('should emit to correct userId channel', async () => {
      const notification1 = createMockNotification({ userId: 'user-1' });
      const notification2 = createMockNotification({ userId: 'user-2' });
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      subscribeToBus('user-1', handler1);
      subscribeToBus('user-2', handler2);

      emitNotification(notification1);

      expect(handler1).toHaveBeenCalledWith(notification1);
      expect(handler2).not.toHaveBeenCalled();

      emitNotification(notification2);

      expect(handler2).toHaveBeenCalledWith(notification2);
      expect(handler1).not.toHaveBeenCalledWith(notification2);
    });

    it('should not emit to other users', async () => {
      const notification = createMockNotification({ userId: 'user-1' });
      const otherUserHandler = vi.fn();

      subscribeToBus('user-2', otherUserHandler);
      emitNotification(notification);

      expect(otherUserHandler).not.toHaveBeenCalled();
    });

    it('should emit to multiple subscribers for same user', async () => {
      const notification = createMockNotification({ userId: 'user-1' });
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      subscribeToBus('user-1', handler1);
      subscribeToBus('user-1', handler2);
      emitNotification(notification);

      expect(handler1).toHaveBeenCalledWith(notification);
      expect(handler2).toHaveBeenCalledWith(notification);
    });

    it('should handle notification with null optional fields', async () => {
      const notification = createMockNotification({
        message: null,
        link: null,
        actorId: null,
        entityType: null,
        entityId: null,
        metadata: null,
      });
      const handler = vi.fn();

      subscribeToBus('user-1', handler);
      emitNotification(notification);

      expect(handler).toHaveBeenCalledWith(notification);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  subscribeToBus
  // ═══════════════════════════════════════════════════════════════

  describe('subscribeToBus', () => {
    it('should return an unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = subscribeToBus('user-1', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop receiving events after unsubscribe', async () => {
      const notification = createMockNotification();
      const handler = vi.fn();

      const unsubscribe = subscribeToBus('user-1', handler);
      emitNotification(notification);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      emitNotification(notification);
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should allow multiple subscriptions for same user', async () => {
      const notification = createMockNotification();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = subscribeToBus('user-1', handler1);
      const unsub2 = subscribeToBus('user-1', handler2);

      emitNotification(notification);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      unsub1();
      emitNotification(notification);
      expect(handler1).toHaveBeenCalledTimes(1); // Unsubscribed
      expect(handler2).toHaveBeenCalledTimes(2); // Still subscribed

      unsub2();
    });

    it('should call handler with notification', async () => {
      const notification = createMockNotification();
      const handler = vi.fn();

      subscribeToBus('user-1', handler);
      emitNotification(notification);

      expect(handler).toHaveBeenCalledWith(notification);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  registerSSEConnection
  // ═══════════════════════════════════════════════════════════════

  describe('registerSSEConnection', () => {
    it('should return an unsubscribe function', async () => {
      const controller = createMockController();
      const unsubscribe = await registerSSEConnection('user-1', controller);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should increment active connection count', async () => {
      expect(getActiveConnectionCount()).toBe(0);

      const controller = createMockController();
      await registerSSEConnection('user-1', controller);

      expect(getActiveConnectionCount()).toBe(1);
    });

    it('should decrement count after unsubscribe', async () => {
      const controller = createMockController();
      const unsubscribe = await registerSSEConnection('user-1', controller);

      expect(getActiveConnectionCount()).toBe(1);

      await unsubscribe();
      expect(getActiveConnectionCount()).toBe(0);
    });

    it('should support multiple connections for same user', async () => {
      const controller1 = createMockController();
      const controller2 = createMockController();

      await registerSSEConnection('user-1', controller1);
      await registerSSEConnection('user-1', controller2);

      expect(getActiveConnectionCount()).toBe(2);
    });

    it('should support connections for different users', async () => {
      const controller1 = createMockController();
      const controller2 = createMockController();

      await registerSSEConnection('user-1', controller1);
      await registerSSEConnection('user-2', controller2);

      expect(getActiveConnectionCount()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  getActiveConnectionCount
  // ═══════════════════════════════════════════════════════════════

  describe('getActiveConnectionCount', () => {
    it('should return 0 when no connections', async () => {
      expect(getActiveConnectionCount()).toBe(0);
    });

    it('should return correct count after registrations', async () => {
      const controller1 = createMockController();
      const controller2 = createMockController();
      const controller3 = createMockController();

      await registerSSEConnection('user-1', controller1);
      await registerSSEConnection('user-1', controller2);
      await registerSSEConnection('user-2', controller3);

      expect(getActiveConnectionCount()).toBe(3);
    });

    it('should return correct count after unregistrations', async () => {
      const controller1 = createMockController();
      const controller2 = createMockController();

      const unsub1 = await registerSSEConnection('user-1', controller1);
      const unsub2 = await registerSSEConnection('user-2', controller2);

      expect(getActiveConnectionCount()).toBe(2);

      await unsub1();
      expect(getActiveConnectionCount()).toBe(1);

      await unsub2();
      expect(getActiveConnectionCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  shutdownListener
  // ═══════════════════════════════════════════════════════════════

  describe('shutdownListener', () => {
    it('should clean up all connections', async () => {
      const controller1 = createMockController();
      const controller2 = createMockController();

      await registerSSEConnection('user-1', controller1);
      await registerSSEConnection('user-2', controller2);

      expect(getActiveConnectionCount()).toBe(2);

      await shutdownListener();

      expect(getActiveConnectionCount()).toBe(0);
    });

    it('should remove all event listeners', async () => {
      const handler = vi.fn();

      subscribeToBus('user-1', handler);

      await shutdownListener();

      // After shutdown, emitting should not trigger handler
      const notification = createMockNotification();
      emitNotification(notification);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should be callable multiple times safely', async () => {
      await shutdownListener();
      await shutdownListener();
      await shutdownListener();

      // Should not throw
      expect(getActiveConnectionCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Integration: Full SSE Flow
  // ═══════════════════════════════════════════════════════════════

  describe('Integration: Full SSE Flow', () => {
    it('should deliver notification to registered SSE controller', async () => {
      const controller = createMockController();
      const notification = createMockNotification();

      // Register SSE connection
      await registerSSEConnection('user-1', controller);

      // Subscribe to bus for same user
      const handler = vi.fn();
      subscribeToBus('user-1', handler);

      // Emit notification
      emitNotification(notification);

      // Handler should receive notification
      expect(handler).toHaveBeenCalledWith(notification);
    });

    it('should handle multiple SSE connections for same user', async () => {
      const controller1 = createMockController();
      const controller2 = createMockController();

      await registerSSEConnection('user-1', controller1);
      await registerSSEConnection('user-1', controller2);

      expect(getActiveConnectionCount()).toBe(2);

      // Clean up
      const unsub1 = await registerSSEConnection('user-1', createMockController());
      await unsub1();
    });

    it('should isolate notifications between users', async () => {
      const user1Notification = createMockNotification({ userId: 'user-1', title: 'User 1 Notif' });
      const user2Notification = createMockNotification({ userId: 'user-2', title: 'User 2 Notif' });

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      subscribeToBus('user-1', handler1);
      subscribeToBus('user-2', handler2);

      emitNotification(user1Notification);
      expect(handler1).toHaveBeenCalledWith(user1Notification);
      expect(handler2).not.toHaveBeenCalled();

      emitNotification(user2Notification);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith(user2Notification);
    });

    it('should handle rapid notification bursts', async () => {
      const handler = vi.fn();
      subscribeToBus('user-1', handler);

      // Emit 10 notifications rapidly
      for (let i = 0; i < 10; i++) {
        emitNotification(createMockNotification({ id: `notif-${i}` }));
      }

      expect(handler).toHaveBeenCalledTimes(10);
    });

    it('should handle subscribe/unsubscribe/subscribe cycle', async () => {
      const notification = createMockNotification();
      const handler = vi.fn();

      // Subscribe
      const unsub = subscribeToBus('user-1', handler);
      emitNotification(notification);
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsub();
      emitNotification(notification);
      expect(handler).toHaveBeenCalledTimes(1);

      // Re-subscribe
      subscribeToBus('user-1', handler);
      emitNotification(notification);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});
