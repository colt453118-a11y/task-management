import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

export const TemplateCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).transform((s) => s.trim()),
  description: z.string().max(1000).optional().nullable(),
  taskTitle: z.string().max(500).optional().nullable(),
  taskDescription: z.string().max(10000).optional().nullable(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent', 'critical']).optional().default('medium'),
  category: z.string().max(100).optional().nullable(),
  labels: z.array(z.string().max(100)).optional().nullable(),
  tags: z.array(z.string().max(100)).optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
}).strict('Unexpected fields');

export const TemplateUpdateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()).optional(),
  description: z.string().max(1000).optional().nullable(),
  taskTitle: z.string().max(500).optional().nullable(),
  taskDescription: z.string().max(10000).optional().nullable(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent', 'critical']).optional(),
  category: z.string().max(100).optional().nullable(),
  labels: z.array(z.string().max(100)).optional().nullable(),
  tags: z.array(z.string().max(100)).optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  isDefault: z.boolean().optional(),
}).strict('Unexpected fields');

// GET /api/task-templates - List templates
export const GET = withAuth(
  async (_request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'task_template:view');

      const templates = await db()
        .select()
        .from(schema.taskTemplates)
        .where(
          and(
            eq(schema.taskTemplates.organizationId, orgId!),
            isNull(schema.taskTemplates.deletedAt),
          ),
        )
        .orderBy(desc(schema.taskTemplates.isDefault), desc(schema.taskTemplates.createdAt));

      return NextResponse.json({ templates });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch templates');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'templates:list' },
);

// POST /api/task-templates - Create template
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'task_template:create');

      const body = await request.json();
      const parsed = TemplateCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid template data',
              details: parsed.error.flatten().fieldErrors,
            },
          },
          { status: 400 },
        );
      }

      const { name, description, taskTitle, taskDescription, priority, category, labels, tags, estimatedHours, isDefault } = parsed.data;

      const [template] = await db()
        .insert(schema.taskTemplates)
        .values({
          organizationId: orgId!,
          name,
          description: description ?? null,
          taskTitle: taskTitle ?? null,
          taskDescription: taskDescription ?? null,
          priority: priority ?? 'medium',
          category: category ?? null,
          labels: labels ?? null,
          tags: tags ?? null,
          estimatedHours: estimatedHours ? String(estimatedHours) : null,
          isDefault: isDefault ?? false,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      if (!template) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create template' } },
          { status: 500 },
        );
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'task_template.created',
        entityType: 'task_template',
        entityId: template.id,
        newValues: { name, priority },
      });

      return NextResponse.json({ template }, { status: 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to create template');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'templates:create' },
);

// PATCH /api/task-templates - Update a template
export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const templateId = request.nextUrl.searchParams.get('id');
      if (!templateId) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Template ID is required' } },
          { status: 400 },
        );
      }

      await requirePermission(user.id, 'task_template:edit');

      const body = await request.json();
      const parsed = TemplateUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid update data',
              details: parsed.error.flatten().fieldErrors,
            },
          },
          { status: 400 },
        );
      }

      // Verify template exists and belongs to org
      const [existing] = await db()
        .select()
        .from(schema.taskTemplates)
        .where(
          and(
            eq(schema.taskTemplates.id, templateId),
            eq(schema.taskTemplates.organizationId, orgId!),
            isNull(schema.taskTemplates.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Template not found' } },
          { status: 404 },
        );
      }

      const { name, description, taskTitle, taskDescription, priority, category, labels, tags, estimatedHours, isDefault } = parsed.data;

      const updateData: Record<string, unknown> = { updatedBy: user.id, updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (taskTitle !== undefined) updateData.taskTitle = taskTitle;
      if (taskDescription !== undefined) updateData.taskDescription = taskDescription;
      if (priority !== undefined) updateData.priority = priority;
      if (category !== undefined) updateData.category = category;
      if (labels !== undefined) updateData.labels = labels;
      if (tags !== undefined) updateData.tags = tags;
      if (estimatedHours !== undefined) updateData.estimatedHours = String(estimatedHours);
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      const [template] = await db()
        .update(schema.taskTemplates)
        .set(updateData)
        .where(eq(schema.taskTemplates.id, templateId))
        .returning();

      if (!template) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to update template' } },
          { status: 500 },
        );
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'task_template.updated',
        entityType: 'task_template',
        entityId: templateId,
        oldValues: { name: existing.name },
        newValues: { name: template.name },
      });

      return NextResponse.json({ template });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update template');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'templates:update' },
);

// DELETE /api/task-templates - Delete a template
export const DELETE = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const templateId = request.nextUrl.searchParams.get('id');
      if (!templateId) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Template ID is required' } },
          { status: 400 },
        );
      }

      await requirePermission(user.id, 'task_template:delete');

      // Verify template exists and belongs to org
      const [existing] = await db()
        .select()
        .from(schema.taskTemplates)
        .where(
          and(
            eq(schema.taskTemplates.id, templateId),
            eq(schema.taskTemplates.organizationId, orgId!),
            isNull(schema.taskTemplates.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Template not found' } },
          { status: 404 },
        );
      }

      await db()
        .update(schema.taskTemplates)
        .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: user.id })
        .where(eq(schema.taskTemplates.id, templateId));

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'task_template.deleted',
        entityType: 'task_template',
        entityId: templateId,
        oldValues: { name: existing.name },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to delete template');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'templates:delete' },
);
