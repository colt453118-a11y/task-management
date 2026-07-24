import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { eq, and, gt, desc, sql } from 'drizzle-orm';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events endpoint for real-time notification delivery.
 *
 * On connect:
 *   1. Authenticates the user via session cookie
 *   2. Sends all unread notifications as initial `notification` events
 *   3. Polls the database every 3 seconds for new notifications
 *   4. Sends `heartbeat` events every 15 seconds to keep the connection alive
 *   5. Cleans up on client disconnect
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
  const encoder = new TextEncoder();

  // Track last poll time — start with current time so we only get *new* notifications
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

      // ── Poll for new notifications every 3 seconds ────────
      const pollInterval = setInterval(async () => {
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

            // Fetch updated unread count
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

          // Update last poll time to now (use the latest notification timestamp if available)
          if (newNotifs.length > 0) {
            const latestTs = newNotifs[0]?.createdAt;
            if (latestTs && latestTs.getTime() > lastPollTime.getTime()) {
              lastPollTime = new Date(latestTs);
            }
          } else {
            // Still advance time so we don't re-fetch old ones
            lastPollTime = new Date();
          }
        } catch (err) {
          console.error('[SSE] Poll error:', err);
        }
      }, 3_000);

      // ── Heartbeat every 15 seconds ────────────────────────
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
        }
      }, 15_000);

      // ── Clean up on client disconnect ─────────────────────
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
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
