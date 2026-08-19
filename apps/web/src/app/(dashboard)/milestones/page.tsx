import { serverFetchJson } from '@/lib/api/server-fetch';
import { MilestonesClient, type MilestoneData } from './milestones-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function MilestonesPage() {
  // Seed the milestone list on the server (default = all statuses) so the first
  // paint has real content instead of a shimmer + client fetch-after-mount.
  // Status-filter changes, the create/edit form's project list, and mutations
  // still run from the client. A null payload (server load failed) makes the
  // client fall back to fetching on mount.
  const data = await serverFetchJson<{ milestones: MilestoneData[] }>('/api/milestones');
  return <MilestonesClient initialMilestones={data?.milestones ?? null} />;
}
