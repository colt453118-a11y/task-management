import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

// ─── Type for EOD settings stored within org settings ────────

export interface EODSettings {
  /** Preferred time for auto-generation (HH:mm format, e.g. "17:00") */
  preferredTime: string;
  /** Whether to generate AI summaries for EOD snapshots */
  aiSummaryEnabled: boolean;
}

// PATCH /api/organization/settings - Update organization-level settings
// Only users with 'org:settings' permission can update settings.
export const PATCH = withAuth(
  async (request: Request, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'org:settings');

      if (!orgId) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'No organization found' } },
          { status: 404 },
        );
      }

      const body = await request.json().catch(() => ({}));
      const { eod } = body as { eod?: Partial<EODSettings> };

      if (!eod || typeof eod !== 'object') {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Request body must include an "eod" object' } },
          { status: 400 },
        );
      }

      // Validate EOD settings
      if (eod.preferredTime !== undefined) {
        const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timePattern.test(eod.preferredTime)) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'preferredTime must be in HH:mm format (e.g. "17:00")' } },
            { status: 400 },
          );
        }
      }

      if (eod.aiSummaryEnabled !== undefined && typeof eod.aiSummaryEnabled !== 'boolean') {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'aiSummaryEnabled must be a boolean' } },
          { status: 400 },
        );
      }

      // ── Read current settings ─────────────────────────────
      const [org] = await db()
        .select({ settings: schema.organizations.settings })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, orgId))
        .limit(1);

      if (!org) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Organization not found' } },
          { status: 404 },
        );
      }

      // ── Merge EOD settings into existing org settings ─────
      const currentSettings = (org.settings as Record<string, unknown>) ?? {};
      const currentEOD = (currentSettings.eod as Partial<EODSettings>) ?? {};

      const updatedEOD: EODSettings = {
        preferredTime: eod.preferredTime ?? currentEOD.preferredTime ?? '17:00',
        aiSummaryEnabled: eod.aiSummaryEnabled ?? currentEOD.aiSummaryEnabled ?? true,
      };

      const updatedSettings = {
        ...currentSettings,
        eod: updatedEOD,
      };

      // ── Persist ───────────────────────────────────────────
      await db()
        .update(schema.organizations)
        .set({
          settings: updatedSettings as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.organizations.id, orgId));

      return NextResponse.json({
        ok: true,
        eod: updatedEOD,
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update organization settings');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'org:settings:update' },
);
