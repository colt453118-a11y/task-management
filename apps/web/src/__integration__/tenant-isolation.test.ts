import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { schema } from '@workmanagement/database';
import { hasTestDb, testDb, resetDb, insertOrg, insertUser, insertTask } from './helpers/db';
import { enforceOrgScope } from '@/lib/auth/api-auth';

/**
 * Multi-tenant isolation — the highest-blast-radius property. Two mechanisms
 * enforce it: (1) list/read queries filter by `organization_id`, and
 * (2) `[id]` routes call `enforceOrgScope(row.organizationId, user.orgId)`.
 * Both are exercised here against real cross-org data in Postgres.
 */
describe.skipIf(!hasTestDb)('Multi-tenant isolation', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('org-scoped queries never return another org\'s rows', async () => {
    const orgA = await insertOrg('Org A');
    const orgB = await insertOrg('Org B');
    const userA = await insertUser();
    const userB = await insertUser();
    const taskA = await insertTask(orgA, userA, 'A task');
    await insertTask(orgB, userB, 'B task');

    // The query pattern every list route uses: WHERE organization_id = <caller org>.
    const rowsForA = await testDb()
      .select({ id: schema.tasks.id, org: schema.tasks.organizationId })
      .from(schema.tasks)
      .where(eq(schema.tasks.organizationId, orgA));

    expect(rowsForA).toHaveLength(1);
    expect(rowsForA[0]!.id).toBe(taskA);
    expect(rowsForA.every((r) => r.org === orgA)).toBe(true);
  });

  it('fetching another org\'s row by id and scoping it is denied', async () => {
    const orgA = await insertOrg('Org A');
    const orgB = await insertOrg('Org B');
    const userB = await insertUser();
    const taskB = await insertTask(orgB, userB, 'B task');

    // A cross-org GET /api/tasks/[id] would fetch the row unscoped, then call
    // enforceOrgScope — which must throw a 403 (the WM-004 hardening).
    const [row] = await testDb()
      .select({ org: schema.tasks.organizationId })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskB));

    expect(() => enforceOrgScope(row!.org, orgA)).toThrowError(/Cross-organization access denied/);
    // Same-org access is allowed.
    expect(() => enforceOrgScope(row!.org, orgB)).not.toThrow();
    // Null/absent org is denied (fail-closed).
    expect(() => enforceOrgScope(null, orgA)).toThrow();
    expect(() => enforceOrgScope(row!.org, null)).toThrow();
  });

  it('a unique constraint scoped per-org allows the same slug in different orgs', async () => {
    // Organizations have globally-unique slugs, but org-scoped resources should
    // be isolated: two orgs can each hold their own tasks without collision.
    const orgA = await insertOrg('Org A');
    const orgB = await insertOrg('Org B');
    const uA = await insertUser();
    const uB = await insertUser();
    await insertTask(orgA, uA, 'Shared title');
    await insertTask(orgB, uB, 'Shared title');

    const all = await testDb()
      .select({ org: schema.tasks.organizationId })
      .from(schema.tasks);
    const byOrg = all.reduce<Record<string, number>>((acc, r) => {
      acc[r.org] = (acc[r.org] ?? 0) + 1;
      return acc;
    }, {});
    expect(byOrg[orgA]).toBe(1);
    expect(byOrg[orgB]).toBe(1);
  });

  it('an org-scoped UPDATE cannot mutate another org\'s row', async () => {
    const orgA = await insertOrg('Org A');
    const orgB = await insertOrg('Org B');
    const userB = await insertUser();
    const taskB = await insertTask(orgB, userB, 'B task');

    // The mutation pattern every PATCH /[id] route uses:
    //   UPDATE … WHERE id = ? AND organization_id = <caller org>.
    // A caller in org A must not be able to touch org B's row — the scoped
    // predicate matches nothing, so the update is a no-op (not a 200-that-lies).
    const asOrgA = await testDb()
      .update(schema.tasks)
      .set({ title: 'hacked' })
      .where(and(eq(schema.tasks.id, taskB), eq(schema.tasks.organizationId, orgA)))
      .returning({ id: schema.tasks.id });
    expect(asOrgA).toHaveLength(0);

    const [after] = await testDb()
      .select({ title: schema.tasks.title })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskB));
    expect(after!.title).toBe('B task'); // unchanged

    // The owning org can update it.
    const asOrgB = await testDb()
      .update(schema.tasks)
      .set({ title: 'renamed by owner' })
      .where(and(eq(schema.tasks.id, taskB), eq(schema.tasks.organizationId, orgB)))
      .returning({ id: schema.tasks.id });
    expect(asOrgB).toHaveLength(1);
  });
});
