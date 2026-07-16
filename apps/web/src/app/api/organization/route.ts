import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth } from '@/lib/auth/api-auth';
import { and, eq, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/organization - Get the current user's organization (rate limited: 100 req/min per user)
export const GET = withAuth(
  async (_request: Request, { orgId }) => {
    try {
      if (!orgId) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'No organization found for this user' } },
          { status: 404 },
        );
      }

      const [org] = await db()
        .select({
          id: schema.organizations.id,
          name: schema.organizations.name,
          slug: schema.organizations.slug,
          logoUrl: schema.organizations.logoUrl,
          domain: schema.organizations.domain,
          settings: schema.organizations.settings,
          maxUsers: schema.organizations.maxUsers,
          isActive: schema.organizations.isActive,
          createdAt: schema.organizations.createdAt,
          updatedAt: schema.organizations.updatedAt,
        })
        .from(schema.organizations)
        .where(and(eq(schema.organizations.id, orgId), isNull(schema.organizations.deletedAt)))
        .limit(1);

      if (!org) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Organization not found' } },
          { status: 404 },
        );
      }

      return NextResponse.json({ organization: org });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch organization');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'organization:get' },
);
