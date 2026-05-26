import { useStore } from '../../store/useStore.js';
import { ALL_INC, FIXES } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';

const RTM_BASE = [
  { id: 'R01', req: 'Platform provisioned per approved topology', test: 'Physical/VM inventory matches CMDB', method: 'Config review + CMDB diff', owner: 'Unix Admin' },
  { id: 'R02', req: 'OS patched to approved baseline', test: 'OS version + patch level verified', method: 'rpm -qa / dpkg -l / oslevel', owner: 'Unix Admin' },
  { id: 'R03', req: 'Network connectivity validated end-to-end', test: 'All VLANs, firewall rules, load balancer paths tested', method: 'ping + traceroute + port scan', owner: 'NetAdmin' },
  { id: 'R04', req: 'Storage mounts verified with correct permissions', test: 'All filesystems mounted, correct mode and owner', method: 'df -h + ls -la + mount', owner: 'StorageAdmin' },
  { id: 'R05', req: 'Backup policy configured and first backup verified', test: 'Backup job ran, restore tested on sample file', method: 'Backup tool log review + restore drill', owner: 'BackupAdmin' },
  { id: 'R06', req: 'Database engine running and accepting connections', test: 'Listener/service up, health query returns', method: 'tnsping / psql / mysql ping', owner: 'DBA' },
  { id: 'R07', req: 'Application deployed and health endpoint returns 200', test: 'Health URL responds within SLA threshold', method: 'curl health endpoint', owner: 'AppAdmin' },
  { id: 'R08', req: 'Security hardening applied per compliance framework', test: 'CIS benchmark scan passes >= 90%', method: 'Lynis / OpenSCAP scan', owner: 'SecOps' },
  { id: 'R09', req: 'Monitoring and alerting configured', test: 'All critical alerts fire on test event', method: 'Alert test via monitoring console', owner: 'Unix Admin' },
  { id: 'R10', req: 'CAB change record approved and linked', test: 'CAB approval documented with reference number', method: 'ITSM tool record review', owner: 'Change Manager' },
  { id: 'R11', req: 'Rollback plan documented and rehearsed', test: 'Rollback executed successfully in staging', method: 'Rollback drill documented', owner: 'SysAdmin Lead' },
  { id: 'R12', req: 'DR test completed and RTO/RPO targets met', test: 'Failover to DR site completed within RTO', method: 'DR drill with timing log', owner: 'Unix Admin' },
];

function StatusBadge({ status }) {
  const cfg = {
    PASS: 'badge-green',
    FAIL: 'badge-red',
    PENDING: 'badge-amber',
    NA: 'badge-slate',
    BLOCKED: 'badge-red',
  };
  return <span className={`badge ${cfg[status] || 'badge-slate'}`}>{status}</span>;
}

function RtmRow({ row, onStatusChange, readOnly }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="py-2 px-3 text-xs font-mono text-slate-400 w-12">{row.id}</td>
      <td className="py-2 px-3 text-xs text-slate-700 max-w-xs">{row.req}</td>
      <td className="py-2 px-3 text-xs text-slate-500 max-w-xs">{row.test}</td>
      <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{row.method}</td>
      <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{row.owner}</td>
      <td className="py-2 px-3 w-28">
        {readOnly ? (
          <StatusBadge status={row.status || 'PENDING'} />
        ) : (
          <select
            className="form-select text-xs py-0.5 px-1"
            value={row.status || 'PENDING'}
            onChange={e => onStatusChange(row.id, e.target.value)}
          >
            <option value="PENDING">PENDING</option>
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="NA">N/A</option>
          </select>
        )}
      </td>
    </tr>
  );
}

export default function RtmTab() {
  const s = useStore();

  const isLocked = !s.phase2Active;
  const canSign = !s.rtmSigned;

  if (isLocked) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="font-semibold text-slate-700 mb-1">RTM Locked</div>
          <div className="text-sm text-slate-500">Complete Phase 2 (inject incidents and UUM items) to unlock the Requirements Traceability Matrix.</div>
        </div>
      </div>
    );
  }

  // Build full RTM rows from base + incident fixes + UUM items
  const rows = [
    ...RTM_BASE.map(r => ({
      ...r,
      status: s.rtmRows?.[r.id] || 'PENDING',
    })),
  ];

  // Add incident-specific RTM rows
  s.selInc.forEach((code, idx) => {
    const inc = ALL_INC.find(i => i.code === code);
    if (!inc) return;
    const fixed = s.promoted || s.selFix.includes(code);
    const id = `INC${String(idx + 1).padStart(2, '0')}`;
    rows.push({
      id,
      req: `Incident ${inc.short} remediated and closed`,
      test: FIXES[code] || 'Fix applied and verified',
      method: 'Post-fix smoke test + QA sign-off',
      owner: 'QA Team',
      status: fixed ? (s.rtmRows?.[id] || 'PASS') : (s.rtmRows?.[id] || 'PENDING'),
    });
  });

  // Add UUM-specific RTM rows
  s.selUUM.forEach((code, idx) => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return;
    const id = `UUM${String(idx + 1).padStart(2, '0')}`;
    rows.push({
      id,
      req: `${uum.short} change completed and verified`,
      test: `${uum.type === 'migration' ? 'Data integrity check + cutover verified' : uum.type === 'upgrade' ? 'Version confirmed + regression suite passed' : 'Patch applied + health check passed'}`,
      method: uum.type === 'migration' ? 'Row count + checksum + app functional test' : 'Version query + test suite',
      owner: uum.layers?.includes('db') ? 'DBA + QA Team' : 'QA Team',
      status: s.promoted ? (s.rtmRows?.[id] || 'PASS') : (s.rtmRows?.[id] || 'PENDING'),
    });
  });

  const passCount = rows.filter(r => r.status === 'PASS' || r.status === 'NA').length;
  const failCount = rows.filter(r => r.status === 'FAIL' || r.status === 'BLOCKED').length;
  const pendingCount = rows.filter(r => r.status === 'PENDING').length;
  const allResolved = pendingCount === 0 && failCount === 0;

  function handleStatusChange(id, status) {
    s.setRtmRow(id, status);
  }

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Requirements Traceability Matrix</div>
          <div className="text-xs text-slate-500">{rows.length} requirements -- {passCount} passed, {failCount} failed, {pendingCount} pending</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-green">{passCount} PASS</span>
          {failCount > 0 && <span className="badge badge-red">{failCount} FAIL</span>}
          {pendingCount > 0 && <span className="badge badge-amber">{pendingCount} PENDING</span>}
          {!s.rtmSigned && allResolved && (
            <button className="btn-teal px-4 py-1.5 text-xs" onClick={() => s.signRtm()}>
              Sign Off RTM
            </button>
          )}
          {s.rtmSigned && (
            <span className="badge badge-green font-semibold">RTM SIGNED</span>
          )}
        </div>
      </div>

      {!s.rtmSigned && !allResolved && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-xs text-amber-700">
          {failCount > 0
            ? `${failCount} requirement(s) FAILED -- resolve before QA sign-off.`
            : `${pendingCount} requirement(s) still pending -- set all to PASS or N/A to enable sign-off.`}
        </div>
      )}

      {s.rtmSigned && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4 text-xs text-green-700 font-semibold">
          RTM signed off by QA Lead -- production cutover authorized.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">ID</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requirement</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Test Condition</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">Method</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Owner</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <RtmRow
                  key={row.id}
                  row={row}
                  onStatusChange={handleStatusChange}
                  readOnly={s.rtmSigned}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
