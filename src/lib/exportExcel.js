import { ALL_INC, FIXES } from './incidents.js';
import { ALL_UUM } from './uumItems.js';
import { getRealTasks, renderRealTasksText } from './realTasks.js';
import { getIncidentFixTasks } from './incidentFixTasks.js';
import { buildDesignTasks } from './designTasks.js';

function ensureXLSX() {
  if (typeof window !== 'undefined' && window.XLSX) return window.XLSX;
  throw new Error('SheetJS (XLSX) not loaded. Make sure the CDN script is in index.html.');
}

function ws(data, header) {
  const XLSX = ensureXLSX();
  return XLSX.utils.aoa_to_sheet([header, ...data]);
}

export function exportExcel(state) {
  const XLSX = ensureXLSX();
  const { ctx, selInc, selUUM, selFix, promoted, cabApproved, rtmSigned, sysDesignData, sdAiTasks, requirements, emergencyChanges } = state;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const execData = [
    ['Field', 'Value'],
    ['Project Name', requirements.projectName || 'Infrastructure Lifecycle Project'],
    ['Environment Type', requirements.envType || 'Production'],
    ['Go-Live Date', requirements.goLiveDate || 'TBD'],
    ['SLA Target', (requirements.sla || '99.9') + '%'],
    ['Compliance Framework', requirements.compliance || 'ISO 27001:2022'],
    ['DR Tier', requirements.drTier || 'Tier 1'],
    ['Hardware Platform', ctx.hw],
    ['Operating System', ctx.os],
    ['Database', ctx.db],
    ['Application', ctx.app],
    ['Active Incidents', selInc.length],
    ['UUM Items', selUUM.length],
    ['CAB Status', cabApproved ? 'APPROVED' : 'PENDING'],
    ['RTM Status', rtmSigned ? 'SIGNED' : 'PENDING'],
    ['Production Status', promoted ? 'PROMOTED' : 'PENDING'],
    ['Load Profile', requirements.loadProfile || 'TBD'],
    ['Data Volume', requirements.dataVolume || 'TBD'],
    ['Constraints', requirements.constraints || 'None documented'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(execData);
  ws1['!cols'] = [{ width: 25 }, { width: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Executive Summary');

  // Sheet 2: Platform Topology
  const topoData = [
    ['Layer', 'Component', 'Status', 'Notes'],
    ['Hardware', ctx.hw, 'Provisioned', ''],
    ['Operating System', ctx.os, 'Provisioned', ''],
    ['Application', ctx.app, 'Provisioned', ''],
    ['Database', ctx.db, 'Provisioned', ''],
    ['Network', 'VLAN / Subnet / LB configured', 'Provisioned', ''],
    ['Storage', 'SAN / NAS / Block allocated', 'Provisioned', ''],
    ['Backup', 'RMAN / pg_basebackup / Veeam', 'Provisioned', ''],
    ['Security', 'Firewall / SIEM / PAM configured', 'Provisioned', ''],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(topoData);
  ws2['!cols'] = [{ width: 20 }, { width: 40 }, { width: 15 }, { width: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Platform Topology');

  // Sheet 3: Incidents
  const incRows = selInc.map(code => {
    const inc = ALL_INC.find(i => i.code === code);
    if (!inc) return null;
    const fixed = promoted || selFix.includes(code);
    const tasks = getIncidentFixTasks(inc, ctx);
    return [
      inc.short,
      inc.txt.substring(0, 80),
      inc.grp,
      inc.layers.join(', '),
      fixed ? 'RESOLVED' : 'ACTIVE',
      FIXES[code] || 'Generic patch applied',
      tasks[0] ? tasks[0].name : '',
      tasks[1] ? tasks[1].name : '',
      tasks[2] ? tasks[2].name : '',
    ];
  }).filter(Boolean);

  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Incident ID', 'Description', 'Group', 'Affected Layers', 'Status', 'Fix Action', 'Task 1', 'Task 2', 'Task 3'],
    ...incRows,
  ]);
  ws3['!cols'] = [{ width: 12 }, { width: 50 }, { width: 25 }, { width: 30 }, { width: 12 }, { width: 50 }, { width: 40 }, { width: 40 }, { width: 40 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Incidents');

  // Sheet 4: UUM Items
  const uumRows = selUUM.map(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return null;
    const tasks = getRealTasks(uum, ctx);
    return [
      uum.short,
      uum.txt.substring(0, 80),
      uum.type.toUpperCase(),
      uum.layers.join(', '),
      promoted ? 'COMPLETED' : 'SCHEDULED',
      tasks[0] ? '[' + tasks[0].role + '] ' + tasks[0].name : '',
      tasks[1] ? '[' + tasks[1].role + '] ' + tasks[1].name : '',
      tasks[2] ? '[' + tasks[2].role + '] ' + tasks[2].name : '',
      tasks[3] ? '[' + tasks[3].role + '] ' + tasks[3].name : '',
    ];
  }).filter(Boolean);

  const ws4 = XLSX.utils.aoa_to_sheet([
    ['UUM ID', 'Description', 'Type', 'Affected Layers', 'Status', 'Task 1', 'Task 2', 'Task 3', 'Task 4'],
    ...uumRows,
  ]);
  ws4['!cols'] = [{ width: 12 }, { width: 50 }, { width: 12 }, { width: 30 }, { width: 12 }, { width: 50 }, { width: 50 }, { width: 50 }, { width: 50 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'UUM Items');

  // Sheet 5: RTM Checklist
  const rtmRows = [
    ['RTM-REQ-001', 'Infrastructure hardware topology and firmware alignment verified', rtmSigned ? 'VERIFIED' : 'PENDING'],
    ['RTM-REQ-002', 'OS kernel, middleware, and runtime compatibility confirmed', rtmSigned ? 'VERIFIED' : 'PENDING'],
    ['RTM-REQ-003', 'Incident runbook fix sequences tested in isolated staging sandbox', rtmSigned ? 'VERIFIED' : 'PENDING'],
    ['RTM-REQ-004', 'Storage, DR replication, and backup integrity checks passed', rtmSigned ? 'VERIFIED' : 'PENDING'],
    ['RTM-REQ-005', 'Security compliance baseline and CVE patch level cleared by SecOps', rtmSigned ? 'VERIFIED' : 'PENDING'],
  ];
  selInc.forEach(code => {
    const inc = ALL_INC.find(i => i.code === code);
    if (inc) rtmRows.push([
      'RTM-FIX-' + inc.short,
      'Fix for "' + inc.short + '" tested and approved in staging',
      (promoted || selFix.includes(code)) ? 'VERIFIED' : 'PENDING',
    ]);
  });
  selUUM.forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (uum) rtmRows.push([
      'RTM-UUM-' + uum.short,
      uum.short + ' [' + uum.type.toUpperCase() + ']: Change reviewed and scheduled',
      promoted ? 'COMPLETED' : 'SCHEDULED',
    ]);
  });

  const ws5 = XLSX.utils.aoa_to_sheet([
    ['RTM ID', 'Requirement / Check', 'Status'],
    ...rtmRows,
  ]);
  ws5['!cols'] = [{ width: 20 }, { width: 70 }, { width: 15 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'RTM Checklist');

  // Sheet 6: Gantt Timeline
  const ganttTasks = sdAiTasks.length > 0 ? sdAiTasks : buildDesignTasks(sysDesignData);
  const uumGanttRows = [];
  selUUM.forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return;
    const tasks = getRealTasks(uum, ctx);
    tasks.forEach((t, i) => {
      uumGanttRows.push([uum.short, '[' + t.role + ']', t.name, t.dep || '', t.validate || '', t.window || '']);
    });
  });

  const ws6 = XLSX.utils.aoa_to_sheet([
    ['Phase / UUM', 'Role', 'Task Name', 'Dependency / Pre-req', 'Handoff / Validate', 'Change Window', 'START DATE', 'END DATE'],
    ...ganttTasks.map(t => [t.team || 'Team', '[' + (t.team || 'Team') + ']', t.title || t.name, t.dep || '', t.note || '', '', '', '']),
    ...uumGanttRows,
  ]);
  ws6['!cols'] = [{ width: 15 }, { width: 20 }, { width: 50 }, { width: 40 }, { width: 40 }, { width: 18 }, { width: 15 }, { width: 15 }];
  XLSX.utils.book_append_sheet(wb, ws6, 'Gantt Timeline');

  // Sheet 7: RAID Registry
  const raidRows = [];
  selInc.forEach(code => {
    const inc = ALL_INC.find(i => i.code === code);
    if (!inc) return;
    const fixed = promoted || selFix.includes(code);
    raidRows.push(['ISSUE', inc.short + ': ' + inc.txt.substring(7, 55) + '...', fixed ? 'LOW' : 'CRITICAL', FIXES[code] || 'Generic patch', fixed ? 'CLOSED' : 'OPEN', 'SysAdmin']);
    if (!fixed) raidRows.push(['RISK', inc.short + ' fix regression may affect adjacent layers in ' + (inc.layers?.join(',') || 'os'), 'MED', 'Run regression suite across adjacent layers after staging fix', 'ACTIVE', 'QA Team']);
  });
  selUUM.forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return;
    const done = promoted;
    raidRows.push(['CHANGE', uum.short + ' [' + uum.type.toUpperCase() + ']: ' + uum.txt.substring(8, 55) + '...', done ? 'DONE' : 'HIGH', done ? 'Completed and verified in production.' : 'Stage first. Release notes reviewed. Rollback documented.', done ? 'DONE' : 'SCHED', uum.layers?.includes('db') ? 'DBA + SysAdmin' : 'SysAdmin']);
  });
  raidRows.push(['ASSUMPTION', 'All function teams are available for the scheduled change windows', 'MED', 'Confirm attendance at kick-off session', 'OPEN', 'Change Manager']);
  raidRows.push(['DEPENDENCY', 'CAB approval required before any production change window is confirmed', 'HIGH', 'CAB submission 5 business days before change window', 'OPEN', 'Change Manager']);

  const ws7 = XLSX.utils.aoa_to_sheet([
    ['Type', 'Description', 'Severity', 'Mitigation / Action', 'Status', 'Owner'],
    ...raidRows,
  ]);
  ws7['!cols'] = [{ width: 12 }, { width: 60 }, { width: 12 }, { width: 55 }, { width: 10 }, { width: 20 }];
  XLSX.utils.book_append_sheet(wb, ws7, 'RAID Registry');

  // Sheet 8: System Design
  const sdRows = [];
  const sections = Object.entries(sysDesignData);
  sections.forEach(([section, fields]) => {
    sdRows.push([section.toUpperCase() + ' SECTION', '', '']);
    Object.entries(fields).forEach(([field, value]) => {
      if (value) sdRows.push(['', field, value]);
    });
    sdRows.push(['', '', '']);
  });

  const ws8 = XLSX.utils.aoa_to_sheet([
    ['Section', 'Field', 'Value / Configuration'],
    ...sdRows,
  ]);
  ws8['!cols'] = [{ width: 15 }, { width: 25 }, { width: 80 }];
  XLSX.utils.book_append_sheet(wb, ws8, 'System Design');

  // Sheet 9: RACI Matrix
  const roles = ['Change Manager', 'Unix Admin', 'DB Admin', 'App Admin', 'Net Admin', 'Storage Admin', 'Backup Admin', 'Web Admin', 'SecOps', 'QA Team'];
  const activities = [
    ['Phase 1 -- Platform Topology Build', 'A', 'R', 'C', 'C', 'C', 'C', 'I', 'I', 'C', 'I'],
    ['AI Smart Scan Execution', 'A', 'R', 'C', 'C', 'I', 'I', 'I', 'I', 'C', 'I'],
    ['System Design Entry', 'C', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'I'],
    ['Phase 2 -- Incident Selection', 'A', 'C', 'C', 'C', 'I', 'I', 'I', 'I', 'C', 'I'],
    ['Incident Fix Runbooks', 'A', 'R', 'R', 'R', 'C', 'C', 'R', 'C', 'C', 'C'],
    ['UUM Change Scheduling', 'A', 'C', 'C', 'C', 'I', 'I', 'C', 'I', 'I', 'I'],
    ['CAB Submission and Approval', 'R', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'I'],
    ['RTM Sign-Off', 'A', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'R'],
    ['Production Cutover', 'A', 'R', 'R', 'R', 'R', 'R', 'I', 'R', 'C', 'C'],
    ['Post-Production Monitoring', 'A', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'C', 'I'],
  ];

  const ws9 = XLSX.utils.aoa_to_sheet([
    ['Activity', ...roles],
    ...activities,
  ]);
  ws9['!cols'] = [{ width: 40 }, ...roles.map(() => ({ width: 16 }))];
  XLSX.utils.book_append_sheet(wb, ws9, 'RACI Matrix');

  // Sheet 10: Closure Summary
  const closureRows = [
    ['PROJECT CLOSURE SUMMARY', '', ''],
    ['Project Name', requirements.projectName || 'Infrastructure Lifecycle Project', ''],
    ['Closure Date', new Date().toISOString().slice(0, 10), ''],
    ['Production Status', promoted ? 'PROMOTED AND STABLE' : 'PENDING', ''],
    ['', '', ''],
    ['INCIDENT RESOLUTION LOG', '', ''],
    ...selInc.map(code => {
      const inc = ALL_INC.find(i => i.code === code);
      const fixed = promoted || selFix.includes(code);
      return [inc ? inc.short : code, inc ? inc.txt.substring(8, 60) + '...' : '', fixed ? 'RESOLVED' : 'PENDING'];
    }),
    ['', '', ''],
    ['UUM MIGRATION LOG', '', ''],
    ...selUUM.map(code => {
      const uum = ALL_UUM.find(u => u.code === code);
      return [uum ? uum.short : code, uum ? uum.txt.substring(8, 60) + '...' : '', promoted ? 'COMPLETED' : 'SCHEDULED'];
    }),
    ['', '', ''],
    ['LESSONS LEARNED', '', ''],
    ['Confirm CAB window is booked 5+ business days in advance', '', ''],
    ['All function team admins should fill System Design before Phase 2 begins', '', ''],
    ['Run rehearsal migration in staging before production cutover', '', ''],
    ['Monitor AWR / alert log for 48h post-cutover before closing CAB ticket', '', ''],
  ];

  const ws10 = XLSX.utils.aoa_to_sheet([
    ['Item', 'Detail', 'Status'],
    ...closureRows,
  ]);
  ws10['!cols'] = [{ width: 35 }, { width: 65 }, { width: 15 }];
  XLSX.utils.book_append_sheet(wb, ws10, 'Closure Summary');

  // Download
  const filename = (requirements.projectName || 'Infra-Lifecycle').replace(/[^a-z0-9]/gi, '-') + '-' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, filename);
}
