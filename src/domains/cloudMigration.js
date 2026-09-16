// Cloud Migration domain catalog — discovery through cutover for a
// lift-shift, replatform, or refactor migration into AWS/Azure/GCP.
// Shape mirrors infra's ALL_INC/ALL_UUM/getRealTasks/DESIGN_SECTIONS exactly
// (see src/domains/applyDomain.js for how this plugs in).

export const incidents = [
  { code: 'cm_inc_1', grp: 'Network & Connectivity', short: 'CM-001', txt: 'CM-001: VPN/ExpressRoute tunnel flapping during cutover window', layers: ['network'] },
  { code: 'cm_inc_2', grp: 'Network & Connectivity', short: 'CM-002', txt: 'CM-002: DNS cutover propagation delay causing split-brain traffic', layers: ['network', 'app'] },
  { code: 'cm_inc_3', grp: 'IAM & Security', short: 'CM-003', txt: 'CM-003: IAM role trust policy misconfiguration blocks cross-account migration', layers: ['security'] },
  { code: 'cm_inc_4', grp: 'IAM & Security', short: 'CM-004', txt: 'CM-004: Object storage bucket/blob policy left world-readable post-migration', layers: ['security', 'storage'] },
  { code: 'cm_inc_5', grp: 'Data Migration', short: 'CM-005', txt: 'CM-005: Database replication lag exceeds cutover window tolerance', layers: ['db'] },
  { code: 'cm_inc_6', grp: 'Data Migration', short: 'CM-006', txt: 'CM-006: Block storage snapshot corruption during cross-region copy', layers: ['storage'] },
  { code: 'cm_inc_7', grp: 'Cost & Performance', short: 'CM-007', txt: 'CM-007: Unplanned egress cost spike from cross-AZ chatty application', layers: ['network', 'app'] },
  { code: 'cm_inc_8', grp: 'Cost & Performance', short: 'CM-008', txt: 'CM-008: Rightsizing mismatch causes p99 latency regression post-migration', layers: ['compute', 'app'] },
];

export const fixes = {
  cm_inc_1: 'Re-establish tunnel with static routing; add BGP failover path.',
  cm_inc_2: 'Lower TTL pre-cutover; verify propagation via multiple resolvers before traffic shift.',
  cm_inc_3: 'Correct trust policy condition keys; re-test AssumeRole cross-account.',
  cm_inc_4: 'Apply least-privilege bucket policy; enable public-access block.',
  cm_inc_5: 'Pause writes briefly or extend window; verify replica catch-up before final sync.',
  cm_inc_6: 'Re-snapshot from source; verify checksum before copy retry.',
  cm_inc_7: 'Collapse cross-AZ chatty calls; add VPC endpoint to avoid public egress.',
  cm_inc_8: 'Re-baseline instance sizing against pre-migration utilization data.',
};

