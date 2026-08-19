import { serverFetchJson } from '@/lib/api/server-fetch';
import { NotificationsClient, type Notification } from './notifications-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  // Seed the first page (default filter = all, offset 0) on the server so the
  // first paint has real content. Filter/pagination and mutations still run
  // from the client. `serverNow` keeps the now-relative render (relative times +
  // today/yesterday grouping) identical between SSR and first hydration.
  const data = await serverFetchJson<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }>('/api/notifications?limit=30&offset=0');
  return (
    <NotificationsClient
      initialNotifications={data?.notifications ?? null}
      initialTotal={data?.total ?? 0}
      initialUnread={data?.unreadCount ?? 0}
      serverNow={Date.now()}
    />
  );
}
