/**
 * Sentry Edge Configuration
 *
 * This file configures the Sentry SDK for the Next.js edge runtime
 * (middleware, edge API routes). Edge runtime has limited API surface.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Lower sample rate for edge — these are typically short-lived
  tracesSampleRate:
    process.env.NODE_ENV === 'production'
      ? Number(process.env.SENTRY_EDGE_TRACES_SAMPLE_RATE ?? 0.1)
      : 0.0,

  // Only send events in production
  enabled: process.env.NODE_ENV === 'production',
});
