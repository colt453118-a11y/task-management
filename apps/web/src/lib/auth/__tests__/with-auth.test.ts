import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { AuthError } from '../session';

const { mockRequireAuth, mockGetDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetDb: vi.fn(),
}));

// Keep the real AuthError (withAuth's catch uses `instanceof AuthError`); mock only requireAuth.
vi.mock('../session', async (orig) => ({
  ...(await orig<typeof import('../session')>()),
  requireAuth: mockRequireAuth,
}));
vi.mock('@workmanagement/database', () => ({
  getDb: mockGetDb,
  schema: {
    users: { id: '', isActive: '', isSuspended: '', organizationId: '', deletedAt: '' },
  },
}));

import { withAuth } from '../api-auth';

function getReq(): NextRequest {
  return {
    method: 'GET',
    headers: new Headers(),
    nextUrl: { pathname: '/api/x', searchParams: new URLSearchParams() },
    url: 'http://localhost/api/x',
  } as unknown as NextRequest;
}

describe('withAuth — handler errors are mapped, not leaked as 500 (WM-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u1', name: 'U' });
    // getUserStatus() chain → an active user in org-A
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = () => Promise.resolve([{ isActive: true, isSuspended: false, organizationId: 'org-A' }]);
    mockGetDb.mockReturnValue(chain);
  });

  it('a handler that throws AuthError(403) → 403 FORBIDDEN (regression: withAuth must await)', async () => {
    const handler = vi.fn(async () => {
      throw new AuthError("Forbidden: requires 'settings:manage' permission", 'FORBIDDEN', 403);
    });
    const res = await withAuth(handler as never)(getReq());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('a handler that throws AuthError(401) → 401', async () => {
    const handler = vi.fn(async () => {
      throw new AuthError('Unauthorized', 'UNAUTHORIZED', 401);
    });
    const res = await withAuth(handler as never)(getReq());
    expect(res.status).toBe(401);
  });

  it('a successful handler passes its response through', async () => {
    const { NextResponse } = await import('next/server');
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withAuth(handler as never)(getReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
