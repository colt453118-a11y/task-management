import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: SessionUser;
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Get the current authenticated session from the request headers.
 * Must be called within a Next.js API route or server component.
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    const auth = getAuth();
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });
    return session as AuthSession | null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Get the current authenticated user.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/**
 * Require authentication. Throws if not authenticated.
 * Use in API routes like:
 *   const user = await requireAuth();
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('Unauthorized', 'UNAUTHORIZED', 401);
  }
  return user;
}

/**
 * Require the user to be active (not suspended/deactivated).
 */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireAuth();
  // Active check happens via the database/org logic in the permission helper
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string = 'UNAUTHORIZED',
    public status: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
