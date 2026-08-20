// ─── Webhook URL SSRF guard ────────────────────────────────────
//
// Outbound webhooks fetch a user-supplied URL from the server, which is a
// classic SSRF vector: a URL pointing at localhost, a private/internal IP, or
// the cloud metadata endpoint (169.254.169.254) would let the server be used to
// reach internal services or steal instance credentials. We reject those hosts
// at create/update time and again before delivery (defense in depth), and block
// redirects at fetch time.
//
// NOTE: this blocks *literal* private/loopback/link-local hosts. It does not by
// itself defeat DNS-rebinding (a public hostname that resolves to a private IP).
// That gap is closed at delivery time by `pinned-lookup.ts`, whose custom undici
// dispatcher validates and pins the resolved IP at connect time; the delivery
// path also disables redirects.

function ipv4Parts(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null;
}

function ipv4IsPrivateOrReserved(parts: number[]): boolean {
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 (cloud metadata)
  if (a >= 224) return true; // multicast / reserved / broadcast
  return false;
}

/**
 * Decode the IPv4 embedded in an IPv6 address so a mapped/compatible/NAT64 form
 * can't smuggle a private target past the IPv4 rules. Covers the dotted forms
 * (`::ffff:169.254.169.254`, `::127.0.0.1`, `64:ff9b::10.0.0.1`) and the hex
 * encodings (`::ffff:a9fe:a9fe`, `64:ff9b::a00:1`). A DNS record returning one
 * of these would otherwise slip past connect-time pinning.
 */
function embeddedIPv4(h: string): number[] | null {
  const dotted = /:((?:\d{1,3}\.){3}\d{1,3})$/.exec(h);
  if (dotted) return ipv4Parts(dotted[1]!);
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    return [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255];
  }
  return null;
}

export function isPrivateOrReservedHost(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '') // strip IPv6 brackets
    .replace(/\.$/, ''); // strip trailing dot

  if (h === 'localhost' || h.endsWith('.localhost')) return true;

  // IPv6 loopback / unspecified / unique-local (fc00::/7) / link-local (fe80::/10)
  if (h === '::1' || h === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;
  if (/^fe80:/.test(h)) return true;

  // IPv4-in-IPv6 embeddings — validate the embedded IPv4 against the v4 rules.
  const embedded = embeddedIPv4(h);
  if (embedded && ipv4IsPrivateOrReserved(embedded)) return true;

  const p = ipv4Parts(h);
  if (p && ipv4IsPrivateOrReserved(p)) return true;

  return false;
}

export function isPublicWebhookUrl(
  raw: unknown,
): { ok: true; url: URL } | { ok: false; reason: string } {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, reason: 'Webhook URL is required' };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'Invalid webhook URL' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'Webhook URL must use http or https' };
  }
  if (isPrivateOrReservedHost(url.hostname)) {
    return {
      ok: false,
      reason:
        'Webhook URL must be a public address (localhost, private, and link-local hosts are blocked)',
    };
  }
  return { ok: true, url };
}
