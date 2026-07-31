import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { checkRateLimit, rateLimitKey, ipFromRequest } from '@/lib/api/rate-limit';

export const runtime = 'nodejs';

/**
 * CSP Violation Report Collector
 *
 * Receives CSP violation reports from browsers (POST with
 * Content-Type: application/csp-report or application/json).
 *
 * Logs the report for monitoring and analysis.
 * Returns 204 No Content (browsers expect a success status).
 *
 * Security: This endpoint is intentionally unauthenticated
 * (CSP reports come from the browser, not from authenticated clients).
 * Rate limited at 60 req/min per IP to prevent log flooding.
 */
export async function POST(request: Request) {
  // Rate limit CSP reports: 60 req/min per IP (prevent log flooding)
  const ip = ipFromRequest(request);
  const key = rateLimitKey('csp-violation', ip);
  const rateResult = await checkRateLimit(key, { windowMs: 60_000, max: 60 });
  if (!rateResult.ok) {
    return new NextResponse(null, { status: 204 });
  }
  try {
    const contentType = request.headers.get('content-type') ?? '';

    // CSP reports can be sent as application/csp-report or application/json
    if (
      contentType.includes('application/csp-report') ||
      contentType.includes('application/json')
    ) {
      const report = await request.json();
      logger.warn(
        { cspReport: report },
        '[csp] Content Security Policy violation reported',
      );
    } else {
      // Some browsers send the body as text/plain
      const body = await request.text();
      logger.warn(
        { cspReportBody: body },
        '[csp] Content Security Policy violation reported (text body)',
      );
    }

    // Return 204 as per CSP spec — the browser expects a success response
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Log parse errors but always return 204 to avoid confusing the browser
    logger.error(
      { err: error instanceof Error ? error.message : error },
      '[csp] Failed to parse CSP violation report',
    );
    return new NextResponse(null, { status: 204 });
  }
}
