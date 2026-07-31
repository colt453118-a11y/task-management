import { getDb, schema } from '@workmanagement/database';
import { eq, and, inArray } from 'drizzle-orm';
import { AsyncLocalStorage } from 'async_hooks';

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
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
 * Check if a user has a specific permission.
 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.some((p) => p.code === permissionCode);
}

