import { NextResponse, NextRequest } from 'next/server';
import { requireAuth, AuthError } from './session';
import { hasPermission } from '../permissions';
import { getDb, schema } from '@workmanagement/database';
import { eq, and, isNull } from 'drizzle-orm';


export type ApiHandlerContext = {
  user: Awaited<ReturnType<typeof requireAuth>>;
  orgId: string | null;
};

/**
 * Wrap an API route handler with authentication.
 * Provides the authenticated user and org context.
 */
export function withAuth(
  handler: (req: NextRequest, context: ApiHandlerContext) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    try {
      const user = await requireAuth();

      // Check if user is active (not suspended/deactivated)
      const isActive = await checkUserActive(user.id);
      if (!isActive) {
        return NextResponse.json(
          { error: { code: 'USER_NOT_ACTIVE', message: 'Your account is suspended or deactivated' } },
          { status: 403 },
        );
      }

      const orgId = await getUserOrgId(user.id);
      return handler(req, { user, orgId });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }
      console.error('Auth error:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' } },
        { status: 500 },
      );
    }
  };
}

/**
 * Check if a user has a specific permission within their organization.
 */
export async function checkPermission(userId: string, permissionCode: string): Promise<boolean> {
  return hasPermission(userId, permissionCode);
}

/**
 * Require a specific permission. Throws if not authorized.
 */
export async function requirePermission(userId: string, permissionCode: string): Promise<void> {
  const hasPerm = await checkPermission(userId, permissionCode);
  if (!hasPerm) {
    throw new AuthError(
      `Forbidden: requires '${permissionCode}' permission`,
      'FORBIDDEN',
      403,
    );
  }
}

/**
 * Get the user's organization ID from the database.
 */
async function getUserOrgId(userId: string): Promise<string | null> {
  try {
    const db = getDb();
    const [user] = await db
      .select({ organizationId: schema.users.organizationId })
      .from(schema.users)
      .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
      .limit(1);
    return user?.organizationId ?? null;
  } catch {
    return null;
  }
}

/**
 * Enforce that a record's organization_id matches the user's org.
 */
export function enforceOrgScope(recordOrgId: string | null, userOrgId: string | null): void {
  if (!userOrgId || !recordOrgId) {
    throw new AuthError('Organization scope mismatch', 'FORBIDDEN', 403);
  }
  if (recordOrgId !== userOrgId) {
    throw new AuthError('Cross-organization access denied', 'FORBIDDEN', 403);
  }
}

/**
 * Check if a user is active (not suspended or deactivated).
 */
export async function checkUserActive(userId: string): Promise<boolean> {
  try {
    const db = getDb();
    const [user] = await db
      .select({ isActive: schema.users.isActive, isSuspended: schema.users.isSuspended })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) return false;
    return user.isActive === true && user.isSuspended !== true;
  } catch {
    return false;
  }
}
