import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth } from '@/lib/auth/api-auth';
import { eq, asc, isNull, and } from 'drizzle-orm';
import { handleApiError } from '@/lib/api/db';

export const runtime = 'nodejs';

// GET /api/gantt/data — Fetch all projects + milestones + tasks for Gantt timeline
export const GET = withAuth(
  async (_request: NextRequest, { orgId }) => {
    try {
      const db = getDb();

      // Fetch projects with date info
      const projects = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          status: schema.projects.status,
          startDate: schema.projects.startDate,
          endDate: schema.projects.endDate,
          progress: schema.projects.progress,
          ownerId: schema.projects.ownerId,
        })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.organizationId, orgId!),
            isNull(schema.projects.deletedAt),
          ),
        )
        .orderBy(asc(schema.projects.startDate));

      // Fetch milestones with date info
      const milestones = await db
        .select({
          id: schema.milestones.id,
          projectId: schema.milestones.projectId,
          name: schema.milestones.name,
          status: schema.milestones.status,
          dueDate: schema.milestones.dueDate,
          sortOrder: schema.milestones.sortOrder,
        })
        .from(schema.milestones)
        .where(isNull(schema.milestones.deletedAt))
        .orderBy(asc(schema.milestones.dueDate));

      // Fetch tasks with date info (non-deleted)
      const tasks = await db
        .select({
          id: schema.tasks.id,
          title: schema.tasks.title,
          projectId: schema.tasks.projectId,
          milestoneId: schema.tasks.milestoneId,
          status: schema.tasks.status,
          priority: schema.tasks.priority,
          startDate: schema.tasks.startDate,
          dueDate: schema.tasks.dueDate,
          assignedTo: schema.tasks.assignedTo,
          estimatedHours: schema.tasks.estimatedHours,
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.organizationId, orgId!),
            isNull(schema.tasks.deletedAt),
          ),
        )
        .orderBy(asc(schema.tasks.startDate));

      return NextResponse.json({ projects, milestones, tasks });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch Gantt data');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'gantt:data' },
);

// PATCH /api/gantt/data — Update an item's dates (drag-to-reschedule)
export const PATCH = withAuth(
  async (request: NextRequest, { orgId }) => {
    try {
      const body = await request.json();
      const { type: itemType, id, startDate, endDate } = body;

      if (!itemType || !id) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'type and id are required' } },
          { status: 400 },
        );
      }

      const db = getDb();

      switch (itemType) {
        case 'project': {
          await db
            .update(schema.projects)
            .set({
              startDate: startDate ?? undefined,
              endDate: endDate ?? undefined,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.projects.id, id),
                eq(schema.projects.organizationId, orgId!),
              ),
            );
          break;
        }
        case 'milestone': {
          // Milestones are org-scoped through their parent project
          const project = await db
            .select({ id: schema.projects.id })
            .from(schema.projects)
            .innerJoin(schema.milestones, eq(schema.milestones.projectId, schema.projects.id))
            .where(
              and(
                eq(schema.milestones.id, id),
                eq(schema.projects.organizationId, orgId!),
              ),
            )
            .limit(1);

          if (project.length === 0) {
            return NextResponse.json(
              { error: { code: 'NOT_FOUND', message: 'Milestone not found in your organization' } },
              { status: 404 },
            );
          }

          await db
            .update(schema.milestones)
            .set({
              dueDate: endDate ?? startDate ?? undefined,
              updatedAt: new Date(),
            })
            .where(eq(schema.milestones.id, id));
          break;
        }
        case 'task': {
          await db
            .update(schema.tasks)
            .set({
              startDate: startDate ? new Date(startDate) : undefined,
              dueDate: endDate ? new Date(endDate) : undefined,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.tasks.id, id),
                eq(schema.tasks.organizationId, orgId!),
              ),
            );
          break;
        }
        default:
          return NextResponse.json(
            { error: { code: 'INVALID_TYPE', message: `Unknown item type: ${itemType}` } },
            { status: 400 },
          );
      }

      return NextResponse.json({ ok: true });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update Gantt item');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'gantt:update' },
);
