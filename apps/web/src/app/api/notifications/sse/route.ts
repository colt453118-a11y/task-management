import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { eq, and, gt, desc, sql } from 'drizzle-orm';
import { getCurrentSession } from '@/lib/auth/session';
import { getUserStatus } from '@/lib/auth/api-auth';
import { registerSSEConnection, subscribeToBus } from '@/lib/notifications/listener';
import type { NotificationEvent } from '@/lib/notifications/listener';
import { revalidateStreamAuth } from '@/lib/notifications/stream-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** How often a live stream re-checks that its session/account is still valid. */
const REVALIDATE_INTERVAL_MS = 30_000;

/**
 * Server-Sent Events endpoint for real-time notification delivery.
 *
 * Architecture:
 * - Uses PostgreSQL LISTEN/NOTIFY for instant push (sub-10ms delivery)
 * - Falls back to a 30-second poll if LISTEN/NOTIFY fails or misses a message
 * - Heartbeat every 15 seconds keeps the connection alive through proxies
 * - Shared single-listener design: one DB connection for ALL SSE users
 *
 * Events sent over the stream:
 *   - `connected`    — initial handshake with userId
 *   - `notification` — one or more notification objects (batch)
 *   - `unread`       — updated unread count
 *   - `heartbeat`    — keep-alive signal
 *   - `error`        — server-side error
 */
export async function GET(req: NextRequest) {
  // ── Authenticate ───────────────────────────────────────────
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required for SSE' } },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  const sessionId = session.session.id;

  // Reject at the handshake if the account is no longer active (deactivated /
  // suspended / soft-deleted) — otherwise a deactivated-but-still-logged-in
  // user could open a fresh stream. Mid-stream revocation is handled by the
  // periodic re-check inside the stream (WM-008).
  const { isActive } = await getUserStatus(userId);
  if (!isActive) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Account is not active' } },
      { status: 403 },
    );
  }

  const encoder = new TextEncoder();

  // Track last poll time — used by the fallback poll only
  let lastPollTime = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      // ── Helper to enqueue an SSE event ────────────────────
      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream may already be closed
        }
      };

      // ── Send connection acknowledgement ───────────────────
      sendEvent('connected', { userId });

      // ── Send initial unread notifications ─────────────────
      try {
        const db = getDb();
        const initialNotifs = await db
          .select()
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, userId),
              eq(schema.notifications.isDismissed, false),
              eq(schema.notifications.isRead, false),
            ),
          )
          .orderBy(desc(schema.notifications.createdAt))
          .limit(50);

        if (initialNotifs.length > 0) {
          // Send in batches of 10 to avoid huge single messages
          for (let i = 0; i < initialNotifs.length; i += 10) {
            const batch = initialNotifs.slice(i, i + 10);
            sendEvent('notification', { notifications: batch });
          }
          sendEvent('unread', { count: initialNotifs.length });
        } else {
          sendEvent('unread', { count: 0 });
        }
      } catch (err) {
        console.error('[SSE] Failed to fetch initial notifications:', err);
        sendEvent('error', { message: 'Failed to load initial notifications' });
      }

      // ── Subscribe to the in-process notification bus ─────
      // This is the PRIMARY delivery path: ~0.1ms, no DB round-trip.
      // The bus delivers the full notification object directly from
      // createNotification() to this SSE controller.
      const unsubBus = subscribeToBus(userId, (notification: NotificationEvent) => {
        sendEvent('notification', { notifications: [notification] });
        // Fetch updated unread count after the notification
        pushUnreadFromBus(userId, sendEvent);
      });

      async function pushUnreadFromBus(uid: string, se: typeof sendEvent) {
        try {
          const db = getDb();
          const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.notifications)
            .where(
              and(
                eq(schema.notifications.userId, uid),
                eq(schema.notifications.isRead, false),
                eq(schema.notifications.isDismissed, false),
              ),
            );
          se('unread', { count: Number(result?.count ?? 0) });
        } catch {
          // Non-critical
        }
      }

      // ── Register with the shared LISTEN/NOTIFY listener ───
      // This handles notifications from OTHER server instances.
      // Wrapped in try/catch — failure degrades to fallback poll.
      let unregister: (() => void) | null = null;
      try {
        unregister = await registerSSEConnection(userId, controller);
      } catch (err) {
        console.error('[SSE] Failed to register listener:', err);
      }

      // ── Idempotent teardown for all timers/subscriptions ──
      // Each resource pushes its disposer onto `teardowns`; cleanup() runs
      // them once (client disconnect, enqueue failure, or revocation).
      let closed = false;
      const teardowns: Array<() => void> = [unsubBus];
      if (unregister) teardowns.push(unregister);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        for (const dispose of teardowns) {
          try {
            dispose();
          } catch {
            // best-effort
          }
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // ── Fallback poll (60s) — catches anything missed by ──
      // both the bus and LISTEN/NOTIFY (e.g., bus listener limit
      // exceeded, transient DB blip)
      const fallbackPoll = setInterval(async () => {
        try {
          const db = getDb();
          const newNotifs = await db
            .select()
            .from(schema.notifications)
            .where(
              and(
                eq(schema.notifications.userId, userId),
                eq(schema.notifications.isDismissed, false),
                gt(schema.notifications.createdAt, lastPollTime),
              ),
            )
            .orderBy(desc(schema.notifications.createdAt))
            .limit(20);

          if (newNotifs.length > 0) {
            sendEvent('notification', { notifications: newNotifs });

            const [unreadResult] = await db
              .select({ count: sql<number>`count(*)` })
              .from(schema.notifications)
              .where(
                and(
                  eq(schema.notifications.userId, userId),
                  eq(schema.notifications.isRead, false),
                  eq(schema.notifications.isDismissed, false),
                ),
              );
            sendEvent('unread', { count: Number(unreadResult?.count ?? 0) });
          }

          if (newNotifs.length > 0) {
            const latestTs = newNotifs[0]?.createdAt;
            if (latestTs && latestTs.getTime() > lastPollTime.getTime()) {
              lastPollTime = new Date(latestTs);
            }
          } else {
            lastPollTime = new Date();
          }
        } catch (err) {
          console.error('[SSE] Fallback poll error:', err);
        }
      }, 60_000);
      teardowns.push(() => clearInterval(fallbackPoll));

      // ── Heartbeat every 15 seconds ────────────────────────
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'));
        } catch {
          cleanup();
        }
      }, 15_000);
      teardowns.push(() => clearInterval(heartbeatInterval));

      // ── Re-validate session/account every 30s (WM-008) ────
      // The handshake authenticates once; without this a logged-out, expired,
      // or deactivated user would keep receiving live events until the tab
      // closes. On failure we notify the client and tear the stream down; it
      // reconnects and is rejected at the handshake (401/403).
      const revalidateInterval = setInterval(async () => {
        const result = await revalidateStreamAuth(sessionId, userId);
        if (!result.valid) {
          sendEvent('expired', { reason: result.reason });
          cleanup();
        }
      }, REVALIDATE_INTERVAL_MS);
      teardowns.push(() => clearInterval(revalidateInterval));

      // ── Clean up on client disconnect ─────────────────────
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
