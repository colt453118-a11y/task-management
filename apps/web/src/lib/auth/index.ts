import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb, schema } from '@workmanagement/database';

let _auth: ReturnType<typeof betterAuth> | null = null;

/**
 * Returns a lazy singleton Better Auth instance.
 * The database connection is not established until the first call,
 * so module imports during next build won't fail without a DB.
 */
export function getAuth(): ReturnType<typeof betterAuth> {
  if (_auth) return _auth;

  _auth = betterAuth({
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
  }) as unknown as ReturnType<typeof betterAuth>;

  return _auth;
}
