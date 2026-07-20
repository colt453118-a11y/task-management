import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { getDb, schema } from '@workmanagement/database';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const NotificationPreferencesSchema = z.object({
  channels: z
    .object({
      inApp: z.boolean().default(true),
      email: z.boolean().default(true),
      push: z.boolean().default(false),
    })
    .optional(),
  types: z
    .object({
      task_assigned: z.boolean().default(true),
      task_comment: z.boolean().default(true),
      task_status_changed: z.boolean().default(true),
      task_mention: z.boolean().default(true),
      task_due_soon: z.boolean().default(true),
      task_overdue: z.boolean().default(true),
      task_escalated: z.boolean().default(true),
      task_completed: z.boolean().default(false),
      task_closed: z.boolean().default(false),
      task_reopened: z.boolean().default(false),
    })
    .optional(),
  digest: z
    .object({
      enabled: z.boolean().default(false),
      frequency: z.enum(['daily', 'weekly', 'never']).default('daily'),
    })
    .optional(),
});

export const PATCH = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = NotificationPreferencesSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid preferences',
              details: parsed.error.flatten().fieldErrors,
            },
          },
          { status: 400 },
        );
      }

      const db = getDb();

      // Merge with existing preferences
      const [existing] = await db
        .select({ preferences: schema.users.preferences })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      const currentPrefs = (existing?.preferences as Record<string, unknown>) ?? {};
      const updatedPrefs = {
        ...currentPrefs,
        notifications: {
          ...((currentPrefs.notifications as Record<string, unknown>) ?? {}),
          ...parsed.data,
        },
      };

      await db
        .update(schema.users)
        .set({
          preferences: updatedPrefs as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));

      return NextResponse.json({ preferences: updatedPrefs });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to update preferences' } },
        { status: 500 },
      );
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'preferences:update' },
);

export const GET = withAuth(
  async (_request: NextRequest, { user }) => {
    try {
      const db = getDb();
      const [existing] = await db
        .select({ preferences: schema.users.preferences })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      const notifPrefs =
        ((existing?.preferences as Record<string, unknown>)?.notifications as Record<string, unknown>) ??
        {};

      return NextResponse.json({ preferences: notifPrefs });
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch preferences' } },
        { status: 500 },
      );
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'preferences:read' },
);
