import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { asc } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/permissions - List all available permissions (rate limited: 100 req/min per user)
export const GET = withAuth(
  async (_request: NextRequest, { user }) => {
    try {
      await requirePermission(user.id, 'role:view');

      const permissions = await db()
        .select()
        .from(schema.permissions)
        .orderBy(asc(schema.permissions.module), asc(schema.permissions.name));

      return NextResponse.json({ permissions });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch permissions');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'permissions:list' },
);
