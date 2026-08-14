import { serverFetchJson } from '@/lib/api/server-fetch';
import { LeaveRequestDetailClient, type LeaveRequestDetail } from './leave-detail-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function LeaveRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Load the request on the server so the first paint has real content. A null
  // result (load failed or not found) makes the client shell fetch and resolve
  // the found/not-found state itself.
  const data = await serverFetchJson<{ request: LeaveRequestDetail }>(
    `/api/leave-requests/${encodeURIComponent(id)}`,
  );
  return <LeaveRequestDetailClient initialRequest={data?.request ?? null} />;
}
