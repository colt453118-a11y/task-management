import { db, schema } from '@/lib/api/db';
import { eq, like, or, and } from 'drizzle-orm';

// ─── Mention Parsing ────────────────────────────────────────────
//
// Supports @mentions using user's name or email prefix.
// Patterns matched:
//   @username   — matches user.name
//   @User Name  — matches full name
//
// We parse potential mentions, then batch-resolve them against the DB.

/**
 * Extract potential mention tokens from text.
 * Returns an array of unique, trimmed mention strings (without the @).
 */
export function extractMentionTokens(text: string | null | undefined): string[] {
  if (!text) return [];

  // Match @ followed by word characters, hyphens, dots, or spaces
  // Handles: @john, @JohnDoe, @john.doe, @John Doe
  const mentionPattern = /@([\w.\- ]+?)(?=\s|$|[.,!?;:)\]}\]])/g;
  const tokens = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(text)) !== null) {
    const token = match[1]?.trim();
    if (token && token.length >= 1 && token.length <= 100) {
      tokens.add(token.toLowerCase());
    }
  }

  return Array.from(tokens);
}

/**
 * Resolve mention tokens to actual user IDs within an organization.
 * Matches by name (case-insensitive) or email prefix.
 *
 * @param orgId - Organization scope to search within
 * @param tokens - Mention tokens extracted from text
 * @returns Map of token -> userId for resolved mentions
 */
export async function resolveMentions(
  orgId: string,
  tokens: string[],
): Promise<Map<string, string>> {
  if (tokens.length === 0) return new Map();

  const result = new Map<string, string>();

  // Build OR conditions for each token — match against name OR email
  const conditions = tokens.map((token) =>
    or(
      like(schema.users.name, `%${token}%`),
      like(schema.users.email, `${token}%`),
    ),
  );

  const users = await db()
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.organizationId, orgId),
        eq(schema.users.isActive, true),
        or(...conditions),
      ),
    )
    .limit(50);

  // For each token, find the best matching user
  for (const token of tokens) {
    const lowerToken = token.toLowerCase();
    const matched = users.find(
      (u) =>
        u.name?.toLowerCase().includes(lowerToken) ||
        u.email.toLowerCase().startsWith(lowerToken),
    );
    if (matched) {
      result.set(token, matched.id);
    }
  }

  return result;
}

/**
 * Convenience function: extract mentions from text and resolve them.
 * Excludes the actor's own userId from results.
 *
 * @returns Array of resolved userIds that were mentioned
 */
export async function extractAndResolveMentions(
  orgId: string,
  text: string | null | undefined,
  excludeUserId?: string,
): Promise<string[]> {
  const tokens = extractMentionTokens(text);
  if (tokens.length === 0) return [];

  const resolved = await resolveMentions(orgId, tokens);
  const userIds = Array.from(resolved.values());

  if (excludeUserId) {
    return userIds.filter((id) => id !== excludeUserId);
  }

  return userIds;
}
