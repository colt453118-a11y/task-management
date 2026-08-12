// ─── Connect-time IP pinning for outbound webhooks (SSRF / DNS-rebinding) ──────
//
// `url-guard` blocks *literal* private hosts, but a public hostname that resolves
// to a private IP (DNS rebinding) would slip past it. This closes that gap: a
// custom undici dispatcher whose connect-time `lookup` resolves the host, rejects
// the connection if ANY resolved address is private/reserved, and otherwise hands
// undici the already-resolved address — so the socket connects to the exact IP we
// validated (no re-resolution, no TOCTOU window).
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { Agent } from 'undici';
import { isPrivateOrReservedHost } from './url-guard';

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | LookupAddress[],
  family?: number,
) => void;

type LookupOptions = { all?: boolean } & Record<string, unknown>;

type Resolver = (
  hostname: string,
  options: { all: true } & Record<string, unknown>,
  callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

/**
 * Build a `dns.lookup`-compatible function that fails closed on any
 * private/reserved resolved address. Exposed as a factory so the DNS resolver
 * can be injected in tests.
 */
export function makePinnedLookup(resolver: Resolver = dnsLookup as unknown as Resolver) {
  return function pinnedLookup(
    hostname: string,
    options: LookupOptions,
    callback: LookupCallback,
  ): void {
    const cb = callback;
    const opts = options ?? {};

    // Always resolve all addresses so we can validate every one of them.
    resolver(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return cb(err);
      if (!addresses || addresses.length === 0) {
        const e = new Error(`No addresses for ${hostname}`) as NodeJS.ErrnoException;
        e.code = 'ENOTFOUND';
        return cb(e);
      }
      const blocked = addresses.find((a) => isPrivateOrReservedHost(a.address));
      if (blocked) {
        const e = new Error(
          `Blocked: ${hostname} resolves to a private/reserved address (${blocked.address})`,
        ) as NodeJS.ErrnoException;
        e.code = 'EAI_BLOCKED';
        return cb(e);
      }
      // Return in the shape the caller asked for; every address is validated,
      // so whichever undici connects to is safe.
      if (opts.all) return cb(null, addresses);
      const first = addresses[0]!;
      return cb(null, first.address, first.family);
    });
  };
}

export const pinnedLookup = makePinnedLookup();

/**
 * Shared dispatcher for all outbound webhook fetches — pins the connection to a
 * validated public IP. Reused across deliveries for connection pooling.
 */
export const safeWebhookDispatcher = new Agent({
  // Runtime contract matches dns.lookup; the type is broader (it can return all
  // addresses), so cast to undici's expected single-address LookupFunction.
  connect: { lookup: pinnedLookup as unknown as LookupFunction },
});
