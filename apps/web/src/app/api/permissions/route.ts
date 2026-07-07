import { NextResponse } from 'next/server';
import { db, schema, apiError } from '@/lib/api/db';
import { withAuth } from '@/lib/auth/api-auth';
import { asc } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/permissions - List all available permissions (rate limited: 100 req/min per user)
export const GET = withAuth(
  async () => {
  try {
    const permissions = await db()
      .select()
      .from(schema.permissions)
      .orderBy(asc(schema.permissions.module), asc(schema.permissions.name));

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
    const { error: err, status } = apiError('Failed to fetch permissions');
    return NextResponse.json(err, { status });
  }
},
{ windowMs: 60_000, max: 100, namespace: 'permissions:list' },
);
