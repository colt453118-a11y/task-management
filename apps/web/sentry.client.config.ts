/**
 * Sentry Client Configuration
 *
 * This file configures the Sentry SDK for the browser (client-side).
 * It is loaded at app startup and initializes error and performance
 * monitoring for the frontend.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // We recommend adjusting this value in production, or using
  // a sample rate that varies by environment:
  //   production: 0.25–0.5
  //   development: 0.0 (or omit entirely)
  tracesSampleRate:
    process.env.NODE_ENV === 'production'
      ? Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.25)
      : 0.0,

  // Replay captures the user session for debugging
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable all integrations by default
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Only send events in production
  enabled: process.env.NODE_ENV === 'production',

  // Ignore common frontend errors that are not actionable
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Network request failed',
    'Failed to fetch',
    'AbortError',
    /^Loading chunk .* failed/,
  ],

  // Deny URLs that are not our app
  denyUrls: [
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /safari-extension:\/\//i,
  ],
});
