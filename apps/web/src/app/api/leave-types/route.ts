import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth } from '@/lib/auth/api-auth';
import { eq, asc } from 'drizzle-orm';
import { handleApiError } from '@/lib/api/db';

export const runtime = 'nodejs';

const DEFAULT_TYPES = [
  { name: 'Vacation', slug: 'vacation', color: '#6366f1', icon: 'Umbrella', description: 'Annual leave and vacation time', sortOrder: 0 },
  { name: 'Sick Leave', slug: 'sick', color: '#f59e0b', icon: 'Thermometer', description: 'Medical and health-related absences', sortOrder: 1 },
  { name: 'Personal Leave', slug: 'personal', color: '#10b981', icon: 'User', description: 'Personal errands and family matters', sortOrder: 2 },
] as const;

// GET /api/leave-types — List all active leave types
export const GET = withAuth(
  async (_request: NextRequest, { orgId }) => {
    try {
      const db = getDb();
      let types = await db
        .select()
        .from(schema.leaveTypes)
        .where(
          eq(schema.leaveTypes.organizationId, orgId!),
        )
        .orderBy(asc(schema.leaveTypes.sortOrder));

      // Seed default types if none exist
      if (types.length === 0) {
        const inserted = await db
          .insert(schema.leaveTypes)
          .values(
            DEFAULT_TYPES.map((t) => ({
              organizationId: orgId!,
              ...t,
              createdBy: _request.headers.get('x-user-id') ?? undefined,
            })),
          )
          .returning();
        types = inserted;
      }

      return NextResponse.json({ types });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch leave types');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'leave:types' },
);
