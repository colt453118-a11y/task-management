import { serverFetchJson } from '@/lib/api/server-fetch';
import { DepartmentDetailClient, type DeptResponse } from './department-detail-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Load the department on the server so the first paint has real content. A null
  // result (load failed or not found) makes the client shell fetch and resolve
  // the found/not-found state itself.
  const data = await serverFetchJson<DeptResponse>(
    `/api/departments/${encodeURIComponent(id)}`,
  );
  return <DepartmentDetailClient initialData={data ?? null} />;
}
