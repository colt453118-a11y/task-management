import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb, schema } from '@workmanagement/database';
import { eq } from 'drizzle-orm';

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
    // ── Auth Negative Testing: Reject deactivated users on login ──
    // Before a user is authenticated, check that their account is
    // still active and not suspended. This catches deactivation at
    // login time rather than only at API route time.
    hooks: {
      before: {
        signIn: async ({ user }: { user: { id: string } }) => {
          if (!user?.id) return;
          try {
            const db = getDb();
            const [found] = await db
              .select({
                isActive: schema.users.isActive,
                isSuspended: schema.users.isSuspended,
              })
              .from(schema.users)
              .where(eq(schema.users.id, user.id))
              .limit(1);

            if (!found) {
              throw new Error('Account not found');
            }

            if (found.isSuspended) {
              throw new Error('Your account has been suspended. Contact your administrator.');
            }

            if (!found.isActive) {
              throw new Error('Your account has been deactivated. Contact your administrator.');
            }
          } catch (err) {
            if (
              err instanceof Error &&
              (err.message === 'Account not found' ||
               err.message === 'Your account has been suspended. Contact your administrator.' ||
               err.message === 'Your account has been deactivated. Contact your administrator.')
            ) {
              throw err;
            }
            console.error('[auth] Login status check failed:', err);
          }
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as unknown as ReturnType<typeof betterAuth>;

  return _auth;
}
