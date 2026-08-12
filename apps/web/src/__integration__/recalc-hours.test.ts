import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@workmanagement/database';
import { hasTestDb, testDb, resetDb, seedBase } from './helpers/db';
import { recalcTaskHours } from '@/lib/api/db';

/**
 * WM-014 — a task's cached `actualHours` is recomputed by a single atomic
 * SQL statement (SUM re-read at UPDATE time), so it can't lost-update under
 * concurrent recomputes. Exercised here against a real DB.
 */
describe.skipIf(!hasTestDb)('WM-014 — recalcTaskHours atomic recompute', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('sums committed time-entry minutes into actualHours (hours, 2dp)', async () => {
    const { userId, taskId } = await seedBase();
    const db = testDb();
    await db.insert(schema.timeEntries).values([
      { taskId, userId, startTime: new Date(), durationMinutes: 90, entryType: 'manual' },
      { taskId, userId, startTime: new Date(), durationMinutes: 30, entryType: 'manual' },
    ]);

    const result = await recalcTaskHours(taskId);
    expect(Number(result)).toBe(2); // 120 min / 60

    const [task] = await db
      .select({ h: schema.tasks.actualHours })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));
    expect(Number(task!.h)).toBe(2);
  });

  it('ignores null-duration (running) entries and rounds to 2dp', async () => {
    const { userId, taskId } = await seedBase();
    const db = testDb();
    await db.insert(schema.timeEntries).values([
      { taskId, userId, startTime: new Date(), durationMinutes: 50, entryType: 'manual' },
      { taskId, userId, startTime: new Date(), durationMinutes: null, entryType: 'timer' },
    ]);

    const result = await recalcTaskHours(taskId);
    expect(Number(result)).toBeCloseTo(0.83, 2); // 50/60 = 0.833 → 0.83
  });

  it('concurrent recomputes converge to the correct (non-stale) total', async () => {
    const { userId, taskId } = await seedBase();
    const db = testDb();
    await db.insert(schema.timeEntries).values([
      { taskId, userId, startTime: new Date(), durationMinutes: 60, entryType: 'manual' },
      { taskId, userId, startTime: new Date(), durationMinutes: 60, entryType: 'manual' },
    ]);

    // Two recomputes racing — the atomic single-statement form means the last
    // write always reflects the committed rows (no stale-read window).
    await Promise.all([recalcTaskHours(taskId), recalcTaskHours(taskId)]);

    const [task] = await db
      .select({ h: schema.tasks.actualHours })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));
    expect(Number(task!.h)).toBe(2);
  });
});
