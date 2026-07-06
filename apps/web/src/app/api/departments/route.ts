import { NextResponse, NextRequest } from 'next/server';
import { db, schema, apiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { DepartmentCreateSchema, validationError } from '@/lib/api/validation';

export const runtime = 'nodejs';

// GET /api/departments - List departments for the org
export const GET = withAuth(async (_request: NextRequest, { orgId }) => {
  try {
    const departments = await db()
      .select({
        id: schema.departments.id,
        name: schema.departments.name,
        code: schema.departments.code,
        description: schema.departments.description,
        headUserId: schema.departments.headUserId,
        isActive: schema.departments.isActive,
        parentId: schema.departments.parentId,
        sortOrder: schema.departments.sortOrder,
        createdAt: schema.departments.createdAt,
      })
      .from(schema.departments)
      .where(and(isNull(schema.departments.deletedAt), eq(schema.departments.organizationId, orgId!)))
      .orderBy(desc(schema.departments.sortOrder), desc(schema.departments.createdAt));

    return NextResponse.json({ departments });
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    const { error: err, status } = apiError('Failed to fetch departments');
    return NextResponse.json(err, { status });
  }
});

// POST /api/departments - Create department
export const POST = withAuth(async (request: NextRequest, { user, orgId }) => {
  try {
    await requirePermission(user.id, 'team:create');

    const body = await request.json();
    const parsed = DepartmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      const { error: err, status } = validationError(parsed.error);
      return NextResponse.json(err, { status });
    }

    const { name, code, description, headUserId, parentId } = parsed.data;

    // Validate head user is in same org if provided
    if (headUserId) {
      const [head] = await db()
        .select({ id: schema.users.id, organizationId: schema.users.organizationId })
        .from(schema.users)
        .where(and(eq(schema.users.id, headUserId), isNull(schema.users.deletedAt)))
        .limit(1);
      if (!head) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Head user not found' } },
          { status: 404 },
        );
      }
      if (head.organizationId !== orgId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Cross-organization head assignment denied' } },
          { status: 403 },
        );
      }
    }

    const [dept] = await db()
      .insert(schema.departments)
      .values({
        name,
        code: code ?? null,
        description: description ?? null,
        headUserId: headUserId ?? null,
        parentId: parentId ?? null,
        organizationId: orgId!,
        createdBy: user.id,
        updatedBy: user.id,
        isActive: true,
      })
      .returning();

    if (!dept) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to create department' } },
        { status: 500 },
      );
    }

    await createAuditEntry({
      organizationId: orgId,
      userId: user.id,
      action: 'department.created',
      entityType: 'department',
      entityId: dept.id,
      newValues: { name, code },
    });

    return NextResponse.json({ department: dept }, { status: 201 });
  } catch (error) {
    console.error('Failed to create department:', error);
    const { error: err, status } = apiError('Failed to create department');
    return NextResponse.json(err, { status });
  }
});
