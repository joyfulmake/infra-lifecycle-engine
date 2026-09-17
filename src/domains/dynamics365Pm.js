// Microsoft Dynamics 365 domain catalog — F&O/Sales/Customer Service
// implementations, Business Central migrations, and Power Platform builds.

export const incidents = [
  { code: 'd365_inc_1', grp: 'Dataverse', short: 'D365-001', txt: 'D365-001: Dataverse API request limit exceeded causing plugin failures', layers: ['app'] },
  { code: 'd365_inc_2', grp: 'Power Platform', short: 'D365-002', txt: 'D365-002: Power Automate flow failing silently after connector deprecation', layers: ['app'] },
  { code: 'd365_inc_3', grp: 'Finance & Operations', short: 'D365-003', txt: 'D365-003: F&O batch job stuck in Executing state, blocking month-end close', layers: ['app'] },
  { code: 'd365_inc_4', grp: 'Security', short: 'D365-004', txt: 'D365-004: Security role misconfiguration grants cross-business-unit access', layers: ['security'] },
  { code: 'd365_inc_5', grp: 'Migration', short: 'D365-005', txt: 'D365-005: GP-to-Business-Central migration leaves unposted transactions', layers: ['db', 'app'] },
  { code: 'd365_inc_6', grp: 'Dataverse', short: 'D365-006', txt: 'D365-006: Plugin causing performance degradation on high-volume entity', layers: ['app', 'db'] },
  { code: 'd365_inc_7', grp: 'Reporting', short: 'D365-007', txt: 'D365-007: Power BI embedded report showing stale data — dataflow refresh failure', layers: ['db'] },
  { code: 'd365_inc_8', grp: 'ISV', short: 'D365-008', txt: 'D365-008: AppSource ISV solution conflicting with custom solution layer', layers: ['app'] },
];

export const fixes = {
  d365_inc_1: 'Optimize plugin/API call pattern to reduce request volume; request capacity add-on if sustained.',
  d365_inc_2: 'Update flow to replacement connector; retest and republish.',
  d365_inc_3: 'Identify and kill stuck batch thread; requeue job via batch job history.',
  d365_inc_4: 'Correct security role/business unit assignment; re-run access review.',
  d365_inc_5: 'Identify unposted transaction batch; correct and re-post in Business Central.',
  d365_inc_6: 'Optimize plugin (async, reduce synchronous DB calls); re-test entity performance.',
  d365_inc_7: 'Re-trigger dataflow refresh; verify source connection credentials valid.',
  d365_inc_8: 'Isolate conflicting solution layer; sequence solution load order or request ISV patch.',
};

export const incidentFixTasks = {
  d365_inc_1: [
    { role: 'Dataverse Architect', name: 'Review API usage against Dataverse service protection limits', dep: 'Plugin failures reported', validate: 'Offending caller and request pattern identified' },
    { role: 'Dataverse Architect', name: 'Optimize call pattern / request capacity add-on', dep: 'Offending pattern identified', validate: 'API errors resolved; usage under service protection thresholds' },
  ],
  d365_inc_2: [
    { role: 'Power Platform Dev', name: 'Identify deprecated connector from flow run history error', dep: 'Silent flow failure reported', validate: 'Deprecated connector confirmed as root cause' },
    { role: 'Power Platform Dev', name: 'Update flow to replacement connector and republish', dep: 'Root cause confirmed', validate: 'Flow runs successfully in test and production' },
  ],
  d365_inc_3: [
    { role: 'F&O Functional Lead', name: 'Identify stuck batch job and thread from batch job history', dep: 'Month-end close blocked', validate: 'Stuck job and cause identified' },
    { role: 'F&O Functional Lead', name: 'Kill stuck thread and requeue batch job', dep: 'Stuck job identified', validate: 'Batch job completes; close process resumes' },
  ],
  d365_inc_4: [
    { role: 'D365 Security Admin', name: 'Review security role and business unit assignment for affected user(s)', dep: 'Excess access flagged', validate: 'Misassignment identified' },
    { role: 'D365 Security Admin', name: 'Correct assignment and re-run access review', dep: 'Misassignment identified', validate: 'Access review confirms correct scoping' },
  ],
  d365_inc_5: [
    { role: 'Data Migration Lead', name: 'Identify unposted transaction batch from migration log', dep: 'Unposted transactions reported', validate: 'Affected batch and transaction count identified' },
    { role: 'Data Migration Lead', name: 'Correct and re-post transactions in Business Central', dep: 'Affected batch identified', validate: 'All transactions post successfully; reconciliation confirms completeness' },
  ],
  d365_inc_6: [
    { role: 'Dataverse Architect', name: 'Profile plugin execution for synchronous DB call bottleneck', dep: 'Performance degradation reported', validate: 'Bottleneck identified' },
    { role: 'Dataverse Architect', name: 'Convert to async execution / optimize query, redeploy', dep: 'Bottleneck identified', validate: 'Entity operation latency back within SLA' },
  ],
  d365_inc_7: [
    { role: 'Power BI Developer', name: 'Check dataflow refresh history and source connection status', dep: 'Stale report data reported', validate: 'Refresh failure cause identified (credential/source/timeout)' },
    { role: 'Power BI Developer', name: 'Correct connection/credentials and re-trigger refresh', dep: 'Cause identified', validate: 'Report reflects current data after refresh' },
  ],
  d365_inc_8: [
    { role: 'Power Platform Dev', name: 'Isolate conflicting components between ISV and custom solution', dep: 'Conflict reported after ISV install', validate: 'Conflicting component(s) identified' },
    { role: 'Power Platform Dev', name: 'Sequence solution load order or engage ISV support for patch', dep: 'Conflict identified', validate: 'Both solutions function correctly together' },
  ],
};

