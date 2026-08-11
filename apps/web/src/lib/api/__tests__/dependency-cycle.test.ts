import { describe, it, expect, vi } from 'vitest';
import { wouldCreateCycle } from '../dependency-cycle';

// Build a fetchDeps backed by an in-memory adjacency map: taskId -> its
// dependsOnTaskIds. Mirrors the route's batched query.
function graph(adj: Record<string, string[]>) {
  return vi.fn(async (taskIds: string[]) => taskIds.flatMap((id) => adj[id] ?? []));
}

describe('wouldCreateCycle (WM-013)', () => {
  it('flags a self-dependency', async () => {
    expect(await wouldCreateCycle('A', 'A', graph({}))).toBe(true);
  });

  it('flags a direct reverse edge (B already depends on A)', async () => {
    // Adding A → B, but B already depends on A.
    expect(await wouldCreateCycle('A', 'B', graph({ B: ['A'] }))).toBe(true);
  });

  it('flags a transitive cycle (B → C → A)', async () => {
    // Adding A → B, and B → C → A already exists.
    expect(await wouldCreateCycle('A', 'B', graph({ B: ['C'], C: ['A'] }))).toBe(true);
  });

  it('allows an edge that does not close a loop', async () => {
    // Adding A → B; B depends on C, D — none reach A.
    expect(await wouldCreateCycle('A', 'B', graph({ B: ['C', 'D'], C: ['E'] }))).toBe(false);
  });

  it('allows an edge into an empty graph', async () => {
    expect(await wouldCreateCycle('A', 'B', graph({}))).toBe(false);
  });

  it('terminates on pre-existing cycles in the graph (visited guard)', async () => {
    // The stored graph already contains B ⇄ C; the walk must not loop forever
    // and, since neither reaches A, adding A → B is allowed.
    const fetch = graph({ B: ['C'], C: ['B'] });
    expect(await wouldCreateCycle('A', 'B', fetch)).toBe(false);
  });

  it('batches frontier lookups rather than querying one node at a time', async () => {
    const fetch = graph({ B: ['C', 'D'], C: ['E'], D: ['F'] });
    await wouldCreateCycle('A', 'B', fetch);
    // 3 BFS levels: [B] -> [C,D] -> [E,F]; each level is one batched call.
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1]![0]).toEqual(['C', 'D']);
  });
});
