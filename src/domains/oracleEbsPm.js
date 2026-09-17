// Oracle EBS / Fusion Cloud domain catalog — EBS upgrades, EBS-to-Fusion
// migrations, and Fusion module rollouts.

export const incidents = [
  { code: 'ebs_inc_1', grp: 'Batch / Concurrent', short: 'EBS-001', txt: 'EBS-001: Concurrent manager queue backlog blocking month-end reports', layers: ['app'] },
  { code: 'ebs_inc_2', grp: 'Data', short: 'EBS-002', txt: 'EBS-002: FBDI data load failure on interface table validation errors', layers: ['db'] },
  { code: 'ebs_inc_3', grp: 'Workflow', short: 'EBS-003', txt: 'EBS-003: Business Event System (BES) not triggering approval notifications', layers: ['app'] },
  { code: 'ebs_inc_4', grp: 'Integration', short: 'EBS-004', txt: 'EBS-004: OIC integration flow failing on Fusion REST API auth token expiry', layers: ['app', 'network'] },
  { code: 'ebs_inc_5', grp: 'CEMLI', short: 'EBS-005', txt: 'EBS-005: Custom extension (CEMLI) breaks after Fusion Cloud quarterly update', layers: ['app'] },
  { code: 'ebs_inc_6', grp: 'Financials', short: 'EBS-006', txt: 'EBS-006: AutoInvoice/AutoAccounting posting failures in General Ledger', layers: ['app', 'db'] },
  { code: 'ebs_inc_7', grp: 'Analytics', short: 'EBS-007', txt: 'EBS-007: Fusion Analytics Warehouse (FAW) data refresh failure', layers: ['db'] },
  { code: 'ebs_inc_8', grp: 'Security', short: 'EBS-008', txt: 'EBS-008: Fusion Security Console role misconfiguration grants excess access', layers: ['security'] },
];

export const fixes = {
  ebs_inc_1: 'Reprioritize concurrent request queue; add parallel managers for close window.',
  ebs_inc_2: 'Correct source data against interface table validation rules; re-run FBDI load.',
  ebs_inc_3: 'Restart BES listener; verify event subscription and rule configuration.',
  ebs_inc_4: 'Refresh OAuth token configuration; verify token expiry/refresh cycle in OIC connection.',
  ebs_inc_5: 'Patch CEMLI against new Fusion API version; regression test in test environment.',
  ebs_inc_6: 'Correct AutoAccounting rule set; reprocess failed transactions through GL interface.',
  ebs_inc_7: 'Re-trigger FAW data pipeline; verify source extract completed before refresh.',
  ebs_inc_8: 'Correct role/duty assignment in Security Console; re-run access certification.',
};

export const incidentFixTasks = {
  ebs_inc_1: [
    { role: 'EBS/Fusion Basis', name: 'Review concurrent request queue and identify blocking long-running jobs', dep: 'Month-end report delay reported', validate: 'Blocking job(s) identified' },
    { role: 'EBS/Fusion Basis', name: 'Reprioritize queue and add parallel managers for close window', dep: 'Blocking jobs identified', validate: 'Queue drains within close window SLA' },
  ],
  ebs_inc_2: [
    { role: 'Data Conversion Lead', name: 'Review FBDI interface table validation errors', dep: 'Load failure reported', validate: 'Validation error pattern and affected rows identified' },
    { role: 'Data Conversion Lead', name: 'Correct source data and re-run FBDI load', dep: 'Error pattern identified', validate: 'Reload passes validation with zero rejected rows' },
  ],
  ebs_inc_3: [
    { role: 'Fusion Technical Lead', name: 'Check BES listener status and event subscription configuration', dep: 'Missing approval notifications reported', validate: 'Listener/subscription fault identified' },
    { role: 'Fusion Technical Lead', name: 'Restart listener and correct subscription/rule configuration', dep: 'Fault identified', validate: 'Notifications resume for test transaction' },
  ],
  ebs_inc_4: [
    { role: 'OIC Integration Architect', name: 'Review integration flow error log for auth failure pattern', dep: 'Integration failure reported', validate: 'Token expiry confirmed as root cause' },
    { role: 'OIC Integration Architect', name: 'Refresh OAuth connection config and verify refresh-token cycle', dep: 'Root cause confirmed', validate: 'Integration flow runs successfully for 24h without auth failure' },
  ],
  ebs_inc_5: [
    { role: 'Fusion Technical Lead', name: 'Identify breaking API/schema change from quarterly update release notes', dep: 'CEMLI failure reported post-update', validate: 'Breaking change identified' },
    { role: 'Fusion Technical Lead', name: 'Patch CEMLI and regression test in test environment', dep: 'Breaking change identified', validate: 'CEMLI passes regression test in test instance' },
  ],
  ebs_inc_6: [
    { role: 'Fusion Financials Lead', name: 'Review AutoAccounting rule set and failed transaction log', dep: 'GL posting failures reported', validate: 'Rule misconfiguration or data issue identified' },
    { role: 'Fusion Financials Lead', name: 'Correct rule set and reprocess failed transactions', dep: 'Issue identified', validate: 'Failed transactions post successfully to GL' },
  ],
  ebs_inc_7: [
    { role: 'Data Conversion Lead', name: 'Check FAW pipeline logs for source extract completion status', dep: 'Stale dashboard data reported', validate: 'Extract failure or timing issue identified' },
    { role: 'Data Conversion Lead', name: 'Re-trigger FAW refresh after confirming source extract complete', dep: 'Issue identified', validate: 'FAW dashboards show current data' },
  ],
  ebs_inc_8: [
    { role: 'Fusion Security Admin', name: 'Review Security Console role/duty assignment for excess access', dep: 'Excess access flagged', validate: 'Over-privileged role/duty combination identified' },
    { role: 'Fusion Security Admin', name: 'Correct assignment and re-run access certification', dep: 'Over-privileged combination identified', validate: 'Certification confirms access matches least-privilege model' },
  ],
};

