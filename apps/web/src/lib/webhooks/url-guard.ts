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
// itself defeat DNS-rebinding (a public hostname that resolves to a private IP);
// the delivery path additionally disables redirects. A stricter guard would pin
// the resolved IP at connect time — tracked as a follow-up.

function ipv4Parts(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null;
}

function isPrivateOrReservedHost(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '') // strip IPv6 brackets
    .replace(/\.$/, ''); // strip trailing dot

  if (h === 'localhost' || h.endsWith('.localhost')) return true;

  // IPv6 loopback / unspecified / unique-local (fc00::/7) / link-local (fe80::/10)
  if (h === '::1' || h === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;
  if (/^fe80:/.test(h)) return true;

  const p = ipv4Parts(h);
  if (p) {
    const [a, b] = p as [number, number, number, number];
    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 (cloud metadata)
    if (a >= 224) return true; // multicast / reserved
  }

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
