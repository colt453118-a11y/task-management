import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, enforceOrgScope } from '@/lib/auth/api-auth';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

function getIdFromPath(request: NextRequest): string {
  return request.nextUrl.pathname.split('/').pop()!;
}

// GET /api/reports/snapshots/[id] - Retrieve a specific report snapshot (rate limited: 60 req/min per user)
export const GET = withAuth(
  async (request: NextRequest, { orgId }) => {
    try {
      const id = getIdFromPath(request);

      const [snapshot] = await db()
        .select()
        .from(schema.reportSnapshots)
        .where(eq(schema.reportSnapshots.id, id))
        .limit(1);

      if (!snapshot) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Report snapshot not found' } },
          { status: 404 },
        );
      }

      enforceOrgScope(snapshot.organizationId, orgId);

      return NextResponse.json({ snapshot });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch report snapshot');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'reports:snapshots:get' },
);
