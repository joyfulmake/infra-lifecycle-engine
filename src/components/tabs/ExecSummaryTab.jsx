import { useStore } from '../../store/useStore.js';
import { ALL_INC } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';
import AgentInsights from '../AgentInsights.jsx';

export default function ExecSummaryTab() {
  const s = useStore();

  const incSev = s.selInc.length > 5 ? 'CRITICAL' : s.selInc.length > 2 ? 'HIGH' : s.selInc.length > 0 ? 'MEDIUM' : 'CLEAR';
  const incColor = incSev === 'CRITICAL' ? 'text-red-600' : incSev === 'HIGH' ? 'text-red-500' : incSev === 'MEDIUM' ? 'text-amber-600' : 'text-green-600';

  const milestones = [
    { label: 'Phase 1 -- Platform Provisioned', done: s.isBuilt },
    { label: 'AI Smart Scan Completed', done: s.scanComplete },
    { label: 'System Design Applied', done: s.designApplied },
    { label: 'Incidents and UUM Injected', done: s.phase2Active },
    { label: 'CAB Authorization Obtained', done: s.cabApproved },
    { label: 'RTM Signed Off by QA', done: s.rtmSigned },
    { label: 'Production Cutover Executed', done: s.promoted },
  ];

  const overallStatus = s.promoted ? 'PRODUCTION STABLE' : s.rtmSigned ? 'RTM COMPLETE -- AWAITING CUTOVER' : s.cabApproved ? 'CAB APPROVED -- AWAITING RTM' : s.phase2Active ? 'PHASE 2 ACTIVE -- REMEDIATION IN PROGRESS' : s.scanComplete ? 'SCAN COMPLETE -- SYSTEM DESIGN OPEN' : s.isBuilt ? 'PHASE 1 COMPLETE -- RUN AI SCAN' : 'AWAITING INITIALIZATION';

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <div className="max-w-4xl mx-auto space-y-4">

        <AgentInsights tab="exec" />

        {/* Status Banner */}
        <div className={['rounded-lg border-2 px-4 py-3',
          s.promoted ? 'border-green-500 bg-green-50' :
          s.phase2Active ? 'border-amber-500 bg-amber-50' :
          'border-teal/30 bg-teal/5'
        ].join(' ')}>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Project Status</div>
          <div className={['text-lg font-bold',
            s.promoted ? 'text-green-700' : s.phase2Active ? 'text-amber-700' : 'text-slate-800',
          ].join(' ')}>{overallStatus}</div>
          {s.requirements.projectName && (
            <div className="text-sm text-slate-500 mt-0.5">{s.requirements.projectName}</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Milestone Checklist */}
          <div className="card p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Milestone Progress</div>
            <div className="space-y-2">
              {milestones.map(m => (
                <div key={m.label} className={['flex items-center gap-2 text-xs rounded px-2 py-1', m.done ? 'text-green-700 bg-green-50' : 'text-slate-500'].join(' ')}>
                  <span className={['w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold', m.done ? 'bg-teal text-white' : 'bg-slate-200 text-slate-400'].join(' ')}>
                    {m.done ? '✓' : '○'}
                  </span>
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Platform Summary */}
          <div className="card p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Platform Stack</div>
            {s.isBuilt ? (
              <div className="space-y-1.5">
                {[
                  ['Hardware', s.ctx.hw],
                  ['OS', s.ctx.os],
                  ['Database', s.ctx.db],
                  ['Application', s.ctx.app],
                  ['Environment', s.requirements.envType || 'Production'],
                  ['SLA Target', (s.requirements.sla || '99.9') + '%'],
                  ['Compliance', s.requirements.compliance || 'ISO 27001:2022'],
                  ['DR Tier', s.requirements.drTier || 'Tier 1'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">{k}</span>
                    <span className="text-slate-700 text-right max-w-48 truncate" title={v}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400">Build environment in Phase 1 first</div>
            )}
          </div>
        </div>

        {/* Incidents and UUM */}
        {s.phase2Active && (
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Active Incidents <span className={['ml-1 font-bold', incColor].join(' ')}>({s.selInc.length} -- SEV: {incSev})</span>
              </div>
              {s.selInc.length === 0 ? (
                <div className="text-xs text-slate-400">No incidents selected</div>
              ) : (
                <div className="space-y-1">
                  {s.selInc.map(code => {
                    const inc = ALL_INC.find(i => i.code === code);
                    if (!inc) return null;
                    const fixed = s.promoted || s.selFix.includes(code);
                    return (
                      <div key={code} className={['text-xs flex items-start gap-2 rounded px-2 py-1', fixed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'].join(' ')}>
                        <span className="flex-shrink-0">{fixed ? '✓' : '!'}</span>
                        <span className="font-medium">{inc.short}</span>
                        <span className="text-slate-500 truncate flex-1">{inc.txt.substring(inc.short.length + 2, 60)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="card p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                UUM Items ({s.selUUM.length})
              </div>
              {s.selUUM.length === 0 ? (
                <div className="text-xs text-slate-400">No UUM items scheduled</div>
              ) : (
                <div className="space-y-1">
                  {s.selUUM.map(code => {
                    const uum = ALL_UUM.find(u => u.code === code);
                    if (!uum) return null;
                    return (
                      <div key={code} className={['text-xs flex items-start gap-2 rounded px-2 py-1', s.promoted ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'].join(' ')}>
                        <span className="font-medium flex-shrink-0">{uum.short}</span>
                        <span className={['badge text-xs flex-shrink-0', uum.type === 'migration' ? 'badge-blue' : uum.type === 'upgrade' ? 'badge-amber' : 'badge-slate'].join(' ')}>{uum.type}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scope and Planning */}
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Scope and Planning</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-1 pr-4 font-semibold">Scope Area</th>
                <th className="pb-1 pr-4 font-semibold">Description</th>
                <th className="pb-1 pr-4 font-semibold">Severity</th>
                <th className="pb-1 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {s.isBuilt && (
                <tr className="border-b border-slate-50">
                  <td className="py-1.5 pr-4 font-medium text-slate-700">Platform Provisioning</td>
                  <td className="py-1.5 pr-4 text-slate-500">Build {s.ctx.hw} / {s.ctx.os} platform topology</td>
                  <td className="py-1.5 pr-4"><span className="badge badge-blue">N/A</span></td>
                  <td className="py-1.5 text-green-600 font-semibold">DONE</td>
                </tr>
              )}
              {[...new Set(s.selInc.map(c => ALL_INC.find(i => i.code === c)?.grp))].filter(Boolean).map(grp => {
                const color = s.promoted ? 'text-green-600' : s.phase2Active ? 'text-amber-600' : 'text-red-600';
                const stat = s.promoted ? 'RESOLVED' : s.phase2Active ? 'ACTIVE FAULT' : 'INJECTED';
                return (
                  <tr key={grp} className="border-b border-slate-50">
                    <td className="py-1.5 pr-4 font-medium text-slate-700">{grp}</td>
                    <td className="py-1.5 pr-4 text-slate-500">Triage and remediation of active fault vectors</td>
                    <td className="py-1.5 pr-4"><span className="badge badge-red">SEV-1</span></td>
                    <td className={`py-1.5 font-semibold ${color}`}>{stat}</td>
                  </tr>
                );
              })}
              {[...new Set(s.selUUM.map(c => ALL_UUM.find(u => u.code === c)?.grp))].filter(Boolean).map(grp => (
                <tr key={grp} className="border-b border-slate-50">
                  <td className="py-1.5 pr-4 font-medium text-slate-700">{grp}</td>
                  <td className="py-1.5 pr-4 text-slate-500">Execute change items per approved maintenance plan</td>
                  <td className="py-1.5 pr-4"><span className="badge badge-amber">4-16h</span></td>
                  <td className={`py-1.5 font-semibold ${s.promoted ? 'text-purple-600' : 'text-amber-600'}`}>{s.promoted ? 'MIGRATED' : 'SCHEDULED'}</td>
                </tr>
              ))}
              {!s.phase2Active && (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-400 text-center">No incidents or UUM items yet -- inject in Phase 2</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
