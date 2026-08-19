import { getDb, schema } from '@workmanagement/database';
import { eq, and } from 'drizzle-orm';
import { isPublicWebhookUrl } from '../webhooks/url-guard';
import { safeWebhookDispatcher } from '../webhooks/pinned-lookup';

// ─── Types ──────────────────────────────────────────────────

export interface SlackMessage {
  text: string;
  blocks?: Array<Record<string, unknown>>;
}

// ─── Send to Slack ──────────────────────────────────────────

/**
 * Send a message to a Slack Incoming Webhook URL.
 */
async function sendToWebhook(
  webhookUrl: string,
  message: SlackMessage,
): Promise<{ success: boolean; error?: string }> {
  // SSRF guard: reject literal private/reserved hosts up front, and pin the
  // connection to a validated public IP at connect time (defeats DNS rebinding)
  // — same protection the generic webhook delivery path uses.
  const guard = isPublicWebhookUrl(webhookUrl);
  if (!guard.ok) {
    return { success: false, error: `Blocked: ${guard.reason}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message.text,
        blocks: message.blocks,
      }),
      signal: controller.signal,
      redirect: 'error', // never follow redirects (could point at an internal target)
      dispatcher: safeWebhookDispatcher,
    } as RequestInit & { dispatcher: unknown });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a Slack notification for an organization.
 * Fire-and-forget - never throws.
 */
export async function sendSlackNotification(
  organizationId: string,
  message: SlackMessage,
): Promise<void> {
  try {
    const db = getDb();

    const [integration] = await db
      .select()
      .from(schema.slackIntegrations)
      .where(
        and(
          eq(schema.slackIntegrations.organizationId, organizationId),
          eq(schema.slackIntegrations.isActive, true),
        ),
      )
      .limit(1);

    if (!integration) return;

    const result = await sendToWebhook(integration.webhookUrl, message);

    await db
      .update(schema.slackIntegrations)
      .set({
        lastUsedAt: new Date(),
        lastError: result.success ? null : result.error,
        updatedAt: new Date(),
      })
      .where(eq(schema.slackIntegrations.id, integration.id));
  } catch {
    // Non-critical
  }
}

/**
 * Test a Slack webhook URL.
 */
export async function testSlackWebhook(webhookUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return sendToWebhook(webhookUrl, {
    text: '✅ WorkManager test notification - connection successful!',
  });
}
