import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipFromRequest, rateLimitKey, checkRateLimit, rateLimitResponse, addRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/api/rate-limit';
import { NextResponse } from 'next/server';

// ─── ipFromRequest ─────────────────────────────────────────────

describe('ipFromRequest', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('http://localhost:3000/api/test', { headers });
  }

  it('extracts IP from x-forwarded-for header', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.42' });
    expect(ipFromRequest(req)).toBe('203.0.113.42');
  });

  it('takes the first IP from a comma-separated x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.42, 198.51.100.7, 10.0.0.1' });
    expect(ipFromRequest(req)).toBe('203.0.113.42');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.7' });
    expect(ipFromRequest(req)).toBe('198.51.100.7');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '203.0.113.42',
      'x-real-ip': '198.51.100.7',
    });
    expect(ipFromRequest(req)).toBe('203.0.113.42');
  });

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeRequest({});
    expect(ipFromRequest(req)).toBe('unknown');
  });

  it('handles IPv6 addresses', () => {
    const req = makeRequest({ 'x-forwarded-for': '::1' });
    expect(ipFromRequest(req)).toBe('::1');
  });

  it('trims whitespace from IP addresses', () => {
    const req = makeRequest({ 'x-forwarded-for': '  203.0.113.42  ' });
    expect(ipFromRequest(req)).toBe('203.0.113.42');
  });
});

// ─── rateLimitKey ──────────────────────────────────────────────

describe('rateLimitKey', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('builds a key with default prefix', () => {
    delete process.env.REDIS_PREFIX;
    const key = rateLimitKey('login', '203.0.113.42');
    expect(key).toBe('wm:rl:login:203.0.113.42');
  });

  it('uses custom prefix when configured', () => {
    process.env.REDIS_PREFIX = 'myapp:rl:';
    const key = rateLimitKey('task:create', 'user-123');
    expect(key).toBe('myapp:rl:task:create:user-123');
  });

  it('handles namespace with special characters', () => {
    delete process.env.REDIS_PREFIX;
    const key = rateLimitKey('auth:login', 'user@example.com');
    expect(key).toBe('wm:rl:auth:login:user@example.com');
  });
});

// ─── checkRateLimit (when Redis is unavailable — fail-open) ─────

describe('checkRateLimit (fail-open)', () => {
  it('returns ok=true when Redis is unavailable', async () => {
    // No REDIS_URL set => Redis client won't connect => fail-open
    delete process.env.REDIS_URL;
    const result = await checkRateLimit('test:key', { windowMs: 60_000, max: 5 });
    expect(result.ok).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(5);
    expect(result.reset).toBe(0);
  });

  it('returns remaining = max when Redis is unavailable', async () => {
    delete process.env.REDIS_URL;
    const result = await checkRateLimit('another:key', { windowMs: 60_000, max: 100 });
    expect(result.remaining).toBe(100);
  });
});

// ─── RATE_LIMIT_PRESETS ────────────────────────────────────────

describe('RATE_LIMIT_PRESETS', () => {
  it('has all required presets', () => {
    expect(RATE_LIMIT_PRESETS.login).toEqual({ windowMs: 60_000, max: 5 });
    expect(RATE_LIMIT_PRESETS.create).toEqual({ windowMs: 60_000, max: 30 });
    expect(RATE_LIMIT_PRESETS.mutate).toEqual({ windowMs: 60_000, max: 60 });
    expect(RATE_LIMIT_PRESETS.comment).toEqual({ windowMs: 60_000, max: 20 });
    expect(RATE_LIMIT_PRESETS.read).toEqual({ windowMs: 60_000, max: 100 });
    expect(RATE_LIMIT_PRESETS.sensitive).toEqual({ windowMs: 60_000, max: 20 });
  });
});

// ─── rateLimitResponse ─────────────────────────────────────────

describe('rateLimitResponse', () => {
  it('returns 429 status', () => {
    const result = { ok: false, limit: 5, remaining: 0, reset: Math.floor(Date.now() / 1000) + 30 };
    const res = rateLimitResponse(result);
    expect(res.status).toBe(429);
  });

  it('includes Retry-After header', () => {
    const reset = Math.floor(Date.now() / 1000) + 30;
    const result = { ok: false, limit: 5, remaining: 0, reset };
    const res = rateLimitResponse(result);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('includes X-RateLimit headers', () => {
    const reset = Math.floor(Date.now() / 1000) + 30;
    const result = { ok: false, limit: 5, remaining: 0, reset };
    const res = rateLimitResponse(result);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toBe(String(reset));
  });

  it('includes structured error body', async () => {
    const reset = Math.floor(Date.now() / 1000) + 30;
    const result = { ok: false, limit: 5, remaining: 0, reset };
    const res = rateLimitResponse(result);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toContain('Too many requests');
  });

  it('uses custom message when provided', async () => {
    const result = { ok: false, limit: 5, remaining: 0, reset: Math.floor(Date.now() / 1000) + 30 };
    const res = rateLimitResponse(result, 'Custom rate limit message');
    const body = await res.json();
    expect(body.error.message).toBe('Custom rate limit message');
  });

  it('ensures Retry-After is at least 1 second', () => {
    const reset = Math.floor(Date.now() / 1000); // 0 seconds ago
    const result = { ok: false, limit: 5, remaining: 0, reset };
    const res = rateLimitResponse(result);
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0');
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });
});

// ─── addRateLimitHeaders ───────────────────────────────────────

describe('addRateLimitHeaders', () => {
  it('adds rate limit headers to an existing response', () => {
    const res = NextResponse.json({ success: true });
    const result = { ok: true, limit: 100, remaining: 99, reset: Math.floor(Date.now() / 1000) + 60 };

    addRateLimitHeaders(res, result);

    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(res.headers.get('X-RateLimit-Reset')).toBe(String(result.reset));
  });
});
