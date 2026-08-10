/**
 * Shared authorization gate for cron / scheduled endpoints (the routes that run
 * outside a user session: deadline checks, overdue automation, EOD snapshots).
 *
 * Fails CLOSED. If `CRON_SECRET` is not configured it is allowed only outside
 * production (dev/test convenience) — in production an unset secret denies every
 * request, so a forgotten secret can never leave these endpoints publicly
 * triggerable. When configured, the secret must be supplied via
 * `Authorization: Bearer <secret>` or a `?token=` / `?secret=` query parameter.
 *
 * Accepts a standard `Request` (works for both `Request` and `NextRequest`).
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const params = new URL(request.url).searchParams;
  return params.get('token') === secret || params.get('secret') === secret;
}
