import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { eq, and } from 'drizzle-orm';
import { createHmac } from 'crypto';
import { isPublicWebhookUrl } from '@/lib/webhooks/url-guard';
import { safeWebhookDispatcher } from '@/lib/webhooks/pinned-lookup';

export const runtime = 'nodejs';

// ─── POST /api/webhooks/test - Send a test ping to a webhook URL ──
// This creates a test delivery log entry and attempts to send a
// real HTTP request to verify the webhook endpoint is reachable.

export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'integration:edit');

      const body = await request.json();
      const { id } = body;

      if (!id) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Webhook ID is required' } },
          { status: 400 },
        );
      }

      // Fetch the webhook subscription
      const [subscription] = await db()
        .select()
        .from(schema.webhookSubscriptions)
        .where(
          and(
            eq(schema.webhookSubscriptions.id, id),
            eq(schema.webhookSubscriptions.organizationId, orgId!),
          ),
        )
        .limit(1);

      if (!subscription) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
          { status: 404 },
        );
      }

      // Build test payload
      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test ping from WorkManager',
          webhookId: subscription.id,
          webhookName: subscription.name,
        },
      };

      const payloadJson = JSON.stringify(testPayload);

      // Sign the payload with the webhook secret for HMAC verification
      const signature = createHmac('sha256', subscription.secret)
        .update(payloadJson)
        .digest('hex');

      const startTime = Date.now();
      let responseStatusCode: number | null = null;
      let responseBody: string | null = null;
      let responseHeaders: Record<string, string> | null = null;
      let errorMessage: string | null = null;
      let success = false;

      // Attempt to send the webhook
      try {
        // SSRF guard + connect-time IP pinning (mirrors the delivery path):
        // reject literal private hosts and pin the socket to a validated public
        // IP so a public host that resolves to an internal address is blocked.
        const guard = isPublicWebhookUrl(subscription.url);
        if (!guard.ok) {
          throw new Error(`Blocked: ${guard.reason}`);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': 'webhook.test',
            'User-Agent': 'WorkManager-Webhook/1.0',
            ...(subscription.headers as Record<string, string> ?? {}),
          },
          body: payloadJson,
          signal: controller.signal,
          redirect: 'error',
          dispatcher: safeWebhookDispatcher,
        } as RequestInit & { dispatcher: unknown });

        clearTimeout(timeout);

        responseStatusCode = response.status;
        responseHeaders = Object.fromEntries(response.headers.entries());
        responseBody = (await response.text()).slice(0, 2000); // Limit response body size
        success = response.ok;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Failed to send webhook';
        success = false;
      }

      const durationMs = Date.now() - startTime;

      // Log the delivery attempt
      await db().insert(schema.webhookDeliveryLogs).values({
        subscriptionId: subscription.id,
        eventType: 'webhook.test',
        payload: testPayload,
        requestHeaders: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'webhook.test',
          'User-Agent': 'WorkManager-Webhook/1.0',
        },
        responseStatusCode,
        responseHeaders,
        responseBody,
        durationMs,
        success,
        errorMessage,
        attempt: 1,
      });

      return NextResponse.json({
        success,
        durationMs,
        statusCode: responseStatusCode,
        responseBody,
        errorMessage,
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to test webhook');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 15, namespace: 'webhooks:test' },
);
