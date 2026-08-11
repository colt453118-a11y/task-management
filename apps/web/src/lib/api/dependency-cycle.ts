// ─── Task dependency cycle detection (WM-013) ──────────────────
//
// A dependency row `{ taskId: A, dependsOnTaskId: B }` means "A depends on B"
// (B must finish before A). The dependency graph must stay acyclic — a cycle
// means tasks mutually block each other, which deadlocks scheduling/gantt.
//
// Adding "source depends on dependsOn" creates a cycle iff `dependsOn` already
// (transitively) depends on `source`. We check that by walking the depends-on
// graph breadth-first starting from `dependsOn` and looking for `source`.

/**
 * @param fetchDeps given a batch of task ids, returns the ids they directly
 *   depend on (the `dependsOnTaskId`s), scoped to the caller's org.
 * @returns true if adding `source → dependsOn` would introduce a cycle.
 */
export async function wouldCreateCycle(
  sourceTaskId: string,
  dependsOnTaskId: string,
  fetchDeps: (taskIds: string[]) => Promise<string[]>,
): Promise<boolean> {
  // A task depending on itself is the degenerate 1-node cycle.
  if (sourceTaskId === dependsOnTaskId) return true;

  const visited = new Set<string>();
  let frontier = [dependsOnTaskId];

  while (frontier.length > 0) {
    const deps = await fetchDeps(frontier);
    const next: string[] = [];
    for (const dep of deps) {
      // Reaching the source means dependsOn already depends on source → adding
      // source → dependsOn closes the loop.
      if (dep === sourceTaskId) return true;
      if (!visited.has(dep)) {
        visited.add(dep);
        next.push(dep);
      }
    }
    frontier = next;
  }

  return false;
}
