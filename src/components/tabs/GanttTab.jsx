import { useState, useCallback } from 'react';
import { useStore } from '../../store/useStore.js';
import { ALL_UUM } from '../../lib/uumItems.js';
import { ALL_INC } from '../../lib/incidents.js';
import { getRealTasks } from '../../lib/realTasks.js';
import { buildDesignTasks } from '../../lib/designTasks.js';
import { canUseFeature } from '../../lib/auth.js';
import { useAuth } from '../../lib/AuthContext.jsx';

const BUFFER = 1.3;

const TEAM_COLORS = {
  'NetAdmin': 'badge-blue', 'NetAdmin + WebAdmin': 'badge-blue',
  'StorageAdmin': 'badge-slate', 'BackupAdmin': 'badge-slate',
  'Unix Admin': 'badge-teal', 'DB Admin': 'badge-amber', 'DBA': 'badge-amber',
  'DBA Lead': 'badge-amber', 'DBA + BackupAdmin': 'badge-amber',
  'WebAdmin': 'badge-blue', 'AppAdmin': 'badge-green', 'AppAdmin Lead': 'badge-green',
  'SecOps': 'badge-red', 'QA Team': 'badge-green',
  'Change Manager': 'badge-slate', 'SysAdmin Lead': 'badge-slate',
};
const TEAM_BAR_COLOR = {
  'NetAdmin': '#3B82F6', 'NetAdmin + WebAdmin': '#3B82F6',
  'StorageAdmin': '#64748B', 'BackupAdmin': '#64748B',
  'Unix Admin': '#14B8A6', 'DB Admin': '#F59E0B', 'DBA': '#F59E0B',
  'DBA Lead': '#F59E0B', 'DBA + BackupAdmin': '#F59E0B',
  'WebAdmin': '#3B82F6', 'AppAdmin': '#22C55E', 'AppAdmin Lead': '#22C55E',
  'SecOps': '#EF4444', 'QA Team': '#22C55E',
  'Change Manager': '#64748B', 'SysAdmin Lead': '#64748B',
};

