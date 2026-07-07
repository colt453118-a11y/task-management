import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Skip Sentry init if no DSN is configured (dev/local)
  if (!process.env.SENTRY_DSN) {
    console.log('[sentry] Skipping initialization — SENTRY_DSN not set');
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : undefined,
      // Capture unhandled rejections and exceptions
      integrations: [
        Sentry.httpIntegration(),
        Sentry.extraErrorDataIntegration({ depth: 5 }),
      ],
      // Only track errors, not debug messages
      beforeSend(event) {
        if (event.exception) {
          console.error('[sentry] Captured error:', event.exception.values?.[0]?.value);
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
    });
  }
}
