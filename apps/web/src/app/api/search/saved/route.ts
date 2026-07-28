import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { db, schema, handleApiError } from '@/lib/api/db';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

// ─── Validation Schemas ────────────────────────────────────────

const CreateSavedSearchSchema = z.object({
  name: z.string().min(1).max(200),
  query: z.string().max(500).optional().default(''),
  type: z.enum(['all', 'tasks', 'projects', 'users']).optional().default('all'),
  filters: z
    .object({
      status: z.string().optional(),
      priority: z.string().optional(),
      assignee: z.string().optional(),
      dateRange: z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional(),
    })
    .optional()
    .default({}),
});

const UpdateSavedSearchSchema = CreateSavedSearchSchema.partial();

// ─── GET /api/search/saved — List saved searches for current user ─

async function listHandler(
  _req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  try {
    const searches = await db()
      .select()
      .from(schema.savedSearches)
      .where(
        and(
          eq(schema.savedSearches.userId, ctx.user.id),
          eq(schema.savedSearches.organizationId, ctx.orgId!),
        ),
      )
      .orderBy(desc(schema.savedSearches.sortOrder), desc(schema.savedSearches.createdAt))
      .limit(50);

    return NextResponse.json({ searches });
  } catch (error) {
    const { error: err, status } = handleApiError(error, 'Failed to fetch saved searches');
    return NextResponse.json(err, { status });
  }
}

// ─── POST /api/search/saved — Create a saved search ────────────

async function createHandler(
  req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  try {
    const body = await req.json();
    const parsed = CreateSavedSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }

    const { name, query, type, filters } = parsed.data;

    // Check for duplicate name
    const [existing] = await db()
      .select({ id: schema.savedSearches.id })
      .from(schema.savedSearches)
      .where(
        and(
          eq(schema.savedSearches.name, name),
          eq(schema.savedSearches.userId, ctx.user.id),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'A saved search with this name already exists' } },
        { status: 409 },
      );
    }

    const [saved] = await db()
      .insert(schema.savedSearches)
      .values({
        organizationId: ctx.orgId!,
        userId: ctx.user.id,
        name,
        query,
        type,
        filters: filters as Record<string, unknown>,
        sortOrder: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json({ search: saved }, { status: 201 });
  } catch (error) {
    const { error: err, status } = handleApiError(error, 'Failed to create saved search');
    return NextResponse.json(err, { status });
  }
}

// ─── PATCH /api/search/saved?id=xxx — Update a saved search ────

async function updateHandler(
  req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Saved search ID is required' } },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = UpdateSavedSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }

    const [existing] = await db()
      .select()
      .from(schema.savedSearches)
      .where(
        and(
          eq(schema.savedSearches.id, id),
          eq(schema.savedSearches.userId, ctx.user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Saved search not found' } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.filters) {
      updateData.filters = parsed.data.filters as Record<string, unknown>;
    }

    await db()
      .update(schema.savedSearches)
      .set(updateData)
      .where(eq(schema.savedSearches.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const { error: err, status } = handleApiError(error, 'Failed to update saved search');
    return NextResponse.json(err, { status });
  }
}

// ─── DELETE /api/search/saved?id=xxx — Delete a saved search ───

async function deleteHandler(
  req: NextRequest,
  ctx: { user: { id: string }; orgId: string | null },
) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Saved search ID is required' } },
        { status: 400 },
      );
    }

    const [existing] = await db()
      .select()
      .from(schema.savedSearches)
      .where(
        and(
          eq(schema.savedSearches.id, id),
          eq(schema.savedSearches.userId, ctx.user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Saved search not found' } },
        { status: 404 },
      );
    }

    await db().delete(schema.savedSearches).where(eq(schema.savedSearches.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const { error: err, status } = handleApiError(error, 'Failed to delete saved search');
    return NextResponse.json(err, { status });
  }
}

// ─── Export routes ──────────────────────────────────────────────

export const GET = withAuth(listHandler, {
  windowMs: 60_000,
  max: 60,
  namespace: 'saved-searches:list',
});
export const POST = withAuth(createHandler, {
  windowMs: 60_000,
  max: 30,
  namespace: 'saved-searches:create',
});
export const PATCH = withAuth(updateHandler, {
  windowMs: 60_000,
  max: 30,
  namespace: 'saved-searches:update',
});
export const DELETE = withAuth(deleteHandler, {
  windowMs: 60_000,
  max: 30,
  namespace: 'saved-searches:delete',
});
