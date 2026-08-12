import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@workmanagement/database';
import {
  hasTestDb,
  testDb,
  resetDb,
  insertOrg,
  insertUser,
  insertLeaveType,
  insertLeaveBalance,
  insertLeaveRequest,
} from './helpers/db';

/**
 * WM-001 — approving a leave request must be atomic and race-safe: N concurrent
 * approvals of the same pending request must yield exactly one success and a
 * single balance deduction (the pre-fix bug approved it many times and
 * over-deducted). This mirrors the route's transaction (conditional
 * `UPDATE … WHERE status='pending' RETURNING` + atomic balance SQL) and fires
 * it concurrently against real Postgres, so the row-locking guarantee is
 * asserted — not just proven by construction.
 */

type Outcome = 'ok' | 'invalid_state' | 'not_found';

/** Faithful replica of the approve route's atomic transaction. */
async function approveOnce(reqId: string, orgId: string, reviewerId: string): Promise<Outcome> {
  return testDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.leaveRequests)
      .where(and(eq(schema.leaveRequests.id, reqId), eq(schema.leaveRequests.organizationId, orgId)))
      .limit(1);

    if (!existing) return 'not_found';
    if (existing.status !== 'pending') return 'invalid_state';

    const [approved] = await tx
      .update(schema.leaveRequests)
      .set({ status: 'approved', reviewedBy: reviewerId, reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.leaveRequests.id, reqId), eq(schema.leaveRequests.status, 'pending')))
      .returning();

    if (!approved) return 'invalid_state';

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
          eq(schema.leaveBalances.organizationId, orgId),
        ),
      );

    return 'ok';
  });
}

describe.skipIf(!hasTestDb)('WM-001 — concurrent leave approval is atomic', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lets exactly one of N concurrent approvals win, deducting the balance once', async () => {
    const orgId = await insertOrg();
    const userId = await insertUser();
    const reviewerId = await insertUser();
    const leaveTypeId = await insertLeaveType(orgId);
    await insertLeaveBalance(orgId, userId, leaveTypeId, 2026, { allocated: 20, used: 0, pending: 5 });
    const reqId = await insertLeaveRequest(orgId, userId, leaveTypeId, {
      daysCount: 5,
      startDate: '2026-03-02',
    });

    // Fire 12 concurrent approvals of the same pending request.
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () => approveOnce(reqId, orgId, reviewerId)),
    );

    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'invalid_state')).toHaveLength(11);

    // Request approved exactly once.
    const [req] = await testDb()
      .select({ status: schema.leaveRequests.status })
      .from(schema.leaveRequests)
      .where(eq(schema.leaveRequests.id, reqId));
    expect(req!.status).toBe('approved');

    // Balance deducted exactly once (not 12×): used 5, pending 0.
    const [bal] = await testDb()
      .select({ used: schema.leaveBalances.usedDays, pending: schema.leaveBalances.pendingDays })
      .from(schema.leaveBalances)
      .where(and(eq(schema.leaveBalances.userId, userId), eq(schema.leaveBalances.leaveTypeId, leaveTypeId)));
    expect(bal!.used).toBe(5);
    expect(bal!.pending).toBe(0);
  });

  it('rejects approval of an already-approved request (idempotent state machine)', async () => {
    const orgId = await insertOrg();
    const userId = await insertUser();
    const reviewerId = await insertUser();
    const leaveTypeId = await insertLeaveType(orgId);
    await insertLeaveBalance(orgId, userId, leaveTypeId, 2026, { used: 0, pending: 5 });
    const reqId = await insertLeaveRequest(orgId, userId, leaveTypeId, {
      daysCount: 5,
      startDate: '2026-03-02',
      status: 'approved',
    });

    expect(await approveOnce(reqId, orgId, reviewerId)).toBe('invalid_state');
  });
});
