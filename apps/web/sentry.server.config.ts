/**
 * Sentry Server Configuration
 *
 * This file configures the Sentry SDK for the Next.js server runtime.
 * It captures unhandled exceptions, performance traces, and API route errors.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Traces sample rate — adjust based on traffic volume
  tracesSampleRate:
    process.env.NODE_ENV === 'production'
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.25)
      : 0.0,

  // Enable profiling (requires @sentry/profiling-node in older versions;
  // in recent SDKs it's bundled or auto-enabled)
  profilesSampleRate:
    process.env.NODE_ENV === 'production'
      ? Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1)
      : 0.0,

  // Only send events in production
  enabled: process.env.NODE_ENV === 'production',

  // Ignore common operational noise
  ignoreErrors: [
    'NextRouter was not mounted',
    'Cancelled',
    'AbortError',
  ],

  // Attach request info to events for context
  sendDefaultPii: false,
});
