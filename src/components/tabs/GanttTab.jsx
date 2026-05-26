import { useStore } from '../../store/useStore.js';
import { ALL_UUM } from '../../lib/uumItems.js';
import { getRealTasks } from '../../lib/realTasks.js';
import { buildDesignTasks } from '../../lib/designTasks.js';

const TEAM_COLORS = {
  'NetAdmin': 'badge-blue',
  'NetAdmin + WebAdmin': 'badge-blue',
  'StorageAdmin': 'badge-slate',
  'BackupAdmin': 'badge-slate',
  'Unix Admin': 'badge-teal',
  'DB Admin': 'badge-amber',
  'DBA': 'badge-amber',
  'DBA Lead': 'badge-amber',
  'DBA + BackupAdmin': 'badge-amber',
  'WebAdmin': 'badge-blue',
  'AppAdmin': 'badge-green',
  'AppAdmin Lead': 'badge-green',
  'SecOps': 'badge-red',
  'QA Team': 'badge-green',
  'Change Manager': 'badge-slate',
  'SysAdmin Lead': 'badge-slate',
};

const TEAM_BAR_COLOR = {
  'NetAdmin': '#3B82F6',
  'NetAdmin + WebAdmin': '#3B82F6',
  'StorageAdmin': '#64748B',
  'BackupAdmin': '#64748B',
  'Unix Admin': '#14B8A6',
  'DB Admin': '#F59E0B',
  'DBA': '#F59E0B',
  'DBA Lead': '#F59E0B',
  'DBA + BackupAdmin': '#F59E0B',
  'WebAdmin': '#3B82F6',
  'AppAdmin': '#22C55E',
  'AppAdmin Lead': '#22C55E',
  'SecOps': '#EF4444',
  'QA Team': '#22C55E',
  'Change Manager': '#64748B',
  'SysAdmin Lead': '#64748B',
};

function DurationBar({ hours, maxHours, color }) {
  const pct = maxHours > 0 ? Math.min(100, (hours / maxHours) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-16 max-w-32">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: pct + '%', backgroundColor: color || '#14B8A6' }}
        />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">{hours}h</span>
    </div>
  );
}

