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

function TaskRow({ task, index, isAi }) {
  const color = TEAM_COLORS[task.team || task.role] || 'badge-slate';
  const role = task.team || task.role || '';
  const name = task.title || task.name || '';
  const dep = task.dep || task.depends_on?.join(', ') || '';
  const handoff = task.validate || task.note || '';
  const window = task.window || '';
  const isMilestone = task.milestone;

  return (
    <div className={['border-b border-slate-100 hover:bg-slate-50 transition-colors', isMilestone ? 'bg-amber-50/50 border-l-2 border-amber-400' : ''].join(' ')}>
      <div className="flex items-start gap-3 px-4 py-2">
        <div className="text-xs text-slate-400 font-mono flex-shrink-0 w-8">{String(index + 1).padStart(2, '0')}</div>
        <span className={`badge ${color} flex-shrink-0 text-xs`}>{role}</span>
        <div className="flex-1 min-w-0">
          <div className={['text-xs font-medium leading-snug', isMilestone ? 'text-amber-800 font-bold' : 'text-slate-700'].join(' ')}>
            {isMilestone && <span className="mr-1">◆</span>}{name}
            {isAi && task.duration_hours && (
              <span className="ml-2 text-slate-400 font-normal">{task.duration_hours}h</span>
            )}
          </div>
          {dep && <div className="text-xs text-slate-400 mt-0.5">Pre-req: {dep}</div>}
          {handoff && <div className="text-xs text-slate-400">Handoff: {typeof handoff === 'string' ? handoff.substring(0, 80) : ''}</div>}
        </div>
        {window && <span className="badge badge-slate text-xs flex-shrink-0">{window}</span>}
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

  // Gather UUM tasks
  const uumTaskGroups = s.selUUM.map(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return null;
    const tasks = getRealTasks(uum, s.ctx);
    return { uum, tasks };
  }).filter(Boolean);

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Execution Gantt</div>
          <div className="text-xs text-slate-500">
            {isAi ? `AI-generated task plan (${designTasks.length} tasks)` : `Rule-based task plan from system design (${designTasks.length} tasks)`}
          </div>
        </div>
        <div className="flex gap-2">
          {isAi && <span className="badge badge-teal">AI Tasks</span>}
          {s.selUUM.length > 0 && <span className="badge badge-amber">{s.selUUM.length} UUM sequences</span>}
        </div>
      </div>

      {/* Design Tasks */}
      <div className="card overflow-hidden mb-4">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600">System Design Tasks</div>
          <span className="badge badge-slate">{designTasks.length} tasks</span>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="flex gap-3 px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <div className="w-8">ID</div>
            <div className="w-28">Role</div>
            <div className="flex-1">Task Name</div>
            <div className="w-32">Pre-req</div>
            <div className="w-24">Window</div>
          </div>
          {designTasks.map((task, i) => (
            <TaskRow key={i} task={task} index={i} isAi={isAi} />
          ))}
        </div>
      </div>

      {/* UUM Task Sequences */}
      {uumTaskGroups.map(({ uum, tasks }) => (
        <div key={uum.code} className="card overflow-hidden mb-4">
          <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center gap-2">
            <span className="font-bold text-amber-800 text-xs">{uum.short}</span>
            <span className={['badge text-xs', uum.type === 'migration' ? 'badge-blue' : uum.type === 'upgrade' ? 'badge-amber' : 'badge-slate'].join(' ')}>{uum.type.toUpperCase()}</span>
            <span className="text-xs text-amber-600 truncate flex-1">{uum.txt.substring(uum.short.length + 2, 70)}</span>
          </div>
          <div>
            {tasks.map((task, i) => (
              <div key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3 px-4 py-2">
                  <div className="text-xs text-slate-400 font-mono flex-shrink-0 w-8">{String(i + 1).padStart(2, '0')}</div>
                  <span className={`badge ${TEAM_COLORS[task.role] || 'badge-slate'} flex-shrink-0 text-xs`}>{task.role}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700">{task.name}</div>
                    {task.dep && <div className="text-xs text-slate-400 mt-0.5">Pre-req: {task.dep.substring(0, 70)}</div>}
                    {task.validate && <div className="text-xs text-slate-400">Handoff: {task.validate.substring(0, 70)}</div>}
                  </div>
                  {task.window && <span className="badge badge-slate text-xs flex-shrink-0">{task.window}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {uumTaskGroups.length === 0 && (
        <div className="card p-4 text-center text-xs text-slate-400">
          No UUM items selected -- add items in Phase 2 to see their task sequences here
        </div>
      )}
    </div>
  );
}
