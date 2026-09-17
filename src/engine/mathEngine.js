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
//
// Weight per linked item uses Probability x Impact (both 1-5, standard PM
// risk-matrix scale) when a RAID entry carries them, since that's a finer
// signal than the 4-bucket severity enum — falls back to SEVERITY_WEIGHT
// for entries that don't (every existing RAID row, and any new one where
// the PM hasn't set P/I), so this is purely additive.
export function computeTaskRWCB(graph, taskId, { hoursPerSeverityPoint = 1, maxBufferMultiple = 2 } = {}) {
  const task = graph.getNode(taskId);
  if (!task) return { raw: 0, capped: 0, hitCap: false };
  const linked = graph.predecessorsOf(taskId).filter(n => n.type === 'raid' && n.status !== 'CLOSED' && n.status !== 'DONE');
  const raw = linked.reduce((sum, r) => sum + weightForRaidNode(r) * hoursPerSeverityPoint, 0);
  const ceiling = (task.hours || 2) * maxBufferMultiple;
  return { raw, capped: Math.min(raw, ceiling), hitCap: raw > ceiling };
}

function weightForRaidNode(r) {
  if (r.probability && r.impact) return computeRiskHeatScore(r.probability, r.impact).score / 5; // 1-25 -> ~0.2-5 range, comparable to SEVERITY_WEIGHT
  return SEVERITY_WEIGHT[r.severity] || 1;
}

// Standard 5x5 Probability x Impact risk matrix. Score 1-25; band follows
// the common PMI-style thresholds. Used both to weight RWCB above and to
// auto-suggest a severity label when a PM sets P/I on a RAID entry instead
// of picking severity directly (see RaidTab.jsx).
export function computeRiskHeatScore(probability, impact) {
  const p = Math.max(1, Math.min(5, Number(probability) || 1));
  const i = Math.max(1, Math.min(5, Number(impact) || 1));
  const score = p * i;
  const band = score >= 16 ? 'CRITICAL' : score >= 10 ? 'HIGH' : score >= 5 ? 'MED' : 'LOW';
  return { score, band, probability: p, impact: i };
}

// Multi-factor Delivery Confidence — the capacity-planning factors that
// matter beyond "is anyone assigned": how much of the needed time is
// actually available, whether the technical approach is sound, whether the
// team has the right skills, and whether scope is still moving underneath
// them. These are structured PM/team self-assessment inputs (there's no
// external HR/capacity system this app can read from), stored per task
// alongside the existing % complete / actual hours (see taskProgress in
// useStore.js) — this function just scores whatever has been entered.
const FEASIBILITY_SCORE = { HIGH: 100, MEDIUM: 60, LOW: 20 };
const SKILLSET_SCORE = { STRONG: 100, ADEQUATE: 65, GAP: 25 };
const SCOPE_SCORE = { STABLE: 100, MINOR_CHANGE: 65, VOLATILE: 25 };

export function computeDeliveryConfidence(assessment = {}) {
  const factors = {
    resourceAvailability: assessment.resourceAvailability ?? null, // 0-100, direct
    technicalFeasibility: assessment.technicalFeasibility ?? null, // HIGH|MEDIUM|LOW
    skillsetMatch: assessment.skillsetMatch ?? null, // STRONG|ADEQUATE|GAP
    scopeStability: assessment.scopeStability ?? null, // STABLE|MINOR_CHANGE|VOLATILE
  };

  const scores = [];
  if (factors.resourceAvailability != null) scores.push(Math.max(0, Math.min(100, factors.resourceAvailability)));
  if (factors.technicalFeasibility) scores.push(FEASIBILITY_SCORE[factors.technicalFeasibility] ?? 60);
  if (factors.skillsetMatch) scores.push(SKILLSET_SCORE[factors.skillsetMatch] ?? 65);
  if (factors.scopeStability) scores.push(SCOPE_SCORE[factors.scopeStability] ?? 65);

  if (scores.length === 0) return { score: null, band: 'unassessed', factors };
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const band = score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red';
  return { score, band, factors, assessedFactorCount: scores.length };
}

// Rolls per-task Delivery Confidence up to a per-role view, mirroring
// computeRoleCapacityDrag's shape so both can render in the same panel.
export function computeRoleDeliveryConfidence(taskNodes, taskProgress) {
  const byRole = {};
  taskNodes.forEach(t => {
    const dc = computeDeliveryConfidence(taskProgress[t.id]);
    if (dc.score == null) return;
    if (!byRole[t.role]) byRole[t.role] = [];
    byRole[t.role].push(dc.score);
  });
  const result = {};
  Object.entries(byRole).forEach(([role, scores]) => {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    result[role] = { score: avg, band: avg >= 80 ? 'green' : avg >= 55 ? 'amber' : 'red', taskCount: scores.length };
  });
  return result;
}

// Risk-adjusted cost exposure: converts total RWCB buffer hours across all
// tasks into a cost figure using the existing CostTab rate model, so cost
// tracking automatically reflects the SAME task-linked risk data the
// Dependency Graph surfaces — one number computed once, read in two tabs.
export function computeRiskAdjustedCostExposure(totalBufferHours, dailyRatePerPerson, hoursPerDay = 8) {
  const days = totalBufferHours / hoursPerDay;
  return Math.ceil(days * dailyRatePerPerson);
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
