import { serverFetchJson } from '@/lib/api/server-fetch';
import { AnalyticsClient, type AnalyticsData } from './analytics-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  // Seed the default 30-day analytics on the server. /api/analytics is a
  // POST-for-read endpoint (the date window is in the body), so we mirror the
  // client's default-period request. Period changes still refetch from the
  // client; a null payload (server load failed) makes it fetch on mount.
  const now = Date.now();
  const body = JSON.stringify({
    startDate: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(now).toISOString(),
  });
  const data = await serverFetchJson<AnalyticsData>('/api/analytics', {
    method: 'POST',
    body,
  });
  return <AnalyticsClient initialData={data} />;
}
