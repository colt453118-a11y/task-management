import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { checkRateLimit, rateLimitKey, ipFromRequest } from '@/lib/api/rate-limit';

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
  return h.POST(request);
}

export async function GET(request: Request) {
  const h = await getHandler();
  return h.GET(request);
}
