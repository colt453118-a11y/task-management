import { withAuth } from '@/lib/auth/api-auth';
import { getDb, schema } from '@workmanagement/database';
import { eq, and, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

async function unreadCountHandler(
  _req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  const db = getDb();
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, ctx.user.id),
        eq(schema.notifications.isRead, false),
        eq(schema.notifications.isDismissed, false),
      ),
    );

  return NextResponse.json({ unreadCount: Number(result?.count ?? 0) });
}

export const GET = withAuth(unreadCountHandler);
