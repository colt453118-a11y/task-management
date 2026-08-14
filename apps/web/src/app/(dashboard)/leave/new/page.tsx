import { serverFetchJson } from '@/lib/api/server-fetch';
import { NewLeaveRequestClient, type LeaveTypeOption } from './new-leave-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function NewLeaveRequestPage() {
  // Load the leave-type options on the server so the form paints ready-to-use.
  // A null result (load failed) makes the client shell fetch them itself.
  const data = await serverFetchJson<{ types: LeaveTypeOption[] }>('/api/leave-types');
  return <NewLeaveRequestClient initialLeaveTypes={data?.types ?? null} />;
}
