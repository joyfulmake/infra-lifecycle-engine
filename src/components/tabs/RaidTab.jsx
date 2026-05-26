import { useStore } from '../../store/useStore.js';
import { ALL_INC, FIXES } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';

const RAID_TYPES = {
  ISSUE: { color: 'badge-red', bg: 'bg-red-50' },
  RISK: { color: 'badge-amber', bg: 'bg-amber-50/50' },
  ASSUMPTION: { color: 'badge-blue', bg: '' },
  DEPENDENCY: { color: 'badge-slate', bg: '' },
  CHANGE: { color: 'badge-amber', bg: 'bg-amber-50/50' },
};

function RaidRow({ type, description, severity, mitigation, status, owner }) {
  const cfg = RAID_TYPES[type] || RAID_TYPES.RISK;
  const statusColor = status === 'CLOSED' || status === 'DONE' ? 'text-green-600 font-semibold' :
    status === 'OPEN' || status === 'ACTIVE' ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold';

  return (
    <tr className={`border-b border-slate-100 ${cfg.bg} hover:bg-slate-50 transition-colors`}>
      <td className="py-2 px-3">
        <span className={`badge ${cfg.color}`}>{type}</span>
      </td>
      <td className="py-2 px-3 text-xs text-slate-700 max-w-xs">{description}</td>
      <td className="py-2 px-3 text-xs">
        <span className={['badge', severity === 'CRITICAL' ? 'badge-red' : severity === 'HIGH' ? 'badge-amber' : severity === 'MED' ? 'badge-blue' : 'badge-slate'].join(' ')}>{severity}</span>
      </td>
      <td className="py-2 px-3 text-xs text-slate-600 max-w-xs">{mitigation}</td>
      <td className={`py-2 px-3 text-xs ${statusColor}`}>{status}</td>
      <td className="py-2 px-3 text-xs text-slate-500">{owner}</td>
    </tr>
  );
}

export default function RaidTab() {
  const s = useStore();

  if (!s.phase2Active) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="font-semibold text-slate-700 mb-1">RAID Registry Locked</div>
          <div className="text-sm text-slate-500">Select incidents and UUM items in Phase 2 to populate the RAID registry.</div>
        </div>
      </div>
    );
  }

  const rows = [];

  // Incidents
  s.selInc.forEach(code => {
    const inc = ALL_INC.find(i => i.code === code);
    if (!inc) return;
    const fixed = s.promoted || s.selFix.includes(code);
    rows.push({
      type: 'ISSUE',
      description: inc.short + ': ' + inc.txt.substring(inc.short.length + 2, 80) + '...',
      severity: fixed ? 'LOW' : 'CRITICAL',
      mitigation: FIXES[code] || 'Generic patch applied.',
      status: fixed ? 'CLOSED' : 'OPEN',
      owner: 'SysAdmin',
    });
    if (!fixed) {
      rows.push({
        type: 'RISK',
        description: inc.short + ' fix regression may affect adjacent layers (' + (inc.layers?.join(', ') || 'os') + ')',
        severity: 'MED',
        mitigation: 'Run regression suite across adjacent layers after staging fix.',
        status: 'ACTIVE',
        owner: 'QA Team',
      });
    }
  });

  // UUM
  s.selUUM.forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return;
    const done = s.promoted;
    rows.push({
      type: 'CHANGE',
      description: uum.short + ' [' + uum.type.toUpperCase() + ']: ' + uum.txt.substring(uum.short.length + 2, 80) + '...',
      severity: done ? 'DONE' : uum.type === 'migration' ? 'HIGH' : uum.type === 'upgrade' ? 'MED' : 'LOW',
      mitigation: done ? 'Completed and verified in production.' :
        uum.type === 'migration' ? 'Dual-run where possible. Data integrity check before source decommission.' :
        uum.type === 'upgrade' ? 'Stage first. Release notes reviewed. Rollback documented.' :
        'Apply in window. Health check post-patch.',
      status: done ? 'DONE' : 'SCHED',
      owner: uum.layers?.includes('db') ? 'DBA + SysAdmin' : 'SysAdmin',
    });
  });

  // Standard rows
  rows.push(
    { type: 'ASSUMPTION', description: 'All function teams are available for scheduled change windows', severity: 'MED', mitigation: 'Confirm attendance at kick-off session', status: 'OPEN', owner: 'Change Manager' },
    { type: 'ASSUMPTION', description: 'Non-prod environment mirrors production configuration and data volume', severity: 'HIGH', mitigation: 'Environment parity check before staging tests begin', status: 'OPEN', owner: 'Unix Admin' },
    { type: 'DEPENDENCY', description: 'CAB approval required before any production change window is confirmed', severity: 'HIGH', mitigation: 'CAB submission 5 business days before change window', status: s.cabApproved ? 'DONE' : 'OPEN', owner: 'Change Manager' },
    { type: 'DEPENDENCY', description: 'RTM sign-off required from QA before production cutover is permitted', severity: 'HIGH', mitigation: 'QA Lead signs all RTM items before cutover call', status: s.rtmSigned ? 'DONE' : 'OPEN', owner: 'QA Team' },
    { type: 'RISK', description: 'Production outage window overrun if migration takes longer than estimated', severity: 'HIGH', mitigation: 'Two staging rehearsals to confirm timing. Rollback at T+30min if not on track.', status: 'ACTIVE', owner: 'Change Manager' },
    { type: 'RISK', description: 'Post-migration application performance regression due to changed execution plans', severity: 'MED', mitigation: 'Baseline AWR/Prometheus metrics pre-migration. Monitor 48h post-cutover.', status: 'ACTIVE', owner: 'DBA + QA Team' },
  );

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">RAID Registry</div>
          <div className="text-xs text-slate-500">Risks, Assumptions, Issues, and Dependencies</div>
        </div>
        <div className="flex gap-2">
          <span className="badge badge-red">{rows.filter(r => r.type === 'ISSUE').length} Issues</span>
          <span className="badge badge-amber">{rows.filter(r => r.type === 'RISK' || r.type === 'CHANGE').length} Risks/Changes</span>
          <span className="badge badge-slate">{rows.filter(r => r.type === 'ASSUMPTION' || r.type === 'DEPENDENCY').length} A&D</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Type</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Severity</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mitigation</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Status</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => <RaidRow key={i} {...row} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
