import { serverFetchJson } from '@/lib/api/server-fetch';
import { UsersClient, type UserRecord } from './users-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  // Load the user list on the server so the first paint has real content
  // instead of a shimmer + client fetch-after-mount. Falls back to client
  // fetching when the server load fails (returns null).
  const data = await serverFetchJson<{ users: UserRecord[] }>('/api/users');
  return <UsersClient initialUsers={data?.users ?? null} />;
}
