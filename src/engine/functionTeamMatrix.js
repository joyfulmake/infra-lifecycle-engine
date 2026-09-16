// Canonical handoff order between function teams for a standard build,
// mirrors the actual sequence buildDesignTasks() already generates in
// src/lib/designTasks.js (Network -> Storage -> Backup -> Unix -> DB -> Web
// -> App -> Security). Used only as an audit signal: when a task's team
// appears earlier in a chain than the matrix expects, it's surfaced as a
// "verify this ordering" flag, not silently corrected — the actual build
// order always comes from array position (see calcDates/computeCPM in
// GanttTab.jsx), never from this matrix.
export const DEFAULT_TEAM_ORDER = [
  'NetAdmin', 'StorageAdmin', 'BackupAdmin', 'Unix Admin', 'DBA', 'WebAdmin', 'AppAdmin', 'SecOps',
];

// A task's `role`/`team` field is often a compound string like
// "DBA + BackupAdmin" or "Unix Admin / App Admin" — resolve to the
// earliest-ranked team mentioned, since that's the one that gates the task.
export function rankOfTeam(teamStr, order = DEFAULT_TEAM_ORDER) {
  if (!teamStr) return order.length;
  const norm = String(teamStr).toLowerCase();
  let best = order.length;
  order.forEach((team, i) => {
    if (norm.includes(team.toLowerCase())) best = Math.min(best, i);
  });
  return best;
}

// Flags task[i] when its team ranks earlier than task[i-1]'s team by more
// than `tolerance` steps — a soft signal, not a hard rule (teams often mix
// intentionally), so it's reported as a review hint, never auto-blocked.
export function findOutOfOrderHandoffs(taskNodes, order = DEFAULT_TEAM_ORDER, tolerance = 1) {
  const flags = [];
  for (let i = 1; i < taskNodes.length; i++) {
    const prevRank = rankOfTeam(taskNodes[i - 1].role, order);
    const curRank = rankOfTeam(taskNodes[i].role, order);
    if (curRank < prevRank - tolerance) {
      flags.push({
        nodeIds: [taskNodes[i - 1].id, taskNodes[i].id],
        reason: 'team_order_review',
        detail: `"${taskNodes[i].name}" (${taskNodes[i].role}) follows "${taskNodes[i - 1].name}" (${taskNodes[i - 1].role}) — verify this handoff order is intentional`,
        detectedAt: new Date().toISOString(),
      });
    }
  }
  return flags;
}
