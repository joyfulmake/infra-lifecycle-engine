import { ALL_INC, FIXES } from './incidents.js';
import { ALL_UUM } from './uumItems.js';

// Single source of truth for the RAID registry's auto-generated rows, so
// RaidTab (display) and the dependency graph engine (linkage/analysis) never
// drift out of sync. Pure function — no React, no store access, just the
// slice of state it needs.
export function buildAutoRaidRows(s) {
  const autoRows = [];

  (s.selInc || []).forEach(code => {
    const inc = ALL_INC.find(i => i.code === code) || (s.customInc || []).find(i => i.id === code);
    if (!inc) return;
    const fixed = s.promoted || (s.selFix || []).includes(code);
    autoRows.push({
      id: `raid-auto-inc-${code}`,
      sourceCode: code, sourceKind: 'incident',
      type: 'ISSUE', description: inc.short + ': ' + (inc.txt || '').substring(0, 80),
      severity: fixed ? 'LOW' : 'CRITICAL', mitigation: FIXES[code] || 'Generic patch applied.',
      status: fixed ? 'CLOSED' : 'OPEN', owner: 'SysAdmin', eta: '',
    });
    if (!fixed) autoRows.push({
      id: `raid-auto-inc-regress-${code}`,
      sourceCode: code, sourceKind: 'incident',
      type: 'RISK', description: inc.short + ' fix regression may affect adjacent layers',
      severity: 'MED', mitigation: 'Run regression suite across adjacent layers after staging fix.',
      status: 'ACTIVE', owner: 'QA Team', eta: '',
    });
  });

  (s.selUUM || []).forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code) || (s.customUUM || []).find(u => u.id === code);
    if (!uum) return;
    const done = s.promoted;
    autoRows.push({
      id: `raid-auto-uum-${code}`,
      sourceCode: code, sourceKind: 'uum',
      type: 'CHANGE',
      description: uum.short + ' [' + (uum.type || 'change').toUpperCase() + ']: ' + (uum.txt || '').substring(0, 80),
      severity: done ? 'LOW' : uum.type === 'migration' ? 'HIGH' : uum.type === 'upgrade' ? 'MED' : 'LOW',
      mitigation: done ? 'Completed and verified.' : uum.type === 'migration' ? 'Dual-run. Data integrity check before decommission.' : uum.type === 'upgrade' ? 'Stage first. Rollback documented.' : 'Apply in window. Health check post-patch.',
      status: done ? 'DONE' : 'SCHED',
      owner: (uum.layers || []).includes('db') ? 'DBA + SysAdmin' : 'SysAdmin', eta: '',
    });
  });

  autoRows.push(
    { id: 'raid-auto-assump-1', type: 'ASSUMPTION', description: 'All function teams available for scheduled change windows', severity: 'MED', mitigation: 'Confirm at kick-off', status: 'OPEN', owner: 'Change Manager', eta: '' },
    { id: 'raid-auto-assump-2', type: 'ASSUMPTION', description: 'Non-prod environment mirrors production configuration and data volume', severity: 'HIGH', mitigation: 'Environment parity check before staging', status: 'OPEN', owner: 'Unix Admin', eta: '' },
    { id: 'raid-auto-dep-cab', type: 'DEPENDENCY', description: 'CAB approval required before production change window', severity: 'HIGH', mitigation: 'CAB submission 5 days before window', status: s.cabApproved ? 'DONE' : 'OPEN', owner: 'Change Manager', eta: '' },
    { id: 'raid-auto-dep-rtm', type: 'DEPENDENCY', description: 'RTM sign-off from QA before cutover', severity: 'HIGH', mitigation: 'QA Lead signs all RTM items before cutover call', status: s.rtmSigned ? 'DONE' : 'OPEN', owner: 'QA Team', eta: '' },
    { id: 'raid-auto-risk-overrun', type: 'RISK', description: 'Production outage window overrun if migration exceeds estimate', severity: 'HIGH', mitigation: 'Two staging rehearsals. Rollback at T+30min if not on track.', status: 'ACTIVE', owner: 'Change Manager', eta: '' },
    { id: 'raid-auto-risk-perf', type: 'RISK', description: 'Post-migration performance regression due to changed execution plans', severity: 'MED', mitigation: 'Baseline metrics pre-migration. Monitor 48h post-cutover.', status: 'ACTIVE', owner: 'DBA + QA Team', eta: '' },
  );

  return autoRows;
}

export function buildAllRaidRows(s) {
  const autoRows = buildAutoRaidRows(s);
  const customRows = (s.customRaidEntries || []).map(e => ({ ...e }));
  return { autoRows, customRows, allRows: [...autoRows, ...customRows] };
}
