import { headers } from 'next/headers';

/**
 * Fetch one of this app's own API routes from a Server Component, forwarding
 * the caller's cookies, and return the parsed JSON (or null on any failure).
 *
 * This is the shared primitive for server-rendering a page's initial data.
 * We call the HTTP API routes (rather than the database directly) on purpose:
 * the routes carry the role-aware, tenant-scoped authorization
 * (withAuth / requirePermission / org scoping), so reusing them keeps a single
 * source of truth for who-can-see-what and avoids duplicating that logic —
 * the class of divergence that leaks another tenant's data.
 *
 * Returns null (never throws) when there is no cookie/host, when the request
 * is not ok, or when parsing fails, so callers can fall back to client-side
 * fetching and the page degrades gracefully.
 */
export async function serverFetchJson<T = unknown>(
  path: string,
  init?: { method?: string; body?: string },
): Promise<T | null> {
  try {
    const h = await headers();
    const cookie = h.get('cookie') ?? '';
    if (!cookie) return null;

    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) return null;
    const proto = h.get('x-forwarded-proto') ?? 'http';

    const res = await fetch(`${proto}://${host}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        cookie,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
