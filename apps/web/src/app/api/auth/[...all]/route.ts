import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { checkRateLimit, rateLimitKey, ipFromRequest } from '@/lib/api/rate-limit';
import { getDb, schema } from '@workmanagement/database';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';

let _handler: {
  POST: (req: Request) => Promise<Response>;
  GET: (req: Request) => Promise<Response>;
} | null = null;

async function getHandler() {
  if (!_handler) {
    const { toNextJsHandler } = await import('better-auth/next-js');
    _handler = toNextJsHandler(getAuth());
  }
  return _handler;
}

// ─── New User Org Assignment ────────────────────────────────────

/**
 * Assign a newly registered user to the default organization and
 * grant them the "member" role so they can immediately access
 * org-scoped data (tasks, projects, etc.).
 *
 * Runs fire-and-forget after a successful signup — never blocks
 * the auth response.
 */
async function assignNewUserToOrg(userId: string): Promise<void> {
  try {
    const db = getDb();

    // Find the default organization (created by db:seed)
    const [org] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, 'default'))
      .limit(1);

    if (!org) {
      console.warn('[auth] No default organization found — new user will have no org context');
      return;
    }

    // Update the user's organization_id
    await db
      .update(schema.users)
      .set({ organizationId: org.id })
      .where(eq(schema.users.id, userId));

    // Find the "member" role for this org
    const [memberRole] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.slug, 'member'),
          eq(schema.roles.organizationId, org.id),
        ),
      )
      .limit(1);

    if (memberRole) {
      await db
        .insert(schema.userRoles)
        .values({
          userId,
          roleId: memberRole.id,
        })
        .onConflictDoNothing();
    }

    logger.info(`[auth] New user ${userId} assigned to default org and member role`);
  } catch (err) {
    // Log but never fail the signup — this is a best-effort assignment
    console.error('[auth] Failed to assign org/role to new user:', err);
  }
}

// ─── Rate-limited Auth Handler ───────────────────────────────────

/**
 * Rate limit login attempts by IP: 5 req / 60s window.
 * We only apply this to POST requests that look like login attempts
 * (i.e. have a body with email/password). Other auth endpoints like
 * register, forgot-password get a more lenient limit.
 */
async function rateLimitAuthRequest(request: Request): Promise<Response | null> {
  try {
    // Only rate limit POST requests
    if (request.method !== 'POST') return null;

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');

    // Determine which auth action this is based on the URL path
    const isSignIn = /\/auth\/sign-in\/email$/.test(path) || /\/auth\/sign-in$/.test(path);
    const isSignUp = /\/auth\/register$/.test(path) || /\/sign-up\/email$/.test(path);

    if (isSignIn) {
      // Strict rate limiting for login: 5 req/min per IP
      const ip = ipFromRequest(request);
      const key = rateLimitKey('auth:login', ip);
      const result = await checkRateLimit(key, { windowMs: 60_000, max: 5 });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many login attempts. Please try again later.',
              retryAfter: Math.max(1, result.reset - Math.floor(Date.now() / 1000)),
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))),
            },
          },
        );
      }
    } else if (isSignUp) {
      // Moderate rate limiting for registration: 3 req/min per IP
      const ip = ipFromRequest(request);
      const key = rateLimitKey('auth:register', ip);
      const result = await checkRateLimit(key, { windowMs: 60_000, max: 3 });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many registration attempts. Please try again later.',
              retryAfter: Math.max(1, result.reset - Math.floor(Date.now() / 1000)),
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))),
            },
          },
        );
      }
    }
    // For password reset, forgot-password, etc., we don't apply strict rate limiting
    // (Better Auth's built-in 100 req/min global rate limit is sufficient)
  } catch (err) {
    // Log but don't block — fail open
    console.error('[rate-limit] Auth rate limit check failed:', err);
  }
  return null;
}

export async function POST(request: Request) {
  const blocked = await rateLimitAuthRequest(request);
  if (blocked) return blocked;
  const h = await getHandler();
  const response = await h.POST(request);

  // ── Auto-assign new users to default org ────────────────
  // Only runs for successful signups (not sign-ins or other auth actions).
  // Assigns the user to the default organization and member role so
  // they can immediately access org-scoped data without manual admin intervention.
  if (response.status === 200) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const isSignUp = /\/auth\/register$/.test(path) || /\/sign-up\/email$/.test(path);

    if (isSignUp) {
      try {
        const body = await response.clone().json();
        if (body?.user?.id) {
          // Fire-and-forget — never block the auth response
          assignNewUserToOrg(body.user.id);
        }
      } catch {
        // Response body may not be parseable (e.g. non-JSON)
      }
    }
  }

  return response;
}

export async function GET(request: Request) {
  const h = await getHandler();
  return h.GET(request);
}
