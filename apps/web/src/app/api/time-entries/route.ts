import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth } from '@/lib/auth/api-auth';
import { eq, desc, and, isNull, isNotNull, sql, gte } from 'drizzle-orm';

export const runtime = 'nodejs';

// ─── GET /api/time-entries — List user's time entries across all tasks ──

export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const { searchParams } = request.nextUrl;
      const scope = searchParams.get('scope') ?? 'today'; // today | week | month | all
      const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let dateFilter;

      switch (scope) {
        case 'today':
          dateFilter = gte(schema.timeEntries.startTime, startOfDay);
          break;
        case 'week': {
          const weekAgo = new Date(startOfDay.getTime() - 7 * 86_400_000);
          dateFilter = gte(schema.timeEntries.startTime, weekAgo);
          break;
        }
        case 'month': {
          const monthAgo = new Date(startOfDay.getTime() - 30 * 86_400_000);
          dateFilter = gte(schema.timeEntries.startTime, monthAgo);
          break;
        }
        default:
          dateFilter = undefined;
      }

      const conditions = [
        eq(schema.timeEntries.userId, user.id),
        eq(schema.tasks.organizationId, orgId!),
        isNull(schema.tasks.deletedAt),
      ];

      if (dateFilter) {
        conditions.push(dateFilter);
      }

      const [entries, totalResult, summaryResult] = await Promise.all([
        db()
          .select({
            id: schema.timeEntries.id,
            taskId: schema.timeEntries.taskId,
            userId: schema.timeEntries.userId,
            startTime: schema.timeEntries.startTime,
            endTime: schema.timeEntries.endTime,
            durationMinutes: schema.timeEntries.durationMinutes,
            billableMinutes: schema.timeEntries.billableMinutes,
            entryType: schema.timeEntries.entryType,
            description: schema.timeEntries.description,
            isApproved: schema.timeEntries.isApproved,
            createdAt: schema.timeEntries.createdAt,
            task: {
              id: schema.tasks.id,
              title: schema.tasks.title,
              taskIdDisplay: schema.tasks.taskIdDisplay,
              status: schema.tasks.status,
              projectId: schema.tasks.projectId,
            },
          })
          .from(schema.timeEntries)
          .innerJoin(schema.tasks, eq(schema.timeEntries.taskId, schema.tasks.id))
          .where(and(...conditions))
          .orderBy(desc(schema.timeEntries.startTime))
          .limit(limit)
          .offset(offset),
        db()
          .select({ count: sql<number>`count(*)` })
          .from(schema.timeEntries)
          .innerJoin(schema.tasks, eq(schema.timeEntries.taskId, schema.tasks.id))
          .where(and(...conditions)),
        db()
          .select({
            totalMinutes: sql<number>`coalesce(sum(${schema.timeEntries.durationMinutes}), 0)`,
            billableMinutes: sql<number>`coalesce(sum(${schema.timeEntries.billableMinutes}), 0)`,
            entryCount: sql<number>`count(*)`,
            avgDuration: sql<number>`coalesce(avg(${schema.timeEntries.durationMinutes}), 0)`,
          })
          .from(schema.timeEntries)
          .innerJoin(schema.tasks, eq(schema.timeEntries.taskId, schema.tasks.id))
          .where(and(...conditions, isNotNull(schema.timeEntries.durationMinutes))),
      ]);

      // ── Group by task for breakdown ──
      const taskBreakdown = entries.reduce<
        Record<string, { taskId: string; title: string; taskIdDisplay: string; status: string; totalMinutes: number; count: number }>
      >((acc, entry) => {
        const key = entry.taskId;
        if (!acc[key]) {
          acc[key] = {
            taskId: entry.taskId,
            title: entry.task.title,
            taskIdDisplay: entry.task.taskIdDisplay,
            status: entry.task.status,
            totalMinutes: 0,
            count: 0,
          };
        }
        acc[key]!.totalMinutes += entry.durationMinutes ?? 0;
        acc[key]!.count += 1;
        return acc;
      }, {});

      return NextResponse.json({
        entries,
        total: Number(totalResult[0]?.count ?? 0),
        summary: {
          totalHours: (Number(summaryResult[0]?.totalMinutes ?? 0) / 60).toFixed(1),
          totalMinutes: Number(summaryResult[0]?.totalMinutes ?? 0),
          billableMinutes: Number(summaryResult[0]?.billableMinutes ?? 0),
          entryCount: Number(summaryResult[0]?.entryCount ?? 0),
          avgSessionMinutes: Math.round(Number(summaryResult[0]?.avgDuration ?? 0)),
        },
        taskBreakdown: Object.values(taskBreakdown)
          .sort((a, b) => b.totalMinutes - a.totalMinutes),
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch time entries');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'time-entries:global' },
);
