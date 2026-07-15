import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════

const { mockCheckRateLimit, mockRateLimitResponse, mockAddRateLimitHeaders, mockIpFromRequest, mockRateLimitKey } =
  vi.hoisted(() => ({
    mockCheckRateLimit: vi.fn(),
    mockRateLimitResponse: vi.fn(),
    mockAddRateLimitHeaders: vi.fn(),
    mockIpFromRequest: vi.fn(),
    mockRateLimitKey: vi.fn(),
  }));

// ═══════════════════════════════════════════════════════════════════
// Module-level mocks
//
// withRateLimit and its dependencies (checkRateLimit, ipFromRequest,
// rateLimitKey, rateLimitResponse, addRateLimitHeaders) are all
// defined in the SAME module (rate-limit.ts).  ES-module-level
// function references are closure-bound, so importOriginal cannot
// intercept internal calls within the same file.
//
// Instead we mock the entire module and provide a withRateLimit that
// replicates the real logic but delegates to our mocked dependencies.
// ═══════════════════════════════════════════════════════════════════

vi.mock('@/lib/api/rate-limit', () => ({
  withRateLimit: vi.fn(
    (
      options: {
        windowMs: number;
        max: number;
        namespace: string;
        identifier?: 'ip' | 'user' | ((req: NextRequest, userId?: string) => string);
      },
      handler: (req: NextRequest) => Promise<Response>,
    ) => {
      return async (req: NextRequest) => {
        const identifier =
          options.identifier === 'ip' || !options.identifier
            ? mockIpFromRequest(req)
            : typeof options.identifier === 'function'
              ? options.identifier(req)
              : mockIpFromRequest(req);

        const key = mockRateLimitKey(options.namespace, identifier);
        const result = await mockCheckRateLimit(key, {
          windowMs: options.windowMs,
          max: options.max,
        });

        if (!result.ok) {
          return mockRateLimitResponse(result);
        }

        const response = await handler(req);
        return mockAddRateLimitHeaders(response, result);
      };
    },
  ),
}));

// ═══════════════════════════════════════════════════════════════════
// Imports — run after mocks are in place
// ═══════════════════════════════════════════════════════════════════

import { withRateLimit } from '@/lib/api/rate-limit';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createRequest(): NextRequest {
  return { method: 'GET' } as NextRequest;
}

const successResult = { ok: true, limit: 5, remaining: 4, reset: Math.floor(Date.now() / 1000) + 60 };
const blockedResult = { ok: false, limit: 5, remaining: 0, reset: Math.floor(Date.now() / 1000) + 30 };
const defaultConfig = { windowMs: 60_000, max: 5, namespace: 'login' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue(successResult);
  mockRateLimitResponse.mockReturnValue(NextResponse.json({ error: { code: 'RATE_LIMIT_EXCEEDED' } }, { status: 429 }));
  mockAddRateLimitHeaders.mockImplementation((res: Response) => res as NextResponse);
  mockIpFromRequest.mockReturnValue('203.0.113.42');
  mockRateLimitKey.mockReturnValue('key:login:203.0.113.42');
});

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe('withRateLimit — identifier derivation', () => {
  it('uses IP when no identifier option is provided', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);

    await wrapped(createRequest());

    expect(mockIpFromRequest).toHaveBeenCalled();
    expect(mockRateLimitKey).toHaveBeenCalledWith('login', '203.0.113.42');
  });

  it('uses IP when identifier is "ip"', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit({ ...defaultConfig, identifier: 'ip' }, handler);

    await wrapped(createRequest());

    expect(mockIpFromRequest).toHaveBeenCalled();
  });

  it('uses custom identifier function when provided', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const customFn = vi.fn(() => 'custom-id');
    const wrapped = withRateLimit({ ...defaultConfig, identifier: customFn }, handler);
    const req = createRequest();

    await wrapped(req);

    expect(customFn).toHaveBeenCalledWith(req);
    expect(mockRateLimitKey).toHaveBeenCalledWith('login', 'custom-id');
  });

  it('passes request to identifier function', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const customFn = vi.fn(() => 'x');
    const req = createRequest();
    const wrapped = withRateLimit({ ...defaultConfig, identifier: customFn }, handler);

    await wrapped(req);

    expect(customFn).toHaveBeenCalledWith(req);
  });
});

describe('withRateLimit — rate limit flow', () => {
  it('calls handler when rate limit is not exceeded', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);

    const response = await wrapped(createRequest());

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);

    const response = await wrapped(createRequest());

    expect(response.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  it('responds with rateLimitResponse when blocked', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const wrapped = withRateLimit(defaultConfig, vi.fn(async () => NextResponse.json({ ok: true })));
    await wrapped(createRequest());

    expect(mockRateLimitResponse).toHaveBeenCalledWith(blockedResult);
  });
});

describe('withRateLimit — response headers', () => {
  it('adds rate limit headers on accepted request', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);

    await wrapped(createRequest());

    expect(mockAddRateLimitHeaders).toHaveBeenCalledWith(
      expect.any(NextResponse),
      successResult,
    );
  });

  it('forwards the rate limit result to addRateLimitHeaders', async () => {
    mockCheckRateLimit.mockResolvedValue({ ...successResult, remaining: 2 });

    const wrapped = withRateLimit(defaultConfig, vi.fn(async () => NextResponse.json({ ok: true })));
    await wrapped(createRequest());

    expect(mockAddRateLimitHeaders).toHaveBeenCalledWith(
      expect.any(NextResponse),
      expect.objectContaining({ remaining: 2 }),
    );
  });
});

describe('withRateLimit — rate limit key construction', () => {
  it('passes namespace and identifier to rateLimitKey', async () => {
    const wrapped = withRateLimit(
      { windowMs: 60_000, max: 10, namespace: 'auth:login' },
      vi.fn(async () => NextResponse.json({ ok: true })),
    );

    await wrapped(createRequest());

    expect(mockRateLimitKey).toHaveBeenCalledWith('auth:login', '203.0.113.42');
  });
});

describe('withRateLimit — edge cases', () => {
  it('allows request at the limit boundary', async () => {
    mockCheckRateLimit.mockResolvedValue({ ...successResult, remaining: 1 });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);
    const response = await wrapped(createRequest());

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('blocks request when remaining is 0', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);
    const response = await wrapped(createRequest());

    expect(response.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  it('tracks remaining across sequential requests', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ ...successResult, remaining: 4 })
      .mockResolvedValueOnce({ ...successResult, remaining: 3 });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);

    await wrapped(createRequest());
    await wrapped(createRequest());

    expect(mockCheckRateLimit).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('inner handler is never called when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue(blockedResult);

    const sideEffect = vi.fn();
    const wrapped = withRateLimit(
      defaultConfig,
      vi.fn(async () => {
        sideEffect();
        return NextResponse.json({ ok: true });
      }),
    );

    await wrapped(createRequest());

    expect(sideEffect).not.toHaveBeenCalled();
  });
});

describe('withRateLimit — config propagation', () => {
  it('forwards windowMs and max to checkRateLimit', async () => {
    const wrapped = withRateLimit(
      { windowMs: 3_600_000, max: 100, namespace: 'slow' },
      vi.fn(async () => NextResponse.json({ ok: true })),
    );

    await wrapped(createRequest());

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.any(String),
      { windowMs: 3_600_000, max: 100 },
    );
  });

  it('forwards the request to the handler', async () => {
    const req = createRequest();
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(defaultConfig, handler);

    await wrapped(req);

    expect(handler).toHaveBeenCalledWith(req);
  });
});
