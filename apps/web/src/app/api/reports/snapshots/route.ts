import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/reports/snapshots - List available report snapshots (rate limited: 60 req/min per user)
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'report:view');

      const { searchParams } = new URL(request.url);
      const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
      const type = searchParams.get('type'); // optional filter: 'eod' | 'weekly' | etc.

      const conditions = [eq(schema.reportSnapshots.organizationId, orgId!)];
      if (type) conditions.push(eq(schema.reportSnapshots.snapshotType, type));

      const snapshots = await db()
        .select({
          id: schema.reportSnapshots.id,
          snapshotDate: schema.reportSnapshots.snapshotDate,
          snapshotType: schema.reportSnapshots.snapshotType,
          label: schema.reportSnapshots.label,
          summary: schema.reportSnapshots.summary,
          generatedBy: schema.reportSnapshots.generatedBy,
          createdAt: schema.reportSnapshots.createdAt,
        })
        .from(schema.reportSnapshots)
        .where(and(...conditions))
        .orderBy(desc(schema.reportSnapshots.snapshotDate), desc(schema.reportSnapshots.createdAt))
        .limit(limit)
        .offset(offset);

      const [totalResult] = await db()
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(schema.reportSnapshots)
        .where(and(...conditions));

      return NextResponse.json({
        snapshots,
        total: totalResult?.total ?? 0,
        limit,
        offset,
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch report snapshots');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'reports:snapshots:list' },
);

// POST /api/reports/snapshots - Generate and store an immutable EOD report snapshot
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'report:generate');

      const body = await request.json().catch(() => ({}));
      const { label, snapshotType = 'eod' } = body;

      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]!;

      // ── Gather snapshot data ──────────────────────────────

      // Task counts by status
      const taskStatusCounts = await db()
        .select({
          status: schema.tasks.status,
          count: sql<number>`COUNT(*)::int`.as('count'),
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, orgId!),
            isNull(schema.tasks.deletedAt),
          ),
        )
        .groupBy(schema.tasks.status);

      // Task counts by priority
      const taskPriorityCounts = await db()
        .select({
          priority: schema.tasks.priority,
          count: sql<number>`COUNT(*)::int`.as('count'),
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, orgId!),
            isNull(schema.tasks.deletedAt),
          ),
        )
        .groupBy(schema.tasks.priority);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      // Tasks overdue (past due date and not completed/closed/cancelled/archived)
      const [overdueResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, orgId!),
            isNull(schema.tasks.deletedAt),
            sql`${schema.tasks.dueDate} < ${todayStart}`,
            sql`${schema.tasks.status} NOT IN ('completed', 'closed', 'cancelled', 'archived')`,
          ),
        );

      // Tasks created today
      const [createdTodayResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, orgId!),
            isNull(schema.tasks.deletedAt),
            sql`${schema.tasks.createdAt} >= ${todayStart}`,
            sql`${schema.tasks.createdAt} < ${todayEnd}`,
          ),
        );

      // Tasks completed today
      const [completedTodayResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, orgId!),
            isNull(schema.tasks.deletedAt),
            sql`${schema.tasks.status} = 'completed'`,
            sql`${schema.tasks.completedAt} >= ${todayStart}`,
            sql`${schema.tasks.completedAt} < ${todayEnd}`,
          ),
        );

      // Total task count
      const [totalTasksResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, orgId!),
            isNull(schema.tasks.deletedAt),
          ),
        );

      // Project counts by status
      const projectStatusCounts = await db()
        .select({
          status: schema.projects.status,
          count: sql<number>`COUNT(*)::int`.as('count'),
        })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.organizationId, orgId!),
            isNull(schema.projects.deletedAt),
          ),
        )
        .groupBy(schema.projects.status);

      // Total projects
      const [totalProjectsResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.organizationId, orgId!),
            isNull(schema.projects.deletedAt),
          ),
        );

      // User counts
      const [activeUsersResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.organizationId, orgId!),
            isNull(schema.users.deletedAt),
            eq(schema.users.isActive, true),
            eq(schema.users.isSuspended, false),
          ),
        );

      const [totalUsersResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.organizationId, orgId!),
            isNull(schema.users.deletedAt),
          ),
        );

      // Team count
      const [totalTeamsResult] = await db()
        .select({ count: sql<number>`COUNT(*)::int`.as('count') })
        .from(schema.teams)
        .where(
          and(
            eq(schema.teams.organizationId, orgId!),
            isNull(schema.teams.deletedAt),
          ),
        );

      // ── Build snapshot data ───────────────────────────────

      const byStatus: Record<string, number> = {};
      for (const row of taskStatusCounts) {
        byStatus[row.status ?? 'unknown'] = row.count;
      }

      const byPriority: Record<string, number> = {};
      for (const row of taskPriorityCounts) {
        byPriority[row.priority ?? 'none'] = row.count;
      }

      const byProjectStatus: Record<string, number> = {};
      for (const row of projectStatusCounts) {
        byProjectStatus[row.status ?? 'unknown'] = row.count;
      }

      const completedCount = byStatus['completed'] ?? 0;
      const totalTasks = totalTasksResult?.count ?? 0;
      const totalProjects = totalProjectsResult?.count ?? 0;

      const snapshotData = {
        timestamp: now.toISOString(),
        generatedBy: user.id,
        organizationId: orgId,
        date: dateStr,
        tasks: {
          total: totalTasks,
          byStatus,
          byPriority,
          overdue: overdueResult?.count ?? 0,
          createdThisPeriod: createdTodayResult?.count ?? 0,
          completedThisPeriod: completedTodayResult?.count ?? 0,
          completionRate: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
        },
        projects: {
          total: totalProjects,
          active: byProjectStatus['active'] ?? 0,
          byStatus: byProjectStatus,
        },
        users: {
          total: totalUsersResult?.count ?? 0,
          active: activeUsersResult?.count ?? 0,
        },
        teams: {
          total: totalTeamsResult?.count ?? 0,
        },
      };

      // ── Store immutable snapshot ──────────────────────────
      const summary = {
        totalTasks,
        completedCount,
        overdueCount: overdueResult?.count ?? 0,
        activeProjects: byProjectStatus['active'] ?? 0,
        totalUsers: totalUsersResult?.count ?? 0,
        completionRate: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
      };

      const [snapshot] = await db()
        .insert(schema.reportSnapshots)
        .values({
          organizationId: orgId!,
          snapshotDate: dateStr,
          snapshotType,
          label: label ?? null,
          snapshotData,
          summary,
          generatedBy: user.id,
        })
        .returning();

      if (!snapshot) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create report snapshot' } },
          { status: 500 },
        );
      }

      // Audit log
      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'report.generated',
        entityType: 'report_snapshot',
        entityId: snapshot.id,
        newValues: { date: dateStr, type: snapshotType, totalTasks, completedCount },
        metadata: { summary },
      });

      return NextResponse.json({ snapshot }, { status: 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to generate report snapshot');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 20, namespace: 'reports:snapshots:create' },
);
