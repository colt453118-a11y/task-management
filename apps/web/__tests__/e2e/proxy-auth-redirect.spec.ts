import { test, expect } from '@playwright/test';

// ─── Constants ──────────────────────────────────────────────────

const SESSION_COOKIE_NAME = 'better-auth.session_token';

// A realistic-looking session token for testing the middleware auth flow.
// The middleware only checks for the cookie's existence, not its validity.
// Full auth validation happens server-side in the API routes.
const MOCK_SESSION_TOKEN = 'mock-session-token-for-testing';

const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/health',
] as const;

const PROTECTED_ROUTES = [
  '/dashboard',
  '/dashboard/settings',
  '/tasks',
  '/teams',
  '/projects',
  '/reports',
  '/users',
  '/calendar',
] as const;

// ─── Helpers ────────────────────────────────────────────────────

async function expectRedirectToLogin(
  response: { status(): number; headers(): Record<string, string> },
  expectedRedirect: string,
) {
  expect(response.status()).toBe(307);
  const location = response.headers()['location'];
  expect(location).toBeTruthy();

  // The redirect Location header from Next.js is relative (e.g. '/auth/login?redirect=/dashboard').
  // Use the baseURL as a base to construct the full URL.
  const url = new URL(location!, 'http://localhost:3000');
  expect(url.pathname).toBe('/auth/login');
  expect(url.searchParams.get('redirect')).toBe(expectedRedirect);
}

// ─── Unauthenticated Access ─────────────────────────────────────

test.describe('unauthenticated access (no session cookie)', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redirects ${route} to /auth/login with redirect param`, async ({ request }) => {
      const response = await request.get(route, {
        maxRedirects: 0, // Don't follow redirects — we want to inspect the 307
      });
      await expectRedirectToLogin(response, route);
    });
  }

  for (const route of PUBLIC_ROUTES) {
    test(`does not redirect public route ${route}`, async ({ request }) => {
      const response = await request.get(route);
      // The middleware lets public routes through; status depends on whether
    // backing services (database, etc.) are available. The key assertion
    // is that the request is NOT redirected (status !== 307).
    expect(response.status()).not.toBe(307);
    });
  }

  test('redirects root (/) to /auth/login', async ({ request }) => {
    // The root page component does redirect('/auth/login') and the middleware also
    // redirects / to /auth/login?redirect=/. Both result in a redirect to login.
    const response = await request.get('/', {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    const location = response.headers()['location'];
    expect(location).toContain('/auth/login');
  });

  test('allows access to static files under /_next', async ({ request }) => {
    const response = await request.get('/_next/static/test.file', {
      maxRedirects: 0,
    });
    // Static files are allowed through; a 404 here means the file doesn't
    // exist (expected for a fake path), not that it was redirected.
    expect(response.status()).not.toBe(307);
  });
});

// ─── Authenticated Access ───────────────────────────────────────

test.describe('authenticated access (with session cookie)', () => {
  test.describe('protected routes serve normally (not redirected)', () => {
    for (const route of PROTECTED_ROUTES) {
      test(`passes ${route} through to the application`, async ({ request }) => {
        const response = await request.get(route, {
          headers: {
            Cookie: `${SESSION_COOKIE_NAME}=${MOCK_SESSION_TOKEN}`,
          },
          maxRedirects: 0,
        });
        // The middleware should let authenticated requests pass through.
        // Actual rendering may 404 or error without a real backend,
        // but the middleware should not redirect.
        expect(response.status()).not.toBe(307);
      });
    }
  });

  test('redirects /auth/login to /dashboard when already logged in', async ({ request }) => {
    const response = await request.get('/auth/login', {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${MOCK_SESSION_TOKEN}`,
      },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    const location = response.headers()['location'];
    expect(location).toContain('/dashboard');
  });
});

// ─── Redirect URL Preservation ──────────────────────────────────

test.describe('redirect URL preservation', () => {
  test('preserves nested path in redirect param', async ({ request }) => {
    const response = await request.get('/dashboard/settings/profile', {
      maxRedirects: 0,
    });
    await expectRedirectToLogin(response, '/dashboard/settings/profile');
  });

  test('uses pathname (not query string) in redirect param', async ({ request }) => {
    // The middleware uses request.nextUrl.pathname which excludes query parameters.
    // The query string is stripped, only the path is preserved in the redirect param.
    const response = await request.get('/tasks?status=open&priority=high', {
      maxRedirects: 0,
    });
    await expectRedirectToLogin(response, '/tasks');
  });

  test('preserves deep nested route', async ({ request }) => {
    const response = await request.get('/teams/departments/abc-123', {
      maxRedirects: 0,
    });
    await expectRedirectToLogin(response, '/teams/departments/abc-123');
  });
});

// ─── Cookie Name ────────────────────────────────────────────────

test.describe('session cookie name', () => {
  test('middleware uses correct session cookie name via redirect behavior', async ({ request }) => {
    // Verify that requests WITHOUT the better-auth.session_token cookie
    // get redirected to login, confirming middleware.ts uses the expected name.
    const response = await request.get('/dashboard', {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);

    // Now verify that requests WITH the correct cookie name pass through
    const authedResponse = await request.get('/dashboard', {
      headers: {
        Cookie: 'better-auth.session_token=mock-token',
      },
      maxRedirects: 0,
    });
    expect(authedResponse.status()).not.toBe(307);

    // And with a WRONG cookie name, the request should still be redirected
    const wrongCookieResponse = await request.get('/dashboard', {
      headers: {
        Cookie: 'wrong_cookie_name=mock-token',
      },
      maxRedirects: 0,
    });
    expect(wrongCookieResponse.status()).toBe(307);
  });
});

// ─── Public Path Prefixes ───────────────────────────────────────

test.describe('public path prefix matching', () => {
  test('allows /api/auth/* subpaths', async ({ request }) => {
    const response = await request.get('/api/auth/session', {
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(307);
  });

  test('allows /api/auth/callback/google', async ({ request }) => {
    const response = await request.get('/api/auth/callback/google', {
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(307);
  });
});
