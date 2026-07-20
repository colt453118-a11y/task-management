import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { getDb, schema } from '@workmanagement/database';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
// ─── Types ──────────────────────────────────────────────────────

type NotifInsert = typeof schema.notifications.$inferInsert;

// ─── GET — List notifications ───────────────────────────────────

async function listHandler(req: NextRequest, ctx: { user: { id: string }; orgId: string | null }) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
  const unreadOnly = searchParams.get('unread') === 'true';

  const db = getDb();

  const conditions = [
    eq(schema.notifications.userId, ctx.user.id),
    eq(schema.notifications.isDismissed, false),
  ];
  if (unreadOnly) {
    conditions.push(eq(schema.notifications.isRead, false));
  }

  const [notifs, totalResult, unreadResult] = await Promise.all([
    db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(and(...conditions)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, ctx.user.id),
          eq(schema.notifications.isRead, false),
          eq(schema.notifications.isDismissed, false),
        ),
      ),
  ]);

  return NextResponse.json({
    notifications: notifs,
    total: Number(totalResult[0]?.count ?? 0),
    unreadCount: Number(unreadResult[0]?.count ?? 0),
  });
}

// ─── POST — Create notification (server-to-server) or mark read ─

async function createOrMarkHandler(
  req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  const body = await req.json().catch(() => ({}));

  // ── Mark single notification as read ──────────────
  if (body.action === 'mark_read' && body.notificationId) {
    const db = getDb();
    await db
      .update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, body.notificationId),
          eq(schema.notifications.userId, ctx.user.id),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  // ── Mark all as read ─────────────────────────────
  if (body.action === 'mark_all_read') {
    const db = getDb();
    await db
      .update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, ctx.user.id),
          eq(schema.notifications.isRead, false),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  // ── Dismiss a notification ───────────────────────
  if (body.action === 'dismiss' && body.notificationId) {
    const db = getDb();
    await db
      .update(schema.notifications)
      .set({ isDismissed: true })
      .where(
        and(
          eq(schema.notifications.id, body.notificationId),
          eq(schema.notifications.userId, ctx.user.id),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  // ── Create notification (internal use) ───────────
  if (body.action === 'create') {
    if (!body.userId || !body.type || !body.title) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'userId, type, and title are required' } },
        { status: 400 },
      );
    }

    const db = getDb();
    const payload: NotifInsert = {
      userId: body.userId,
      organizationId: body.organizationId ?? ctx.orgId ?? '',
      type: body.type,
      title: body.title,
      message: body.message ?? null,
      link: body.link ?? null,
      actorId: body.actorId ?? null,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      metadata: body.metadata ?? {},
    };

    const [notif] = await db.insert(schema.notifications).values(payload).returning();
    return NextResponse.json({ notification: notif });
  }

  return NextResponse.json(
    { error: { code: 'INVALID_ACTION', message: 'Invalid action' } },
    { status: 400 },
  );
}

// ─── PATCH — Mark multiple notifications as read ───────────────

async function batchMarkHandler(
  req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids ?? [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No notification IDs provided' } },
      { status: 400 },
    );
  }

  const db = getDb();
  await db
    .update(schema.notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        inArray(schema.notifications.id, ids),
        eq(schema.notifications.userId, ctx.user.id),
      ),
    );

  return NextResponse.json({ ok: true });
}

// ─── DELETE — Dismiss a notification ───────────────────────────

async function dismissHandler(
  req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Notification ID is required' } },
      { status: 400 },
    );
  }

  const db = getDb();
  await db
    .update(schema.notifications)
    .set({ isDismissed: true })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, ctx.user.id)));

  return NextResponse.json({ ok: true });
}

// ─── Export routes ──────────────────────────────────────────────

export const GET = withAuth(listHandler, { windowMs: 60_000, max: 100, namespace: 'notifications:list' });
export const POST = withAuth(createOrMarkHandler, { windowMs: 60_000, max: 30, namespace: 'notifications:create' });
export const PATCH = withAuth(batchMarkHandler, { windowMs: 60_000, max: 30, namespace: 'notifications:mark' });
export const DELETE = withAuth(dismissHandler, { windowMs: 60_000, max: 30, namespace: 'notifications:dismiss' });
