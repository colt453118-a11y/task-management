import { describe, it, expect } from 'vitest';
import { isPublicWebhookUrl } from '../url-guard';

describe('isPublicWebhookUrl — webhook SSRF guard (WM-007)', () => {
  const blocked = [
    'http://localhost/x',
    'https://localhost:3000/hook',
    'http://foo.localhost/x',
    'http://127.0.0.1/',
    'http://127.0.0.1:9200/_cat',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/', // cloud metadata
    'http://10.0.0.5/internal',
    'http://172.16.0.1/',
    'http://172.31.255.255/',
    'http://192.168.1.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    // IPv4-mapped IPv6 pointing at loopback / cloud metadata (DNS-rebind + literal bypass)
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/',
    'http://[::ffff:10.0.0.1]/',
    // NAT64 (64:ff9b::/96) embedding cloud metadata
    'http://[64:ff9b::a9fe:a9fe]/',
    // Carrier-grade NAT (100.64.0.0/10) — reachable internal infra
    'http://100.64.0.1/',
    'http://100.127.255.255/',
    'ftp://example.com/',
    'file:///etc/passwd',
    'gopher://example.com/',
  ];
  const allowed = [
    'https://hooks.slack.com/services/T/B/x',
    'https://example.com/webhook',
    'http://example.com:8080/hook',
    'https://api.github.com/repos/x',
    'http://172.32.0.1/', // just outside the private 172.16/12 range
    'http://100.128.0.1/', // just outside the 100.64/10 CGNAT range
    'http://[::ffff:8.8.8.8]/', // IPv4-mapped but a public address — RFC-correct to allow
  ];

  it.each(blocked)('blocks %s', (u) => {
    expect(isPublicWebhookUrl(u).ok).toBe(false);
  });

  it.each(allowed)('allows %s', (u) => {
    expect(isPublicWebhookUrl(u).ok).toBe(true);
  });

  it('rejects empty / non-string input', () => {
    expect(isPublicWebhookUrl('').ok).toBe(false);
    expect(isPublicWebhookUrl(undefined as unknown as string).ok).toBe(false);
    expect(isPublicWebhookUrl('not a url').ok).toBe(false);
  });
});