export const uumItems = [
  { code: 'ebs_uum_1', grp: 'Migration', short: 'MIG-001', txt: 'MIG-001: EBS R12 to Fusion Cloud full migration', layers: ['app', 'db'], type: 'migration' },
  { code: 'ebs_uum_2', grp: 'Upgrade', short: 'UPG-001', txt: 'UPG-001: EBS 12.1 to 12.2 upgrade (online patching)', layers: ['app', 'db'], type: 'upgrade' },
  { code: 'ebs_uum_3', grp: 'Integration', short: 'OIC-001', txt: 'OIC-001: Oracle Integration Cloud build replacing custom EBS interfaces', layers: ['app', 'network'], type: 'migration' },
  { code: 'ebs_uum_4', grp: 'CEMLI', short: 'CEM-001', txt: 'CEM-001: CEMLI remediation ahead of Fusion quarterly update', layers: ['app'], type: 'update' },
  { code: 'ebs_uum_5', grp: 'Financials', short: 'FIN-001', txt: 'FIN-001: Fusion Financials rollout (GL/AP/AR)', layers: ['app'], type: 'migration' },
  { code: 'ebs_uum_6', grp: 'SCM', short: 'SCM-001', txt: 'SCM-001: Fusion Supply Chain Management rollout', layers: ['app'], type: 'migration' },
  { code: 'ebs_uum_7', grp: 'Data', short: 'DAT-001', txt: 'DAT-001: Data conversion via FBDI/ADFdi templates', layers: ['db'], type: 'migration' },
  { code: 'ebs_uum_8', grp: 'Batch', short: 'BAT-001', txt: 'BAT-001: Concurrent program to ESS job migration', layers: ['app'], type: 'migration' },
];

