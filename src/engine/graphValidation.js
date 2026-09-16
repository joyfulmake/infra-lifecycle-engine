// Validation passes over a DependencyGraph. Never fail silently: anything
// that can't be resolved automatically is flagged for a human, not dropped.

// DFS-based cycle detection (three-color marking).
export function detectCycles(graph) {
  const white = new Set(graph.nodes.keys());
  const gray = new Set();
  const black = new Set();
  const flagged = [];

  function visit(id, path) {
    if (black.has(id)) return;
    if (gray.has(id)) {
      const start = path.indexOf(id);
      flagged.push({
        nodeIds: path.slice(start === -1 ? 0 : start).concat(id),
        reason: 'circular_dependency',
        detectedAt: new Date().toISOString(),
      });
      return;
    }
    gray.add(id);
    white.delete(id);
    for (const succ of graph.successorsOf(id)) visit(succ.id, [...path, id]);
    gray.delete(id);
    black.add(id);
  }

  while (white.size > 0) {
    const next = white.values().next().value;
    visit(next, []);
  }
  return flagged;
}

// A task with no predecessor AND no successor within its own chain, or a
// risk/issue/dependency/change RAID row with no linked task at all, is
// either genuinely standalone or a missed link — flag it either way and let
// a human decide, rather than guessing silently.
export function findOrphanTasks(graph) {
  return graph.nodesOfType('task')
    .filter(n => graph.predecessorsOf(n.id).length === 0 && graph.successorsOf(n.id).length === 0)
    .map(n => ({ nodeIds: [n.id], reason: 'no_dependency_found_check_manually', detectedAt: new Date().toISOString() }));
}

export function findUnlinkedRaidItems(graph) {
  const linkable = new Set(['RISK', 'ISSUE', 'DEPENDENCY', 'CHANGE']);
  return graph.nodesOfType('raid')
    .filter(n => linkable.has(n.raidType) && graph.successorsOf(n.id).length === 0)
    .map(n => ({ nodeIds: [n.id], reason: 'no_linked_task_check_manually', detectedAt: new Date().toISOString() }));
}
