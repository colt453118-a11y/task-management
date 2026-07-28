import { EventEmitter } from 'events';
import postgres from 'postgres';
import { getDb, schema } from '@workmanagement/database';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Channel name for PostgreSQL LISTEN/NOTIFY used by the notification system.
 */
const NOTIFICATION_CHANNEL = 'notification_channel';

/**
 * Event name emitted on the notification bus for each notification.
 * Concatenated with userId so each user only receives their own events.
 */
function busEvent(userId: string): string {
  return `notif:${userId}`;
}

// ─── Types ────────────────────────────────────────────────────

export interface NotificationEvent {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  isDismissed: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotifyPayload {
  userId: string;
  notificationId: string;
  type: string;
}

// ─── In-Process Notification Bus ──────────────────────────────
// An EventEmitter that delivers notifications directly to SSE
// controllers within the same Node.js process. This eliminates
// the DB round-trip for same-process notifications.
//
// Delivery hierarchy:
//   1. In-process bus (EventEmitter) — ~0.1ms, same process
//   2. PostgreSQL LISTEN/NOTIFY       — ~5ms, cross-process
//   3. Fallback poll (60s)            — safety net

const bus = new EventEmitter();
bus.setMaxListeners(0); // Unlimited listeners — one per SSE connection

// ─── Shared state ─────────────────────────────────────────────

/**
 * Registry of active SSE stream controllers grouped by userId.
 */
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

/** Unsubscribe function for the shared LISTEN connection. */
let unsubscribeListener: (() => Promise<void>) | null = null;

/** The dedicated postgres connection for LISTEN. */
let listenSql: ReturnType<typeof postgres> | null = null;

/** Guards against concurrent listener initialization. */
let listenerReady: Promise<void> | null = null;

// ─── Internal helpers ─────────────────────────────────────────

/**
 * Fetch a single notification by ID from the database.
 * Used by cross-process dispatch (LISTEN/NOTIFY path) where we
 * only receive userId + notificationId.
 */
async function fetchNotification(
  notificationId: string,
): Promise<NotificationEvent | null> {
  try {
    const db = getDb();
    const [notif] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, notificationId))
      .limit(1);
    return (notif as NotificationEvent | undefined) ?? null;
  } catch (err) {
    console.error('[notif-bus] Failed to fetch notification:', err);
    return null;
  }
}

/**
 * Fetch the unread count for a user and push an `unread` SSE event.
 */
async function pushUnreadCount(
  userId: string,
  sendEvent: (event: string, data: unknown) => void,
): Promise<void> {
  try {
    const db = getDb();
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false),
          eq(schema.notifications.isDismissed, false),
        ),
      );
    sendEvent('unread', { count: Number(result?.count ?? 0) });
  } catch {
    // Non-critical
  }
}

/**
 * Push a notification and updated unread count to all SSE controllers
 * registered for a userId.
 */
async function dispatchToUser(
  userId: string,
  notification: NotificationEvent,
): Promise<void> {
  const userConns = connections.get(userId);
  if (!userConns || userConns.size === 0) return;

  const encoder = new TextEncoder();
  const deadControllers: ReadableStreamDefaultController[] = [];

  // Push notification event to all surviving controllers
  for (const controller of userConns) {
    try {
      controller.enqueue(
        encoder.encode(
          `event: notification\ndata: ${JSON.stringify({ notifications: [notification] })}\n\n`,
        ),
      );
    } catch {
      deadControllers.push(controller);
    }
  }

  // Clean up dead controllers
  for (const dead of deadControllers) {
    userConns.delete(dead);
  }
  if (userConns.size === 0) {
    connections.delete(userId);
    return;
  }

  // Push updated unread count to surviving controllers
  const pushEvent = (event: string, data: unknown) => {
    for (const c of userConns) {
      try {
        c.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      } catch {
        /* skip — cleaned up on next dispatch */
      }
    }
  };
  await pushUnreadCount(userId, pushEvent);
}

