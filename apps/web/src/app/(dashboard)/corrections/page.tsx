import { serverFetchJson } from '@/lib/api/server-fetch';
import { CorrectionsClient, type CorrectionRequest } from './corrections-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function CorrectionsPage() {
  // Load correction requests on the server so the first paint has real content
  // instead of a shimmer + client fetch-after-mount. Falls back to client
  // fetching when the server load fails (returns null).
  const data = await serverFetchJson<{ requests: CorrectionRequest[] }>('/api/time-corrections?limit=100');
  return <CorrectionsClient initialRequests={data?.requests ?? null} />;
}
