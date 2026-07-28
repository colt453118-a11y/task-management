import { NextResponse } from 'next/server';
import { checkOverdueTasks } from '@/lib/automation/overdue';

export const runtime = 'nodejs';

// ─── Configuration ──────────────────────────────────────────

/**
 * The CRON_SECRET is used to authenticate cron job requests.
 * Set this in your .env file and pass it as a Bearer token
 * or ?secret= query parameter when calling this endpoint.
 */
const CRON_SECRET = process.env.CRON_SECRET;

// ─── Auth Check ─────────────────────────────────────────────

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) {
    // If no secret is configured, only allow in dev mode
    return process.env.NODE_ENV === 'development';
  }

  // Check Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;

  // Check query parameter
  const url = new URL(request.url);
  if (url.searchParams.get('secret') === CRON_SECRET) return true;

  return false;
}

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
  if (!isAuthorized(request)) {
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
