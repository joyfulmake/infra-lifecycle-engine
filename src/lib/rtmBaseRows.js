// Shared base-RTM-row definitions — used by RtmTab.jsx (live tab) and
// exportExcel.js (RTM Checklist sheet) so both render the same rows instead
// of drifting (the Excel sheet used to carry its own separate hardcoded
// infra-flavored copy that also ignored the user's actual per-row status).

export const INFRA_RTM_BASE = [
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

// This 12-row base RTM was hardcoded regardless of domain — every one of the
// other 15 domains got "OS patched to approved baseline" / "tnsping / psql /
// mysql ping" / owner "Unix Admin" rows, same bug class as RolesTab's
// INFRA_ROLES (see buildGenericRoles there). Unlike ALL_INC/ALL_UUM/
// DESIGN_SECTIONS, no domain catalog exports an RTM-row equivalent, so derive
// one requirement row per design section (each already carries its own
// `owner`, e.g. EHR Analyst, SAP Basis, Cloud Architect) plus a handful of
// universal governance rows that apply to any PM domain.
export function buildGenericRtmRows(designSections) {
  const sectionRows = (designSections || []).map((sec, i) => ({
    id: `R${String(i + 1).padStart(2, '0')}`,
    req: `${sec.label} design meets approved requirements`,
    test: `${sec.label} fields reviewed and validated against sign-off criteria`,
    method: 'Design review + validation checklist',
    owner: sec.owner || 'PM',
  }));
  const n = sectionRows.length;
  const tail = [
    { req: 'Change/approval record documented and linked', test: 'Approval reference recorded before go-live', method: 'Governance record review', owner: 'Change Manager' },
    { req: 'Rollback / contingency plan documented and rehearsed', test: 'Rollback steps validated before go-live', method: 'Rollback drill documented', owner: 'PM' },
    { req: 'Monitoring and alerting configured for the new state', test: 'Critical alerts verified functional', method: 'Alert test', owner: 'PM' },
    { req: 'Go-live readiness confirmed against target timeline', test: 'Readiness checklist complete and signed off', method: 'Stakeholder sign-off', owner: 'PM' },
  ].map((r, i) => ({ id: `R${String(n + i + 1).padStart(2, '0')}`, ...r }));
  return [...sectionRows, ...tail];
}

export function getRtmBaseRows(activeDomain, designSections) {
  return activeDomain === 'infra' ? INFRA_RTM_BASE : buildGenericRtmRows(designSections);
}
