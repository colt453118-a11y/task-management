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
 * Returns null (never throws) when there is no cookie, when the request is not
 * ok, or when parsing fails, so callers can fall back to client-side fetching
 * and the page degrades gracefully.
 *
 * The target is always one of THIS app's own API routes, served by this same
 * process, so we connect over loopback (`127.0.0.1:<PORT>`) rather than
 * reconstructing the URL from the request's Host / X-Forwarded-Host header.
 * Those headers are client-influenceable; using them to build a fetch that
 * forwards the caller's session cookie would let a spoofed host exfiltrate that
 * cookie (SSRF / session theft), which matters on any deployment not sitting
 * behind a Host-normalizing proxy (e.g. the bundled docker-compose.prod).
 */
export async function serverFetchJson<T = unknown>(
  path: string,
  init?: { method?: string; body?: string },
): Promise<T | null> {
  try {
    const h = await headers();
    const cookie = h.get('cookie') ?? '';
    if (!cookie) return null;

    const port = process.env.PORT ?? '3000';

    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
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
