import { DependencyGraph } from './graph.js';
import { buildDesignTasks } from '../lib/designTasks.js';
import { getRealTasks } from '../lib/realTasks.js';
import { buildAllRaidRows } from '../lib/raidRows.js';
import { ALL_UUM } from '../lib/uumItems.js';

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'will', 'all', 'any', 'per']);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function overlapScore(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setB = new Set(tokensB);
  let hits = 0;
  for (const t of tokensA) if (setB.has(t)) hits++;
  return hits;
}

// Stable per-task id, matching GanttTab.jsx's taskKey() convention exactly
// so graph node ids line up with ganttOverrides keys the UI already uses.
function taskKey(task, i, uumCode) {
  const base = task.id || task.title || task.name || String(i);
  return uumCode ? `${base}:${uumCode}` : base;
}

function normalizeTask(raw, i, chainId, chainLabel, uumCode, ganttOverrides) {
  const id = taskKey(raw, i, uumCode);
  const override = ganttOverrides?.[id];
  return {
    id,
    type: 'task',
    chainId,
    chainLabel,
    index: i,
    role: raw.role || raw.team || 'Unassigned',
    name: raw.name || raw.title || `Task ${i + 1}`,
    hours: override?.durationHours ?? raw.duration_hours ?? raw.dur ?? raw.est_hours ?? raw.hours ?? 2,
    parallel: override?.parallel ?? !!raw.parallel,
    prereqText: raw.dep || raw.validate || '',
    raw,
  };
}

// Builds a DependencyGraph from the app's real Zustand state — no invented
// data model. Two node types: 'task' (from buildDesignTasks + per-UUM
// getRealTasks, chained sequentially exactly as GanttTab already schedules
// them) and 'raid' (from buildAllRaidRows — the same rows RaidTab renders).
// Edges: 'handoff' between sequential tasks in a chain (skipped when a task
// is flagged parallel, mirroring computeCPM's model), and 'impacts' from a
// RAID row to any task it keyword-matches on role/description overlap.
export function buildProjectGraph(state) {
  const graph = new DependencyGraph();
  const chains = [];

  // Chain 1: design-phase tasks (sequential, same list Gantt renders as the
  // "Design" phase when no Groq-generated sdAiTasks are present).
  const isAi = (state.sdAiTasks || []).length > 0;
  const designRaw = isAi ? state.sdAiTasks : buildDesignTasks(state.sysDesignData || {});
  chains.push({
    id: 'chain-design', label: 'System Design Build-Out',
    tasks: designRaw.map((t, i) => normalizeTask(t, i, 'chain-design', 'System Design Build-Out', null, state.ganttOverrides)),
  });

  // One chain per selected UUM item, each its own sequential run (matches
  // calcDates: each UUM group schedules after the design chain ends).
  (state.selUUM || []).forEach(code => {
    const catalog = ALL_UUM.find(u => u.code === code);
    const custom = !catalog ? (state.customUUM || []).find(u => u.id === code) : null;
    const uum = catalog || custom;
    if (!uum) return;
    const uumCode = uum.code || uum.id;
    const rawTasks = custom?.aiTasks?.length ? custom.aiTasks : getRealTasks({ ...uum, code: uumCode }, state.ctx || {});
    chains.push({
      id: `chain-uum-${uumCode}`, label: uum.short || uumCode,
      tasks: rawTasks.map((t, i) => normalizeTask(t, i, `chain-uum-${uumCode}`, uum.short || uumCode, uumCode, state.ganttOverrides)),
    });
  });

  const allTaskNodes = [];
  chains.forEach(chain => {
    chain.tasks.forEach(t => { graph.addNode(t); allTaskNodes.push(t); });
    for (let i = 1; i < chain.tasks.length; i++) {
      if (chain.tasks[i].parallel) continue; // parallel tasks float off the previous one, no hard handoff edge
      graph.addEdge(chain.tasks[i - 1].id, chain.tasks[i].id, 'handoff');
    }
  });

  // RAID rows as nodes, linked to any task they keyword-overlap with.
  const { allRows } = buildAllRaidRows(state);
  allRows.forEach((row, i) => {
    const id = row.id || `raid-${i}`;
    graph.addNode({
      id, type: 'raid', raidType: row.type, severity: row.severity,
      probability: row.probability, impact: row.impact,
      description: row.description, owner: row.owner, status: row.status, raw: row,
    });
    const rowTokens = tokenize(row.description + ' ' + row.owner);
    allTaskNodes.forEach(t => {
      const score = overlapScore(rowTokens, tokenize(t.role + ' ' + t.name));
      if (score >= 2) graph.addEdge(id, t.id, 'impacts');
    });
  });

  return { graph, chains };
}
