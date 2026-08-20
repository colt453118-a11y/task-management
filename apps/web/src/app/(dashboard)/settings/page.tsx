import { serverFetchJson } from '@/lib/api/server-fetch';
import { SettingsClient, type Organization } from './settings-client';

// Per-request, auth-scoped data — never statically cached.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Seed the default (general) tab's organization details on the server so the
  // settings form paints immediately instead of flashing a shimmer. The other
  // tabs (roles, notifications, AI, webhooks, Slack, security) still load their
  // data from the client when first opened.
  const orgData = await serverFetchJson<{ organization: Organization | null }>(
    '/api/organization',
  );
  return <SettingsClient initialOrg={orgData?.organization ?? null} />;
}
