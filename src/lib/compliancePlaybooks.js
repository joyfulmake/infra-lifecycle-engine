// Phase 5 — Program/Portfolio Compliance Library. Seed content is an
// illustrative starting point drawn from common infra program practice, not
// a certified regulatory checklist — review with compliance/legal before
// relying on it for a real audit. Nothing here ever writes to the RAID
// registry on its own: RaidTab renders these as proposals, and only an
// explicit "+ Add" click (s.addCustomRaidEntry) turns one into a real row,
// through the exact same entry point a hand-typed RAID item uses.

export const PROJECT_TYPES = [
  { id: '', label: '— Not set —' },
  { id: 'cloud-migration', label: 'Cloud Migration' },
  { id: 'datacenter-exit', label: 'Datacenter Exit / Consolidation' },
  { id: 'dr-bcp-build', label: 'DR / BCP Build' },
  { id: 'network-refresh', label: 'Network Refresh' },
  { id: 'security-remediation', label: 'Security Remediation / Patch Program' },
  { id: 'application-modernization', label: 'Application Modernization' },
  { id: 'mna-infra-integration', label: 'M&A Infrastructure Integration' },
];

// Each seed item is shaped exactly like a customRaidEntries row (minus id/
// addedAt, which RaidTab fills in on accept) so it can be handed straight
// to s.addCustomRaidEntry() with no translation step.
const PLAYBOOKS = {
  'cloud-migration': {
    programDemand: ['Cloud governance review', 'Data residency audit'],
    items: [
      { type: 'RISK', description: 'Data transfer window exceeds approved maintenance SLA', severity: 'HIGH', mitigation: 'Stage transfer during an extended freeze-exempt window; checksum-verify before cutover.', status: 'OPEN', owner: 'Change Manager' },
      { type: 'ISSUE', description: 'Cloud shared-responsibility model not yet mapped to internal controls', severity: 'MED', mitigation: 'Document control ownership split with cloud provider before go-live.', status: 'OPEN', owner: 'SecOps' },
      { type: 'DECISION', description: 'Pre-migration architecture review sign-off obtained', severity: 'LOW', mitigation: 'Best practice — log sign-off date and reviewer.', status: 'OPEN', owner: 'PM / Architect' },
    ],
  },
  'datacenter-exit': {
    programDemand: ['Asset disposal audit', 'Decommission checklist'],
    items: [
      { type: 'RISK', description: 'Hardware disposal misses chain-of-custody logging', severity: 'HIGH', mitigation: 'Certificate of destruction filed per asset; serials logged before pickup.', status: 'OPEN', owner: 'Unix Admin' },
      { type: 'ISSUE', description: 'Asset retirement audit trail incomplete for legacy inventory', severity: 'MED', mitigation: 'Reconcile CMDB against physical inventory before decommission window.', status: 'OPEN', owner: 'Change Manager' },
      { type: 'DECISION', description: 'Certificate of destruction filed per disposed asset', severity: 'LOW', mitigation: 'Best practice — attach to closure package.', status: 'OPEN', owner: 'Backup Admin' },
    ],
  },
  'dr-bcp-build': {
    programDemand: ['Recovery time objective validation', 'Regulatory DR audit'],
    items: [
      { type: 'RISK', description: 'Failover test window conflicts with peak business hours', severity: 'HIGH', mitigation: 'Schedule failover rehearsal in an approved off-peak window with rollback plan.', status: 'OPEN', owner: 'Change Manager' },
      { type: 'ISSUE', description: 'DR capability audit finds untested failback procedure', severity: 'HIGH', mitigation: 'Run and document a full failback rehearsal before sign-off.', status: 'OPEN', owner: 'DBA + BackupAdmin' },
      { type: 'DECISION', description: 'Tabletop exercise findings logged as lessons learned', severity: 'LOW', mitigation: 'Best practice — feed findings back into the next DR cycle.', status: 'OPEN', owner: 'QA Team' },
    ],
  },
  'network-refresh': {
    programDemand: ['Change freeze compliance', 'Segmentation review'],
    items: [
      { type: 'RISK', description: 'Legacy VLAN dependency not documented before cutover', severity: 'HIGH', mitigation: 'Full VLAN/trunk audit against live traffic capture before cutover.', status: 'OPEN', owner: 'Net Admin' },
      { type: 'ISSUE', description: 'Network segmentation audit flags a flat trust zone', severity: 'MED', mitigation: 'Re-zone per least-privilege before go-live; validate with a pen test.', status: 'OPEN', owner: 'SecOps' },
      { type: 'DECISION', description: 'Topology diagram updated and filed post-cutover', severity: 'LOW', mitigation: 'Best practice — required before closure sign-off.', status: 'OPEN', owner: 'Net Admin' },
    ],
  },
  'security-remediation': {
    programDemand: ['Vulnerability SLA compliance', 'Regulator reporting'],
    items: [
      { type: 'RISK', description: 'Patch window collides with quarter-end change freeze', severity: 'CRITICAL', mitigation: 'Escalate for a freeze exception or pull the patch window forward.', status: 'OPEN', owner: 'Change Manager' },
      { type: 'ISSUE', description: 'CVE remediation SLA audit finds overdue critical items', severity: 'CRITICAL', mitigation: 'Triage overdue CVEs in the Vulnerabilities tab; assign fix targets today.', status: 'OPEN', owner: 'SecOps' },
      { type: 'DECISION', description: 'Root-cause note filed to lessons-learned feed per incident', severity: 'LOW', mitigation: 'Best practice.', status: 'OPEN', owner: 'SecOps' },
    ],
  },
  'application-modernization': {
    programDemand: ['Code and data compliance review', 'License audit'],
    items: [
      { type: 'RISK', description: 'Third-party library approaching end of support', severity: 'MED', mitigation: 'Cross-check dependency versions against the Vulnerabilities/CMDB EOL data.', status: 'OPEN', owner: 'App Admin' },
      { type: 'ISSUE', description: 'Software license audit finds unlicensed component usage', severity: 'HIGH', mitigation: 'Reconcile SBOM against procurement records before release.', status: 'OPEN', owner: 'App Admin' },
      { type: 'DECISION', description: 'Containerization best-practice checklist shared with team', severity: 'LOW', mitigation: 'Best practice.', status: 'OPEN', owner: 'App Admin' },
    ],
  },
  'mna-infra-integration': {
    programDemand: ['Combined-entity compliance mapping', 'Cross-jurisdiction review'],
    items: [
      { type: 'RISK', description: 'Two organizations run conflicting IAM standards', severity: 'HIGH', mitigation: 'Define a target IAM model and a phased federation plan before integration.', status: 'OPEN', owner: 'SecOps' },
      { type: 'ISSUE', description: 'Cross-jurisdiction data-handling audit incomplete', severity: 'HIGH', mitigation: 'Engage legal/compliance to map applicable data-residency obligations.', status: 'OPEN', owner: 'PM / Architect' },
      { type: 'DECISION', description: 'Integration runbook filed to the portfolio library', severity: 'LOW', mitigation: 'Best practice.', status: 'OPEN', owner: 'PM / Architect' },
    ],
  },
};

export function getPlaybook(projectType) {
  return PLAYBOOKS[projectType] || null;
}
