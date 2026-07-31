import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, and, desc } from 'drizzle-orm';
import { handleApiError } from '@/lib/api/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const BalanceCreateSchema = z.object({
  userId: z.string().min(1),
  leaveTypeId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  allocatedDays: z.number().int().min(0).max(365),
  notes: z.string().max(500).optional().nullable(),
});

// GET /api/leave-balances — List leave balances
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') ?? user.id;
      const year = url.searchParams.get('year')
        ? parseInt(url.searchParams.get('year')!)
        : new Date().getFullYear();

      const db = getDb();
      const balances = await db
        .select({
          id: schema.leaveBalances.id,
          userId: schema.leaveBalances.userId,
          leaveTypeId: schema.leaveBalances.leaveTypeId,
          year: schema.leaveBalances.year,
          allocatedDays: schema.leaveBalances.allocatedDays,
          usedDays: schema.leaveBalances.usedDays,
          pendingDays: schema.leaveBalances.pendingDays,
          notes: schema.leaveBalances.notes,
          leaveType: {
            id: schema.leaveTypes.id,
            name: schema.leaveTypes.name,
            slug: schema.leaveTypes.slug,
            color: schema.leaveTypes.color,
            icon: schema.leaveTypes.icon,
            description: schema.leaveTypes.description,
          },
        })
        .from(schema.leaveBalances)
        .leftJoin(schema.leaveTypes, eq(schema.leaveBalances.leaveTypeId, schema.leaveTypes.id))
        .where(
          and(
            eq(schema.leaveBalances.organizationId, orgId!),
            eq(schema.leaveBalances.userId, userId),
            eq(schema.leaveBalances.year, year),
          ),
        )
        .orderBy(desc(schema.leaveBalances.year));

      return NextResponse.json({ balances });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch leave balances');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'leave:balances' },
);

// POST /api/leave-balances — Create or update a leave balance (admin only)
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'time:manage');

      const body = await request.json();
      const parsed = BalanceCreateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') } },
          { status: 400 },
        );
      }

      const { userId: targetUserId, leaveTypeId, year, allocatedDays, notes } = parsed.data;
      const db = getDb();

      // Check if balance already exists for this user/type/year
      const existing = await db
        .select()
        .from(schema.leaveBalances)
        .where(
          and(
            eq(schema.leaveBalances.userId, targetUserId),
            eq(schema.leaveBalances.leaveTypeId, leaveTypeId),
            eq(schema.leaveBalances.year, year),
            eq(schema.leaveBalances.organizationId, orgId!),
          ),
        )
        .limit(1);

      let balance;
      if (existing.length > 0) {
        [balance] = await db
          .update(schema.leaveBalances)
          .set({
            allocatedDays,
            notes: notes ?? null,
            updatedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.leaveBalances.id, existing[0]!.id))
          .returning();
      } else {
        [balance] = await db
          .insert(schema.leaveBalances)
          .values({
            organizationId: orgId!,
            userId: targetUserId,
            leaveTypeId,
            year,
            allocatedDays,
            notes: notes ?? null,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();
      }

      return NextResponse.json({ balance }, { status: existing.length > 0 ? 200 : 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to save leave balance');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'leave:balance-manage' },
);
