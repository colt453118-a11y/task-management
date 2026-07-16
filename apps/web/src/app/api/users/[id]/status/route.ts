import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserIdFromPath(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  const idIndex = segments.indexOf('users');
  return segments[idIndex + 1]!;
}

// PATCH /api/users/[id]/status - Deactivate, suspend, or reactivate a user
//
// Request body:
//   { "status": "deactivate" | "suspend" | "activate" | "unsuspend" }
//   - deactivate: Sets isActive=false, revokes all sessions
//   - suspend: Sets isSuspended=true, revokes all sessions
//   - activate: Sets isActive=true
//   - unsuspend: Sets isSuspended=false
//
// Rate limited: 30 req/min (sensitive operation)
export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'user:manage');

      const targetUserId = getUserIdFromPath(request);
      const body = await request.json().catch(() => ({}));
      const { status: action } = body;

      if (!action || !['deactivate', 'suspend', 'activate', 'unsuspend'].includes(action)) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message:
                "Status action must be one of: 'deactivate', 'suspend', 'activate', 'unsuspend'",
            },
          },
          { status: 400 },
        );
      }

      // Fetch target user for validation
      const [targetUser] = await db()
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.id, targetUserId), isNull(schema.users.deletedAt)))
        .limit(1);

      if (!targetUser) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'User not found' } },
          { status: 404 },
        );
      }

      // Must be in same org
      if (targetUser.organizationId !== orgId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Cross-organization user management denied' } },
          { status: 403 },
        );
      }

      // Cannot deactivate yourself
      if (targetUserId === user.id) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATE',
              message: 'You cannot deactivate or suspend your own account',
            },
          },
          { status: 422 },
        );
      }

      const oldValues: Record<string, unknown> = {
        isActive: targetUser.isActive,
        isSuspended: targetUser.isSuspended,
      };
      const newValues: Record<string, unknown> = {};

      // Apply the action
      switch (action) {
        case 'deactivate':
          if (!targetUser.isActive) {
            return NextResponse.json(
              { error: { code: 'INVALID_STATE', message: 'User is already deactivated' } },
              { status: 422 },
            );
          }
          newValues.isActive = false;
          break;

        case 'suspend':
          if (targetUser.isSuspended) {
            return NextResponse.json(
              { error: { code: 'INVALID_STATE', message: 'User is already suspended' } },
              { status: 422 },
            );
          }
          newValues.isSuspended = true;
          break;

        case 'activate':
          if (targetUser.isActive) {
            return NextResponse.json(
              { error: { code: 'INVALID_STATE', message: 'User is already active' } },
              { status: 422 },
            );
          }
          newValues.isActive = true;
          break;

        case 'unsuspend':
          if (!targetUser.isSuspended) {
            return NextResponse.json(
              { error: { code: 'INVALID_STATE', message: 'User is not suspended' } },
              { status: 422 },
            );
          }
          newValues.isSuspended = false;
          break;
      }

      // Update the user record
      await db()
        .update(schema.users)
        .set({ ...newValues, updatedAt: new Date() })
        .where(eq(schema.users.id, targetUserId));

      // ── Revoke all sessions if deactivating or suspending ──
      if (action === 'deactivate' || action === 'suspend') {
        try {
          await revokeAllUserSessions(targetUserId);
        } catch (err) {
          console.error(`[auth] Failed to revoke sessions for user ${targetUserId}:`, err);
          // Continue — user is still deactivated; sessions will expire naturally
        }
      }

      // Audit log
      const auditAction =
        action === 'deactivate'
          ? 'user.deactivated'
          : action === 'suspend'
            ? 'user.suspended'
            : 'user.reactivated';

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: auditAction,
        entityType: 'user',
        entityId: targetUserId,
        oldValues,
        newValues,
        metadata: { action },
      });

      return NextResponse.json({
        success: true,
        message: `User ${action}d successfully`,
        user: {
          id: targetUserId,
          ...newValues,
        },
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update user status');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'users:status' },
);

/**
 * Revoke all active sessions for a user by deleting them from the database.
 * This forces the user to re-authenticate after being deactivated/suspended.
 */
async function revokeAllUserSessions(userId: string): Promise<void> {
  await db().delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
