import { NextResponse } from 'next/server';
import { getDb } from '@workmanagement/database';
import { sql } from 'drizzle-orm';

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
      return { status: 'degraded', error: 'REDIS_URL not configured' };
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
      error: error instanceof Error ? error.message : 'Redis check failed',
    };
  }
}

export async function GET() {
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

  return NextResponse.json(
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
}
