import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb, schema } from '@workmanagement/database';

let _auth: ReturnType<typeof betterAuth> | null = null;

/**
 * Returns a lazy singleton Better Auth instance.
 * The database connection is not established until the first call,
 * so module imports during next build won't fail without a DB.
 *
 * CSRF protection is provided by:
 * - SameSite=Lax cookies (configured below) — browser won't send
 *   session cookies on cross-site POST requests
 * - Better Auth's built-in fetch metadata / origin checks (default)
 * - Custom Origin/Referer validation in withAuth (see api-auth.ts)
 */
export function getAuth(): ReturnType<typeof betterAuth> {
  if (_auth) return _auth;

  _auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verificationTokens,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID ?? '',
        clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
      },
      microsoft: {
        clientId: process.env.AUTH_MICROSOFT_ID ?? '',
        clientSecret: process.env.AUTH_MICROSOFT_SECRET ?? '',
      },
    },
    session: {
      cookie: {
        name: 'session_token',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    rateLimit: {
      window: 60,
      max: 100,
    },
    // Deactivated/suspended user check is handled in withAuth()
    // via checkUserActive() at the API route level.
    // session.cookie.name config is accepted at runtime by better-auth
    // but is not reflected in its current type definitions.
    // The cast is scoped to the config object only; the return type is still
    // properly inferred via ReturnType<typeof betterAuth>.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ReturnType<typeof betterAuth>;

  return _auth;
}
