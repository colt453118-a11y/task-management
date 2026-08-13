import { serverFetchJson } from '@/lib/api/server-fetch';
import { TeamsClient, type TeamsData } from './teams-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  // Load teams + departments on the server so the first paint has real content
  // instead of a shimmer + client fetch-after-mount. Falls back to client
  // fetching when the server load fails (returns null).
  const data = await serverFetchJson<TeamsData>('/api/teams');
  return <TeamsClient initialData={data} />;
}