export const uumTasks = {
  ebs_uum_1: [
    { role: 'Fusion Technical Lead', name: 'Run functional/technical fit-gap assessment against target Fusion modules', dep: 'Current EBS footprint documented', validate: 'Fit-gap report signed off by business', window: 'Working hours', est_hours: 24 },
    { role: 'Data Conversion Lead', name: 'Execute data conversion via FBDI for core objects (GL, AP, AR, items)', dep: 'Fit-gap signed off; conversion templates mapped', validate: 'Conversion reconciles against EBS source within tolerance', window: 'Working hours', est_hours: 40 },
    { role: 'Fusion Financials Lead', name: 'Execute parallel run and cutover to Fusion', dep: 'Data conversion validated; UAT signed off', validate: 'Parallel run reconciles; cutover complete with business sign-off', window: 'Weekend window', est_hours: 16 },
  ],
  ebs_uum_2: [
    { role: 'EBS/Fusion Basis', name: 'Run pre-upgrade readiness checks and apply consolidated patches', dep: 'Upgrade window scheduled', validate: 'Readiness checks pass with no blockers', window: 'Working hours', est_hours: 8 },
    { role: 'EBS/Fusion Basis', name: 'Execute online patching cycle in non-production, validate', dep: 'Readiness checks passed', validate: 'Non-prod on 12.2; core batch and OLTP flows validated', window: 'Working hours', est_hours: 16 },
    { role: 'EBS/Fusion Basis', name: 'Execute production online patching cutover', dep: 'Non-prod validated; CAB approved', validate: 'Production on 12.2; smoke test and month-end batch pass', window: 'Weekend window', est_hours: 12 },
  ],
  ebs_uum_3: [
    { role: 'OIC Integration Architect', name: 'Design integration flow replacing legacy custom interface', dep: 'Legacy interface inventory and data contract documented', validate: 'Integration design reviewed and approved' },
    { role: 'OIC Integration Architect', name: 'Build and test OIC integration in non-production', dep: 'Design approved', validate: 'Integration passes functional and error-handling tests' },
    { role: 'OIC Integration Architect', name: 'Cut over to OIC integration, decommission legacy interface', dep: 'Non-prod testing signed off', validate: 'Production integration stable for 5 cycles; legacy interface retired' },
  ],
  ebs_uum_4: [
    { role: 'Fusion Technical Lead', name: 'Run CEMLI impact assessment against upcoming quarterly update release notes', dep: 'Quarterly update schedule confirmed', validate: 'Impact assessment produced with prioritized remediation list' },
    { role: 'Fusion Technical Lead', name: 'Remediate flagged CEMLIs and regression test', dep: 'Impact assessment reviewed', validate: 'All flagged CEMLIs pass regression test against update preview' },
  ],
  ebs_uum_5: [
    { role: 'Fusion Financials Lead', name: 'Configure ledger structure, chart of accounts, and tax setup', dep: 'Financial design workshop complete', validate: 'Configuration validated against sample transactions', window: 'Working hours', est_hours: 20 },
    { role: 'Fusion Financials Lead', name: 'Run UAT for GL/AP/AR core processes', dep: 'Configuration complete', validate: 'UAT sign-off from finance operations' },
  ],
  ebs_uum_6: [
    { role: 'Fusion SCM Lead', name: 'Configure inventory org structure and procurement workflows', dep: 'SCM design workshop complete', validate: 'Configuration validated against sample transactions', window: 'Working hours', est_hours: 20 },
    { role: 'Fusion SCM Lead', name: 'Run UAT for procure-to-pay and order-to-cash flows', dep: 'Configuration complete', validate: 'UAT sign-off from supply chain operations' },
  ],
  ebs_uum_7: [
    { role: 'Data Conversion Lead', name: 'Map source objects to FBDI/ADFdi templates', dep: 'Source data extracted and profiled', validate: 'Mapping signed off by functional leads' },
    { role: 'Data Conversion Lead', name: 'Execute mock conversion and reconcile record counts', dep: 'Mapping approved', validate: 'Mock conversion reconciles within tolerance' },
    { role: 'Data Conversion Lead', name: 'Execute production cutover conversion', dep: 'Mock conversion signed off', validate: 'Production conversion reconciles; business validates key records', window: 'Weekend window', est_hours: 8 },
  ],
  ebs_uum_8: [
    { role: 'Fusion Technical Lead', name: 'Inventory EBS concurrent programs and map to target ESS jobs', dep: 'Concurrent program catalog exported', validate: 'Mapping complete with parameter equivalence confirmed' },
    { role: 'Fusion Technical Lead', name: 'Schedule and validate ESS jobs in non-production', dep: 'Mapping complete', validate: 'ESS jobs produce output matching legacy concurrent program output' },
  ],
};

export const designSections = [
  { key: 'fusionFinancials', label: 'Financials', owner: 'Fusion Financials Lead', fields: ['ledger_structure', 'coa_design', 'tax_config', 'notes'] },
  { key: 'fusionScm', label: 'Supply Chain', owner: 'Fusion SCM Lead', fields: ['inventory_org_structure', 'procurement_config', 'order_mgmt_flow', 'notes'] },
  { key: 'integration', label: 'Integration (OIC)', owner: 'OIC Integration Architect', fields: ['integration_pattern', 'auth_method', 'error_handling', 'notes'] },
  { key: 'dataConversion', label: 'Data Conversion', owner: 'Data Conversion Lead', fields: ['conversion_tool', 'object_scope', 'reconciliation_approach', 'notes'] },
  { key: 'cemli', label: 'CEMLI', owner: 'Fusion Technical Lead', fields: ['cemli_inventory', 'remediation_plan', 'testing_approach', 'notes'] },
  { key: 'security', label: 'Security Console', owner: 'Fusion Security Admin', fields: ['role_model', 'data_access_sets', 'segregation_of_duties', 'notes'] },
];

export const fieldLabels = {
  ledger_structure: 'Ledger Structure', coa_design: 'Chart of Accounts Design', tax_config: 'Tax Configuration',
  inventory_org_structure: 'Inventory Org Structure', procurement_config: 'Procurement Configuration', order_mgmt_flow: 'Order Management Flow',
  integration_pattern: 'Integration Pattern', auth_method: 'Authentication Method', error_handling: 'Error Handling Strategy',
  conversion_tool: 'Conversion Tool (FBDI/ADFdi)', object_scope: 'Object Scope', reconciliation_approach: 'Reconciliation Approach',
  cemli_inventory: 'CEMLI Inventory', remediation_plan: 'Remediation Plan', testing_approach: 'Testing Approach',
  role_model: 'Role Model', data_access_sets: 'Data Access Sets', segregation_of_duties: 'Segregation of Duties Ruleset',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['EBS 12.1', 'EBS 12.2', 'Fusion Cloud (existing)', 'Legacy Oracle Apps 11i'],
  ['Fusion Cloud SaaS', 'EBS 12.2 (stay on-prem)', 'Hybrid (EBS + Fusion)', 'OCI-hosted EBS'],
  ['Big Bang Migration', 'Phased by Module', 'Phased by Business Unit', 'Pilot then Rollout'],
  ['Financials Only', 'Financials + SCM', 'Financials + HCM', 'Full Suite'],
];
