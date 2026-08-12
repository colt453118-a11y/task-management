import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { schema } from '@workmanagement/database';
import { hasTestDb, testDb, resetDb, seedBase } from './helpers/db';
import { isUniqueViolation } from '@/lib/db-errors';

/**
 * WM-011 — starting a timer must be race-safe: a user can never end up with two
 * running timers. The invariant is enforced by the partial unique index
 * `idx_time_entries_one_running_timer`. Unit tests mock the DB, so this asserts
 * the real constraint under genuine concurrency (the gap WM-002 flagged).
 */
describe.skipIf(!hasTestDb)('WM-011 — one running timer per user', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects a second concurrent running timer for the same user', async () => {
    const { userId, taskId } = await seedBase();
    const db = testDb();

    const startTimer = () =>
      db.insert(schema.timeEntries).values({
        taskId,
        userId,
        startTime: new Date(),
        entryType: 'timer',
      });

    // Two "start timer" inserts fired concurrently — the check-then-insert
    // pattern would let both through; the DB index must reject one.
    const results = await Promise.allSettled([startTimer(), startTimer()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // The loser is exactly the 23505 the route maps to a friendly 409 — even
    // though Drizzle wraps it (the real error is on `.cause`). See WM-015.
    expect(
      isUniqueViolation(rejected[0]!.reason, 'idx_time_entries_one_running_timer'),
    ).toBe(true);

    const running = await db
      .select()
      .from(schema.timeEntries)
      .where(
        and(
          eq(schema.timeEntries.userId, userId),
          isNull(schema.timeEntries.endTime),
          eq(schema.timeEntries.entryType, 'timer'),
        ),
      );
    expect(running).toHaveLength(1);
  });

  it('allows a new timer once the previous one is stopped', async () => {
    const { userId, taskId } = await seedBase();
    const db = testDb();

    const [first] = await db
      .insert(schema.timeEntries)
      .values({ taskId, userId, startTime: new Date(), entryType: 'timer' })
      .returning({ id: schema.timeEntries.id });

    await db
      .update(schema.timeEntries)
      .set({ endTime: new Date() })
      .where(eq(schema.timeEntries.id, first!.id));

    await expect(
      db
        .insert(schema.timeEntries)
        .values({ taskId, userId, startTime: new Date(), entryType: 'timer' }),
    ).resolves.toBeDefined();
  });

  it('does not constrain concurrent open manual entries (only timers)', async () => {
    const { userId, taskId } = await seedBase();
    const db = testDb();

    await Promise.all([
      db.insert(schema.timeEntries).values({
        taskId, userId, startTime: new Date(), entryType: 'manual',
      }),
      db.insert(schema.timeEntries).values({
        taskId, userId, startTime: new Date(), entryType: 'manual',
      }),
    ]);

    const open = await db
      .select()
      .from(schema.timeEntries)
      .where(and(eq(schema.timeEntries.userId, userId), isNull(schema.timeEntries.endTime)));
    expect(open.length).toBe(2);
  });
});
