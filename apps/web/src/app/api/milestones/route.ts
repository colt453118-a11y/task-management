import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, desc, and, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/milestones - List milestones with project names
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'milestone:view');

      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId');
      const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 200);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

      const conditions = [
        isNull(schema.milestones.deletedAt),
        eq(schema.projects.organizationId, orgId!),
      ];
      if (projectId) conditions.push(eq(schema.milestones.projectId, projectId));

      const milestones = await db()
        .select({
          id: schema.milestones.id,
          projectId: schema.milestones.projectId,
          projectName: schema.projects.name,
          name: schema.milestones.name,
          description: schema.milestones.description,
          status: schema.milestones.status,
          dueDate: schema.milestones.dueDate,
          completedDate: schema.milestones.completedDate,
          sortOrder: schema.milestones.sortOrder,
          createdAt: schema.milestones.createdAt,
        })
        .from(schema.milestones)
        .innerJoin(
          schema.projects,
          and(
            eq(schema.milestones.projectId, schema.projects.id),
            isNull(schema.projects.deletedAt),
          ),
        )
        .where(and(...conditions))
        .orderBy(desc(schema.milestones.dueDate), desc(schema.milestones.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ milestones });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch milestones');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'milestones:list' },
);
