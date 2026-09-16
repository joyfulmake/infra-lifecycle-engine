// Phase 4 — math engine. Pure functions over the Phase 3 graph plus a
// lightweight per-task progress map ({ percentComplete, actualHours }),
// which is the only new state this phase adds (src/store/useStore.js
// `taskProgress`). Everything else reads data the graph already carries.

export const SEVERITY_WEIGHT = { CRITICAL: 5, HIGH: 3, MED: 2, LOW: 1 };
const LINKABLE_TYPES = new Set(['RISK', 'ISSUE', 'DEPENDENCY', 'CHANGE']);

// Risk-Weighted Contingency Buffer: extra hours a task should carry given
// the open RAID items linked to it. Capped at maxBufferMultiple x the
// task's own hours so one mis-weighted risk can't blow out the estimate
// unnoticed — the cap is a visible ceiling, not a silent clamp (callers can
// see raw vs capped and flag it if they differ significantly).
export function computeTaskRWCB(graph, taskId, { hoursPerSeverityPoint = 1, maxBufferMultiple = 2 } = {}) {
  const task = graph.getNode(taskId);
  if (!task) return { raw: 0, capped: 0, hitCap: false };
  const linked = graph.predecessorsOf(taskId).filter(n => n.type === 'raid' && n.status !== 'CLOSED' && n.status !== 'DONE');
  const raw = linked.reduce((sum, r) => sum + (SEVERITY_WEIGHT[r.severity] || 1) * hoursPerSeverityPoint, 0);
  const ceiling = (task.hours || 2) * maxBufferMultiple;
  return { raw, capped: Math.min(raw, ceiling), hitCap: raw > ceiling };
}

// Risk-Adjusted Capacity: for each role, how many hours of that role's
// capacity are being consumed by open risk/issue mitigation right now.
// Reported as drag, not an absolute "hours remaining" figure — this app
// doesn't track headcount per role, so presenting a fabricated capacity
// ceiling would be more misleading than useful.
export function computeRoleCapacityDrag(graph, { hoursPerSeverityPoint = 1 } = {}) {
  const drag = {};
  graph.nodesOfType('raid').forEach(r => {
    if (r.status === 'CLOSED' || r.status === 'DONE') return;
    if (!LINKABLE_TYPES.has(r.raidType)) return;
    const weight = (SEVERITY_WEIGHT[r.severity] || 1) * hoursPerSeverityPoint;
    const affectedRoles = new Set(graph.successorsOf(r.id).filter(n => n.type === 'task').map(t => t.role));
    affectedRoles.forEach(role => { drag[role] = (drag[role] || 0) + weight; });
  });
  return drag; // { [role]: dragHours }
}

// Earned Value Management. `taskProgress` is { [taskId]: { percentComplete: 0-1, actualHours } }.
// `plannedDates` is { [taskId]: { start, end } } (ISO strings), typically from
// calcDates() in scheduling.js — the same schedule Gantt already renders, so
// SPI/CPI reflect the actual plan, not a shadow copy of it.
export function computeEVM(taskNodes, taskProgress, plannedDates, asOfDate = new Date()) {
  let plannedValue = 0, earnedValue = 0, actualCost = 0;

  taskNodes.forEach(t => {
    const hours = t.hours || 0;
    const progress = taskProgress[t.id] || {};
    const pct = Math.max(0, Math.min(1, progress.percentComplete || 0));
    const dates = plannedDates[t.id];

    let scheduledFraction = 0;
    if (dates?.start && dates?.end) {
      const start = new Date(dates.start).getTime();
      const end = new Date(dates.end).getTime();
      const now = asOfDate.getTime();
      if (now >= end) scheduledFraction = 1;
      else if (now > start) scheduledFraction = (now - start) / Math.max(1, end - start);
    }

    plannedValue += hours * scheduledFraction;
    earnedValue += hours * pct;
    actualCost += progress.actualHours || 0;
  });

  return {
    asOfDate: asOfDate.toISOString(),
    plannedValue, earnedValue, actualCost,
    spi: plannedValue > 0 ? earnedValue / plannedValue : 1,
    cpi: actualCost > 0 ? earnedValue / actualCost : 1,
  };
}

// Composite Project Velocity Index. 0.5/0.5 is a configurable starting
// weighting, not a validated constant — exposed as a param, not hardcoded.
export function computePVI(evm, scheduleWeight = 0.5) {
  const value = scheduleWeight * evm.spi + (1 - scheduleWeight) * evm.cpi;
  const band = value >= 1.0 ? 'green' : value >= 0.85 ? 'amber' : 'red';
  return { value, band };
}
