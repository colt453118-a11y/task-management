import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { ProjectCreateSchema, validationError } from '@/lib/api/validation';

export const runtime = 'nodejs';

// GET /api/projects - List projects (rate limited: 100 req/min per user)
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'project:view');

      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

      const conditions = [
        isNull(schema.projects.deletedAt),
        eq(schema.projects.organizationId, orgId!),
      ];
      if (status) conditions.push(eq(schema.projects.status, status));

      const projects = await db()
        .select()
        .from(schema.projects)
        .where(and(...conditions))
        .orderBy(desc(schema.projects.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ projects });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch projects');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'projects:list' },
);

// POST /api/projects - Create project (rate limited: 30 req/min per user)
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'project:create');

      const body = await request.json();
      const parsed = ProjectCreateSchema.safeParse(body);
      if (!parsed.success) {
        const { error: err, status } = validationError(parsed.error);
        return NextResponse.json(err, { status });
      }

      const { name, code, description, ownerId, departmentId, teamId, startDate, endDate } = parsed.data;

      // Validate owner is in same org
      const [owner] = await db()
        .select({ id: schema.users.id, organizationId: schema.users.organizationId })
        .from(schema.users)
        .where(and(eq(schema.users.id, ownerId), isNull(schema.users.deletedAt)))
        .limit(1);

      if (!owner) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Owner user not found' } },
          { status: 404 },
        );
      }

      if (owner.organizationId !== orgId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Cross-organization owner assignment denied' } },
          { status: 403 },
        );
      }

      const [project] = await db()
        .insert(schema.projects)
        .values({
          name,
          code,
          description,
          organizationId: orgId!,
          ownerId,
          departmentId,
          teamId,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          createdBy: user.id,
          updatedBy: user.id,
          status: 'active',
        })
        .returning();

      if (!project) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create project' } },
          { status: 500 },
        );
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'project.created',
        entityType: 'project',
        entityId: project.id,
        newValues: { name, code, status: 'active', ownerId },
      });

      return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to create project');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'projects:create' },
);
