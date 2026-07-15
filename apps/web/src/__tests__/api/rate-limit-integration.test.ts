import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════

const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════
// Module-level mocks
//
// We do NOT mock next/server — the real NextResponse.json is needed
// so that the real rateLimitResponse and addRateLimitHeaders helpers
// (used via importOriginal below) produce proper response objects.
//
// We mock auth/session so requireAuth() resolves without a database,
// and CSRF + DB lookups are bypassed. Only checkRateLimit is mocked
// in the rate-limit module (it depends on Redis). The rest of the
// rate-limit helpers (rateLimitResponse, addRateLimitHeaders) are
// real, verifying that the actual response formatting works.
// ═══════════════════════════════════════════════════════════════════

vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ),
  AuthError: class AuthError extends Error {
    code: string;
    status: number;
    constructor(message: string, code = 'UNAUTHORIZED', status = 401) {
      super(message);
      this.name = 'AuthError';
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock('@/lib/api/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/rate-limit')>();
  return {
    ...actual,
    checkRateLimit: mockCheckRateLimit,
    rateLimitKey: vi.fn((ns: string, id: string) => `rl:${ns}:${id}`),
    ipFromRequest: vi.fn(() => '127.0.0.1'),
  };
});

vi.mock('@/lib/api/csrf', () => ({
  getAllowedOrigins: vi.fn(() => ['http://localhost:3000']),
  validateOrigin: vi.fn(() => ({ valid: true })),
  validateReferer: vi.fn(() => ({ valid: true })),
  csrfErrorResponse: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@workmanagement/database', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() =>
            Promise.resolve([
              { organizationId: 'org-1', isActive: true, isSuspended: false },
            ]),
          ),
        })),
      })),
    })),
  })),
  schema: { users: {} },
}));

// ═══════════════════════════════════════════════════════════════════
// Imports — run after mocks are in place
// ═══════════════════════════════════════════════════════════════════

import { withAuth } from '@/lib/auth/api-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createRequest(method: string): NextRequest {
  return {
    method,
    nextUrl: { pathname: '/api/tasks/task-123' },
    headers: new Map(),
  } as unknown as NextRequest;
}

const noopHandler = vi.fn(async () => NextResponse.json({ success: true }));

const rateLimitConfig = {
  windowMs: 60_000,
  max: 5,
  namespace: 'test:endpoint',
};

const successResult = {
  ok: true,
  limit: 5,
  remaining: 4,
  reset: Math.floor(Date.now() / 1000) + 60,
};

const blockedResult = {
  ok: false,
  limit: 5,
  remaining: 0,
  reset: Math.floor(Date.now() / 1000) + 30,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue(successResult);
});

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe('withAuth — rate limiting (user-based)', () => {
  const config = { ...rateLimitConfig, key: 'user' as const };

  it('passes request through when rate limit is not exceeded', async () => {
    const handler = withAuth(noopHandler, config);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('rl:test:endpoint:user-1', {
      windowMs: 60_000,
      max: 5,
    });
    expect(noopHandler).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = withAuth(noopHandler, config);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(429);
    expect(noopHandler).not.toHaveBeenCalled();
  });

  it('uses user ID as the rate limit identifier (not IP)', async () => {
    const handler = withAuth(noopHandler, config);
    await handler(createRequest('GET'));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('user-1'),
      expect.any(Object),
    );
  });
});

describe('withAuth — rate limiting (IP-based)', () => {
  const config = { ...rateLimitConfig, key: 'ip' as const };

  it('passes request through when rate limit is not exceeded', async () => {
    const handler = withAuth(noopHandler, config);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('rl:test:endpoint:127.0.0.1', {
      windowMs: 60_000,
      max: 5,
    });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = withAuth(noopHandler, config);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(429);
    expect(noopHandler).not.toHaveBeenCalled();
  });

  it('uses client IP as the rate limit identifier (not user ID)', async () => {
    const handler = withAuth(noopHandler, config);
    await handler(createRequest('GET'));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('127.0.0.1'),
      expect.any(Object),
    );
  });
});

describe('withAuth — without rate limiting', () => {
  it('calls the handler when no rate limit config is provided', async () => {
    const handler = withAuth(noopHandler);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(200);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(noopHandler).toHaveBeenCalledTimes(1);
  });
});

describe('withAuth — rate limit response body & headers', () => {
  it('returns structured error body on rate-limited request', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = withAuth(noopHandler, rateLimitConfig);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toBe('Too many requests. Please try again later.');
    expect(body.error.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('includes Retry-After header on rate-limited response', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = withAuth(noopHandler, rateLimitConfig);
    const response = await handler(createRequest('GET'));

    const retryAfter = response.headers.get('Retry-After');
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });

  it('includes X-RateLimit headers on rate-limited response', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = withAuth(noopHandler, rateLimitConfig);
    const response = await handler(createRequest('GET'));

    expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });
});

describe('withAuth — rate limit edge cases', () => {
  it('allows request exactly at the limit boundary', async () => {
    mockCheckRateLimit.mockResolvedValue({ ...successResult, remaining: 1 });

    const handler = withAuth(noopHandler, rateLimitConfig);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(200);
    expect(noopHandler).toHaveBeenCalledTimes(1);
  });

  it('blocks request when remaining is 0', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = withAuth(noopHandler, rateLimitConfig);
    const response = await handler(createRequest('GET'));

    expect(response.status).toBe(429);
    expect(noopHandler).not.toHaveBeenCalled();
  });

  it('tracks remaining count across sequential requests', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ ...successResult, remaining: 4 })
      .mockResolvedValueOnce({ ...successResult, remaining: 3 });

    const handler = withAuth(noopHandler, rateLimitConfig);
    await handler(createRequest('GET'));
    await handler(createRequest('GET'));

    expect(mockCheckRateLimit).toHaveBeenCalledTimes(2);
    expect(noopHandler).toHaveBeenCalledTimes(2);
  });

  it('rate-limited handler never reaches the inner handler', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const sideEffect = vi.fn();
    const handlerWithSideEffect = withAuth(
      vi.fn(async () => {
        sideEffect();
        return NextResponse.json({ success: true });
      }),
      rateLimitConfig,
    );

    await handlerWithSideEffect(createRequest('GET'));

    expect(sideEffect).not.toHaveBeenCalled();
  });
});

describe('withAuth — rate limit config validation', () => {
  it('accepts different window sizes', async () => {
    const handler = withAuth(noopHandler, {
      windowMs: 3_600_000,
      max: 1000,
      namespace: 'hourly:endpoint',
    });
    await handler(createRequest('GET'));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('hourly:endpoint'),
      { windowMs: 3_600_000, max: 1000 },
    );
  });

  it('uses rate limit key that includes namespace and identifier', async () => {
    const handler = withAuth(noopHandler, {
      windowMs: 60_000,
      max: 30,
      namespace: 'tasks:create',
      key: 'user',
    });
    await handler(createRequest('GET'));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'rl:tasks:create:user-1',
      expect.any(Object),
    );
  });
});
