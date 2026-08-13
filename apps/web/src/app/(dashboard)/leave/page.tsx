import { serverFetchJson } from '@/lib/api/server-fetch';
import { LeaveClient, type LeaveRequestItem } from './leave-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function LeavePage() {
  // Load the (unfiltered) leave requests on the server so the first paint has
  // real content instead of a spinner + client fetch-after-mount. Falls back to
  // client fetching when the server load fails (returns null).
  const data = await serverFetchJson<{ requests: LeaveRequestItem[] }>('/api/leave-requests?limit=50');
  return <LeaveClient initialRequests={data?.requests ?? null} />;
}