export const incidentFixTasks = {
  cm_inc_1: [
    { role: 'Cloud Network Eng', name: 'Diagnose tunnel flap — check IKE/BGP logs on both ends', dep: 'Incident scope confirmed as network layer', validate: 'Root cause identified (MTU, rekey timeout, or route flap)' },
    { role: 'Cloud Network Eng', name: 'Re-establish tunnel with corrected config', dep: 'Root cause identified', validate: 'Tunnel stable for 30 min under load test' },
    { role: 'Cloud Architect', name: 'Add secondary path for failover', dep: 'Primary tunnel stable', validate: 'Failover tested — traffic shifts within SLA' },
  ],
  cm_inc_2: [
    { role: 'Cloud Network Eng', name: 'Confirm DNS record propagation across resolvers', dep: 'Cutover window opened', validate: 'All target resolvers return new record' },
    { role: 'App Owner', name: 'Verify application handles dual-endpoint gracefully during propagation', dep: 'DNS propagation confirmed', validate: 'No 5xx spike observed during transition' },
  ],
  cm_inc_3: [
    { role: 'Cloud Security Eng', name: 'Review IAM trust policy condition keys against source account', dep: 'Incident scope confirmed as IAM', validate: 'Misconfigured condition identified' },
    { role: 'Cloud Security Eng', name: 'Correct trust policy and re-test AssumeRole', dep: 'Misconfiguration identified', validate: 'Cross-account role assumption succeeds' },
  ],
  cm_inc_4: [
    { role: 'Cloud Security Eng', name: 'Audit bucket/blob ACL and policy for public exposure', dep: 'Incident scope confirmed', validate: 'Exposure scope documented' },
    { role: 'Cloud Security Eng', name: 'Apply least-privilege policy and enable public-access block', dep: 'Exposure documented', validate: 'Public access blocked; access logs show no external hits post-fix' },
  ],
  cm_inc_5: [
    { role: 'Cloud DBA', name: 'Check replication lag metrics against cutover SLA', dep: 'Incident scope confirmed as data layer', validate: 'Lag quantified against tolerance' },
    { role: 'Cloud DBA', name: 'Pause non-critical writes or extend window to allow catch-up', dep: 'Lag quantified', validate: 'Replica lag under 5s before final sync' },
  ],
  cm_inc_6: [
    { role: 'Cloud Storage Eng', name: 'Verify snapshot checksum against source', dep: 'Incident scope confirmed', validate: 'Checksum mismatch confirmed or ruled out' },
    { role: 'Cloud Storage Eng', name: 'Re-snapshot and re-copy with verification', dep: 'Checksum mismatch confirmed', validate: 'New copy checksum matches source' },
  ],
  cm_inc_7: [
    { role: 'Cloud FinOps', name: 'Identify chatty cross-AZ call pattern from cost/traffic data', dep: 'Cost spike flagged', validate: 'Offending service/call pattern identified' },
    { role: 'Cloud Architect', name: 'Add VPC endpoint or collapse cross-AZ calls', dep: 'Pattern identified', validate: 'Egress cost trend returns to baseline' },
  ],
  cm_inc_8: [
    { role: 'Cloud Architect', name: 'Compare post-migration instance sizing against source utilization baseline', dep: 'Latency regression confirmed', validate: 'Sizing gap quantified' },
    { role: 'Cloud Architect', name: 'Resize instances / adjust autoscaling policy', dep: 'Sizing gap quantified', validate: 'p99 latency back within SLA' },
  ],
};

export const uumItems = [
  { code: 'cm_uum_1', grp: 'Discovery & Assessment', short: 'MIG-001', txt: 'MIG-001: Full application/dependency discovery and 6R disposition (rehost/replatform/refactor/repurchase/retire/retain)', layers: ['app', 'network'], type: 'migration' },
  { code: 'cm_uum_2', grp: 'Landing Zone', short: 'MIG-002', txt: 'MIG-002: Landing zone build — VPC/VNet, subnets, IAM baseline, guardrails', layers: ['network', 'security'], type: 'migration' },
  { code: 'cm_uum_3', grp: 'Compute Migration', short: 'MIG-003', txt: 'MIG-003: Lift-and-shift of VM fleet via agent-based replication', layers: ['compute'], type: 'migration' },
  { code: 'cm_uum_4', grp: 'Database Migration', short: 'MIG-004', txt: 'MIG-004: Homogeneous database migration to managed cloud DB service', layers: ['db'], type: 'migration' },
  { code: 'cm_uum_5', grp: 'Database Migration', short: 'MIG-005', txt: 'MIG-005: Heterogeneous database migration with schema conversion', layers: ['db'], type: 'migration' },
  { code: 'cm_uum_6', grp: 'Storage Migration', short: 'MIG-006', txt: 'MIG-006: Bulk object/file storage migration with integrity verification', layers: ['storage'], type: 'migration' },
  { code: 'cm_uum_7', grp: 'Cutover', short: 'MIG-007', txt: 'MIG-007: DNS/traffic cutover and hypercare window', layers: ['network', 'app'], type: 'migration' },
  { code: 'cm_uum_8', grp: 'Cost Governance', short: 'MIG-008', txt: 'MIG-008: Post-migration rightsizing and cost baseline', layers: ['compute'], type: 'update' },
];

