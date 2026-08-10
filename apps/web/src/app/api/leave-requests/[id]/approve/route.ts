import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, and, sql } from 'drizzle-orm';
import { handleApiError } from '@/lib/api/db';

export const runtime = 'nodejs';

function getIdFromPath(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  // Path: /api/leave-requests/[id]/approve → id is at index 3
  return segments[3]!;
}

// POST /api/leave-requests/[id]/approve
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'time:manage');

      const id = getIdFromPath(request);
      const body = await request.json().catch(() => ({}));
      const reviewNote = body.reviewNote ?? null;
      const db = getDb();

      // The status transition and the balance mutation must be atomic and
      // race-safe: two concurrent approvals of the same request must not both
      // succeed (which previously double-counted the balance). We do this in a
      // single transaction with a conditional UPDATE — only one caller can flip
      // `pending → approved`, and the balance is moved with atomic SQL (no
      // read-modify-write, so increments can never be lost).
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

        // Conditional transition — the `status = 'pending'` predicate is
        // re-checked under Postgres' row lock, so exactly one concurrent
        // approval wins; the rest match 0 rows.
        const [approved] = await tx
          .update(schema.leaveRequests)
          .set({
            status: 'approved',
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

        if (!approved) return { kind: 'invalid_state' as const };

        // Move pending days → used days atomically.
        const year = new Date(existing.startDate).getFullYear();
        await tx
          .update(schema.leaveBalances)
          .set({
            usedDays: sql`${schema.leaveBalances.usedDays} + ${existing.daysCount}`,
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

        return { kind: 'ok' as const, approved };
      });

      if (outcome.kind === 'not_found') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Leave request not found' } },
          { status: 404 },
        );
      }
      if (outcome.kind === 'invalid_state') {
        return NextResponse.json(
          { error: { code: 'INVALID_STATE', message: 'Only pending requests can be approved' } },
          { status: 400 },
        );
      }

      return NextResponse.json({ request: outcome.approved });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to approve leave request');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'leave:approve' },
);
