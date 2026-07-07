import * as Sentry from '@sentry/nextjs';

/**
 * Capture an exception to Sentry with optional context.
 * Safe to call even if Sentry isn't configured (no-op).
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) {
    // Sentry not configured — skip silently
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[sentry] Would capture:', error);
    }
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a message to Sentry with severity level.
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'error'): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureMessage(message, level);
}

/**
 * Set the current user in Sentry context.
 */
export function setSentryUser(user: { id: string; email?: string; name?: string } | null): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.setUser(user);
}

/**
 * Set a tag in Sentry context (e.g., { 'org': orgId }).
 */
export function setSentryTag(key: string, value: string): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.setTag(key, value);
}
