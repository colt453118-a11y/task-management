import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth } from '@/lib/auth/api-auth';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export type ActivityFeedItem = {
  id: string;
  type: 'task_update' | 'comment' | 'audit';
  action: string;
  description: string | null;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  taskId: string | null;
  taskTitle: string | null;
  projectId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// GET /api/activity-feed - Get org-wide activity feed
// Returns up to 50 recent activities combining task history + comments + audit logs
export const GET = withAuth(
  async (_request: NextRequest, _context: { user: { id: string }; orgId: string | null }) => {
    try {
      const { orgId } = _context;
      if (!orgId) {
        return NextResponse.json(
          { error: { code: 'NO_ORG', message: 'User has no organization' } },
          { status: 400 },
        );
      }

      // ─── Fetch from 3 sources in parallel ──────────────
      const LIMIT = 50;

      const [taskHistory, comments, auditEntries] = await Promise.all([
        // 1. Task history
        db()
          .select({
            id: schema.taskHistory.id,
            type: sql<string>`'task_update'`.as('type'),
            action: schema.taskHistory.changeType,
            description: schema.taskHistory.description,
            userId: schema.taskHistory.userId,
            userName: schema.users.name,
            userAvatar: schema.users.avatarUrl,
            taskId: schema.taskHistory.taskId,
            taskTitle: schema.tasks.title,
            projectId: schema.tasks.projectId,
            entityType: sql<string | null>`NULL`,
            entityId: sql<string | null>`NULL`,
            metadata: sql<Record<string, unknown> | null>`jsonb_build_object(
              'field', ${schema.taskHistory.field},
              'oldValue', ${schema.taskHistory.oldValue},
              'newValue', ${schema.taskHistory.newValue}
            )`,
            createdAt: schema.taskHistory.createdAt,
          })
          .from(schema.taskHistory)
          .innerJoin(schema.tasks, eq(schema.taskHistory.taskId, schema.tasks.id))
          .leftJoin(schema.users, eq(schema.taskHistory.userId, schema.users.id))
          .where(
            and(
              eq(schema.tasks.organizationId, orgId),
              isNull(schema.tasks.deletedAt),
            ),
          )
          .orderBy(desc(schema.taskHistory.createdAt))
          .limit(LIMIT),

        // 2. Task comments
        db()
          .select({
            id: schema.taskComments.id,
            type: sql<string>`'comment'`.as('type'),
            action: sql<string>`'comment.added'`.as('action'),
            description: sql<string | null>`left(${schema.taskComments.content}, 200)`,
            userId: schema.taskComments.userId,
            userName: schema.users.name,
            userAvatar: schema.users.avatarUrl,
            taskId: schema.taskComments.taskId,
            taskTitle: schema.tasks.title,
            projectId: schema.tasks.projectId,
            entityType: sql<string | null>`NULL`,
            entityId: sql<string | null>`NULL`,
            metadata: sql<Record<string, unknown> | null>`jsonb_build_object(
              'commentId', ${schema.taskComments.id}
            )`,
            createdAt: schema.taskComments.createdAt,
          })
          .from(schema.taskComments)
          .innerJoin(schema.tasks, eq(schema.taskComments.taskId, schema.tasks.id))
          .leftJoin(schema.users, eq(schema.taskComments.userId, schema.users.id))
          .where(
            and(
              eq(schema.tasks.organizationId, orgId),
              isNull(schema.tasks.deletedAt),
              isNull(schema.taskComments.deletedAt),
            ),
          )
          .orderBy(desc(schema.taskComments.createdAt))
          .limit(LIMIT),

        // 3. Audit logs (relevant actions only)
        db()
          .select({
            id: schema.auditLogs.id,
            type: sql<string>`'audit'`.as('type'),
            action: schema.auditLogs.action,
            description: sql<string | null>`NULL`,
            userId: schema.auditLogs.userId,
            userName: schema.users.name,
            userAvatar: schema.users.avatarUrl,
            taskId: sql<string | null>`NULL`,
            taskTitle: sql<string | null>`NULL`,
            projectId: sql<string | null>`NULL`,
            entityType: schema.auditLogs.entityType,
            entityId: schema.auditLogs.entityId,
            metadata: sql<Record<string, unknown> | null>`jsonb_build_object(
              'action', ${schema.auditLogs.action},
              'entityType', ${schema.auditLogs.entityType},
              'entityId', ${schema.auditLogs.entityId}
            )`,
            createdAt: schema.auditLogs.createdAt,
          })
          .from(schema.auditLogs)
          .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
          .where(
            and(
              eq(schema.auditLogs.organizationId, orgId),
              // Only include relevant org-wide events
              sql`${schema.auditLogs.action} IN ('task.created','task.status_changed','task.assigned','task.completed','task.closed','task.reopened')`,
            ),
          )
          .orderBy(desc(schema.auditLogs.createdAt))
          .limit(LIMIT),
      ]);

      // ─── Combine, normalize dates, sort, and slice ─────
      const normalizeDate = (d: Date | string): string =>
        typeof d === 'string' ? d : d.toISOString();

      const combined: ActivityFeedItem[] = [
        ...taskHistory.map((r) => ({ ...(r as unknown as ActivityFeedItem), createdAt: normalizeDate((r as { createdAt: Date }).createdAt) })),
        ...comments.map((r) => ({ ...(r as unknown as ActivityFeedItem), createdAt: normalizeDate((r as { createdAt: Date }).createdAt) })),
        ...auditEntries.map((r) => ({ ...(r as unknown as ActivityFeedItem), createdAt: normalizeDate((r as { createdAt: Date }).createdAt) })),
      ];
      combined.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const items = combined.slice(0, LIMIT);

      return NextResponse.json({ items });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch activity feed');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'activity-feed:list' },
);
