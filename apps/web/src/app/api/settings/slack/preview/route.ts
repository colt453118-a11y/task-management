import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { sendSlackNotification } from '@/lib/slack/webhook';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (_request: NextRequest, { orgId }) => {
    try {
      if (!orgId) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 400 },
        );
      }

      // Send a preview notification
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🔔 *WorkManager Test Notification*\n\nThis is a preview message to verify your Slack integration is working correctly.',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*What you\'ll receive:*\n• Task assignments\n• Status updates\n• Comments & mentions\n• Due date reminders',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Sent from WorkManager • <https://workmanager.com|Open App>',
            },
          ],
        },
      ];

      await sendSlackNotification(orgId, {
        text: '🔔 WorkManager Test Notification',
        blocks,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to send preview' },
        { status: 500 },
      );
    }
  },
  { windowMs: 60_000, max: 5, namespace: 'slack:preview' },
);
