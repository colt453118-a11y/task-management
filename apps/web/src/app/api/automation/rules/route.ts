import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@workmanagement/database';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { handleApiError } from '@/lib/api/db';
import { z } from 'zod';

export const runtime = 'nodejs';

// ─── Validation Schema ─────────────────────────────────────

const RuleCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  trigger: z.string().min(1),
  conditions: z.array(z.unknown()).default([]),
  actions: z.array(z.unknown()).min(1, 'At least one action is required'),
  enabled: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(0).default(0),
});

// GET /api/automation/rules - List all rules for the org
export const GET = withAuth(
  async (_request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'settings:view');

      const rules = await getDb()
        .select()
        .from(schema.automationRules)
        .where(
          and(
            eq(schema.automationRules.organizationId, orgId!),
            isNull(schema.automationRules.deletedAt),
          ),
        )
        .orderBy(desc(schema.automationRules.createdAt));

      return NextResponse.json({ rules });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch automation rules');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'automation:list' },
);

// POST /api/automation/rules - Create a new rule
export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'settings:manage');

      const body = await request.json();
      const parsed = RuleCreateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') } },
          { status: 400 },
        );
      }

      const { name, description, trigger, conditions, actions, enabled, cooldownMinutes } =
        parsed.data;

      const [rule] = await getDb()
        .insert(schema.automationRules)
        .values({
          organizationId: orgId!,
          name,
          description: description ?? null,
          trigger,
          conditions,
          actions,
          enabled,
          cooldownMinutes,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      return NextResponse.json({ rule }, { status: 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to create automation rule');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'automation:create' },
);
