import { describe, it, expect, vi } from 'vitest';
import { handleApiError } from '../db';

// Build an AuthError-shaped error without importing the auth layer.
function authError(message: string, code: string, status: number): Error {
  const e = new Error(message);
  e.name = 'AuthError';
  (e as unknown as { code: string; status: number }).code = code;
  (e as unknown as { code: string; status: number }).status = status;
  return e;
}

describe('handleApiError — preserves auth/permission status (WM-004)', () => {
  it('maps a requirePermission/enforceOrgScope AuthError (403) → 403 FORBIDDEN, not 500', () => {
    const r = handleApiError(authError("Forbidden: requires 'task:edit'", 'FORBIDDEN', 403), 'Failed to X');
    expect(r.status).toBe(403);
    expect(r.error.code).toBe('FORBIDDEN');
  });

  it('maps a requireAuth AuthError (401) → 401', () => {
    const r = handleApiError(authError('Unauthorized', 'UNAUTHORIZED', 401), 'Failed to X');
    expect(r.status).toBe(401);
    expect(r.error.code).toBe('UNAUTHORIZED');
  });

  it('leaves a generic error as the passed-in status/code (500 default) and generic message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = handleApiError(new Error('internal detail that must not leak'), 'Failed to X');
    expect(r.status).toBe(500);
    expect(r.error.code).toBe('INTERNAL_ERROR');
    expect(r.error.message).toBe('Failed to X'); // generic message, not the raw error
  });
});
