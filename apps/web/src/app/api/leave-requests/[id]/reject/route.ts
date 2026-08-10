import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, and, sql } from 'drizzle-orm';
import { handleApiError } from '@/lib/api/db';

export const runtime = 'nodejs';

function getIdFromPath(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  return segments[3]!;
}

// POST /api/leave-requests/[id]/reject
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'time:manage');

      const id = getIdFromPath(request);
      const body = await request.json().catch(() => ({}));
      const reviewNote = body.reviewNote ?? null;
      const db = getDb();

      // Atomic + race-safe transition (see approve route for rationale): only one
      // concurrent reject wins the `pending` guard, and the pending-days release
      // is applied with atomic SQL inside the same transaction.
      const outcome = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(schema.leaveRequests)
          .where(
            and(
              eq(schema.leaveRequests.id, id),
              eq(schema.leaveRequests.organizationId, orgId!),
            ),
          )
          .limit(1);

        if (!existing) return { kind: 'not_found' as const };
        if (existing.status !== 'pending') return { kind: 'invalid_state' as const };

        const [rejected] = await tx
          .update(schema.leaveRequests)
          .set({
            status: 'rejected',
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewNote,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.leaveRequests.id, id),
              eq(schema.leaveRequests.status, 'pending'),
            ),
          )
          .returning();

        if (!rejected) return { kind: 'invalid_state' as const };

        // Release the reserved pending days atomically.
        const year = new Date(existing.startDate).getFullYear();
        await tx
          .update(schema.leaveBalances)
          .set({
            pendingDays: sql`GREATEST(0, ${schema.leaveBalances.pendingDays} - ${existing.daysCount})`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.leaveBalances.userId, existing.userId),
              eq(schema.leaveBalances.leaveTypeId, existing.leaveTypeId),
              eq(schema.leaveBalances.year, year),
              eq(schema.leaveBalances.organizationId, orgId!),
            ),
          );

        return { kind: 'ok' as const, rejected };
      });

      if (outcome.kind === 'not_found') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Leave request not found' } },
          { status: 404 },
        );
      }
      if (outcome.kind === 'invalid_state') {
        return NextResponse.json(
          { error: { code: 'INVALID_STATE', message: 'Only pending requests can be rejected' } },
          { status: 400 },
        );
      }

      return NextResponse.json({ request: outcome.rejected });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to reject leave request');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'leave:reject' },
);
