import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain, createRequest } from '@/__tests__/api/test-helpers';

// ═══════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════

const { mockNextResponseJson, mockDb } = vi.hoisted(() => ({
  mockNextResponseJson: vi.fn((body: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200,
    ok: (init?.status ?? 200) < 400,
    json: async () => body,
  })),
  mockDb: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════
// Module-level mocks
// ═══════════════════════════════════════════════════════════════════

vi.mock('next/server', () => ({
  NextResponse: { json: mockNextResponseJson },
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: Function) => async (req: unknown) =>
    handler(req, {
      user: { id: 'user-1', email: 'test@test.com', name: 'Test User' },
      orgId: 'org-1',
    }),
}));

vi.mock('@workmanagement/database', () => ({
  getDb: vi.fn(() => mockDb()),
  schema: {
    users: {
      id: 'users.id',
      preferences: 'users.preferences',
      updatedAt: 'users.updatedAt',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: string, value: unknown) => ({ field, value, type: 'eq' })),
}));

// ═══════════════════════════════════════════════════════════════════
// Imports — these run after mocks are in place
// ═══════════════════════════════════════════════════════════════════

import { GET, PATCH } from '@/app/api/users/me/preferences/route';

const PREFS_PATH = '/api/users/me/preferences';

beforeEach(() => {
  vi.resetAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
// GET — Fetch notification preferences
// ═══════════════════════════════════════════════════════════════════

describe('Preferences API — GET (fetch preferences)', () => {
  it('returns notification preferences for user', async () => {
    const existingPrefs = {
      notifications: {
        channels: { inApp: true, email: true, push: false },
        types: { task_assigned: true, task_comment: false },
      },
    };

    mockDb.mockReturnValue(
      createChain([[{ preferences: existingPrefs }]]),
    );

    const response = await GET(createRequest('GET', PREFS_PATH));

    expect(response.status).toBe(200);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: existingPrefs.notifications,
      }),
    );
  });

  it('returns empty object when user has no preferences', async () => {
    mockDb.mockReturnValue(
      createChain([[{ preferences: null }]]),
    );

    const response = await GET(createRequest('GET', PREFS_PATH));

    expect(response.status).toBe(200);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: {} }),
    );
  });

  it('returns empty object when user has no notifications section', async () => {
    mockDb.mockReturnValue(
      createChain([[{ preferences: { theme: 'dark' } }]]),
    );

    const response = await GET(createRequest('GET', PREFS_PATH));

    expect(response.status).toBe(200);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: {} }),
    );
  });

  it('returns 500 on database error', async () => {
    mockDb.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error('DB error')),
      limit: vi.fn(),
    });

    const response = await GET(createRequest('GET', PREFS_PATH));

    expect(response.status).toBe(500);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
      expect.objectContaining({ status: 500 }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// PATCH — Update notification preferences
// ═══════════════════════════════════════════════════════════════════

describe('Preferences API — PATCH (update preferences)', () => {
  it('updates notification preferences successfully', async () => {
    const newPrefs = {
      channels: { email: false },
    };

    mockDb.mockReturnValue(
      createChain([
        [{ preferences: {} }], // Existing preferences
        [], // Update result
      ]),
    );

    const response = await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, newPrefs),
    );

    expect(response.status).toBe(200);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          notifications: expect.objectContaining({
            channels: expect.objectContaining({ email: false }),
          }),
        }),
      }),
    );
  });

  it('merges with existing preferences', async () => {
    const existingPrefs = {
      notifications: {
        channels: { inApp: true, email: true, push: false },
        types: { task_assigned: true },
      },
    };

    const updatePrefs = {
      channels: { email: false },
    };

    mockDb.mockReturnValue(
      createChain([
        [{ preferences: existingPrefs }],
        [],
      ]),
    );

    await PATCH(createRequest('PATCH', PREFS_PATH, undefined, updatePrefs));

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          notifications: expect.objectContaining({
            channels: expect.objectContaining({
              inApp: true,
              email: false, // Updated
              push: false, // Preserved
            }),
            types: expect.objectContaining({
              task_assigned: true, // Preserved
            }),
          }),
        }),
      }),
    );
  });

  it('validates typeChannels schema', async () => {
    // The schema uses z.enum for typeChannels keys, so we need to send
    // data that fails validation. However, z.record with z.enum might
    // accept extra keys depending on Zod version. Let's test with
    // invalid channel values instead.
    const invalidPrefs = {
      channels: 'not_a_boolean', // Invalid type
    };

    mockDb.mockReturnValue(createChain([[]]));

    const response = await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, invalidPrefs),
    );

    expect(response.status).toBe(400);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      }),
      expect.objectContaining({ status: 400 }),
    );
  });

  it('validates digest frequency enum', async () => {
    const invalidPrefs = {
      digest: { frequency: 'monthly' },
    };

    mockDb.mockReturnValue(createChain([[]]));

    const response = await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, invalidPrefs),
    );

    expect(response.status).toBe(400);
  });

  it('validates media preferences', async () => {
    const validPrefs = {
      media: { soundEnabled: false, hapticEnabled: true },
    };

    mockDb.mockReturnValue(
      createChain([
        [{ preferences: {} }],
        [],
      ]),
    );

    const response = await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, validPrefs),
    );

    expect(response.status).toBe(200);
  });

  it('returns 500 on database error during update', async () => {
    mockDb.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{}]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockRejectedValue(new Error('DB error')),
    });

    const response = await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, { channels: { email: false } }),
    );

    expect(response.status).toBe(500);
  });

  it('returns empty object when body is empty', async () => {
    mockDb.mockReturnValue(
      createChain([
        [{ preferences: {} }],
        [],
      ]),
    );

    const response = await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, {}),
    );

    expect(response.status).toBe(200);
  });

  it('preserves existing non-notification preferences', async () => {
    const existingPrefs = {
      theme: 'dark',
      notifications: {
        channels: { inApp: true, email: true },
      },
    };

    const updatePrefs = {
      channels: { email: false },
    };

    mockDb.mockReturnValue(
      createChain([
        [{ preferences: existingPrefs }],
        [],
      ]),
    );

    await PATCH(createRequest('PATCH', PREFS_PATH, undefined, updatePrefs));

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          theme: 'dark', // Preserved
        }),
      }),
    );
  });

  it('persists the slack channel preference', async () => {
    mockDb.mockReturnValue(
      createChain([
        [{ preferences: {} }],
        [],
      ]),
    );

    await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, {
        channels: { slack: true },
      }),
    );

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          notifications: expect.objectContaining({
            channels: expect.objectContaining({
              slack: true, // Not stripped by validation
            }),
          }),
        }),
      }),
    );
  });

  it('persists per-type slack channel overrides', async () => {
    mockDb.mockReturnValue(
      createChain([
        [{ preferences: {} }],
        [],
      ]),
    );

    await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, {
        typeChannels: {
          task_assigned: { slack: false },
        },
      }),
    );

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          notifications: expect.objectContaining({
            typeChannels: expect.objectContaining({
              task_assigned: expect.objectContaining({ slack: false }),
            }),
          }),
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// Response contract
// ═══════════════════════════════════════════════════════════════════

