import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '@/__tests__/api/test-helpers';

// ── Hoisted mocks ──────────────────────────────────────────────
const { mockDb } = vi.hoisted(() => ({ mockDb: vi.fn() }));

vi.mock('@workmanagement/database', () => ({
  getDb: vi.fn(() => mockDb()),
  schema: {
    sessions: { id: 'sessions.id', expiresAt: 'sessions.expires_at' },
    users: {
      id: 'users.id',
      isActive: 'users.is_active',
      isSuspended: 'users.is_suspended',
      organizationId: 'users.organization_id',
      deletedAt: 'users.deleted_at',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: string, value: unknown) => ({ field, value, type: 'eq' })),
  and: vi.fn((...conds: unknown[]) => ({ conds, type: 'and' })),
  isNull: vi.fn((field: string) => ({ field, type: 'isNull' })),
}));

// Import AFTER mocks are registered.
import { revalidateStreamAuth } from '../stream-auth';

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);
const activeUser = { isActive: true, isSuspended: false, organizationId: 'org-1' };

describe('revalidateStreamAuth — SSE re-authorization (WM-008)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns valid for a live session + active account', async () => {
    mockDb.mockReturnValue(createChain([[{ expiresAt: future() }], [activeUser]]));
    expect(await revalidateStreamAuth('sess-1', 'user-1')).toEqual({ valid: true });
  });

  it('flags session_revoked when the session row is gone (logout)', async () => {
    mockDb.mockReturnValue(createChain([[], [activeUser]]));
    expect(await revalidateStreamAuth('sess-1', 'user-1')).toEqual({
      valid: false,
      reason: 'session_revoked',
    });
  });

  it('flags session_expired when past expiresAt', async () => {
    mockDb.mockReturnValue(createChain([[{ expiresAt: past() }], [activeUser]]));
    expect(await revalidateStreamAuth('sess-1', 'user-1')).toEqual({
      valid: false,
      reason: 'session_expired',
    });
  });

  it('flags account_disabled when the user is soft-deleted (no row)', async () => {
    mockDb.mockReturnValue(createChain([[{ expiresAt: future() }], []]));
    expect(await revalidateStreamAuth('sess-1', 'user-1')).toEqual({
      valid: false,
      reason: 'account_disabled',
    });
  });

  it('flags account_disabled when the user is suspended', async () => {
    mockDb.mockReturnValue(
      createChain([[{ expiresAt: future() }], [{ ...activeUser, isSuspended: true }]]),
    );
    expect(await revalidateStreamAuth('sess-1', 'user-1')).toEqual({
      valid: false,
      reason: 'account_disabled',
    });
  });

  it('flags account_disabled when isActive is false', async () => {
    mockDb.mockReturnValue(
      createChain([[{ expiresAt: future() }], [{ ...activeUser, isActive: false }]]),
    );
    expect(await revalidateStreamAuth('sess-1', 'user-1')).toEqual({
      valid: false,
      reason: 'account_disabled',
    });
  });

  it('fails closed (session_revoked) if the session lookup throws', async () => {
    mockDb.mockImplementationOnce(() => {
      throw new Error('db down');
    });
    expect(await revalidateStreamAuth('sess-1', 'user-1')).toEqual({
      valid: false,
      reason: 'session_revoked',
    });
  });
});
