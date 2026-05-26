import { useStore } from '../../store/useStore.js';
import { ALL_INC } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';

const CLOSURE_CHECKLIST = [
  { id: 'C01', label: 'All incidents closed and verified in production', dep: 'promoted' },
  { id: 'C02', label: 'All UUM change items completed and documented', dep: 'promoted' },
  { id: 'C03', label: 'RTM signed off by QA Lead', dep: 'rtmSigned' },
  { id: 'C04', label: 'CAB change record closed in ITSM tool', dep: 'cabApproved' },
  { id: 'C05', label: 'CMDB updated to reflect new production state', dep: null },
  { id: 'C06', label: 'Post-implementation review (PIR) scheduled', dep: null },
  { id: 'C07', label: 'Lessons learned documented and shared', dep: null },
  { id: 'C08', label: 'Knowledge base articles updated', dep: null },
  { id: 'C09', label: 'Monitoring baselines updated post-cutover', dep: null },
  { id: 'C10', label: 'Stakeholder closure notification sent', dep: null },
];

export default function ClosureTab() {
  const s = useStore();

  const isLocked = !s.promoted;

  if (isLocked) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="font-semibold text-slate-700 mb-1">Closure Locked</div>
          <div className="text-sm text-slate-500">Execute production cutover (promote to production) to unlock the closure report.</div>
          <div className="mt-3 space-y-1 text-left">
            {[
              ['CAB Approved', s.cabApproved],
              ['RTM Signed', s.rtmSigned],
              ['Production Cutover', s.promoted],
            ].map(([label, done]) => (
              <div key={label} className={['text-xs flex items-center gap-2', done ? 'text-green-600' : 'text-slate-400'].join(' ')}>
                <span>{done ? '✓' : '○'}</span>{label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const incFixed = s.selInc.filter(c => s.selFix.includes(c) || s.promoted);
  const incTotal = s.selInc.length;
  const uumDone = s.selUUM.length;

  const checklist = CLOSURE_CHECKLIST.map(item => {
    const auto = item.dep ? !!s[item.dep] : false;
    const manual = s.closureChecks?.[item.id] || false;
    return { ...item, done: auto || manual, auto };
  });

  const allDone = checklist.every(c => c.done);

  const metrics = [
    { label: 'Incidents Resolved', value: `${incTotal}/${incTotal}`, color: 'text-green-700' },
    { label: 'UUM Items Completed', value: `${uumDone}/${uumDone}`, color: 'text-green-700' },
    { label: 'RTM Requirements', value: `${s.rtmSigned ? 'SIGNED' : 'PENDING'}`, color: s.rtmSigned ? 'text-green-700' : 'text-amber-600' },
    { label: 'CAB Record', value: `${s.cabApproved ? 'CLOSED' : 'OPEN'}`, color: s.cabApproved ? 'text-green-700' : 'text-amber-600' },
    { label: 'Project Status', value: 'PRODUCTION STABLE', color: 'text-green-700' },
    { label: 'Environment', value: s.requirements?.envType || 'Production', color: 'text-slate-700' },
  ];

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      {/* Banner */}
      <div className="bg-green-50 border-2 border-green-400 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0" />
        <div>
          <div className="font-bold text-green-800 text-sm">Production Cutover Complete</div>
          <div className="text-xs text-green-700 mt-0.5">
            {s.requirements?.projectName || 'Infrastructure Project'} has been successfully promoted to production.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Outcome Metrics */}
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Outcome Metrics</div>
          <div className="space-y-2">
            {metrics.map(m => (
              <div key={m.label} className="flex justify-between text-xs">
                <span className="text-slate-500">{m.label}</span>
                <span className={`font-semibold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Summary */}
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Production Platform</div>
          <div className="space-y-1.5">
            {[
              ['Hardware', s.ctx.hw],
              ['Operating System', s.ctx.os],
              ['Database', s.ctx.db],
              ['Application', s.ctx.app],
              ['SLA Target', (s.requirements?.sla || '99.9') + '%'],
              ['Compliance', s.requirements?.compliance || 'ISO 27001:2022'],
              ['DR Tier', s.requirements?.drTier || 'Tier 1'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-700 truncate max-w-36 text-right" title={v}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incident Summary */}
      {s.selInc.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Resolved Incidents ({incTotal})</div>
          <div className="grid grid-cols-2 gap-1">
            {s.selInc.map(code => {
              const inc = ALL_INC.find(i => i.code === code);
              if (!inc) return null;
              return (
                <div key={code} className="text-xs flex items-center gap-1.5 bg-green-50 text-green-700 rounded px-2 py-1">
                  <span className="font-bold">✓</span>
                  <span className="font-medium truncate">{inc.short}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UUM Summary */}
      {s.selUUM.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Completed Changes ({uumDone})</div>
          <div className="grid grid-cols-2 gap-1">
            {s.selUUM.map(code => {
              const uum = ALL_UUM.find(u => u.code === code);
              if (!uum) return null;
              return (
                <div key={code} className="text-xs flex items-center gap-1.5 bg-purple-50 text-purple-700 rounded px-2 py-1">
                  <span className="font-bold">✓</span>
                  <span className="font-medium truncate">{uum.short}</span>
                  <span className={['badge text-xs flex-shrink-0', uum.type === 'migration' ? 'badge-blue' : uum.type === 'upgrade' ? 'badge-amber' : 'badge-slate'].join(' ')}>{uum.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Closure Checklist */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Closure Checklist</div>
          {allDone && <span className="badge badge-green font-semibold">PROJECT CLOSED</span>}
        </div>
        <div className="space-y-1.5">
          {checklist.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              {item.auto ? (
                <div className="w-4 h-4 rounded flex-shrink-0 bg-teal flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-teal flex-shrink-0 cursor-pointer"
                  checked={item.done}
                  onChange={e => s.setClosureCheck(item.id, e.target.checked)}
                />
              )}
              <span className={['text-xs', item.done ? 'text-green-700' : 'text-slate-600'].join(' ')}>
                {item.label}
              </span>
              {item.auto && <span className="text-xs text-slate-400">(auto)</span>}
            </div>
          ))}
        </div>
      </div>

      {/* PIR Notes */}
      <div className="card p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Post-Implementation Notes</div>
        <textarea
          className="form-input text-xs min-h-20 resize-none"
          placeholder="Document lessons learned, issues encountered, and recommendations for future projects..."
          value={s.closureNotes || ''}
          onChange={e => s.setClosureNotes(e.target.value)}
        />
        <div className="mt-2 text-xs text-slate-400">These notes will be included in the Excel export closure sheet.</div>
      </div>
    </div>
  );
}