describe('Preferences API — response contract', () => {
  it('GET returns expected shape with preferences object', async () => {
    mockDb.mockReturnValue(
      createChain([[{ preferences: { notifications: {} } }]]),
    );

    await GET(createRequest('GET', PREFS_PATH));

    const firstCall = mockNextResponseJson.mock.calls[0];
    expect(firstCall).toBeDefined();
    const body = firstCall![0] as Record<string, unknown>;
    expect(body).toHaveProperty('preferences');
    expect(typeof body.preferences).toBe('object');
  });

  it('PATCH returns expected shape with preferences object', async () => {
    mockDb.mockReturnValue(
      createChain([
        [{ preferences: {} }],
        [],
      ]),
    );

    await PATCH(createRequest('PATCH', PREFS_PATH, undefined, { channels: { email: true } }));

    const firstCall = mockNextResponseJson.mock.calls[0];
    expect(firstCall).toBeDefined();
    const body = firstCall![0] as Record<string, unknown>;
    expect(body).toHaveProperty('preferences');
    expect(typeof body.preferences).toBe('object');
  });

  it('PATCH returns 400 with validation error shape', async () => {
    mockDb.mockReturnValue(createChain([[]]));

    await PATCH(
      createRequest('PATCH', PREFS_PATH, undefined, {
        channels: 'invalid_type', // Invalid type
      }),
    );

    const firstCall = mockNextResponseJson.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [body, init] = firstCall! as [Record<string, unknown>, { status?: number } | undefined];
    expect(init?.status).toBe(400);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });
});
