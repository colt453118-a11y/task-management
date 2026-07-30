import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, enforceOrgScope, requirePermission } from '@/lib/auth/api-auth';
import { buildCsvRow } from '@/lib/export/csv';
import { createAuditEntry } from '@/lib/audit';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

function getIdFromPath(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  // /api/reports/snapshots/[id]/export → [id] is at index 4
  return segments[4]!;
}

// GET /api/reports/snapshots/[id]/export
// Export a snapshot's full data as CSV.
// Rate limited: 20 req/min per user.
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'report:export');

      const id = getIdFromPath(request);

      // ── Fetch snapshot ──────────────────────────────────
      const [snapshot] = await db()
        .select()
        .from(schema.reportSnapshots)
        .where(eq(schema.reportSnapshots.id, id))
        .limit(1);

      if (!snapshot) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Report snapshot not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(snapshot.organizationId, orgId);

      // ── Parse data ──────────────────────────────────────
      const snapshotData = snapshot.snapshotData as Record<string, unknown> | null;
      const summary = snapshot.summary as Record<string, unknown> | null;

      let csvContent = '';

      // ── Metadata section ────────────────────────────────
      csvContent += buildCsvRow(['Snapshot Export']);
      csvContent += buildCsvRow(['']);
      csvContent += buildCsvRow(['Field', 'Value']);
      csvContent += buildCsvRow(['Label', snapshot.label ?? '']);
      csvContent += buildCsvRow(['Date', snapshot.snapshotDate]);
      csvContent += buildCsvRow(['Type', snapshot.snapshotType]);
      csvContent += buildCsvRow(['Generated At', snapshot.createdAt]);
      csvContent += buildCsvRow(['Snapshot ID', snapshot.id]);
      csvContent += buildCsvRow(['']);

      // ── Summary section ─────────────────────────────────
      if (summary) {
        csvContent += buildCsvRow(['Summary Metrics']);
        csvContent += buildCsvRow(['Metric', 'Value']);
        csvContent += buildCsvRow(['Total Tasks', String(summary.totalTasks ?? '')]);
        csvContent += buildCsvRow(['Completed', String(summary.completedCount ?? '')]);
        csvContent += buildCsvRow(['Overdue', String(summary.overdueCount ?? '')]);
        csvContent += buildCsvRow(['Active Projects', String(summary.activeProjects ?? '')]);
        csvContent += buildCsvRow(['Total Users', String(summary.totalUsers ?? '')]);
        csvContent += buildCsvRow(['Completion Rate', `${String(summary.completionRate ?? '')}%`]);
        csvContent += buildCsvRow(['']);
      }

      // ── AI Summary ──────────────────────────────────────
      if (summary?.aiSummary) {
        const aiText = summary.aiSummary as string;
        csvContent += buildCsvRow(['AI Summary']);
        csvContent += buildCsvRow([aiText]);
        csvContent += buildCsvRow(['']);
      }

      // ── Task Status Distribution ─────────────────────────
      if (snapshotData?.tasks) {
        const tasks = snapshotData.tasks as Record<string, unknown>;
        const byStatus = tasks.byStatus as Record<string, number> | undefined;

        if (byStatus && Object.keys(byStatus).length > 0) {
          csvContent += buildCsvRow(['Task Status Distribution']);
          csvContent += buildCsvRow(['Status', 'Count']);
          for (const [status, count] of Object.entries(byStatus)) {
            csvContent += buildCsvRow([status, String(count)]);
          }
          csvContent += buildCsvRow(['']);
        }

        // ── Task Priority Distribution ─────────────────────
        const byPriority = tasks.byPriority as Record<string, number> | undefined;
        if (byPriority && Object.keys(byPriority).length > 0) {
          csvContent += buildCsvRow(['Task Priority Distribution']);
          csvContent += buildCsvRow(['Priority', 'Count']);
          for (const [priority, count] of Object.entries(byPriority)) {
            csvContent += buildCsvRow([priority, String(count)]);
          }
          csvContent += buildCsvRow(['']);
        }

        // ── Task Activity ─────────────────────────────────
        csvContent += buildCsvRow(['Task Activity']);
        csvContent += buildCsvRow(['Metric', 'Value']);
        csvContent += buildCsvRow(['Total', String(tasks.total ?? '')]);
        csvContent += buildCsvRow(['Overdue', String(tasks.overdue ?? '')]);
        csvContent += buildCsvRow(['Created This Period', String(tasks.createdThisPeriod ?? '')]);
        csvContent += buildCsvRow(['Completed This Period', String(tasks.completedThisPeriod ?? '')]);
        csvContent += buildCsvRow(['Completion Rate', `${String(tasks.completionRate ?? '')}%`]);
        csvContent += buildCsvRow(['']);
      }

      // ── Project Status Distribution ─────────────────────
      if (snapshotData?.projects) {
        const projects = snapshotData.projects as Record<string, unknown>;
        const byStatus = projects.byStatus as Record<string, number> | undefined;

        csvContent += buildCsvRow(['Project Status Distribution']);
        csvContent += buildCsvRow(['Status', 'Count']);
        csvContent += buildCsvRow(['Total', String(projects.total ?? '')]);
        csvContent += buildCsvRow(['Active', String(projects.active ?? '')]);
        if (byStatus && Object.keys(byStatus).length > 0) {
          for (const [status, count] of Object.entries(byStatus)) {
            csvContent += buildCsvRow([status, String(count)]);
          }
        }
        csvContent += buildCsvRow(['']);
      }

      // ── Users & Teams ───────────────────────────────────
      if (snapshotData?.users || snapshotData?.teams) {
        csvContent += buildCsvRow(['People & Teams']);
        csvContent += buildCsvRow(['Metric', 'Value']);
        if (snapshotData.users) {
          const users = snapshotData.users as Record<string, unknown>;
          csvContent += buildCsvRow(['Total Users', String(users.total ?? '')]);
          csvContent += buildCsvRow(['Active Users', String(users.active ?? '')]);
        }
        if (snapshotData.teams) {
          const teams = snapshotData.teams as Record<string, unknown>;
          csvContent += buildCsvRow(['Teams', String(teams.total ?? '')]);
        }
        csvContent += buildCsvRow(['']);
      }

      // ── Timestamp ───────────────────────────────────────
      csvContent += buildCsvRow([`Exported: ${new Date().toISOString()}`]);

      // ── Audit ───────────────────────────────────────────
      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'report.exported',
        entityType: 'report_snapshot',
        entityId: snapshot.id,
        newValues: {
          snapshotDate: snapshot.snapshotDate,
          snapshotType: snapshot.snapshotType,
        },
        metadata: { exportedFrom: 'snapshot_detail' },
      });

      // ── Return CSV ──────────────────────────────────────
      const filename = `snapshot-${snapshot.snapshotDate}-${snapshot.snapshotType}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(Buffer.byteLength(csvContent, 'utf-8')),
        },
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to export snapshot');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 20, namespace: 'reports:snapshots:export' },
);
