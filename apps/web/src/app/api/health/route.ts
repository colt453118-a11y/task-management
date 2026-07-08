import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@workmanagement/database';
import { sql } from 'drizzle-orm';
import {
  checkRateLimit,
  rateLimitKey,
  ipFromRequest,
  rateLimitResponse,
} from '@/lib/api/rate-limit';

export const runtime = 'nodejs';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: string;
  error?: string;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    const latency = `${Math.round(performance.now() - start)}ms`;
    return { status: 'healthy', latency };
  } catch (error) {
    const latency = `${Math.round(performance.now() - start)}ms`;
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    const { createClient } = await import('redis');
    const url = process.env.REDIS_URL;
    if (!url) {
      // Deliberately vague — don't leak which env var or service is missing
      return { status: 'degraded', error: 'Caching service not configured' };
    }
    const client = createClient({ url });
    await client.connect();
    await client.ping();
    await client.quit();
    const latency = `${Math.round(performance.now() - start)}ms`;
    return { status: 'healthy', latency };
  } catch (error) {
    const latency = `${Math.round(performance.now() - start)}ms`;
    return {
      status: 'degraded',
      latency,
      error: error instanceof Error ? error.message : 'Caching service check failed',
    };
  }
}

export async function GET(request: NextRequest) {
  // ── Rate limit: 60 req/min per IP ──────────────────────
  // The health endpoint is public and unauthenticated, so we use
  // IP-based rate limiting to prevent abuse. 60 req/min allows
  // for load balancer polling (every 10-15s) + monitoring services
  // + CI/CD probes without false positives.
  const ip = ipFromRequest(request);
  const key = rateLimitKey('health', ip);
  const rateLimitResult = await checkRateLimit(key, { windowMs: 60_000, max: 60 });

  if (!rateLimitResult.ok) {
    return rateLimitResponse(rateLimitResult, 'Health check rate limit exceeded');
  }

  const [dbResult, redisResult] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const allHealthy = dbResult.status === 'healthy' && redisResult.status === 'healthy';
  const anyUnhealthy = dbResult.status === 'unhealthy' || redisResult.status === 'unhealthy';

  const overallStatus = allHealthy
    ? 'healthy'
    : anyUnhealthy
      ? 'degraded'
      : 'healthy';

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  const response = NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks: {
        database: dbResult,
        redis: redisResult,
      },
    },
    { status: statusCode },
  );

  // Attach rate limit headers so callers can track their usage
  // (rateLimitResult.ok is guaranteed true at this point — we returned
  //  early above if rate-limited)
  response.headers.set('X-RateLimit-Limit', String(rateLimitResult.limit));
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  response.headers.set('X-RateLimit-Reset', String(rateLimitResult.reset));

  return response;
}
