// Generic, framework-agnostic dependency graph — no React, no store access.
// Nodes and edges only; callers (projectGraph.js) decide what a node means.

export class DependencyGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return node;
  }

  addEdge(from, to, relation) {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Cannot link unknown node: ${from} -> ${to}`);
    }
    this.edges.push({ from, to, relation });
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  predecessorsOf(id) {
    return this.edges.filter(e => e.to === id).map(e => this.nodes.get(e.from)).filter(Boolean);
  }

  successorsOf(id) {
    return this.edges.filter(e => e.from === id).map(e => this.nodes.get(e.to)).filter(Boolean);
  }

  nodesOfType(type) {
    return [...this.nodes.values()].filter(n => n.type === type);
  }

  allEdges() {
    return this.edges;
  }

  // Kahn's algorithm. Returns { order, cyclic } — cyclic lists node ids that
  // never resolved (still had unmet predecessors), so a cycle never crashes
  // the caller, it just gets reported.
  topologicalSort() {
    const indegree = new Map([...this.nodes.keys()].map(id => [id, 0]));
    for (const e of this.edges) indegree.set(e.to, (indegree.get(e.to) || 0) + 1);
    const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      for (const succ of this.successorsOf(id)) {
        indegree.set(succ.id, indegree.get(succ.id) - 1);
        if (indegree.get(succ.id) === 0) queue.push(succ.id);
      }
    }
    const cyclic = order.length === this.nodes.size ? [] : [...this.nodes.keys()].filter(id => !order.includes(id));
    return { order, cyclic };
  }
}
