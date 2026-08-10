import { NextResponse } from 'next/server';
import { checkOverdueTasks } from '@/lib/automation/overdue';
import { isCronAuthorized } from '@/lib/api/cron-auth';

export const runtime = 'nodejs';

// ─── POST /api/automation/check-overdue ────────────────────
//
// Called by an external cron job (e.g., cron-job.org, Railway cron,
// system crontab). Checks for tasks past their due date and fires
// the 'task.overdue' automation trigger for each one.
//
// Set up to run every 15-30 minutes via your cron provider:
//   POST https://your-domain.com/api/automation/check-overdue
//   Authorization: Bearer your-cron-secret
//
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
      { status: 401 },
    );
  }

  try {
    const startTime = Date.now();
    const result = await checkOverdueTasks();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      durationMs,
      ...result,
    });
  } catch (error) {
    console.error('[overdue] Check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// GET /api/automation/check-overdue - Also support GET for simpler cron setups
export async function GET(request: Request) {
  return POST(request);
}
