import { describe, it, expect } from 'vitest';
import type { LookupAddress } from 'node:dns';
import { makePinnedLookup } from '../pinned-lookup';

// A fake DNS resolver so the test needs no real network/DNS.
function resolverReturning(addresses: LookupAddress[]) {
  return (
    _hostname: string,
    _options: { all: true } & Record<string, unknown>,
    cb: (err: NodeJS.ErrnoException | null, addrs: LookupAddress[]) => void,
  ) => cb(null, addresses);
}

describe('pinnedLookup — webhook SSRF / DNS-rebinding pin', () => {
  it('blocks a public host that resolves to a private IP', () => {
    const lookup = makePinnedLookup(resolverReturning([{ address: '10.0.0.5', family: 4 }]));
    let err: NodeJS.ErrnoException | null = null;
    let addr: unknown;
    lookup('evil.example.com', { all: false }, (e, a) => {
      err = e;
      addr = a;
    });
    expect(err).toBeInstanceOf(Error);
    expect(err!.code).toBe('EAI_BLOCKED');
    expect(addr).toBeUndefined();
  });

  it('blocks the cloud metadata IP (169.254.169.254)', () => {
    const lookup = makePinnedLookup(resolverReturning([{ address: '169.254.169.254', family: 4 }]));
    let err: NodeJS.ErrnoException | null = null;
    lookup('metadata.example.com', {}, (e) => {
      err = e;
    });
    expect(err!.code).toBe('EAI_BLOCKED');
  });

  it('blocks an IPv4-mapped IPv6 that embeds the metadata IP (::ffff:169.254.169.254)', () => {
    const lookup = makePinnedLookup(
      resolverReturning([{ address: '::ffff:169.254.169.254', family: 6 }]),
    );
    let err: NodeJS.ErrnoException | null = null;
    lookup('rebind.example.com', {}, (e) => {
      err = e;
    });
    expect(err!.code).toBe('EAI_BLOCKED');
  });

  it('fails closed when ANY resolved address is private (mixed public + private)', () => {
    const lookup = makePinnedLookup(
      resolverReturning([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    );
    let err: NodeJS.ErrnoException | null = null;
    lookup('h', {}, (e) => {
      err = e;
    });
    expect(err!.code).toBe('EAI_BLOCKED');
  });

  it('allows a public IPv4 (single-address contract)', () => {
    const lookup = makePinnedLookup(resolverReturning([{ address: '93.184.216.34', family: 4 }]));
    let err: NodeJS.ErrnoException | null = null;
    let addr: unknown;
    let fam: unknown;
    lookup('example.com', { all: false }, (e, a, f) => {
      err = e;
      addr = a;
      fam = f;
    });
    expect(err).toBeNull();
    expect(addr).toBe('93.184.216.34');
    expect(fam).toBe(4);
  });

  it('returns every address when all:true and all are public', () => {
    const addrs: LookupAddress[] = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ];
    const lookup = makePinnedLookup(resolverReturning(addrs));
    let err: NodeJS.ErrnoException | null = null;
    let out: unknown;
    lookup('example.com', { all: true }, (e, a) => {
      err = e;
      out = a;
    });
    expect(err).toBeNull();
    expect(out).toEqual(addrs);
  });

  it('propagates a resolver (DNS) error', () => {
    const lookup = makePinnedLookup((_h, _o, cb) =>
      cb(Object.assign(new Error('nope'), { code: 'ENOTFOUND' }) as NodeJS.ErrnoException, []),
    );
    let err: NodeJS.ErrnoException | null = null;
    lookup('x', {}, (e) => {
      err = e;
    });
    expect(err!.code).toBe('ENOTFOUND');
  });
});
