import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, enforceOrgScope, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

function getIdFromPath(request: NextRequest): string {
  return request.nextUrl.pathname.split('/').pop()!;
}

// GET /api/roles/[id] - Get a single role with its permissions (rate limited: 100 req/min per user)
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);

      await requirePermission(user.id, 'role:view');

      const [role] = await db()
        .select()
        .from(schema.roles)
        .where(and(eq(schema.roles.id, id), isNull(schema.roles.deletedAt)))
        .limit(1);

      if (!role) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Role not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(role.organizationId, orgId);

      // Get assigned permission IDs
      const rolePerms = await db()
        .select({ permissionId: schema.rolePermissions.permissionId })
        .from(schema.rolePermissions)
        .where(
          and(
            eq(schema.rolePermissions.roleId, id),
            eq(schema.rolePermissions.allow, true),
          ),
        );

      const permissionIds = rolePerms.map((rp) => rp.permissionId);

      return NextResponse.json({ role, permissionIds });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch role');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'roles:get' },
);

// PATCH /api/roles/[id] - Update a role (rate limited: 60 req/min per user)
export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'role:edit');

      const body = await request.json();
      const { name, description, permissionIds, isActive } = body;

      const [existing] = await db()
        .select()
        .from(schema.roles)
        .where(and(eq(schema.roles.id, id), isNull(schema.roles.deletedAt)))
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Role not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(existing.organizationId, orgId);

      // System roles can only have their permissions changed, not name/description
      if (existing.isSystem) {
        if (name !== undefined || isActive !== undefined) {
          return NextResponse.json(
            { error: { code: 'FORBIDDEN', message: 'System roles cannot be renamed or disabled' } },
            { status: 403 },
          );
        }
      }

      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};

      if (name !== undefined) { oldValues.name = existing.name; newValues.name = name; }
      if (description !== undefined) { oldValues.description = existing.description; newValues.description = description; }
      if (isActive !== undefined) { oldValues.isActive = existing.isActive; newValues.isActive = isActive; }

      if (Object.keys(newValues).length > 0) {
        await db()
          .update(schema.roles)
          .set({ ...newValues, updatedAt: new Date() })
          .where(eq(schema.roles.id, id));
      }

      // Update permissions if provided
      if (permissionIds !== undefined && Array.isArray(permissionIds)) {
        // Remove existing permissions
        await db()
          .delete(schema.rolePermissions)
          .where(eq(schema.rolePermissions.roleId, id));

        // Insert new permissions
        if (permissionIds.length > 0) {
          await db().insert(schema.rolePermissions).values(
            permissionIds.map((permissionId: string) => ({
              roleId: id,
              permissionId,
              allow: true,
            })),
          );
        }

        oldValues.permissions = 'previous';
        newValues.permissions = `${permissionIds.length} permissions`;
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'role.updated',
        entityType: 'role',
        entityId: id,
        oldValues,
        newValues,
      });

      // Fetch updated role
      const [role] = await db()
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.id, id))
        .limit(1);

      return NextResponse.json({ role });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update role');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'roles:update' },
);

// DELETE /api/roles/[id] - Soft delete a role (rate limited: 30 req/min per user — sensitive)
export const DELETE = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'role:delete');

      const [existing] = await db()
        .select()
        .from(schema.roles)
        .where(and(eq(schema.roles.id, id), isNull(schema.roles.deletedAt)))
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Role not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(existing.organizationId, orgId);

      if (existing.isSystem) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'System roles cannot be deleted' } },
          { status: 403 },
        );
      }

      await db()
        .update(schema.roles)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.roles.id, id));

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'role.deleted',
        entityType: 'role',
        entityId: id,
        oldValues: { name: existing.name, slug: existing.slug },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to delete role');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'roles:delete' },
);