/**
 * Handle a notification that arrived via PostgreSQL LISTEN/NOTIFY.
 * We only have userId + notificationId, so we must fetch from DB.
 */
async function handleListenNotification(userId: string, notificationId: string): Promise<void> {
  const notification = await fetchNotification(notificationId);
  if (!notification) return;
  await dispatchToUser(userId, notification);
}

/**
 * Start the shared PostgreSQL LISTEN connection.
 * Called once — subsequent calls are no-ops.
 */
async function ensureListener(): Promise<void> {
  if (listenerReady) return listenerReady;

  listenerReady = (async () => {
    try {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        console.warn('[notif-bus] DATABASE_URL not set — falling back to polling');
        return;
      }

      // Create a dedicated single-connection client for LISTEN
      const sql = postgres(connectionString, {
        max: 1,
        connection: {
          application_name: 'sse_notification_listener',
        },
      });

      listenSql = sql;

      // Listen for notifications from other processes
      const listenResult = await sql.listen(
        NOTIFICATION_CHANNEL,
        (payload: string) => {
          try {
            const parsed: NotifyPayload =
              typeof payload === 'string' ? JSON.parse(payload) : payload;
            handleListenNotification(parsed.userId, parsed.notificationId).catch((err) =>
              console.error('[notif-bus] listen dispatch error:', err),
            );
          } catch {
            // Ignore malformed payloads
          }
        },
      );

      unsubscribeListener = (listenResult as unknown as { unsubscribe: () => Promise<void> }).unsubscribe;
    } catch (err) {
      console.error('[notif-bus] Failed to start listener:', err);
      listenerReady = null; // Allow retry
    }
  })();

  return listenerReady;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Emit a notification on the in-process bus.
 * Called by createNotification() after the DB INSERT succeeds.
 * The notification is delivered instantly to all SSE controllers
 * for the target userId within the current process — no DB round-trip.
 */
export function emitNotification(notification: NotificationEvent): void {
  bus.emit(busEvent(notification.userId), notification);
}

/**
 * Subscribe to in-process notifications for a specific userId.
 * Returns an unsubscribe function. Call it on SSE connection close.
 */
export function subscribeToBus(
  userId: string,
  handler: (notification: NotificationEvent) => void,
): () => void {
  const event = busEvent(userId);
  bus.on(event, handler);
  return () => {
    bus.off(event, handler);
  };
}

/**
 * Register an SSE stream controller for a given userId.
 * The controller will receive real-time notification events via:
 *   1. In-process EventEmitter bus (instant, ~0.1ms)
 *   2. PostgreSQL LISTEN/NOTIFY (cross-process, ~5ms)
 *
 * Returns an unsubscribe function that removes the controller
 * from the registry. Call it on SSE connection close.
 */
export async function registerSSEConnection(
  userId: string,
  controller: ReadableStreamDefaultController,
): Promise<() => void> {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);

  // Start the shared LISTEN connection for cross-process notifications
  ensureListener().catch(() => {
    /* listener failures degrade to fallback poll */
  });

  return () => {
    const userConns = connections.get(userId);
    if (!userConns) return;
    userConns.delete(controller);
    if (userConns.size === 0) {
      connections.delete(userId);
    }
  };
}

/**
 * Get the number of active SSE connections (for monitoring).
 */
export function getActiveConnectionCount(): number {
  let count = 0;
  for (const conns of connections.values()) {
    count += conns.size;
  }
  return count;
}

/**
 * Clean shutdown — unsubscribe from LISTEN and close the connection.
 */
export async function shutdownListener(): Promise<void> {
  if (unsubscribeListener) {
    await unsubscribeListener();
    unsubscribeListener = null;
  }
  if (listenSql) {
    await listenSql.end();
    listenSql = null;
  }
  listenerReady = null;
  bus.removeAllListeners();
  connections.clear();
}