function AiTaskRow({ task, index, maxHours }) {
  const role = task.team || task.role || '';
  const color = TEAM_COLORS[role] || 'badge-slate';
  const barColor = TEAM_BAR_COLOR[role] || '#14B8A6';
  const hours = task.duration_hours || 2;
  const deps = task.depends_on || [];
  const isMilestone = task.milestone;

  return (
    <div className={[
      'border-b border-slate-100 hover:bg-slate-50 transition-colors',
      isMilestone ? 'bg-amber-50/60 border-l-2 border-amber-400' : '',
    ].join(' ')}>
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="text-xs text-slate-400 font-mono flex-shrink-0 w-7 pt-0.5">{String(index + 1).padStart(2, '0')}</div>
        <span className={`badge ${color} flex-shrink-0 text-xs`}>{role}</span>
        <div className="flex-1 min-w-0">
          <div className={['text-xs font-medium leading-snug mb-1', isMilestone ? 'text-amber-800 font-bold' : 'text-slate-700'].join(' ')}>
            {isMilestone && <span className="mr-1">◆</span>}{task.title || task.name}
          </div>
          <DurationBar hours={hours} maxHours={maxHours} color={barColor} />
          {deps.length > 0 && (
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <span className="text-slate-300">↳</span>
              <span>After: {deps.map(d => <span key={d} className="bg-slate-100 text-slate-600 rounded px-1 mr-0.5 font-mono text-xs">{d}</span>)}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          {task.phase && <span className="badge badge-slate text-xs">{task.phase}</span>}
        </div>
      </div>
    </div>
  );
}

function UumTaskRow({ task, index, uum }) {
  const role = task.role || '';
  const color = TEAM_COLORS[role] || 'badge-slate';
  const barColor = TEAM_BAR_COLOR[role] || '#64748B';
  const hours = task.est_hours || task.hours || 2;

  return (
    <div className="border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="text-xs text-slate-400 font-mono flex-shrink-0 w-7 pt-0.5">{String(index + 1).padStart(2, '0')}</div>
        <span className={`badge ${color} flex-shrink-0 text-xs`}>{role}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-700 leading-snug mb-0.5">{task.name}</div>
          {hours > 0 && <DurationBar hours={hours} maxHours={16} color={barColor} />}
          {task.dep && <div className="text-xs text-slate-400 mt-0.5 truncate"><span className="text-slate-300">↳</span> {task.dep.substring(0, 80)}</div>}
          {task.validate && <div className="text-xs text-slate-400 italic truncate">✓ {task.validate.substring(0, 80)}</div>}
        </div>
        {task.window && (
          <span className="badge badge-red text-xs flex-shrink-0 whitespace-nowrap">{task.window}</span>
        )}
      </div>
    </div>
  );
}

function PhaseTimeline({ tasks, isAi }) {
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
          const pct = (d.hours / total) * 100;
          const colors = ['#14B8A6','#3B82F6','#F59E0B','#22C55E','#EF4444','#8B5CF6'];
          return (
            <div key={ph} style={{ width: pct + '%', backgroundColor: colors[i % colors.length], minWidth: '2%' }}
              title={`${ph}: ${d.hours}h`} className="h-full" />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {Object.entries(phases).map(([ph, d], i) => {
          const colors = ['#14B8A6','#3B82F6','#F59E0B','#22C55E','#EF4444','#8B5CF6'];
          return (
            <div key={ph} className="flex items-center gap-1 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <span>{ph}</span>
              <span className="text-slate-400">{d.hours}h</span>
            </div>
          );
        })}
        <div className="text-xs text-slate-400 ml-auto font-semibold">Total: {total}h ({Math.ceil(total / 8)} days est.)</div>
      </div>
    </div>
  );
}

function ChangeWindowSummary({ uumGroups }) {
  if (uumGroups.length === 0) return null;
  const windows = uumGroups.flatMap(({ uum, tasks }) =>
    tasks.filter(t => t.window).map(t => ({ uum: uum.short, type: uum.type, window: t.window, task: t.name }))
  );
  if (windows.length === 0) return null;

  return (
    <div className="card p-3 mb-4 border-l-4 border-amber-400">
      <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Change Window Impact Summary</div>
      <div className="space-y-1">
        {windows.map((w, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="badge badge-amber flex-shrink-0">{w.uum}</span>
            <span className="text-slate-500 truncate">{w.task}</span>
            <span className="badge badge-red flex-shrink-0 ml-auto">{w.window}</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-amber-600 mt-2 font-medium">
        {windows.length} task{windows.length > 1 ? 's' : ''} require{windows.length === 1 ? 's' : ''} a defined change window — book CAB early.
      </div>
    </div>
  );
}

export default function GanttTab() {
  const s = useStore();

  const isLocked = !s.designApplied;

  if (isLocked) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
          </div>
          <div className="font-semibold text-slate-700 mb-1">Gantt Locked</div>
          <div className="text-sm text-slate-500">Apply the System Design (or generate AI task plan) to unlock the Gantt timeline.</div>
        </div>
      </div>
    );
  }

  const isAi = s.sdAiTasks.length > 0;
  const designTasks = isAi ? s.sdAiTasks : buildDesignTasks(s.sysDesignData);
  const maxHours = isAi ? Math.max(...designTasks.map(t => t.duration_hours || 2), 1) : 1;

  const uumTaskGroups = s.selUUM.map(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return null;
    const tasks = getRealTasks(uum, s.ctx);
    return { uum, tasks };
  }).filter(Boolean);

  const totalHours = isAi ? designTasks.reduce((n, t) => n + (t.duration_hours || 2), 0) : 0;
  const uumHours = uumTaskGroups.reduce((n, { tasks }) =>
    n + tasks.reduce((m, t) => m + (t.est_hours || t.hours || 2), 0), 0);

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Execution Gantt & Task Plan</div>
          <div className="text-xs text-slate-500">
            {isAi
              ? `AI-generated (${designTasks.length} tasks, ~${totalHours}h design)`
              : `Rule-based (${designTasks.length} tasks from system design)`}
            {uumTaskGroups.length > 0 && ` + ${uumTaskGroups.length} UUM sequences (~${uumHours}h)`}
          </div>
        </div>
        <div className="flex gap-2">
          {isAi && <span className="badge badge-teal">AI Tasks</span>}
          {s.selUUM.length > 0 && <span className="badge badge-amber">{s.selUUM.length} UUM</span>}
          {isAi && <span className="badge badge-slate">{totalHours + uumHours}h total</span>}
        </div>
      </div>

      {/* Phase timeline bar */}
      <PhaseTimeline tasks={designTasks} isAi={isAi} />

      {/* Change window impact */}
      <ChangeWindowSummary uumGroups={uumTaskGroups} />

      {/* Design Tasks */}
      <div className="card overflow-hidden mb-4">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">System Design Tasks</div>
            <span className="badge badge-slate">{designTasks.length} tasks</span>
          </div>
          {isAi && <span className="text-xs text-slate-400">~{totalHours}h estimated</span>}
        </div>

        {/* Column headers */}
        <div className="flex gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <div className="w-7">#</div>
          <div className="w-24">Role</div>
          <div className="flex-1">Task</div>
          {isAi && <div className="w-40">Duration</div>}
          <div className="w-20">Phase</div>
        </div>

        <div className="divide-y divide-slate-100">
          {isAi ? (
            designTasks.map((task, i) => (
              <AiTaskRow key={i} task={task} index={i} maxHours={maxHours} />
            ))
          ) : (
            designTasks.map((task, i) => {
              const role = task.team || task.role || '';
              const color = TEAM_COLORS[role] || 'badge-slate';
              const dep = task.dep || '';
              const isMilestone = task.milestone;
              return (
                <div key={i} className={['border-b border-slate-100 hover:bg-slate-50 transition-colors', isMilestone ? 'bg-amber-50/50 border-l-2 border-amber-400' : ''].join(' ')}>
                  <div className="flex items-start gap-2 px-3 py-2">
                    <div className="text-xs text-slate-400 font-mono flex-shrink-0 w-7">{String(i + 1).padStart(2, '0')}</div>
                    <span className={`badge ${color} flex-shrink-0 text-xs`}>{role}</span>
                    <div className="flex-1 min-w-0">
                      <div className={['text-xs font-medium leading-snug', isMilestone ? 'text-amber-800 font-bold' : 'text-slate-700'].join(' ')}>
                        {isMilestone && <span className="mr-1">◆</span>}{task.title || task.name}
                      </div>
                      {dep && <div className="text-xs text-slate-400 mt-0.5"><span className="text-slate-300">↳</span> {dep}</div>}
                    </div>
                    {task.window && <span className="badge badge-slate text-xs flex-shrink-0">{task.window}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* UUM Task Sequences */}
      {uumTaskGroups.map(({ uum, tasks }) => {
        const uumTotal = tasks.reduce((n, t) => n + (t.est_hours || t.hours || 2), 0);
        const changeWindows = tasks.filter(t => t.window).length;
        return (
          <div key={uum.code} className="card overflow-hidden mb-4">
            <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-800 text-xs">{uum.short}</span>
                <span className={['badge text-xs', uum.type === 'migration' ? 'badge-blue' : uum.type === 'upgrade' ? 'badge-amber' : 'badge-slate'].join(' ')}>
                  {uum.type.toUpperCase()}
                </span>
                <span className="text-xs text-amber-600 truncate hidden sm:block" style={{ maxWidth: 200 }}>
                  {uum.txt.substring(uum.short.length + 2, 80)}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {changeWindows > 0 && <span className="badge badge-red text-xs">{changeWindows} change window{changeWindows > 1 ? 's' : ''}</span>}
                <span className="text-xs text-amber-600">~{uumTotal}h</span>
              </div>
            </div>

            {/* UUM column headers */}
            <div className="flex gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <div className="w-7">#</div>
              <div className="w-24">Role</div>
              <div className="flex-1">Task</div>
              <div className="w-28">Window</div>
            </div>

            <div className="divide-y divide-slate-100">
              {tasks.map((task, i) => (
                <UumTaskRow key={i} task={task} index={i} uum={uum} />
              ))}
            </div>
          </div>
        );
      })}

      {uumTaskGroups.length === 0 && (
        <div className="card p-4 text-center text-xs text-slate-400">
          No UUM items selected — add items in Phase 2 to see their task sequences and change windows here.
        </div>
      )}
    </div>
  );
}
