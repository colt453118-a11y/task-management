import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, and, isNull } from 'drizzle-orm';
import { handleApiError } from '@/lib/api/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const RuleUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  trigger: z.string().optional(),
  conditions: z.array(z.unknown()).optional(),
  actions: z.array(z.unknown()).min(1).optional(),
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(0).optional(),
});

function getIdFromPath(request: NextRequest): string {
  return request.nextUrl.pathname.split('/').pop()!;
}

// GET /api/automation/rules/[id] - Get a single rule
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'settings:view');

      const [rule] = await getDb()
        .select()
        .from(schema.automationRules)
        .where(
          and(
            eq(schema.automationRules.id, id),
            eq(schema.automationRules.organizationId, orgId!),
            isNull(schema.automationRules.deletedAt),
          ),
        )
        .limit(1);

      if (!rule) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Rule not found' } },
          { status: 404 },
        );
      }

      // Also fetch recent logs for this rule
      const logs = await getDb()
        .select()
        .from(schema.automationLogs)
        .where(eq(schema.automationLogs.ruleId, id))
        .orderBy(schema.automationLogs.createdAt)
        .limit(20);

      return NextResponse.json({ rule, logs });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch rule');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'automation:get' },
);

// PATCH /api/automation/rules/[id] - Update a rule
export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'settings:manage');

      const body = await request.json();
      const parsed = RuleUpdateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') } },
          { status: 400 },
        );
      }

      const [existing] = await getDb()
        .select()
        .from(schema.automationRules)
        .where(
          and(
            eq(schema.automationRules.id, id),
            eq(schema.automationRules.organizationId, orgId!),
            isNull(schema.automationRules.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Rule not found' } },
          { status: 404 },
        );
      }

      const [rule] = await getDb()
        .update(schema.automationRules)
        .set({
          ...parsed.data,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.automationRules.id, id))
        .returning();

      return NextResponse.json({ rule });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update rule');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'automation:update' },
);

// DELETE /api/automation/rules/[id] - Soft delete a rule
export const DELETE = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const id = getIdFromPath(request);
      await requirePermission(user.id, 'settings:manage');

      const [existing] = await getDb()
        .select()
        .from(schema.automationRules)
        .where(
          and(
            eq(schema.automationRules.id, id),
            eq(schema.automationRules.organizationId, orgId!),
            isNull(schema.automationRules.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Rule not found' } },
          { status: 404 },
        );
      }

      await getDb()
        .update(schema.automationRules)
        .set({ deletedAt: new Date(), updatedBy: user.id, updatedAt: new Date() })
        .where(eq(schema.automationRules.id, id));

      return NextResponse.json({ success: true });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to delete rule');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'automation:delete' },
);
