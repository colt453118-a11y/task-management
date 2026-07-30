import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, and } from 'drizzle-orm';
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
      const db = getDb();
      const [leaveRequest] = await db
        .select()
        .from(schema.leaveRequests)
        .where(
          and(
            eq(schema.leaveRequests.id, id),
            eq(schema.leaveRequests.organizationId, orgId!),
          ),
        )
        .limit(1);

      if (!leaveRequest) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Leave request not found' } },
          { status: 404 },
        );
      }

      if (leaveRequest.status !== 'pending') {
        return NextResponse.json(
          { error: { code: 'INVALID_STATE', message: 'Only pending requests can be approved' } },
          { status: 400 },
        );
      }

      const body = await request.json().catch(() => ({}));
      const reviewNote = body.reviewNote ?? null;

      const [approved] = await db
        .update(schema.leaveRequests)
        .set({
          status: 'approved',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewNote,
          updatedAt: new Date(),
        })
        .where(eq(schema.leaveRequests.id, id))
        .returning();

      // Move pending days to used days in balance
      const year = new Date(leaveRequest.startDate).getFullYear();
      const balance = await db
        .select()
        .from(schema.leaveBalances)
        .where(
          and(
            eq(schema.leaveBalances.userId, leaveRequest.userId),
            eq(schema.leaveBalances.leaveTypeId, leaveRequest.leaveTypeId),
            eq(schema.leaveBalances.year, year),
            eq(schema.leaveBalances.organizationId, orgId!),
          ),
        )
        .limit(1);

      if (balance.length > 0) {
        await db
          .update(schema.leaveBalances)
          .set({
            usedDays: balance[0]!.usedDays + leaveRequest.daysCount,
            pendingDays: Math.max(0, balance[0]!.pendingDays - leaveRequest.daysCount),
            updatedAt: new Date(),
          })
          .where(eq(schema.leaveBalances.id, balance[0]!.id));
      }

      return NextResponse.json({ request: approved });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to approve leave request');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'leave:approve' },
);
