import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

// ─── Helpers ───────────────────────────────────────────────────

function generateSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

// ─── GET - List webhook subscriptions ─────────────────────────

export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'integration:view');

      const { searchParams } = new URL(request.url);
      const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

      const subscriptions = await db()
        .select()
        .from(schema.webhookSubscriptions)
        .where(
          and(
            eq(schema.webhookSubscriptions.organizationId, orgId!),
            isNull(schema.webhookSubscriptions.deletedAt),
          ),
        )
        .orderBy(desc(schema.webhookSubscriptions.createdAt))
        .limit(limit)
        .offset(offset);

      // Never expose the webhook secret in API responses
      const safeList = subscriptions.map(({ secret: _secret, ...rest }) => ({
        ...rest,
        hasSecret: true,
      }));

      return NextResponse.json({ subscriptions: safeList });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to fetch webhooks');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 100, namespace: 'webhooks:list' },
);

// ─── POST - Create webhook subscription ───────────────────────

export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'integration:create');

      const body = await request.json();
      const { name, url, events, headers, retryCount, retryIntervalMs, timeoutMs } = body;

      // Validate required fields
      if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'name, url, and events (non-empty array) are required',
            },
          },
          { status: 400 },
        );
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook URL' } },
          { status: 400 },
        );
      }

      // Validate events against known list
      const VALID_EVENTS = [
        'task.created',
        'task.updated',
        'task.deleted',
        'task.status_changed',
        'task.assigned',
        'task.comment_added',
        'project.created',
        'project.updated',
        'project.deleted',
      ];
      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid events: ${invalidEvents.join(', ')}`,
            },
          },
          { status: 400 },
        );
      }

      const secret = generateSecret();

      const [subscription] = await db()
        .insert(schema.webhookSubscriptions)
        .values({
          organizationId: orgId!,
          name,
          url,
          secret, // Stored as-is for HMAC signing; access protected by RBAC
          events,
          headers: headers ?? {},
          retryCount: retryCount ?? 3,
          retryIntervalMs: retryIntervalMs ?? 5000,
          timeoutMs: timeoutMs ?? 10000,
          createdBy: user.id,
        })
        .returning();

      if (!subscription) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook' } },
          { status: 500 },
        );
      }

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'webhook.created',
        entityType: 'webhook',
        entityId: subscription.id,
        newValues: { name, url, events },
      });

      // Return the raw secret only on creation — it cannot be retrieved later
      const { secret: _secret, ...safeSub } = subscription;
      return NextResponse.json(
        {
          subscription: {
            ...safeSub,
            rawSecret: secret,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to create webhook');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'webhooks:create' },
);

// ─── PATCH - Update webhook subscription ──────────────────────

export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'integration:edit');

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Webhook ID is required' } },
          { status: 400 },
        );
      }

      const body = await request.json();
      const { name, url, events, isActive, retryCount, retryIntervalMs, timeoutMs } = body;

      // Verify ownership
      const [existing] = await db()
        .select()
        .from(schema.webhookSubscriptions)
        .where(
          and(
            eq(schema.webhookSubscriptions.id, id),
            eq(schema.webhookSubscriptions.organizationId, orgId!),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
          { status: 404 },
        );
      }

      const updateData: Record<string, unknown> = {};

      if (name !== undefined) updateData.name = name;
      if (url !== undefined) {
        try {
          new URL(url);
          updateData.url = url;
        } catch {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook URL' } },
            { status: 400 },
          );
        }
      }
      if (events !== undefined) updateData.events = events;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (retryCount !== undefined) updateData.retryCount = retryCount;
      if (retryIntervalMs !== undefined) updateData.retryIntervalMs = retryIntervalMs;
      if (timeoutMs !== undefined) updateData.timeoutMs = timeoutMs;

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
          { status: 400 },
        );
      }

      updateData.updatedAt = new Date();

      const [updated] = await db()
        .update(schema.webhookSubscriptions)
        .set(updateData)
        .where(eq(schema.webhookSubscriptions.id, id))
        .returning();

      const { secret: _secret, ...safeSub } = updated!;
      return NextResponse.json({ subscription: { ...safeSub, hasSecret: true } });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to update webhook');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'webhooks:update' },
);

// ─── DELETE - Soft delete webhook subscription ────────────────

export const DELETE = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'integration:delete');

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Webhook ID is required' } },
          { status: 400 },
        );
      }

      const [existing] = await db()
        .select()
        .from(schema.webhookSubscriptions)
        .where(
          and(
            eq(schema.webhookSubscriptions.id, id),
            eq(schema.webhookSubscriptions.organizationId, orgId!),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
          { status: 404 },
        );
      }

      await db()
        .update(schema.webhookSubscriptions)
        .set({ deletedAt: new Date(), isActive: false })
        .where(
          and(
            eq(schema.webhookSubscriptions.id, id),
            eq(schema.webhookSubscriptions.organizationId, orgId!),
          ),
        );

      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'webhook.deleted',
        entityType: 'webhook',
        entityId: id,
        oldValues: { name: existing.name, url: existing.url },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to delete webhook');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'webhooks:delete' },
);
