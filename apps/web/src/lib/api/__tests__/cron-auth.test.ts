import { describe, it, expect, afterEach, vi } from 'vitest';
import { isCronAuthorized } from '../cron-auth';

function req(opts: { url?: string; auth?: string } = {}) {
  return new Request(opts.url ?? 'http://localhost/api/cron/x', {
    headers: opts.auth ? { authorization: opts.auth } : {},
  });
}

describe('isCronAuthorized — fail-closed cron gate (WM-003)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('DENIES when no secret is configured in production', () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isCronAuthorized(req())).toBe(false);
  });

  it('allows when no secret is configured outside production (dev/test convenience)', () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(isCronAuthorized(req())).toBe(true);
  });

  it('allows a correct Bearer token', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isCronAuthorized(req({ auth: 'Bearer s3cret' }))).toBe(true);
  });

  it('denies a wrong Bearer token', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isCronAuthorized(req({ auth: 'Bearer nope' }))).toBe(false);
  });

  it('allows a correct ?token= or ?secret= query param', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isCronAuthorized(req({ url: 'http://x/api/cron?token=s3cret' }))).toBe(true);
    expect(isCronAuthorized(req({ url: 'http://x/api/cron?secret=s3cret' }))).toBe(true);
  });

  it('denies when a secret is configured but none is provided (the fail-open bug)', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isCronAuthorized(req())).toBe(false);
  });
});
