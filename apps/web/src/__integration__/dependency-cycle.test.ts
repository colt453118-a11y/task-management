import { describe, it, expect, beforeEach } from 'vitest';
import { inArray } from 'drizzle-orm';
import { schema } from '@workmanagement/database';
import { hasTestDb, testDb, resetDb, insertOrg, insertUser, insertTask } from './helpers/db';
import { wouldCreateCycle } from '@/lib/api/dependency-cycle';

/**
 * WM-013 — task dependencies must stay acyclic. `wouldCreateCycle` walks the
 * depends-on graph; here it runs against a real `task_dependencies` graph via a
 * live `fetchDeps`, so the traversal + termination are asserted end-to-end.
 */
describe.skipIf(!hasTestDb)('WM-013 — dependency acyclicity over a real graph', () => {
  beforeEach(async () => {
    await resetDb();
  });

  const fetchDeps = async (ids: string[]): Promise<string[]> => {
    const rows = await testDb()
      .select({ d: schema.taskDependencies.dependsOnTaskId })
      .from(schema.taskDependencies)
      .where(inArray(schema.taskDependencies.taskId, ids));
    return rows.map((r) => r.d);
  };

  it('detects a transitive cycle but allows a non-closing edge', async () => {
    const org = await insertOrg();
    const user = await insertUser();
    const a = await insertTask(org, user, 'A');
    const b = await insertTask(org, user, 'B');
    const c = await insertTask(org, user, 'C');
    const db = testDb();

    // A → B → C  (A depends on B, B depends on C)
    await db.insert(schema.taskDependencies).values([
      { taskId: a, dependsOnTaskId: b },
      { taskId: b, dependsOnTaskId: c },
    ]);

    // Adding C → A closes the loop (A already transitively depends on C).
    expect(await wouldCreateCycle(c, a, fetchDeps)).toBe(true);
    // Adding A → C does not (C depends on nothing).
    expect(await wouldCreateCycle(a, c, fetchDeps)).toBe(false);
    // A brand-new unrelated edge is fine.
    const d = await insertTask(org, user, 'D');
    expect(await wouldCreateCycle(d, a, fetchDeps)).toBe(false);
  });

  it('terminates on a pre-existing stored cycle', async () => {
    const org = await insertOrg();
    const user = await insertUser();
    const x = await insertTask(org, user, 'X');
    const y = await insertTask(org, user, 'Y');
    const db = testDb();

    // Directly store a 2-cycle X ↔ Y (bypassing the guard) to prove the
    // visited-set stops the BFS from hanging.
    await db.insert(schema.taskDependencies).values([
      { taskId: x, dependsOnTaskId: y },
      { taskId: y, dependsOnTaskId: x },
    ]);

    // Should return without hanging.
    const result = await wouldCreateCycle(x, y, fetchDeps);
    expect(typeof result).toBe('boolean');
  });
});
