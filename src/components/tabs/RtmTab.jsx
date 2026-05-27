import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { ALL_INC, FIXES } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';

// Resolve any incident code — checks catalog first, then customInc
function resolveInc(code, customInc) {
  return ALL_INC.find(i => i.code === code) || (customInc || []).find(c => c.code === code) || null;
}

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

function RtmRow({ row, onStatusChange, readOnly, reviewed }) {
  return (
    <tr className={['border-b border-slate-100 transition-colors', reviewed ? 'hover:bg-slate-50' : 'hover:bg-amber-50/30 bg-amber-50/10'].join(' ')}>
      <td className="py-2 px-3 text-xs font-mono text-slate-400 w-12">{row.id}</td>
      <td className="py-2 px-3 text-xs text-slate-700 max-w-xs">
        {!reviewed && !readOnly && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 mb-0.5" title="Needs manual review" />}
        {row.req}
      </td>
      <td className="py-2 px-3 text-xs text-slate-500 max-w-xs">{row.test}</td>
      <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{row.method}</td>
      <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{row.owner}</td>
      <td className="py-2 px-3 w-28">
        {readOnly ? (
          <StatusBadge status={row.status || 'PENDING'} />
        ) : (
          <select
            className={['form-select text-xs py-0.5 px-1', !reviewed ? 'border-amber-300 bg-amber-50' : ''].join(' ')}
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
  // Track which rows the reviewer has explicitly touched this session
  const [sessionReviewed, setSessionReviewed] = useState({});

  const isLocked = !s.phase2Active;

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

  // Build full RTM rows — all default to PENDING, user must explicitly set each one
  const rows = [
    ...RTM_BASE.map(r => ({
      ...r,
      status: s.rtmRows?.[r.id] || 'PENDING',
    })),
  ];

  s.selInc.forEach((code, idx) => {
    const inc = resolveInc(code, s.customInc);
    if (!inc) return;
    const id = `INC${String(idx + 1).padStart(2, '0')}`;
    rows.push({
      id,
      req: `Incident ${inc.short} remediated and closed`,
      test: FIXES[code] || 'Fix applied and verified',
      method: 'Post-fix smoke test + QA sign-off',
      owner: 'QA Team',
      status: s.rtmRows?.[id] || 'PENDING',
      isCustom: !!(s.customInc || []).find(c => c.code === code),
    });
  });

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
      // Always PENDING until user explicitly sets
      status: s.rtmRows?.[id] || 'PENDING',
    });
  });

  // A row is "reviewed" if the user explicitly changed it in the Zustand store
  const reviewedIds = new Set([
    ...Object.keys(s.rtmRows || {}),
    ...Object.keys(sessionReviewed),
  ]);

  const passCount = rows.filter(r => r.status === 'PASS' || r.status === 'NA').length;
  const failCount = rows.filter(r => r.status === 'FAIL' || r.status === 'BLOCKED').length;
  const pendingCount = rows.filter(r => r.status === 'PENDING').length;
  const unreviewed = rows.filter(r => !reviewedIds.has(r.id)).length;

  // Sign-off requires: all rows reviewed AND no FAIL/BLOCKED
  const canSign = !s.rtmSigned && unreviewed === 0 && failCount === 0 && pendingCount === 0;

  function handleStatusChange(id, status) {
    s.setRtmRow(id, status);
    setSessionReviewed(prev => ({ ...prev, [id]: true }));
  }

  // "Confirm current statuses" — sets all still-PENDING rows to PASS
  function markAllReviewed() {
    const next = {};
    rows.forEach(r => {
      const status = (r.status === 'PENDING' || !reviewedIds.has(r.id)) ? 'PASS' : r.status;
      s.setRtmRow(r.id, status);
      next[r.id] = true;
    });
    setSessionReviewed(prev => ({ ...prev, ...next }));
  }

  function markAll(status) {
    const next = {};
    rows.forEach(r => {
      s.setRtmRow(r.id, status);
      next[r.id] = true;
    });
    setSessionReviewed(prev => ({ ...prev, ...next }));
  }

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">Requirements Traceability Matrix</div>
          <div className="text-xs text-slate-500">{rows.length} requirements — {passCount} passed, {failCount} failed, {pendingCount} pending</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge badge-green">{passCount} PASS</span>
          {failCount > 0 && <span className="badge badge-red">{failCount} FAIL</span>}
          {pendingCount > 0 && <span className="badge badge-amber">{pendingCount} PENDING</span>}
          {unreviewed > 0 && !s.rtmSigned && (
            <span className="badge badge-amber">{unreviewed} unreviewed</span>
          )}
          {!s.rtmSigned && (
            <>
              <button
                className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 whitespace-nowrap"
                onClick={() => markAll('PASS')}
                title="Mark all requirements as PASS"
              >All PASS</button>
              <button
                className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 bg-slate-50 hover:bg-slate-100 whitespace-nowrap"
                onClick={() => markAll('NA')}
                title="Mark all requirements as N/A"
              >All N/A</button>
            </>
          )}
          {canSign && (
            <button className="btn-teal px-4 py-1.5 text-xs" onClick={() => s.signRtm()}>
              Sign Off RTM
            </button>
          )}
          {s.rtmSigned && (
            <span className="badge badge-green font-semibold">RTM SIGNED</span>
          )}
        </div>
      </div>

      {/* Review guidance banner */}
      {!s.rtmSigned && unreviewed > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 flex items-center justify-between">
          <div className="text-xs text-amber-800">
            <span className="font-semibold">{unreviewed} row{unreviewed > 1 ? 's' : ''} still unreviewed.</span>
            {' '}Use dropdowns to set each status, or confirm all pending as PASS below.
          </div>
          <button
            className="text-xs text-green-700 border border-green-400 bg-green-50 rounded px-2 py-0.5 hover:bg-green-100 whitespace-nowrap ml-3"
            onClick={markAllReviewed}
          >
            Confirm all unreviewed → PASS
          </button>
        </div>
      )}

      {!s.rtmSigned && unreviewed === 0 && failCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-xs text-red-700">
          {failCount} requirement(s) FAILED — resolve or mark as N/A before QA sign-off.
        </div>
      )}

      {!s.rtmSigned && unreviewed === 0 && pendingCount > 0 && failCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-xs text-amber-700">
          {pendingCount} requirement(s) still PENDING — set all to PASS or N/A to enable sign-off.
        </div>
      )}

      {s.rtmSigned && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4 text-xs text-green-700 font-semibold">
          RTM signed off by QA Lead — production cutover authorized.
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
                  reviewed={reviewedIds.has(row.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Next Build Targets — items not fully passed become improvement targets */}
      {(() => {
        const targets = rows.filter(r => r.status === 'FAIL' || r.status === 'BLOCKED' || r.status === 'PENDING');
        if (targets.length === 0) return null;
        return (
          <div className="card mt-4 overflow-hidden border-l-4 border-blue-400">
            <div className="bg-blue-50 px-4 py-2 border-b border-blue-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Next Build Improvement Targets</div>
                <div className="text-xs text-blue-500">{targets.length} requirement{targets.length > 1 ? 's' : ''} not cleared — carry forward to next build cycle</div>
              </div>
              <span className="badge badge-blue">{targets.length} items</span>
            </div>
            <div className="divide-y divide-blue-50">
              {targets.map(r => (
                <div key={r.id} className="px-4 py-2 flex items-start gap-3 hover:bg-blue-50/30 transition-colors">
                  <span className="text-xs font-mono text-blue-400 w-10 flex-shrink-0 pt-0.5">{r.id}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700">{r.req}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{r.method} — {r.owner}</div>
                  </div>
                  <span className={['badge text-xs flex-shrink-0', r.status === 'FAIL' || r.status === 'BLOCKED' ? 'badge-red' : 'badge-amber'].join(' ')}>{r.status}</span>
                </div>
              ))}
            </div>
            <div className="bg-blue-50 px-4 py-2 border-t border-blue-100">
              <div className="text-xs text-blue-600">
                These {targets.length} item{targets.length > 1 ? 's' : ''} will be automatically pre-populated as open requirements when you create the next build with the same environment.
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
