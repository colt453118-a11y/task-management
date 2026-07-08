import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, like, or, desc, and, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/users - List users (org-scoped, rate limited: 100 req/min per user)
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'user:view');

      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search');
      const departmentId = searchParams.get('departmentId');
      const teamId = searchParams.get('teamId');
      const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
      const offset = Number(searchParams.get('offset')) || 0;

      const filters: SQL[] = [
        isNull(schema.users.deletedAt),
        eq(schema.users.organizationId, orgId!),
      ];

      if (departmentId) filters.push(eq(schema.users.departmentId, departmentId));
      if (teamId) filters.push(eq(schema.users.teamId, teamId));

      if (search) {
        const searchClause = or(
          like(schema.users.firstName, `%${search}%`),
          like(schema.users.lastName, `%${search}%`),
          like(schema.users.email, `%${search}%`),
          like(schema.users.displayName, `%${search}%`),
        );
        if (searchClause) filters.push(searchClause);
      }

      const users = await db()
        .select({
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          name: schema.users.name,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          designation: schema.users.designation,
          departmentId: schema.users.departmentId,
          teamId: schema.users.teamId,
          employmentStatus: schema.users.employmentStatus,
          isActive: schema.users.isActive,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(and(...filters))
        .orderBy(desc(schema.users.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ users });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch users');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'users:list' },
);
