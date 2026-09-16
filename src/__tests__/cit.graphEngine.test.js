// CIT — Component Integration Tests: dependency graph engine (Phase 3)
// Validates the generic graph (graph.js), validation passes
// (graphValidation.js), the function-team ordering audit
// (functionTeamMatrix.js), and real-data assembly (projectGraph.js).

import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../engine/graph.js';
import { detectCycles, findOrphanTasks, findUnlinkedRaidItems } from '../engine/graphValidation.js';
import { rankOfTeam, findOutOfOrderHandoffs, DEFAULT_TEAM_ORDER } from '../engine/functionTeamMatrix.js';
import { buildProjectGraph } from '../engine/projectGraph.js';

describe('DependencyGraph', () => {
  it('adds nodes and edges, resolves predecessors/successors', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'a', type: 'task' });
    g.addNode({ id: 'b', type: 'task' });
    g.addEdge('a', 'b', 'handoff');
    expect(g.successorsOf('a').map(n => n.id)).toEqual(['b']);
    expect(g.predecessorsOf('b').map(n => n.id)).toEqual(['a']);
    expect(g.predecessorsOf('a')).toEqual([]);
  });

  it('throws when linking an unknown node', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'a', type: 'task' });
    expect(() => g.addEdge('a', 'missing', 'handoff')).toThrow();
  });

  it('nodesOfType filters correctly', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'a', type: 'task' });
    g.addNode({ id: 'b', type: 'raid' });
    expect(g.nodesOfType('task').map(n => n.id)).toEqual(['a']);
    expect(g.nodesOfType('raid').map(n => n.id)).toEqual(['b']);
  });

  it('topologicalSort orders a simple chain and detects a cycle', () => {
    const g = new DependencyGraph();
    ['a', 'b', 'c'].forEach(id => g.addNode({ id, type: 'task' }));
    g.addEdge('a', 'b', 'handoff');
    g.addEdge('b', 'c', 'handoff');
    const { order, cyclic } = g.topologicalSort();
    expect(order).toEqual(['a', 'b', 'c']);
    expect(cyclic).toEqual([]);

    const g2 = new DependencyGraph();
    ['x', 'y'].forEach(id => g2.addNode({ id, type: 'task' }));
    g2.addEdge('x', 'y', 'handoff');
    g2.addEdge('y', 'x', 'handoff');
    const result2 = g2.topologicalSort();
    expect(result2.order.length).toBeLessThan(2);
    expect(result2.cyclic.length).toBeGreaterThan(0);
  });
});

describe('detectCycles', () => {
  it('flags an injected circular edge (A -> B -> A)', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'a', type: 'task' });
    g.addNode({ id: 'b', type: 'task' });
    g.addEdge('a', 'b', 'handoff');
    g.addEdge('b', 'a', 'handoff');
    const flagged = detectCycles(g);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged[0].reason).toBe('circular_dependency');
    expect(flagged[0].nodeIds).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('does not flag an acyclic chain', () => {
    const g = new DependencyGraph();
    ['a', 'b', 'c'].forEach(id => g.addNode({ id, type: 'task' }));
    g.addEdge('a', 'b', 'handoff');
    g.addEdge('b', 'c', 'handoff');
    expect(detectCycles(g)).toEqual([]);
  });
});

describe('findOrphanTasks / findUnlinkedRaidItems', () => {
  it('flags a task with no predecessor and no successor, not one with either', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'linked-1', type: 'task' });
    g.addNode({ id: 'linked-2', type: 'task' });
    g.addNode({ id: 'lonely', type: 'task' });
    g.addEdge('linked-1', 'linked-2', 'handoff');
    const orphans = findOrphanTasks(g).map(f => f.nodeIds[0]);
    expect(orphans).toEqual(['lonely']);
  });

  it('flags a RISK/ISSUE/DEPENDENCY/CHANGE raid row with no linked task, not ASSUMPTION/DECISION', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'task-1', type: 'task' });
    g.addNode({ id: 'risk-linked', type: 'raid', raidType: 'RISK' });
    g.addNode({ id: 'risk-orphan', type: 'raid', raidType: 'RISK' });
    g.addNode({ id: 'assumption-1', type: 'raid', raidType: 'ASSUMPTION' });
    g.addEdge('risk-linked', 'task-1', 'impacts');
    const flagged = findUnlinkedRaidItems(g).map(f => f.nodeIds[0]);
    expect(flagged).toEqual(['risk-orphan']);
  });
});

describe('functionTeamMatrix', () => {
  it('ranks compound team strings by the earliest-ranked team mentioned', () => {
    expect(rankOfTeam('NetAdmin')).toBe(0);
    expect(rankOfTeam('DBA + BackupAdmin')).toBe(DEFAULT_TEAM_ORDER.indexOf('BackupAdmin'));
    expect(rankOfTeam('Unrecognized Team')).toBe(DEFAULT_TEAM_ORDER.length);
  });

  it('flags a handoff that jumps backward in canonical order beyond tolerance', () => {
    const tasks = [
      { id: 't1', role: 'SecOps', name: 'Harden endpoint' },
      { id: 't2', role: 'NetAdmin', name: 'Configure VLANs' },
    ];
    const flags = findOutOfOrderHandoffs(tasks);
    expect(flags.length).toBe(1);
    expect(flags[0].reason).toBe('team_order_review');
  });

  it('does not flag a forward or adjacent-order handoff', () => {
    const tasks = [
      { id: 't1', role: 'NetAdmin', name: 'Configure VLANs' },
      { id: 't2', role: 'StorageAdmin', name: 'Provision LUNs' },
    ];
    expect(findOutOfOrderHandoffs(tasks)).toEqual([]);
  });
});

describe('buildProjectGraph (real data assembly)', () => {
  const baseState = {
    ctx: { hw: 'Dell PowerEdge (x86_64)', os: 'RHEL 9.x', db: 'PostgreSQL 16', app: 'Node.js 22 LTS' },
    sysDesignData: {
      network: { vlan_ids: 'VLAN 100, 200', fw_rules: 'Allow 443,22' },
      storage: { lun_size: '500GB' },
    },
    sdAiTasks: [],
    selUUM: [],
    selInc: [],
    selFix: [],
    customUUM: [],
    customInc: [],
    customRaidEntries: [],
    ganttOverrides: {},
    cabApproved: false,
    rtmSigned: false,
    promoted: false,
  };

  it('builds a design chain with sequential handoff edges', () => {
    const { graph, chains } = buildProjectGraph(baseState);
    const designChain = chains.find(c => c.id === 'chain-design');
    expect(designChain.tasks.length).toBeGreaterThan(0);
    // every task after the first should have exactly one predecessor within the chain
    for (let i = 1; i < designChain.tasks.length; i++) {
      const preds = graph.predecessorsOf(designChain.tasks[i].id);
      expect(preds.length).toBe(1);
      expect(preds[0].id).toBe(designChain.tasks[i - 1].id);
    }
  });

  it('links RAID rows to tasks by keyword overlap without crashing on zero matches', () => {
    const { graph } = buildProjectGraph(baseState);
    const raidNodes = graph.nodesOfType('raid');
    expect(raidNodes.length).toBeGreaterThan(0);
    // some rows are pure process rows (e.g. CAB/RTM dependencies) and may
    // legitimately have zero matches — the assembly must not throw either way
    const flagged = findUnlinkedRaidItems(graph);
    expect(Array.isArray(flagged)).toBe(true);
  });

  it('never produces a cyclic graph from real sequential chains', () => {
    const { graph } = buildProjectGraph(baseState);
    expect(detectCycles(graph)).toEqual([]);
  });
});
