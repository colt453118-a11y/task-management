import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { testSlackWebhook } from '@/lib/slack/webhook';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    await requirePermission(user.id, 'settings:manage');
    try {
      const body = await request.json();
      const { webhookUrl } = body;

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return NextResponse.json(
          { error: 'Invalid webhook URL' },
          { status: 400 },
        );
      }

      const result = await testSlackWebhook(webhookUrl);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 },
      );
    }
  },
  { windowMs: 60_000, max: 10, namespace: 'slack:test' },
);