export const uumItems = [
  { code: 'd365_uum_1', grp: 'Implementation', short: 'IMP-001', txt: 'IMP-001: Dynamics 365 Finance & Operations implementation', layers: ['app', 'db'], type: 'migration' },
  { code: 'd365_uum_2', grp: 'Implementation', short: 'IMP-002', txt: 'IMP-002: Dynamics 365 Sales / Customer Service implementation', layers: ['app'], type: 'migration' },
  { code: 'd365_uum_3', grp: 'Migration', short: 'MIG-001', txt: 'MIG-001: GP/NAV to Business Central migration', layers: ['app', 'db'], type: 'migration' },
  { code: 'd365_uum_4', grp: 'Power Platform', short: 'PWR-001', txt: 'PWR-001: Power Platform integration — Power Automate and Power Apps', layers: ['app'], type: 'migration' },
  { code: 'd365_uum_5', grp: 'Data', short: 'DAT-001', txt: 'DAT-001: Dataverse data migration from legacy CRM/ERP', layers: ['db'], type: 'migration' },
  { code: 'd365_uum_6', grp: 'Security', short: 'SEC-001', txt: 'SEC-001: Security role and business unit redesign', layers: ['security'], type: 'update' },
  { code: 'd365_uum_7', grp: 'Reporting', short: 'RPT-001', txt: 'RPT-001: Power BI embedded reporting rollout', layers: ['db'], type: 'migration' },
  { code: 'd365_uum_8', grp: 'ISV', short: 'ISV-001', txt: 'ISV-001: AppSource ISV solution integration', layers: ['app'], type: 'migration' },
];

