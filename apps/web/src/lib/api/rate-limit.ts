import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Redis Client (lazy singleton) ──────────────────────────────
//
// Design decisions:
// - Fail-open: if Redis is unavailable, requests are allowed through.
//   This prioritises availability over strict rate limiting during outages.
// - The redis@4 client auto-reconnects on transient errors. We only log
//   errors rather than nulling the client to avoid fighting the built-in
//   reconnection loop.
// - A `redisConnecting` guard prevents connection storms during cold starts.

let redisClient: RedisClientType | null = null;
let redisConnecting = false;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient?.isOpen) return redisClient;
  if (redisConnecting) return null;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  redisConnecting = true;
  try {
    redisClient = createClient({ url });
    redisClient.on('error', (err: Error) => {
      // Log only — the redis@4 client auto-reconnects.
      // Do NOT null the client here or we fight the reconnection loop.
      console.error('[rate-limit] Redis client error:', err.message);
    });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.error('[rate-limit] Failed to connect to Redis:', err);
    redisClient = null;
    return null;
  } finally {
    redisConnecting = false;
  }
}

// ─── Rate Limit Configuration Presets ────────────────────────────

export const RATE_LIMIT_PRESETS = {
  /** Login: 5 requests per 60s per IP */
  login: { windowMs: 60_000, max: 5 },
  /** Task/Comment creation: 30 requests per 60s per user */
  create: { windowMs: 60_000, max: 30 },
  /** Mutations (PATCH, DELETE): 60 requests per 60s per user */
  mutate: { windowMs: 60_000, max: 60 },
  /** Comment creation: 20 requests per 60s per user */
  comment: { windowMs: 60_000, max: 20 },
  /** Read queries (GET lists): 100 requests per 60s per user */
  read: { windowMs: 60_000, max: 100 },
  /** Sensitive operations (role creation, etc): 20 requests per 60s per user */
  sensitive: { windowMs: 60_000, max: 20 },
} as const;

// ─── Result Types ────────────────────────────────────────────────

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

// ─── Rate Limit Identifier ─────────────────────────────────────

/**
 * Extract a client IP from the request, respecting proxy headers.
 */
export function ipFromRequest(request: NextRequest | Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Build a Redis key for a given namespace and identifier.
 */
export function rateLimitKey(namespace: string, identifier: string): string {
  const prefix = process.env.REDIS_PREFIX || 'wm:rl:';
  return `${prefix}${namespace}:${identifier}`;
}

// ─── Core Rate Limit Check ───────────────────────────────────────

/**
 * Check whether an action is rate limited.
 *
 * Uses a sliding-window approach with Redis INCR + EXPIRE.
 * The window is bucketed by `Math.floor(now / windowMs)` so that
 * a new bucket is created every `windowMs` milliseconds.
 *
 * Returns `{ ok: true, ... }` if the request is within limits, or
 * `{ ok: false, ... }` with the reset time if it exceeds the limit.
 *
 * If Redis is unavailable, the check passes open (fail-open).
 */
export async function checkRateLimit(
  key: string,
  config: { windowMs: number; max: number },
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  if (!client) {
    // Redis unavailable — allow the request
    return { ok: true, limit: config.max, remaining: config.max, reset: 0 };
  }

  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / config.windowMs)}`;

  try {
    const multi = client.multi();
    multi.incr(windowKey);
    multi.ttl(windowKey);
    // redis@4 exec() returns [error | null, value][] — cast the values we need
    const results = (await multi.exec()) as Array<[Error | null, number]> | null;

    const count = results?.[0]?.[1];
    let ttl = results?.[1]?.[1];

    // On first increment, set TTL to expire the window
    if (count === 1) {
      const expirySeconds = Math.ceil(config.windowMs / 1000);
      await client.expire(windowKey, expirySeconds);
      ttl = expirySeconds;
    }

    const currentCount = count ?? 0;
    const currentTtl = ttl ?? Math.ceil(config.windowMs / 1000);
    const remaining = Math.max(0, config.max - currentCount);

    if (currentCount > config.max) {
      return {
        ok: false,
        limit: config.max,
        remaining: 0,
        reset: Math.floor(now / 1000) + currentTtl,
      };
    }

    return {
      ok: true,
      limit: config.max,
      remaining,
      reset: Math.floor(now / 1000) + currentTtl,
    };
  } catch (err) {
    console.error('[rate-limit] Redis check failed:', err);
    return { ok: true, limit: config.max, remaining: config.max, reset: 0 };
  }
}

// ─── Response Helpers ────────────────────────────────────────────

/**
 * Create a 429 Too Many Requests response with rate limit headers.
 */
export function rateLimitResponse(result: RateLimitResult, message?: string): NextResponse {
  const retryAfter = Math.max(1, result.reset - Math.floor(Date.now() / 1000));
  return NextResponse.json(
    {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: message ?? 'Too many requests. Please try again later.',
        retryAfter,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.reset),
      },
    },
  );
}

/**
 * Attach rate limit headers (limit, remaining, reset) to an existing response.
 */
export function addRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.reset));
  return response;
}

// ─── High-Level Wrappers ─────────────────────────────────────────

/**
 * Options for the `withRateLimit` wrapper.
 */
export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests within the window */
  max: number;
  /** Namespace for the Redis key (e.g. "login", "task:create") */
  namespace: string;
  /**
   * How to identify the client:
   * - `'ip'`: use the request IP
   * - `'user'`: use the authenticated user ID (must be called after `withAuth`)
   * - A custom generator function
   * @default 'ip'
   */
  identifier?: 'ip' | 'user' | ((req: NextRequest, userId?: string) => string);
}

/**
 * Wrap an API route handler with IP-based rate limiting.
 * Use this BEFORE `withAuth` for unauthenticated endpoints (login, register, etc.).
 *
 * Example:
 * ```ts
 * export const POST = withRateLimit(
 *   { windowMs: 60000, max: 5, namespace: 'login' },
 *   authHandler,
 * );
 * ```
 */
export function withRateLimit(
  options: RateLimitOptions,
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const identifier =
      options.identifier === 'ip' || !options.identifier
        ? ipFromRequest(req)
        : typeof options.identifier === 'function'
          ? options.identifier(req)
          : ipFromRequest(req);

    const key = rateLimitKey(options.namespace, identifier);
    const result = await checkRateLimit(key, {
      windowMs: options.windowMs,
      max: options.max,
    });

    if (!result.ok) {
      return rateLimitResponse(result);
    }

    const response = await handler(req);
    return addRateLimitHeaders(response, result);
  };
}
