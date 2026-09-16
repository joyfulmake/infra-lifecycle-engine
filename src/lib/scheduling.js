// Shared date/schedule math — extracted from GanttTab.jsx so the math
// engine (Phase 4) can derive planned dates the same way the Gantt chart
// already does, instead of maintaining a second, divergent date model.

export const BUFFER = 1.3;

export function taskKey(task, i) {
  return task.id || task.title || task.name || String(i);
}

export function addWorkingHours(start, hours, hpd = 8, blocked = []) {
  const d = new Date(start);
  let rem = Math.ceil(hours);
  while (rem > 0) {
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const isBlocked = blocked.some(b => b.start && b.end && b.start <= iso && iso <= b.end);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !isBlocked) rem -= hpd;
  }
  return d;
}

export function fmtDate(d) { return d ? (d instanceof Date ? d.toISOString().slice(0, 10) : d) : '—'; }
export function isWeekend(s) { if (!s || s === '—') return false; const d = new Date(s); return d.getDay() === 0 || d.getDay() === 6; }

export function calcDates(tasks, startDateStr, hpd, overrides, blocked = []) {
  if (!startDateStr) return tasks.map(() => null);
  let cursor = new Date(startDateStr);
  let lastSeqStart = new Date(startDateStr);
  let parallelGroupEnd = null;

  return tasks.map((task, i) => {
    const key = taskKey(task, i);
    const ov = overrides[key] || {};
    const raw = ov.durationHours ?? (task.duration_hours || task.est_hours || task.hours || 2);
    const buf = Math.ceil(raw * BUFFER);
    const isParallel = ov.parallel ?? false;

    if (isParallel) {
      const start = fmtDate(lastSeqStart);
      const endDate = addWorkingHours(new Date(lastSeqStart), buf, hpd, blocked);
      if (!parallelGroupEnd || endDate > parallelGroupEnd) parallelGroupEnd = endDate;
      return { start, end: fmtDate(endDate), raw, buf, parallel: true };
    } else {
      if (parallelGroupEnd && parallelGroupEnd > cursor) cursor = new Date(parallelGroupEnd);
      parallelGroupEnd = null;
      lastSeqStart = new Date(cursor);
      const start = fmtDate(cursor);
      cursor = addWorkingHours(new Date(cursor), buf, hpd, blocked);
      parallelGroupEnd = new Date(cursor);
      return { start, end: fmtDate(cursor), raw, buf, parallel: false };
    }
  });
}

// Critical Path Method: sequential tasks ARE the critical path in this model.
// Parallel tasks have slack = working-day gap until next sequential task starts.
export function computeCPM(tasks, dates, overrides, hpd = 8, blocked = []) {
  const result = tasks.map(() => ({ isCritical: true, slackDays: 0 }));
  if (!dates || dates.some(d => !d)) return result;

  let nextSeqStart = null;
  for (let i = tasks.length - 1; i >= 0; i--) {
    const key = taskKey(tasks[i], i);
    const isParallel = overrides[key]?.parallel ?? false;
    if (!isParallel) {
      nextSeqStart = dates[i]?.start || null;
      result[i] = { isCritical: true, slackDays: 0 };
    } else {
      result[i].isCritical = false;
      if (nextSeqStart && dates[i]?.end) {
        let slack = 0;
        let c = new Date(dates[i].end);
        const target = new Date(nextSeqStart);
        while (c < target) {
          c.setDate(c.getDate() + 1);
          const iso = c.toISOString().slice(0, 10);
          const isBlocked = blocked.some(b => b.start && b.end && b.start <= iso && iso <= b.end);
          if (c.getDay() !== 0 && c.getDay() !== 6 && !isBlocked) slack++;
        }
        result[i].slackDays = Math.max(0, slack);
      }
    }
  }
  return result;
}
