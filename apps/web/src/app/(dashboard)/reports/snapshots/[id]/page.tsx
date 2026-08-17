import { serverFetchJson } from '@/lib/api/server-fetch';
import { SnapshotDetailClient, type SnapshotDetail } from './snapshot-detail-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Load the snapshot (primary) and the recent EOD snapshots list (for the
  // previous-snapshot delta + trend sparklines) on the server so the first
  // paint has the real report. A null snapshot (load failed / not found) makes
  // the client shell fetch and resolve the error/not-found state.
  const [snap, list] = await Promise.all([
    serverFetchJson<{ snapshot: SnapshotDetail }>(
      `/api/reports/snapshots/${encodeURIComponent(id)}`,
    ),
    serverFetchJson<{ snapshots: SnapshotDetail[] }>(
      '/api/reports/snapshots?limit=50&type=eod',
    ),
  ]);
  return (
    <SnapshotDetailClient
      initialSnapshot={snap?.snapshot ?? null}
      initialSnapshots={list?.snapshots ?? []}
    />
  );
}
