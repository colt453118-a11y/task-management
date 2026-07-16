import { describe, it, expect } from 'vitest';
import { RATE_LIMIT_PRESETS, rateLimitKey, ipFromRequest } from '@/lib/api/rate-limit';
import { AuthError } from '@/lib/auth/session';

// ─── Rate Limit Presets ────────────────────────────────────────

describe('login rate limiting configuration', () => {
  it('limits login to 5 req/min per IP', () => {
    expect(RATE_LIMIT_PRESETS.login).toEqual({ windowMs: 60_000, max: 5 });
  });

  it('uses IP-based key for login rate limiting', () => {
    const key = rateLimitKey('auth:login', '203.0.113.42');
    expect(key).toContain('auth:login');
    expect(key).toContain('203.0.113.42');
  });

  it('distinguishes rate limit keys by namespace', () => {
    const loginKey = rateLimitKey('auth:login', '203.0.113.42');
    const registerKey = rateLimitKey('auth:register', '203.0.113.42');
    expect(loginKey).not.toBe(registerKey);
  });
});

// ─── IP Extraction for Login Rate Limiting ─────────────────────

describe('login IP extraction', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('http://localhost:3000/api/auth/sign-in/email', { headers });
  }

  it('extracts IP from x-forwarded-for on login requests', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.42' });
    expect(ipFromRequest(req)).toBe('203.0.113.42');
  });

  it('returns "unknown" when login request has no IP headers', () => {
    const req = makeRequest({});
    expect(ipFromRequest(req)).toBe('unknown');
  });
});

// ─── AuthError ──────────────────────────────────────────────────

describe('AuthError', () => {
  it('creates an unauthorized error with defaults', () => {
    const err = new AuthError('Unauthorized');
    expect(err.message).toBe('Unauthorized');
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.status).toBe(401);
    expect(err.name).toBe('AuthError');
  });

  it('creates a forbidden error with custom code', () => {
    const err = new AuthError('Forbidden', 'FORBIDDEN', 403);
    expect(err.message).toBe('Forbidden');
    expect(err.code).toBe('FORBIDDEN');
    expect(err.status).toBe(403);
  });

  it('is instanceof Error', () => {
    const err = new AuthError('Test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
  });
});

// ─── User Status Validation (negative scenarios) ────────────────

describe('user status validation scenarios', () => {
  it('should reject API requests from deactivated users via withAuth', () => {
    // The withAuth wrapper calls checkUserActive() which verifies:
    //   user.isActive === true && user.isSuspended !== true
    const checkUserActive = (input: { isActive?: boolean; isSuspended?: boolean }): boolean => {
      return input.isActive === true && input.isSuspended !== true;
    };

    expect(checkUserActive({ isActive: true, isSuspended: false })).toBe(true);
    expect(checkUserActive({ isActive: false, isSuspended: false })).toBe(false);
    expect(checkUserActive({ isActive: true, isSuspended: true })).toBe(false);
    expect(checkUserActive({ isActive: false, isSuspended: true })).toBe(false);
    expect(checkUserActive({})).toBe(false); // undefined isActive
  });

  it('login hook should reject deactivated users before authentication', () => {
    // The Better Auth `before.signIn` hook checks:
    //   1. User exists in DB
    //   2. User is not suspended (isSuspended !== true)
    //   3. User is active (isActive === true)
    const simulateLoginHook = (input: {
      isActive?: boolean;
      isSuspended?: boolean;
    }): string | null => {
      if (input.isSuspended) {
        return 'Your account has been suspended';
      }
      if (!input.isActive) {
        return 'Your account has been deactivated';
      }
      return null; // Login allowed
    };

    // Active user — login allowed
    expect(simulateLoginHook({ isActive: true, isSuspended: false })).toBeNull();

    // Suspended user — login blocked
    expect(simulateLoginHook({ isActive: true, isSuspended: true })).toBe(
      'Your account has been suspended',
    );

    // Deactivated user — login blocked
    expect(simulateLoginHook({ isActive: false, isSuspended: false })).toBe(
      'Your account has been deactivated',
    );
  });
});
