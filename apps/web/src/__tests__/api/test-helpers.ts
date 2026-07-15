import { vi } from 'vitest';

// ─── Types ──────────────────────────────────────────────────────

export type TerminalResult = unknown;

export interface QueryChain {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (value: TerminalResult) => void) => void;
}

// ─── createChain ────────────────────────────────────────────────

/**
 * Build a thenable drizzle query chain that returns results from a queue.
 *
 * Each `await db().select()...where()...limit(1)` resolves to the next
 * element in `resultsQueue`, making it simple to simulate multi-query routes:
 *
 *    createChain([taskRow, watcherRows])
 *       → 1st query returns taskRow
 *       → 2nd query returns watcherRows
 */
export function createChain(resultsQueue: TerminalResult[]): QueryChain {
  let index = 0;
  const then = (resolve: (value: TerminalResult) => void) =>
    resolve(resultsQueue[index++] ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    then,
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  };
  return chain as unknown as QueryChain;
}

// ─── createRequest ──────────────────────────────────────────────

/**
 * Create a minimal mock NextRequest with an optional body.
 * Routes that read `request.json()` will receive `body ?? { content: 'Test content' }`.
 * The default content ensures POST schema validation passes in most routes.
 */
export function createRequest(method: string, pathname: string, searchParams?: string, body?: unknown): any {
  return {
    method,
    nextUrl: {
      pathname,
      searchParams: new URLSearchParams(searchParams ?? ''),
    },
    json: async () => body ?? { content: 'Test content' },
  };
}

// ─── chain() helper ─────────────────────────────────────────────

/**
 * Extract the current QueryChain from a `mockDb` so that
 * call-count assertions can be made on individual chain methods.
 *
 * Usage:
 *   mockDb.mockReturnValue(createChain([...]));
 *   expect(chain().innerJoin).toHaveBeenCalled();
 */
export function chain(mockDb: ReturnType<typeof vi.fn>): QueryChain {
  return mockDb.mock.results[0]?.value as QueryChain;
}
