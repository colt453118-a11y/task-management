import { getDb, schema } from '@workmanagement/database';
import { eq, and, inArray } from 'drizzle-orm';
import { AsyncLocalStorage } from 'async_hooks';

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

// ── Request-scoped permission cache via AsyncLocalStorage ──────────────────
// Each API request gets its own Map<string, Permission[]> so that multiple
// requirePermission() calls within the same request share the 3-query result.
// The store is automatically garbage collected when the request completes.
//
// Design choices:
//   - AsyncLocalStorage ensures zero memory leak between requests
//   - No TTL needed — the cache lives exactly as long as the request
//   - Falls through to DB query if called outside a withAuth context
//     (e.g., from a server component or background job)
//   - Entries can be selectively cleared via clearUserPermissionsCache()
//     for mid-request role changes
//
// How it works:
//   1. withAuth() creates a new Map and runs the handler inside
//      permissionStorage.run(new Map(), ...)
//   2. getUserPermissions() checks the request-scoped store first
//   3. On cache miss, fetches from DB and populates the store
//   4. When the request completes, the Map is garbage collected
export const permissionStorage = new AsyncLocalStorage<Map<string, Permission[]>>();

/**
 * Get all permissions for a user by looking up their roles and role-permissions.
 * Results are cached per userId within the current request's AsyncLocalStorage
 * context (if one exists), eliminating redundant DB queries.
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  // Check the request-scoped store first
  const store = permissionStorage.getStore();
  if (store) {
    const cached = store.get(userId);
    if (cached) return cached;
  }

  try {
    const db = getDb();

    // Get user's roles
    const userRoles = await db
      .select({
        roleId: schema.userRoles.roleId,
      })
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, userId));

    if (userRoles.length === 0) {
      // Cache empty result to avoid re-querying
      store?.set(userId, []);
      return [];
    }

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

    if (rolePerms.length === 0) {
      store?.set(userId, []);
      return [];
    }

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

    // Populate the request-scoped store before returning
    store?.set(userId, permissions);
    return permissions;
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return [];
  }
}

/**
 * Clear the cached permissions for a specific user from the current request's
 * store. Call this after updating a user's roles or permissions within the
 * same request so that subsequent requirePermission() calls reflect the change.
 *
 * If called outside a request context (no AsyncLocalStorage store), this is a
 * no-op since there's no cache to clear.
 */
export function clearUserPermissionsCache(userId: string): void {
  const store = permissionStorage.getStore();
  if (store) {
    store.delete(userId);
  }
}

/**
 * Clear all cached permissions for the current request.
 * Call this after bulk role/permission changes within the same request.
 */
export function clearAllPermissionsCache(): void {
  const store = permissionStorage.getStore();
  if (store) {
    store.clear();
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