const PERIOD_TYPE = {
  freeze:  { label: 'Change Freeze', color: 'bg-red-50 border-red-300 text-red-700',  badge: 'badge-red' },
  holiday: { label: 'Public Holiday', color: 'bg-amber-50 border-amber-300 text-amber-700', badge: 'badge-amber' },
  break:   { label: 'Team Break',    color: 'bg-blue-50 border-blue-300 text-blue-700',  badge: 'badge-blue' },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function addWorkingHours(start, hours, hpd = 8, blocked = []) {
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
function fmtDate(d) { return d ? (d instanceof Date ? d.toISOString().slice(0, 10) : d) : '—'; }
function isWeekend(s) { if (!s || s === '—') return false; const d = new Date(s); return d.getDay() === 0 || d.getDay() === 6; }

function taskKey(task, i) { return task.id || task.title || task.name || String(i); }

function calcDates(tasks, startDateStr, hpd, overrides, blocked = []) {
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

function getEnvTag(task) {
  const n = (task.name || task.title || '').toLowerCase();
  const prod = !!task.window || /\bprod\b|cutover|go.live|switch|promo/i.test(n);
  const np = /staging|sandbox|qa|test|dr\s|backup|rehearsal|prep|non.?prod|model|integration|dev/i.test(n);
  if (prod && !np) return 'prod';
  if (np && !prod) return 'nonprod';
  return 'both';
}

function EnvBadge({ tag }) {
  if (tag === 'prod') return <span className="badge badge-red text-xs">Prod</span>;
  if (tag === 'nonprod') return <span className="badge badge-blue text-xs">Non-Prod</span>;
  return <span className="badge badge-slate text-xs">Both</span>;
}

// ── Inline task editor ────────────────────────────────────────────────────────

function TaskEditPanel({ taskKey: key, task, override, onSave, onClear, canEdit }) {
  const [dur, setDur] = useState(String(override?.durationHours ?? task.duration_hours ?? task.est_hours ?? task.hours ?? 2));
  const [dep, setDep] = useState(override?.dep ?? (task.dep || (task.depends_on || []).join(', ') || ''));
  const [parallel, setParallel] = useState(override?.parallel ?? false);

  if (!canEdit) return (
    <div className="px-3 pb-2 text-xs text-slate-400">Sign in with Professional+ to edit task durations and scheduling.</div>
  );

  return (
    <div className="px-3 pb-3 pt-1 bg-slate-50 border-t border-slate-200">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-slate-500 block mb-0.5">Duration (h)</label>
          <input
            type="number" min="0.5" step="0.5"
            className="w-20 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
            value={dur}
            onChange={e => setDur(e.target.value)}
          />
          <div className="text-xs text-amber-500 mt-0.5">+{Math.ceil(parseFloat(dur || 2) * (BUFFER - 1))}h buf = {Math.ceil(parseFloat(dur || 2) * BUFFER)}h total</div>
        </div>
        <div className="flex-1 min-w-32">
          <label className="text-xs text-slate-500 block mb-0.5">Dependency / notes</label>
          <input
            type="text"
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
            value={dep}
            onChange={e => setDep(e.target.value)}
            placeholder="e.g. task-id, after DB migration..."
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setParallel(p => !p)}
            className={['w-8 h-5 rounded-full relative transition-colors', parallel ? 'bg-teal' : 'bg-slate-300'].join(' ')}
          >
            <span className={['absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all', parallel ? 'left-3.5' : 'left-0.5'].join(' ')} />
          </button>
          <span className="text-xs text-slate-500">Parallel</span>
        </div>
        <div className="flex gap-1.5">
          <button
            className="text-xs bg-teal text-white rounded px-2 py-1 hover:bg-teal/80"
            onClick={() => onSave(key, { durationHours: parseFloat(dur) || 2, dep, parallel })}
          >Save</button>
          {override && (
            <button className="text-xs text-slate-400 hover:text-red-500 border border-slate-200 rounded px-2 py-1" onClick={() => onClear(key)}>
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-slate-400 mt-1.5">
        {parallel
          ? 'Runs in parallel with the previous task — same start date.'
          : 'Runs sequentially after all preceding tasks complete.'}
      </div>
    </div>
  );
}

// ── Task row with expand/edit ─────────────────────────────────────────────────

function TaskRow({ task, index, dates, override, onToggleEdit, expanded, maxHours, isUum, canEdit, onSave, onClear }) {
  const role = task.team || task.role || '';
  const color = TEAM_COLORS[role] || 'badge-slate';
  const barColor = TEAM_BAR_COLOR[role] || '#14B8A6';
  const raw = override?.durationHours ?? (task.duration_hours || task.est_hours || task.hours || 2);
  const buf = Math.ceil(raw * BUFFER);
  const isMilestone = task.milestone;
  const envTag = getEnvTag(task);
  const key = taskKey(task, index);
  const isParallel = override?.parallel ?? false;

  return (
    <div className={[
      'border-b border-slate-100',
      isMilestone ? 'bg-amber-50/60 border-l-2 border-amber-400' : '',
      isParallel ? 'border-l-2 border-teal/40' : '',
    ].join(' ')}>
      <div
        className="flex items-start gap-2 px-3 py-2 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => onToggleEdit(key)}
      >
        <div className="text-xs text-slate-400 font-mono flex-shrink-0 w-7 pt-0.5">
          {isParallel ? '‖' : String(index + 1).padStart(2, '0')}
        </div>
        <span className={`badge ${color} flex-shrink-0 text-xs`}>{role}</span>
        <div className="flex-1 min-w-0">
          <div className={['text-xs font-medium leading-snug', isMilestone ? 'text-amber-800 font-bold' : 'text-slate-700'].join(' ')}>
            {isMilestone && <span className="mr-1">◆</span>}{task.title || task.name}
            {override && <span className="ml-1 text-teal text-xs">✎</span>}
          </div>
          {/* Duration bar */}
          {maxHours > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-12 max-w-28">
                <div className="h-full rounded-full transition-all" style={{ width: Math.min(100, (raw / maxHours) * 100) + '%', backgroundColor: barColor }} />
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">{raw}h</span>
              <span className="text-xs text-amber-500 whitespace-nowrap">+{buf - raw}h</span>
            </div>
          )}
          {(override?.dep || task.dep || (task.depends_on || []).length > 0) && (
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              <span className="text-slate-300">↳</span> {override?.dep || task.dep || (task.depends_on || []).join(', ')}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <EnvBadge tag={envTag} />
          {dates ? (
            <div className="text-xs text-slate-500 whitespace-nowrap">
              <span>{dates.start}</span>
              <span className="text-slate-300 mx-0.5">→</span>
              <span className={isWeekend(dates.end) ? 'text-amber-500' : ''}>{dates.end}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-300">set start date</span>
          )}
          {(task.window || task.phase) && (
            <span className="badge badge-slate text-xs">{task.window || task.phase}</span>
          )}
        </div>
      </div>
      {expanded && (
        <TaskEditPanel
          taskKey={key} task={task} override={override}
          onSave={onSave} onClear={onClear} canEdit={canEdit}
        />
      )}
    </div>
  );
}

// ── Change periods panel ──────────────────────────────────────────────────────

const EMPTY_PERIOD = { type: 'freeze', label: '', start: '', end: '' };

function ChangePeriodsPanel({ periods, onUpdate, requirements, onUpdateReq, totalHours, selRegions }) {
  const [open, setOpen] = useState(false);
  const { projectStartDate, goLiveDate, hoursPerDay } = requirements;
  const hpd = parseInt(hoursPerDay || '8', 10);

  function addPeriod() {
    const next = [...periods, { ...EMPTY_PERIOD, id: String(Date.now()) }];
    onUpdate(next);
  }
  function updatePeriod(id, patch) {
    onUpdate(periods.map(p => p.id === id ? { ...p, ...patch } : p));
  }
  function removePeriod(id) {
    onUpdate(periods.filter(p => p.id !== id));
  }

  let workingDays = null, bufDays = null;
  if (projectStartDate && goLiveDate) {
    let c = new Date(projectStartDate), end = new Date(goLiveDate), d = 0;
    while (c < end) { c.setDate(c.getDate() + 1); if (c.getDay() !== 0 && c.getDay() !== 6) d++; }
    workingDays = d;
    bufDays = Math.ceil(totalHours * BUFFER / hpd);
  }
  const tight = workingDays !== null && bufDays > workingDays;

  return (
    <div className="card mb-4 border-l-4 border-teal overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-teal/5 hover:bg-teal/10 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-teal uppercase tracking-wide">Project Timeline &amp; Change Periods</span>
          <span className="badge badge-slate text-xs">{periods.length} period{periods.length !== 1 ? 's' : ''}</span>
          {selRegions.map(r => <span key={r} className="badge badge-slate text-xs">{r}</span>)}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {workingDays !== null && (
            <span className={['text-xs font-medium', tight ? 'text-red-600' : 'text-green-600'].join(' ')}>
              {workingDays}d avail · {bufDays}d needed {tight ? '⚠ TIGHT' : '✓ OK'}
            </span>
          )}
          <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-4">
          {/* Project anchor dates */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-500 font-semibold block mb-0.5">Project Start</label>
              <input type="date" className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                value={projectStartDate || ''} onChange={e => onUpdateReq({ projectStartDate: e.target.value })} />
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-0.5">Go-Live / Target</label>
              <input type="date" className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal"
                value={goLiveDate || ''} onChange={e => onUpdateReq({ goLiveDate: e.target.value })}/>
              {goLiveDate && isWeekend(goLiveDate) && <div className="text-amber-500 text-xs mt-0.5">Weekend — confirm with team</div>}
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-0.5">Hours / Day</label>
              <select className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                value={hoursPerDay || '8'} onChange={e => onUpdateReq({ hoursPerDay: e.target.value })}>
                {['6','7','8','9','10'].map(h => <option key={h}>{h}h / day</option>)}
              </select>
            </div>
          </div>

          {/* Timeline summary */}
          {workingDays !== null && (
            <div className={['rounded border px-3 py-2 text-xs', tight ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'].join(' ')}>
              <span className={tight ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>
                {tight
                  ? `Timeline is TIGHT — ${bufDays - workingDays} day(s) short. Reduce scope, extend go-live, or add parallel tasks.`
                  : `Timeline OK — ${workingDays - bufDays} buffer day(s) available after ${bufDays} estimated (incl. 30% buffer).`}
              </span>
            </div>
          )}

          {/* Change periods list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Change Freeze &amp; Break Periods</span>
              <button
                onClick={addPeriod}
                className="text-xs text-teal border border-teal/30 rounded px-2 py-0.5 hover:bg-teal/5 transition-colors font-semibold"
              >+ Add Period</button>
            </div>

            {periods.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded">
                No change freeze periods — click + Add Period to block out dates
              </div>
            )}

            <div className="space-y-2">
              {periods.map(p => {
                const cfg = PERIOD_TYPE[p.type] || PERIOD_TYPE.freeze;
                return (
                  <div key={p.id} className={['flex items-center gap-2 rounded border px-3 py-2 text-xs', cfg.color].join(' ')}>
                    <select
                      className="border-0 bg-transparent font-semibold text-xs focus:outline-none cursor-pointer"
                      value={p.type}
                      onChange={e => updatePeriod(p.id, { type: e.target.value })}
                    >
                      <option value="freeze">Change Freeze</option>
                      <option value="holiday">Public Holiday</option>
                      <option value="break">Team Break</option>
                    </select>
                    <input
                      type="text"
                      className="flex-1 bg-transparent border-b border-current/30 focus:outline-none placeholder:opacity-40 min-w-0"
                      placeholder="Label (e.g. Year-end freeze)"
                      value={p.label}
                      onChange={e => updatePeriod(p.id, { label: e.target.value })}
                    />
                    <input type="date" className="bg-transparent border-b border-current/30 focus:outline-none text-xs"
                      value={p.start}
                      onChange={e => {
                        const s = e.target.value;
                        const patch = { start: s };
                        if (!p.end || p.end < s) patch.end = s;
                        updatePeriod(p.id, patch);
                      }} />
                    <span className="opacity-40">→</span>
                    <input type="date" className="bg-transparent border-b border-current/30 focus:outline-none text-xs"
                      value={p.end}
                      min={p.start || undefined}
                      onChange={e => updatePeriod(p.id, { end: e.target.value })} />
                    <button onClick={() => removePeriod(p.id)} className="opacity-40 hover:opacity-90 text-base leading-none ml-1">×</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accepted change window types */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Accepted Change Window Slots</div>
            <div className="flex flex-wrap gap-1">
              {['Out-of-hours (weekday 22:00–02:00)', 'Standard weekday (09:00–17:00)', 'Early morning (06:00–08:00)', 'Weekend window (02:00–06:00)', 'Sunday only (02:00–06:00)', 'Public holiday window'].map(w => (
                <span key={w} className="badge badge-slate text-xs">{w}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Incident/UUM scope panel ──────────────────────────────────────────────────

function IncidentEnvPanel({ selInc, selUUM, customInc, regions }) {
  if (selInc.length === 0 && selUUM.length === 0) return null;
  const allInc = [...ALL_INC, ...(customInc || [])];
  return (
    <div className="card p-3 mb-4 border-l-4 border-blue-400">
      <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Change Scope — Environments &amp; Impact</div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        {selInc.map(code => {
          const inc = allInc.find(i => i.code === code);
          if (!inc) return null;
          return (
            <div key={code} className="flex items-center gap-1.5 rounded border border-red-100 bg-red-50 px-2 py-1">
              <span className="font-bold text-red-700">{inc.short}</span>
              <span className="text-slate-500 truncate flex-1">{inc.txt.substring(inc.short.length + 2, 55)}</span>
              <div className="flex gap-0.5">
                {regions.includes('Production') && <span className="badge badge-red text-xs">Prod</span>}
                {regions.some(r => r !== 'Production') && <span className="badge badge-blue text-xs">Non-Prod</span>}
              </div>
            </div>
          );
        })}
        {selUUM.map(code => {
          const uum = ALL_UUM.find(u => u.code === code);
          if (!uum) return null;
          return (
            <div key={code} className="flex items-center gap-1.5 rounded border border-amber-100 bg-amber-50 px-2 py-1">
              <span className="font-bold text-amber-700">{uum.short}</span>
              <span className="text-slate-500 truncate flex-1">{uum.txt.substring(uum.short.length + 2, 55)}</span>
              <div className="flex gap-0.5">
                {regions.includes('Production') && <span className="badge badge-red text-xs">Prod</span>}
                {regions.some(r => r !== 'Production') && <span className="badge badge-blue text-xs">Non-Prod</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Phase timeline bar ────────────────────────────────────────────────────────

function PhaseTimeline({ tasks, isAi, totalBufDays }) {
  if (!isAi || tasks.length === 0) return null;
  const phases = {};
  tasks.forEach(t => {
    const ph = t.phase || 'General';
    if (!phases[ph]) phases[ph] = { count: 0, hours: 0 };
    phases[ph].count++;
    phases[ph].hours += t.duration_hours || 2;
  });
  const total = Object.values(phases).reduce((s, p) => s + p.hours, 0);
  return (
    <div className="card p-3 mb-4">
      <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Phase Timeline Overview</div>
      <div className="flex gap-0 rounded overflow-hidden mb-2 h-5">
        {Object.entries(phases).map(([ph, d], i) => {
          const colors = ['#14B8A6','#3B82F6','#F59E0B','#22C55E','#EF4444','#8B5CF6'];
          return <div key={ph} style={{ width: ((d.hours / total) * 100) + '%', backgroundColor: colors[i % colors.length], minWidth: '2%' }} title={`${ph}: ${d.hours}h`} className="h-full" />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-center">
        {Object.entries(phases).map(([ph, d], i) => {
          const colors = ['#14B8A6','#3B82F6','#F59E0B','#22C55E','#EF4444','#8B5CF6'];
          return (
            <div key={ph} className="flex items-center gap-1 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              <span>{ph}</span><span className="text-slate-400">{d.hours}h</span>
            </div>
          );
        })}
        <div className="text-xs text-slate-400 ml-auto font-semibold">
          Total: {total}h raw · ~{Math.ceil(total * BUFFER)}h buffered · ~{totalBufDays}d
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GanttTab() {
  const s = useStore();
  const { authUser } = useAuth();
  const [expandedTask, setExpandedTask] = useState(null);
  const canEdit = canUseFeature(authUser, 'save_builds');

  if (!s.designApplied) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
          </div>
          <div className="font-semibold text-slate-700 mb-1">Gantt Locked</div>
          <div className="text-sm text-slate-500">Apply System Design to unlock the task plan and timeline.</div>
        </div>
      </div>
    );
  }

  const isAi = s.sdAiTasks.length > 0;
  const designTasks = isAi ? s.sdAiTasks : buildDesignTasks(s.sysDesignData);
  const maxHours = Math.max(...designTasks.map(t => s.ganttOverrides[taskKey(t, 0)]?.durationHours ?? t.duration_hours ?? 2), 1);
  const hpd = parseInt(s.requirements.hoursPerDay || '8', 10);
  const hasStartDate = !!s.requirements.projectStartDate;

  const uumTaskGroups = s.selUUM.map(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return null;
    return { uum, tasks: getRealTasks(uum, s.ctx) };
  }).filter(Boolean);

  const rawTotal = designTasks.reduce((n, t) => {
    const key = taskKey(t, designTasks.indexOf(t));
    return n + (s.ganttOverrides[key]?.durationHours ?? t.duration_hours ?? 2);
  }, 0);
  const uumTotal = uumTaskGroups.reduce((n, { tasks }) => n + tasks.reduce((m, t) => m + (t.est_hours || t.hours || 2), 0), 0);
  const totalBufDays = Math.ceil((rawTotal + uumTotal) * BUFFER / hpd);

  const blocked = s.changePeriods || [];
  const designDates = calcDates(designTasks, s.requirements.projectStartDate, hpd, s.ganttOverrides, blocked);

  const lastDesignEnd = designDates[designDates.length - 1]?.end || s.requirements.projectStartDate;
  const allUumDates = uumTaskGroups.map(({ tasks }) => calcDates(tasks, lastDesignEnd, hpd, s.ganttOverrides, blocked));

  const regions = s.selRegions || ['Production'];

  function toggleEdit(key) {
    setExpandedTask(prev => prev === key ? null : key);
  }
  function handleSaveOverride(key, patch) {
    s.setGanttOverride(key, patch);
    setExpandedTask(null);
  }
  function handleClearOverride(key) {
    s.clearGanttOverride(key);
    setExpandedTask(null);
  }

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">

      {/* Stale tasks banner */}
      {s.tasksStaleReason && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 mb-4 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-amber-500 flex-shrink-0 text-base">⚠</span>
            <div>
              <div className="text-xs font-semibold text-amber-800">Tasks may be out of date</div>
              <div className="text-xs text-amber-700">{s.tasksStaleReason}</div>
            </div>
          </div>
          <button
            className="flex-shrink-0 text-xs bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-md hover:bg-amber-700 transition-colors"
            onClick={() => { s.setAiTasks([]); s.setTasksStaleReason(null); }}
          >Regenerate Tasks</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Execution Gantt &amp; Task Plan</div>
          <div className="text-xs text-slate-500">
            {isAi ? `AI plan (${designTasks.length} tasks, ~${rawTotal}h raw)` : `Rule-based (${designTasks.length} tasks)`}
            {uumTaskGroups.length > 0 && ` + ${uumTaskGroups.length} UUM (~${uumTotal}h)`}
            <span className="ml-2 text-amber-600 font-medium">~{totalBufDays}d buffered @ {hpd}h/day</span>
            {!hasStartDate && <span className="ml-2 text-slate-400">— set start date to see scheduled dates</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAi && <span className="badge badge-teal">AI Tasks</span>}
          {s.selUUM.length > 0 && <span className="badge badge-amber">{s.selUUM.length} UUM</span>}
          {Object.keys(s.ganttOverrides).length > 0 && (
            <span className="badge badge-teal text-xs">{Object.keys(s.ganttOverrides).length} edited</span>
          )}
          {regions.map(r => <span key={r} className="badge badge-slate text-xs">{r}</span>)}
        </div>
      </div>

      {/* Change periods + timeline */}
      <ChangePeriodsPanel
        periods={s.changePeriods}
        onUpdate={s.setChangePeriods}
        requirements={s.requirements}
        onUpdateReq={patch => s.setRequirements({ ...s.requirements, ...patch })}
        totalHours={rawTotal + uumTotal}
        selRegions={regions}
      />

      {/* Incident/UUM scope */}
      {s.phase2Active && (
        <IncidentEnvPanel selInc={s.selInc} selUUM={s.selUUM} customInc={s.customInc} regions={regions} />
      )}

      {/* Phase timeline */}
      <PhaseTimeline tasks={designTasks} isAi={isAi} totalBufDays={totalBufDays} />

      {/* Edit hint */}
      {canEdit && (
        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
          <span className="text-teal">✎</span>
          Click any task row to edit its duration, dependency, and parallel/sequential scheduling.
        </div>
      )}

      {/* Design Tasks */}
      <div className="card overflow-hidden mb-4">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">System Design Tasks</span>
            <span className="badge badge-slate">{designTasks.length}</span>
          </div>
          <span className="text-xs text-slate-400">~{rawTotal}h raw · ~{Math.ceil(rawTotal * BUFFER)}h buf</span>
        </div>
        <div className="flex gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <div className="w-7">#</div><div className="w-24">Role</div><div className="flex-1">Task</div>
          <div className="w-36 text-right">{hasStartDate ? 'Start → End' : 'Duration'}</div>
          <div className="w-16 text-right">Env</div>
        </div>
        <div>
          {designTasks.map((task, i) => {
            const key = taskKey(task, i);
            return (
              <TaskRow
                key={key} task={task} index={i}
                dates={designDates[i]}
                override={s.ganttOverrides[key]}
                onToggleEdit={toggleEdit}
                expanded={expandedTask === key}
                maxHours={maxHours}
                canEdit={canEdit}
                onSave={handleSaveOverride}
                onClear={handleClearOverride}
              />
            );
          })}
        </div>
      </div>

      {/* UUM sequences */}
      {uumTaskGroups.map(({ uum, tasks }, gi) => {
        const uumBuf = tasks.reduce((n, t) => n + Math.ceil((t.est_hours || t.hours || 2) * BUFFER), 0);
        const uumDates = allUumDates[gi] || [];
        return (
          <div key={uum.code} className="card overflow-hidden mb-4">
            <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-800 text-xs">{uum.short}</span>
                <span className={['badge text-xs', uum.type === 'migration' ? 'badge-blue' : uum.type === 'upgrade' ? 'badge-amber' : 'badge-slate'].join(' ')}>{uum.type.toUpperCase()}</span>
                <span className="text-xs text-amber-600 truncate hidden sm:block" style={{ maxWidth: 220 }}>{uum.txt.substring(uum.short.length + 2, 80)}</span>
              </div>
              <span className="text-xs text-amber-600 flex-shrink-0">~{uumBuf}h buffered</span>
            </div>
            <div className="flex gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <div className="w-7">#</div><div className="w-24">Role</div><div className="flex-1">Task</div>
              <div className="w-36 text-right">{hasStartDate ? 'Start → End' : 'Duration'}</div>
              <div className="w-16 text-right">Env</div>
            </div>
            <div>
              {tasks.map((task, i) => {
                const key = taskKey(task, i) + ':' + uum.code;
                return (
                  <TaskRow
                    key={key} task={task} index={i}
                    dates={uumDates[i]}
                    override={s.ganttOverrides[key]}
                    onToggleEdit={toggleEdit}
                    expanded={expandedTask === key}
                    maxHours={16}
                    canEdit={canEdit}
                    onSave={handleSaveOverride}
                    onClear={handleClearOverride}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {uumTaskGroups.length === 0 && !s.cabDeclined && (
        <div className="card p-4 text-center text-xs text-slate-400">
          No UUM items selected — add items in Phase 2 to see change sequences here.
        </div>
      )}

      {/* Rollback plan */}
      {s.cabDeclined && (
        <div className="card overflow-hidden mb-4 border-l-4 border-red-500">
          <div className="bg-red-50 px-4 py-2 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-red-700 text-xs uppercase tracking-wide">Rollback Plan — CAB Declined</span>
              <span className="badge badge-red text-xs">MANDATORY</span>
            </div>
            <span className="text-xs text-red-600">~16h estimated</span>
          </div>
          <div className="divide-y divide-red-50">
            {[
              { id: 'RB01', role: 'Change Manager', task: 'Notify all stakeholders of CAB decline and rollback trigger', hours: 1 },
              { id: 'RB02', role: 'Unix Admin', task: 'Snapshot environment state before rollback begins', hours: 1 },
              { id: 'RB03', role: 'AppAdmin', task: 'Revert application to last known-good version', hours: 2 },
              { id: 'RB04', role: 'DBA', task: 'Revert DB schema changes; validate data integrity', hours: 3 },
              { id: 'RB05', role: 'Unix Admin', task: 'Restore OS / kernel config from pre-change snapshot', hours: 2 },
              { id: 'RB06', role: 'NetAdmin', task: 'Re-validate network, firewall, load balancer', hours: 1 },
              { id: 'RB07', role: 'QA Team', task: 'Full service health smoke test suite post-rollback', hours: 2 },
              { id: 'RB08', role: 'Change Manager', task: 'File post-change incident report; lessons learned', hours: 1 },
            ].map(step => (
              <div key={step.id} className="flex items-center gap-2 px-3 py-2 hover:bg-red-50/40">
                <div className="text-xs text-red-400 font-mono w-7">{step.id}</div>
                <span className={`badge text-xs ${TEAM_COLORS[step.role] || 'badge-slate'}`}>{step.role}</span>
                <div className="flex-1 text-xs text-slate-700">{step.task}</div>
                <div className="text-xs text-slate-400 w-12 text-right">{step.hours}h</div>
              </div>
            ))}
          </div>
          <div className="bg-red-50 px-4 py-2 border-t border-red-200">
            <div className="text-xs text-red-700 font-medium">After rollback: revise scope, update RTM, resubmit to CAB.</div>
          </div>
        </div>
      )}
    </div>
  );
}
