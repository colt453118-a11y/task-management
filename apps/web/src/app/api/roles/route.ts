import { NextResponse, NextRequest } from 'next/server';
import { db, schema, apiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { RoleCreateSchema, validationError } from '@/lib/api/validation';

export const runtime = 'nodejs';

// GET /api/roles - List roles for the organization (rate limited: 100 req/min per user)
export const GET = withAuth(
  async (_request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'role:view');

      const roles = await db()
        .select({
          id: schema.roles.id,
          name: schema.roles.name,
          slug: schema.roles.slug,
          description: schema.roles.description,
          isSystem: schema.roles.isSystem,
          isActive: schema.roles.isActive,
          priority: schema.roles.priority,
          createdAt: schema.roles.createdAt,
          permissionCount: sql<number>`(
            SELECT COUNT(*) FROM ${schema.rolePermissions}
            WHERE ${schema.rolePermissions.roleId} = ${schema.roles.id}
            AND ${schema.rolePermissions.allow} = true
          )`,
          userCount: sql<number>`(
            SELECT COUNT(*) FROM ${schema.userRoles}
            WHERE ${schema.userRoles.roleId} = ${schema.roles.id}
          )`,
        })
        .from(schema.roles)
        .where(
          and(
            eq(schema.roles.organizationId, orgId!),
            isNull(schema.roles.deletedAt),
          ),
        )
        .orderBy(desc(schema.roles.priority), desc(schema.roles.createdAt));

      return NextResponse.json({ roles });
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      const { error: err, status } = apiError('Failed to fetch roles');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'roles:list' },
);

// POST /api/roles - Create a new role (rate limited: 30 req/min per user — sensitive operation)
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'role:create');

      const body = await request.json();
      const parsed = RoleCreateSchema.safeParse(body);
      if (!parsed.success) {
        const { error: err, status } = validationError(parsed.error);
        return NextResponse.json(err, { status });
      }

      const { name, slug, description, permissionIds } = parsed.data;

      // Check slug uniqueness within org
      const [existing] = await db()
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(
          and(
            eq(schema.roles.organizationId, orgId!),
            eq(schema.roles.slug, slug),
            isNull(schema.roles.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: 'A role with this slug already exists in your organization' } },
          { status: 409 },
        );
      }

      const [role] = await db()
        .insert(schema.roles)
        .values({
          name,
          slug,
          description: description ?? null,
          organizationId: orgId!,
        })
        .returning();

      if (!role) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create role' } },
          { status: 500 },
        );
      }

      // Assign permissions if provided
      if (permissionIds && permissionIds.length > 0) {
        await db().insert(schema.rolePermissions).values(
          permissionIds.map((permissionId: string) => ({
            roleId: role.id,
            permissionId,
            allow: true,
          })),
        );
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'role.created',
        entityType: 'role',
        entityId: role.id,
        newValues: { name, slug, permissionCount: permissionIds?.length ?? 0 },
      });

      return NextResponse.json({ role }, { status: 201 });
    } catch (error) {
      console.error('Failed to create role:', error);
      const { error: err, status } = apiError('Failed to create role');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'roles:create' },
);