export const uumTasks = {
  cm_uum_1: [
    { role: 'Cloud Architect', name: 'Run automated discovery scan across source estate', dep: 'Discovery tooling deployed with read access', validate: 'Full inventory of VMs, DBs, dependencies captured', window: 'Working hours', est_hours: 8 },
    { role: 'Cloud Architect', name: 'Assign 6R disposition per application', dep: 'Discovery scan complete', validate: 'Every app has a disposition and owner sign-off', window: 'Working hours', est_hours: 6 },
    { role: 'App Owner', name: 'Validate dependency map with application team', dep: '6R disposition assigned', validate: 'Dependency map confirmed accurate by app owner', window: 'Working hours', est_hours: 4 },
  ],
  cm_uum_2: [
    { role: 'Cloud Architect', name: 'Design landing zone network topology (VPC/VNet, subnets, routing)', dep: 'Target cloud and region confirmed', validate: 'Network design peer-reviewed', window: 'Working hours', est_hours: 6 },
    { role: 'Cloud Security Eng', name: 'Apply IAM baseline and guardrail policies (SCPs/Azure Policy)', dep: 'Network design approved', validate: 'Guardrails enforced; policy violations blocked in test', window: 'Working hours', est_hours: 6 },
    { role: 'Cloud Network Eng', name: 'Establish hybrid connectivity (VPN/ExpressRoute/Direct Connect)', dep: 'Landing zone network live', validate: 'Connectivity tested from on-prem to landing zone', window: 'Working hours', est_hours: 4 },
  ],
  cm_uum_3: [
    { role: 'Cloud Migration Eng', name: 'Install replication agents on source VMs', dep: 'Landing zone ready; target subnets available', validate: 'Agents reporting healthy replication status', window: 'Working hours', est_hours: 4 },
    { role: 'Cloud Migration Eng', name: 'Run test migration for a non-production wave', dep: 'Replication healthy for 24h+', validate: 'Test instances boot and pass smoke test in target', window: 'Working hours', est_hours: 6 },
    { role: 'Cloud Migration Eng', name: 'Execute production wave cutover migration', dep: 'Test wave signed off', validate: 'Production instances migrated; app functional checks pass', window: 'Weekend window', est_hours: 8 },
  ],
  cm_uum_4: [
    { role: 'Cloud DBA', name: 'Provision managed DB service target with matching engine version', dep: 'Landing zone ready', validate: 'Target DB reachable and configured to baseline', window: 'Working hours', est_hours: 4 },
    { role: 'Cloud DBA', name: 'Set up continuous replication from source to target', dep: 'Target provisioned', validate: 'Replication lag under 5s sustained', window: 'Working hours', est_hours: 6 },
    { role: 'Cloud DBA', name: 'Cutover — stop writes on source, verify final sync, redirect app', dep: 'Replication stable', validate: 'Row counts match; app connects to target successfully', window: 'Weekend window', est_hours: 4 },
  ],
  cm_uum_5: [
    { role: 'Cloud DBA', name: 'Run schema conversion tool and review conversion report', dep: 'Source schema documented', validate: 'Conversion report reviewed; unsupported objects flagged' },
    { role: 'Cloud DBA', name: 'Manually remediate unsupported/incompatible objects', dep: 'Conversion report reviewed', validate: 'All flagged objects converted or replaced' },
    { role: 'QA Team', name: 'Run full regression against converted schema', dep: 'Schema conversion complete', validate: 'Regression suite passes on target engine' },
  ],
  cm_uum_6: [
    { role: 'Cloud Storage Eng', name: 'Run bulk transfer job (parallel, checksum-verified)', dep: 'Target storage bucket/container provisioned', validate: 'Transfer complete with 100% checksum match', window: 'Working hours', est_hours: 6 },
    { role: 'Cloud Storage Eng', name: 'Apply lifecycle/tiering policy on target', dep: 'Transfer verified', validate: 'Policy active; test object transitions correctly' },
  ],
  cm_uum_7: [
    { role: 'Cloud Network Eng', name: 'Lower DNS TTL ahead of cutover', dep: 'Cutover date confirmed', validate: 'TTL reduced and verified 24h before cutover' },
    { role: 'Cloud Network Eng', name: 'Flip DNS/traffic manager to target endpoint', dep: 'Target fully validated', validate: 'Traffic observed flowing to target; error rate nominal', window: 'Weekend window', est_hours: 2 },
    { role: 'App Owner', name: 'Hypercare monitoring — first 48h post-cutover', dep: 'Traffic cutover complete', validate: 'No P1/P2 incidents in hypercare window', window: 'Weekend window', est_hours: 16 },
  ],
  cm_uum_8: [
    { role: 'Cloud FinOps', name: 'Compare actual utilization vs provisioned sizing after 2 weeks live', dep: 'Workload stable in production', validate: 'Rightsizing report produced with recommendations' },
    { role: 'Cloud Architect', name: 'Apply approved rightsizing changes', dep: 'Rightsizing report approved', validate: 'Cost baseline re-measured, trending to target' },
  ],
};

