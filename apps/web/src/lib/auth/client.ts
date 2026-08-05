import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // `||` (not `??`) so an empty string from an unset Docker build arg also
  // falls back to localhost instead of producing a broken relative/empty URL.
  // In production the Dockerfile bakes the real URL via ARG NEXT_PUBLIC_APP_URL.
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});
