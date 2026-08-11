import { getDb, schema } from '@workmanagement/database';
import { eq } from 'drizzle-orm';
import { getUserStatus } from '@/lib/auth/api-auth';

// ─── Long-lived stream re-authorization (WM-008) ───────────────
//
// The SSE handshake authenticates once. Without a periodic re-check, a stream
// that was authorized at connect time keeps pushing that user's events forever:
// after the user logs out (session row deleted), after the session expires, or
// after an admin deactivates the account, an already-open browser tab would go
// on receiving live notifications until it happens to close. This module lets
// the stream re-validate against the DB on an interval and tear itself down.

export type StreamAuthResult =
  | { valid: true }
  | { valid: false; reason: 'session_revoked' | 'session_expired' | 'account_disabled' };

/**
 * Re-validate a long-lived stream's authorization against the database.
 *
 * Checks, in order:
 *  1. the session row still exists — Better Auth deletes it on sign-out, so a
 *     missing row means the user logged out (or the session was revoked);
 *  2. the session has not passed its `expiresAt`;
 *  3. the account is still active (delegates to the canonical `getUserStatus`,
 *     i.e. not soft-deleted / suspended / deactivated).
 *
 * Fails closed: if the session lookup errors we drop the stream rather than
 * keep streaming on an unverifiable session — the client reconnects, which
 * re-authenticates through the normal handshake.
 */
export async function revalidateStreamAuth(
  sessionId: string,
  userId: string,
): Promise<StreamAuthResult> {
  try {
    const db = getDb();
    const [sess] = await db
      .select({ expiresAt: schema.sessions.expiresAt })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .limit(1);

    if (!sess) return { valid: false, reason: 'session_revoked' };
    if (sess.expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'session_expired' };
    }
  } catch {
    return { valid: false, reason: 'session_revoked' };
  }

  const { isActive } = await getUserStatus(userId);
  if (!isActive) return { valid: false, reason: 'account_disabled' };

  return { valid: true };
}
