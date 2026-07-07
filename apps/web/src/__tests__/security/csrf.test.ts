import { describe, it, expect } from 'vitest';
import { validateOrigin, validateReferer, csrfErrorResponse } from '@/lib/api/csrf';

const ALLOWED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
  'http://localhost:3000',
];

// ─── validateOrigin ────────────────────────────────────────────

describe('validateOrigin', () => {
  it('allows requests from allowed origins', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { origin: 'https://app.example.com' },
    });
    expect(validateOrigin(req, ALLOWED_ORIGINS)).toEqual({ valid: true });
  });

  it('allows requests from localhost in allowed list', () => {
    const req = new Request('http://localhost:3000/api/tasks', {
      headers: { origin: 'http://localhost:3000' },
    });
    expect(validateOrigin(req, ALLOWED_ORIGINS)).toEqual({ valid: true });
  });

  it('rejects requests from unknown origins', () => {
    const req = new Request('https://evil.com/api/tasks', {
      headers: { origin: 'https://evil.com' },
    });
    const result = validateOrigin(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('evil.com');
  });

  it('rejects requests from null origin string', () => {
    // Some browsers send 'null' for file:// or data:// origins
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { origin: 'null' },
    });
    const result = validateOrigin(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
  });

  it('allows requests with no Origin header', () => {
    // Same-origin requests and non-browser clients may omit Origin
    const req = new Request('https://app.example.com/api/tasks');
    expect(validateOrigin(req, ALLOWED_ORIGINS)).toEqual({ valid: true });
  });

  it('is case-sensitive in origin matching', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { origin: 'HTTPS://APP.EXAMPLE.COM' },
    });
    const result = validateOrigin(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
  });

  it('handles trailing slashes in origin', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { origin: 'https://app.example.com/' },
    });
    expect(validateOrigin(req, ALLOWED_ORIGINS)).toEqual({ valid: true });
  });

  it('rejects origin with path components', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { origin: 'https://app.example.com/evil-path' },
    });
    const result = validateOrigin(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
  });

  it('rejects origin with port mismatch', () => {
    const req = new Request('http://localhost:3000/api/tasks', {
      headers: { origin: 'http://localhost:8080' },
    });
    const result = validateOrigin(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
  });

  it('rejects subdomain attacks when subdomain not in allowed list', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { origin: 'https://evil.app.example.com' },
    });
    const result = validateOrigin(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
  });
});

// ─── validateReferer ───────────────────────────────────────────

describe('validateReferer', () => {
  it('allows requests with matching referer origin', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { referer: 'https://app.example.com/dashboard' },
    });
    expect(validateReferer(req, ALLOWED_ORIGINS)).toEqual({ valid: true });
  });

  it('rejects requests with unknown referer origin', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { referer: 'https://evil.com/dashboard' },
    });
    const result = validateReferer(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('evil.com');
  });

  it('allows requests with no Referer header', () => {
    const req = new Request('https://app.example.com/api/tasks');
    expect(validateReferer(req, ALLOWED_ORIGINS)).toEqual({ valid: true });
  });

  it('handles invalid Referer URL gracefully', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { referer: 'not-a-valid-url' },
    });
    const result = validateReferer(req, ALLOWED_ORIGINS);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not-a-valid-url');
  });

  it('handles empty Referer header', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { referer: '' },
    });
    expect(validateReferer(req, ALLOWED_ORIGINS)).toEqual({ valid: true });
  });
});

// ─── csrfErrorResponse ─────────────────────────────────────────

describe('csrfErrorResponse', () => {
  it('returns 403 with structured error', () => {
    const res = csrfErrorResponse('Origin not allowed');
    expect(res.status).toBe(403);

    // Response.json() returns a NextResponse — we can check its body
    // by parsing the response after serialisation
  });

  it('includes the reason in the error message', async () => {
    const res = csrfErrorResponse('Custom reason');
    const body = await res.json();
    expect(body.error.code).toBe('CSRF_VALIDATION_FAILED');
    expect(body.error.message).toBe('Custom reason');
  });

  it('provides default message when no reason given', async () => {
    const res = csrfErrorResponse();
    const body = await res.json();
    expect(body.error.code).toBe('CSRF_VALIDATION_FAILED');
    expect(body.error.message).toBe('Cross-site request forbidden');
  });
});

// ─── Integration: Origin + Referer fallback ────────────────────

describe('CSRF validation flow (Origin → Referer fallback)', () => {
  const allowed = ALLOWED_ORIGINS;

  it('passes when Origin is missing but Referer matches', () => {
    // Some CDNs strip the Origin header but preserve Referer
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { referer: 'https://app.example.com/dashboard' },
    });
    // Origin check passes (missing Origin)
    expect(validateOrigin(req, allowed)).toEqual({ valid: true });
    // If we needed to fall back, Referer would also pass
    expect(validateReferer(req, allowed)).toEqual({ valid: true });
  });

  it('fails when Origin and Referer both point to attacker', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: {
        origin: 'https://evil.com',
        referer: 'https://evil.com/dashboard',
      },
    });
    expect(validateOrigin(req, allowed).valid).toBe(false);
    expect(validateReferer(req, allowed).valid).toBe(false);
  });

  it('fails when bad Origin is present but good Referer is absent', () => {
    const req = new Request('https://app.example.com/api/tasks', {
      headers: { origin: 'https://evil.com' },
    });
    expect(validateOrigin(req, allowed).valid).toBe(false);
  });
});
