import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

// ─── Validation ────────────────────────────────────────────────

const MilestoneCreateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'delayed']).optional(),
  sortOrder: z.number().int().optional(),
});

const MilestoneUpdateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'delayed']).optional(),
  sortOrder: z.number().int().optional(),
});

// ─── GET /api/milestones - List milestones with project names ──

export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'milestone:view');

      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('projectId');
      const status = searchParams.get('status');
      const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 200);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

      const conditions = [
        isNull(schema.milestones.deletedAt),
        eq(schema.projects.organizationId, orgId!),
      ];
      if (projectId) conditions.push(eq(schema.milestones.projectId, projectId));
      if (status) conditions.push(eq(schema.milestones.status, status));

      const milestones = await db()
        .select({
          id: schema.milestones.id,
          projectId: schema.milestones.projectId,
          projectName: schema.projects.name,
          projectStatus: schema.projects.status,
          name: schema.milestones.name,
          description: schema.milestones.description,
          status: schema.milestones.status,
          dueDate: schema.milestones.dueDate,
          completedDate: schema.milestones.completedDate,
          sortOrder: schema.milestones.sortOrder,
          createdAt: schema.milestones.createdAt,
          updatedAt: schema.milestones.updatedAt,
          _taskCount: sql<number>`(
            SELECT COUNT(*) FROM ${schema.tasks}
            WHERE ${schema.tasks.milestoneId} = ${schema.milestones.id}
            AND ${schema.tasks.deletedAt} IS NULL
          )`,
          _completedTaskCount: sql<number>`(
            SELECT COUNT(*) FROM ${schema.tasks}
            WHERE ${schema.tasks.milestoneId} = ${schema.milestones.id}
            AND ${schema.tasks.status} = 'completed'
            AND ${schema.tasks.deletedAt} IS NULL
          )`,
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

// ─── POST /api/milestones - Create a milestone ────────────────

export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'milestone:create');

      const body = await request.json();
      const parsed = MilestoneCreateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.errors.map((e) => e.message).join(', '),
            },
          },
          { status: 400 },
        );
      }

      const { projectId, name, description, dueDate, status, sortOrder } = parsed.data;

      // Verify project belongs to org
      const [project] = await db()
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(
          and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId!)),
        )
        .limit(1);

      if (!project) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Project not found' } },
          { status: 404 },
        );
      }

      const [milestone] = await db()
        .insert(schema.milestones)
        .values({
          projectId,
          name,
          description: description ?? null,
          dueDate: dueDate ?? null,
          status: status ?? 'pending',
          sortOrder: sortOrder ?? 0,
        })
        .returning();

      if (!milestone) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create milestone' } },
          { status: 500 },
        );
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'milestone.created',
        entityType: 'milestone',
        entityId: milestone.id,
        newValues: { projectId, name, dueDate, status },
      });

      return NextResponse.json({ milestone }, { status: 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to create milestone');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'milestones:create' },
);

// ─── PATCH /api/milestones?id=xxx - Update a milestone ────────

export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'milestone:edit');

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Milestone ID is required' } },
          { status: 400 },
        );
      }

      const body = await request.json();
      const parsed = MilestoneUpdateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.errors.map((e) => e.message).join(', '),
            },
          },
          { status: 400 },
        );
      }

      // Verify ownership via project org
      const [existing] = await db()
        .select({ id: schema.milestones.id, projectId: schema.milestones.projectId })
        .from(schema.milestones)
        .innerJoin(schema.projects, eq(schema.milestones.projectId, schema.projects.id))
        .where(
          and(
            eq(schema.milestones.id, id),
            eq(schema.projects.organizationId, orgId!),
            isNull(schema.milestones.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Milestone not found' } },
          { status: 404 },
        );
      }

      const updateData: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
      if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate;
      if (parsed.data.status !== undefined) {
        updateData.status = parsed.data.status;
        if (parsed.data.status === 'completed') {
          updateData.completedDate = new Date().toISOString().split('T')[0];
        } else {
          updateData.completedDate = null;
        }
      }
      if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
      updateData.updatedAt = new Date();

      const [milestone] = await db()
        .update(schema.milestones)
        .set(updateData)
        .where(eq(schema.milestones.id, id))
        .returning();

      return NextResponse.json({ milestone });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update milestone');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'milestones:update' },
);

// ─── DELETE /api/milestones?id=xxx - Soft delete a milestone ──

export const DELETE = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'milestone:delete');

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Milestone ID is required' } },
          { status: 400 },
        );
      }

      const [existing] = await db()
        .select({ id: schema.milestones.id, name: schema.milestones.name })
        .from(schema.milestones)
        .innerJoin(schema.projects, eq(schema.milestones.projectId, schema.projects.id))
        .where(
          and(
            eq(schema.milestones.id, id),
            eq(schema.projects.organizationId, orgId!),
            isNull(schema.milestones.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Milestone not found' } },
          { status: 404 },
        );
      }

      await db()
        .update(schema.milestones)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.milestones.id, id));

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'milestone.deleted',
        entityType: 'milestone',
        entityId: id,
        oldValues: { name: existing.name },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to delete milestone');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'milestones:delete' },
);
