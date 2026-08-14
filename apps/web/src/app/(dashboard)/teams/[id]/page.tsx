import { serverFetchJson } from '@/lib/api/server-fetch';
import { TeamDetailClient, type TeamResponse } from './team-detail-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Load the team on the server so the first paint has real content. A null
  // result (load failed or not found) makes the client shell fetch and resolve
  // the found/not-found state itself.
  const data = await serverFetchJson<TeamResponse>(
    `/api/teams/${encodeURIComponent(id)}`,
  );
  return <TeamDetailClient initialData={data ?? null} />;
}