export const designSections = [
  { key: 'landingZone', label: 'Landing Zone', owner: 'Cloud Architect', fields: ['vpc_design', 'subnet_layout', 'routing', 'guardrails', 'account_structure', 'notes'] },
  { key: 'network', label: 'Networking', owner: 'Cloud Network Eng', fields: ['hybrid_connectivity', 'dns_strategy', 'load_balancer', 'egress_strategy', 'notes'] },
  { key: 'iam', label: 'IAM & Security', owner: 'Cloud Security Eng', fields: ['iam_model', 'scp_policy', 'encryption_standard', 'secrets_mgmt', 'notes'] },
  { key: 'migrationWave', label: 'Migration Wave Plan', owner: 'Cloud Migration Eng', fields: ['wave_grouping', 'migration_tool', 'cutover_window', 'rollback_plan', 'notes'] },
  { key: 'costGovernance', label: 'Cost Governance', owner: 'Cloud FinOps', fields: ['tagging_strategy', 'budget_alerts', 'reserved_capacity', 'notes'] },
  { key: 'drCloud', label: 'DR / Resilience', owner: 'Cloud Architect', fields: ['multi_az_strategy', 'backup_target', 'rto_rpo', 'notes'] },
];

export const fieldLabels = {
  vpc_design: 'VPC/VNet Design', subnet_layout: 'Subnet Layout', routing: 'Routing Tables', guardrails: 'Guardrail Policies (SCP/Azure Policy)', account_structure: 'Account/Subscription Structure',
  hybrid_connectivity: 'Hybrid Connectivity (VPN/ExpressRoute)', dns_strategy: 'DNS Cutover Strategy', load_balancer: 'Load Balancer Config', egress_strategy: 'Egress Strategy',
  iam_model: 'IAM Role Model', scp_policy: 'SCP / Policy Guardrails', encryption_standard: 'Encryption Standard', secrets_mgmt: 'Secrets Management',
  wave_grouping: 'Migration Wave Grouping', migration_tool: 'Migration Tooling', cutover_window: 'Cutover Window', rollback_plan: 'Rollback Plan',
  tagging_strategy: 'Tagging Strategy', budget_alerts: 'Budget Alert Thresholds', reserved_capacity: 'Reserved/Committed Capacity',
  multi_az_strategy: 'Multi-AZ/Region Strategy', backup_target: 'Backup Target', rto_rpo: 'RTO / RPO Targets',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['On-Prem VMware', 'On-Prem Bare Metal', 'AWS (source)', 'Azure (source)', 'GCP (source)', 'Other Cloud (source)'],
  ['AWS', 'Microsoft Azure', 'Google Cloud Platform', 'Oracle Cloud Infrastructure', 'Multi-Cloud'],
  ['Rehost (Lift & Shift)', 'Replatform', 'Refactor', 'Repurchase (SaaS)', 'Hybrid'],
  ['New Landing Zone', 'Existing Landing Zone', 'Shared Landing Zone (multi-BU)', 'Sandbox / PoC'],
];
