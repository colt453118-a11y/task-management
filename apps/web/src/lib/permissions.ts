import { getDb, schema } from '@workmanagement/database';
import { eq, and, inArray } from 'drizzle-orm';

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

export interface UserRole {
  id: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
}

/**
 * Get all permissions for a user by looking up their roles and role-permissions.
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    const db = getDb();

    // Get user's roles
    const userRoles = await db
      .select({
        roleId: schema.userRoles.roleId,
      })
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, userId));

    if (userRoles.length === 0) return [];

    const roleIds = userRoles.map((r) => r.roleId);

    // Get permission IDs for those roles
    const rolePerms = await db
      .select({
        permissionId: schema.rolePermissions.permissionId,
      })
      .from(schema.rolePermissions)
      .where(
        and(
          inArray(schema.rolePermissions.roleId, roleIds),
          eq(schema.rolePermissions.allow, true),
        ),
      );

    if (rolePerms.length === 0) return [];

    const permIds = [...new Set(rolePerms.map((rp) => rp.permissionId))];

    // Get permission details
    const permissions = await db
      .select({
        id: schema.permissions.id,
        code: schema.permissions.code,
        name: schema.permissions.name,
        module: schema.permissions.module,
      })
      .from(schema.permissions)
      .where(inArray(schema.permissions.id, permIds));

    return permissions;
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return [];
  }
}

/**
 * Get all roles for a user.
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  try {
    const db = getDb();

    const roles = await db
      .select({
        id: schema.userRoles.id,
        roleId: schema.userRoles.roleId,
        roleName: schema.roles.name,
        roleSlug: schema.roles.slug,
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, userId));

    return roles;
  } catch (error) {
    console.error('Failed to get user roles:', error);
    return [];
  }
}

/**
 * Check if a user has a specific permission.
 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.some((p) => p.code === permissionCode);
}

/**
 * Check if a user has any of the specified permissions.
 */
export async function hasAnyPermission(
  userId: string,
  permissionCodes: string[],
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.some((p) => permissionCodes.includes(p.code));
}

/**
 * Check if a user has all of the specified permissions.
 */
export async function hasAllPermissions(
  userId: string,
  permissionCodes: string[],
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  const userCodes = new Set(permissions.map((p) => p.code));
  return permissionCodes.every((code) => userCodes.has(code));
}

/**
 * Check if a user has a role with the given slug.
 */
export async function hasRole(userId: string, roleSlug: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.roleSlug === roleSlug);
}