export const uumTasks = {
  d365_uum_1: [
    { role: 'F&O Functional Lead', name: 'Configure legal entity structure, chart of accounts, and batch framework', dep: 'Finance design workshop complete', validate: 'Configuration validated against sample transactions', window: 'Working hours', est_hours: 20 },
    { role: 'Power Platform Dev', name: 'Build integration touchpoints to Power Platform where required', dep: 'Core configuration complete', validate: 'Integration touchpoints tested end-to-end' },
    { role: 'QA Eng', name: 'Run UAT for core financial and operational processes', dep: 'Configuration and integration complete', validate: 'UAT sign-off from finance and operations leads', window: 'Working hours', est_hours: 16 },
  ],
  d365_uum_2: [
    { role: 'CE Functional Lead', name: 'Configure sales process, case routing, and SLA rules', dep: 'Service/sales model requirements confirmed', validate: 'Configuration tested end-to-end', window: 'Working hours', est_hours: 14 },
    { role: 'Power Platform Dev', name: 'Build custom canvas apps / model-driven app customizations', dep: 'Core configuration complete', validate: 'Custom apps tested with pilot users' },
  ],
  d365_uum_3: [
    { role: 'Data Migration Lead', name: 'Map GP/NAV chart of accounts and master data to Business Central', dep: 'Source system data extracted and profiled', validate: 'Mapping signed off by finance' },
    { role: 'Data Migration Lead', name: 'Execute mock migration and reconcile open transactions', dep: 'Mapping approved', validate: 'Mock migration reconciles within tolerance' },
    { role: 'Data Migration Lead', name: 'Execute production cutover migration', dep: 'Mock migration signed off', validate: 'Production migration reconciles; no unposted transactions remain', window: 'Weekend window', est_hours: 8 },
  ],
  d365_uum_4: [
    { role: 'Power Platform Dev', name: 'Inventory required flows and canvas/model-driven apps', dep: 'Automation requirements gathered', validate: 'Inventory reviewed and prioritized' },
    { role: 'Power Platform Dev', name: 'Build and test flows/apps in non-production environment', dep: 'Inventory prioritized', validate: 'Flows/apps pass functional test' },
    { role: 'Power Platform Dev', name: 'Deploy to production via solution pipeline', dep: 'Non-production testing signed off', validate: 'Production deployment verified with smoke test' },
  ],
  d365_uum_5: [
    { role: 'Dataverse Architect', name: 'Design target entity model in Dataverse', dep: 'Legacy data model documented', validate: 'Entity model reviewed and approved' },
    { role: 'Data Migration Lead', name: 'Execute data migration and reconcile record counts', dep: 'Entity model approved', validate: 'Migration reconciles within tolerance', window: 'Weekend window', est_hours: 8 },
  ],
  d365_uum_6: [
    { role: 'D365 Security Admin', name: 'Audit current security roles and business unit structure', dep: 'Access review requirement raised', validate: 'Gap list produced' },
    { role: 'D365 Security Admin', name: 'Redesign roles/business units and roll out', dep: 'Gap list reviewed', validate: 'Redesigned roles tested per persona; no access regressions' },
  ],
  d365_uum_7: [
    { role: 'Power BI Developer', name: 'Build semantic model and embedded reports against Dataverse/F&O data', dep: 'Reporting requirements confirmed', validate: 'Reports validated against source data' },
    { role: 'Power BI Developer', name: 'Configure dataflow refresh schedule and embed in application', dep: 'Reports validated', validate: 'Embedded reports refresh on schedule with no errors' },
  ],
  d365_uum_8: [
    { role: 'Power Platform Dev', name: 'Install ISV solution in non-production and test alongside custom solution', dep: 'ISV solution procured', validate: 'No conflicts found in non-production' },
    { role: 'Power Platform Dev', name: 'Deploy to production and monitor for solution layer conflicts', dep: 'Non-production testing signed off', validate: 'Production deployment stable; no conflicts after 1 week' },
  ],
};

export const designSections = [
  { key: 'financeOps', label: 'Finance & Operations', owner: 'F&O Functional Lead', fields: ['legal_entity_structure', 'coa_design', 'batch_framework', 'notes'] },
  { key: 'salesService', label: 'Sales & Customer Service', owner: 'CE Functional Lead', fields: ['sales_process', 'case_routing', 'sla_config', 'notes'] },
  { key: 'powerPlatform', label: 'Power Platform', owner: 'Power Platform Dev', fields: ['flow_inventory', 'canvas_apps', 'connector_scope', 'notes'] },
  { key: 'dataverse', label: 'Dataverse', owner: 'Dataverse Architect', fields: ['entity_model', 'migration_tool', 'data_volume', 'notes'] },
  { key: 'security', label: 'Security Roles', owner: 'D365 Security Admin', fields: ['role_model', 'business_unit_structure', 'field_security_profiles', 'notes'] },
  { key: 'reporting', label: 'Reporting & BI', owner: 'Power BI Developer', fields: ['embedded_reports', 'dataflow_refresh', 'semantic_model', 'notes'] },
];

export const fieldLabels = {
  legal_entity_structure: 'Legal Entity Structure', coa_design: 'Chart of Accounts Design', batch_framework: 'Batch Framework Config',
  sales_process: 'Sales Process', case_routing: 'Case Routing Rules', sla_config: 'SLA Configuration',
  flow_inventory: 'Power Automate Flow Inventory', canvas_apps: 'Canvas / Model-Driven Apps', connector_scope: 'Connector Scope',
  entity_model: 'Dataverse Entity Model', migration_tool: 'Migration Tool', data_volume: 'Data Volume (records)',
  role_model: 'Security Role Model', business_unit_structure: 'Business Unit Structure', field_security_profiles: 'Field Security Profiles',
  embedded_reports: 'Embedded Report Inventory', dataflow_refresh: 'Dataflow Refresh Schedule', semantic_model: 'Semantic Model Design',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Finance & Operations', 'Sales', 'Customer Service', 'Business Central', 'Field Service'],
  ['Dynamics GP', 'Dynamics NAV', 'Dynamics AX 2012', 'Salesforce', 'Greenfield (new)'],
  ['Cloud (SaaS)', 'On-Premise', 'Hybrid'],
  ['Power Automate Only', 'Power Apps + Automate', 'Full Power Platform', 'Standalone D365'],
];
