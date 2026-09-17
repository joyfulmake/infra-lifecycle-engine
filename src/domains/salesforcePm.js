// Salesforce Program domain catalog — Sales/Service/Experience Cloud
// implementations, CPQ rollouts, and org consolidation programs.

export const incidents = [
  { code: 'sf_inc_1', grp: 'Apex / Automation', short: 'SF-001', txt: 'SF-001: Apex batch job hitting CPU time governor limit during nightly sync', layers: ['app'] },
  { code: 'sf_inc_2', grp: 'Apex / Automation', short: 'SF-002', txt: 'SF-002: Flow automation infinite loop triggering record update storm', layers: ['app'] },
  { code: 'sf_inc_3', grp: 'Data', short: 'SF-003', txt: 'SF-003: Data Loader bulk import failing on duplicate rule rejections', layers: ['db'] },
  { code: 'sf_inc_4', grp: 'Integration', short: 'SF-004', txt: 'SF-004: Integration user hitting daily API call limit, blocking MuleSoft sync', layers: ['app', 'network'] },
  { code: 'sf_inc_5', grp: 'Security', short: 'SF-005', txt: 'SF-005: Permission set misconfiguration exposes PII fields to unauthorized profile', layers: ['security'] },
  { code: 'sf_inc_6', grp: 'Environment', short: 'SF-006', txt: 'SF-006: Full sandbox refresh overwrites UAT test data and custom metadata', layers: ['app', 'db'] },
  { code: 'sf_inc_7', grp: 'CPQ', short: 'SF-007', txt: 'SF-007: CPQ pricing rule conflict produces incorrect quote line totals', layers: ['app'] },
  { code: 'sf_inc_8', grp: 'Release', short: 'SF-008', txt: 'SF-008: Managed package upgrade breaks custom Lightning Web Component', layers: ['app'] },
];

export const fixes = {
  sf_inc_1: 'Refactor batch job to reduce SOQL/DML per transaction; adjust batch scope size.',
  sf_inc_2: 'Deactivate flow, add recursion guard, redeploy with entry-condition fix.',
  sf_inc_3: 'Adjust duplicate rule action to report-only, clean source data, re-run load.',
  sf_inc_4: 'Request temporary API limit increase; optimize integration to batch calls.',
  sf_inc_5: 'Correct permission set field-level security; audit affected user access.',
  sf_inc_6: 'Restore from backup metadata/data export; document refresh runbook to prevent recurrence.',
  sf_inc_7: 'Correct pricing rule condition order; re-validate quote calculation test cases.',
  sf_inc_8: 'Patch custom LWC against new package API version; regression test.',
};

export const incidentFixTasks = {
  sf_inc_1: [
    { role: 'Salesforce Dev', name: 'Review debug logs for CPU time breakdown by batch chunk', dep: 'Governor limit exception captured', validate: 'Hotspot SOQL/DML identified in batch execute method' },
    { role: 'Salesforce Dev', name: 'Refactor batch job (bulkify, reduce scope size) and redeploy', dep: 'Hotspot identified', validate: 'Batch completes without CPU limit exception in sandbox re-run' },
  ],
  sf_inc_2: [
    { role: 'Salesforce Admin', name: 'Deactivate offending flow to stop the update storm', dep: 'Record update storm detected', validate: 'Flow deactivated; record update rate returns to normal' },
    { role: 'Salesforce Dev', name: 'Add recursion guard / entry condition fix, test, reactivate', dep: 'Flow deactivated', validate: 'Flow re-tested with no recursive trigger; reactivated safely' },
  ],
  sf_inc_3: [
    { role: 'Data Migration Lead', name: 'Review Data Loader error log for duplicate rule rejection pattern', dep: 'Bulk import failure reported', validate: 'Rejection cause and affected record count identified' },
    { role: 'Data Migration Lead', name: 'Clean source data / adjust duplicate rule, re-run load', dep: 'Rejection cause identified', validate: 'Re-run load completes with zero unexpected rejections' },
  ],
  sf_inc_4: [
    { role: 'Integration Architect', name: 'Confirm API limit exhaustion via System Overview / API usage log', dep: 'Sync failures reported', validate: 'API limit exhaustion confirmed as root cause' },
    { role: 'Integration Architect', name: 'Request temporary limit increase and optimize call batching', dep: 'Root cause confirmed', validate: 'Sync resumes; API usage trending back under daily limit' },
  ],
  sf_inc_5: [
    { role: 'Salesforce Security Admin', name: 'Audit permission set field-level security for PII fields', dep: 'Exposure reported', validate: 'Affected fields and profiles documented' },
    { role: 'Salesforce Security Admin', name: 'Correct field-level security and review access logs for exposure window', dep: 'Affected fields documented', validate: 'FLS corrected; no unauthorized access confirmed post-fix' },
  ],
  sf_inc_6: [
    { role: 'Salesforce Admin', name: 'Assess scope of lost UAT data and custom metadata', dep: 'Sandbox refresh completed unexpectedly', validate: 'Loss scope documented' },
    { role: 'Salesforce Admin', name: 'Restore from metadata backup / data export and re-seed UAT', dep: 'Loss scope documented', validate: 'UAT environment restored; testing can resume' },
  ],
  sf_inc_7: [
    { role: 'CPQ Specialist', name: 'Reproduce quote and identify conflicting pricing rule execution order', dep: 'Incorrect quote total reported', validate: 'Conflicting rule(s) identified' },
    { role: 'CPQ Specialist', name: 'Correct rule condition/order and re-validate quote test cases', dep: 'Conflicting rule identified', validate: 'Quote calculation test suite passes' },
  ],
  sf_inc_8: [
    { role: 'Salesforce Dev', name: 'Identify breaking API change from package release notes', dep: 'LWC error reported post-upgrade', validate: 'Breaking change identified' },
    { role: 'Salesforce Dev', name: 'Patch custom LWC and run regression test', dep: 'Breaking change identified', validate: 'LWC renders correctly; regression suite passes' },
  ],
};

export const uumItems = [
  { code: 'sf_uum_1', grp: 'Implementation', short: 'IMP-001', txt: 'IMP-001: Sales Cloud implementation — accounts, opportunities, forecasting', layers: ['app'], type: 'migration' },
  { code: 'sf_uum_2', grp: 'Implementation', short: 'IMP-002', txt: 'IMP-002: Service Cloud implementation — case management, omni-channel routing', layers: ['app'], type: 'migration' },
  { code: 'sf_uum_3', grp: 'Automation', short: 'AUT-001', txt: 'AUT-001: Process Builder to Flow migration (Process Builder retirement)', layers: ['app'], type: 'upgrade' },
  { code: 'sf_uum_4', grp: 'CPQ', short: 'CPQ-001', txt: 'CPQ-001: CPQ implementation — product catalog, pricing rules, approval matrix', layers: ['app'], type: 'migration' },
  { code: 'sf_uum_5', grp: 'Integration', short: 'INT-001', txt: 'INT-001: MuleSoft/API integration build to ERP and marketing systems', layers: ['app', 'network'], type: 'migration' },
  { code: 'sf_uum_6', grp: 'Data', short: 'DAT-001', txt: 'DAT-001: Legacy CRM data migration via Data Loader / ETL', layers: ['db'], type: 'migration' },
  { code: 'sf_uum_7', grp: 'Security', short: 'SEC-001', txt: 'SEC-001: Permission set and profile redesign for least-privilege access', layers: ['security'], type: 'update' },
  { code: 'sf_uum_8', grp: 'Experience Cloud', short: 'EXP-001', txt: 'EXP-001: Experience Cloud (partner/customer community) rollout', layers: ['app'], type: 'migration' },
];

export const uumTasks = {
  sf_uum_1: [
    { role: 'Salesforce Admin', name: 'Configure sales process, stages, and forecasting categories', dep: 'Business requirements signed off', validate: 'Sales process configured and validated with pilot users', window: 'Working hours', est_hours: 12 },
    { role: 'Salesforce Dev', name: 'Build custom validation rules and lead routing logic', dep: 'Sales process configured', validate: 'Routing tested across all lead source scenarios', window: 'Working hours', est_hours: 16 },
    { role: 'QA Eng', name: 'Run UAT with sales team on core opportunity lifecycle', dep: 'Configuration and routing complete', validate: 'UAT sign-off from sales operations lead', window: 'Working hours', est_hours: 8 },
  ],
  sf_uum_2: [
    { role: 'Salesforce Admin', name: 'Configure case queues, omni-channel routing, and SLAs', dep: 'Service model requirements confirmed', validate: 'Routing configuration tested end-to-end', window: 'Working hours', est_hours: 12 },
    { role: 'Salesforce Dev', name: 'Build Lightning Console layout and macros for agents', dep: 'Routing configuration tested', validate: 'Agent console reviewed and approved by service ops' },
  ],
  sf_uum_3: [
    { role: 'Salesforce Dev', name: 'Inventory all active Process Builder processes', dep: 'Migration project kicked off', validate: 'Full inventory with business logic documented' },
    { role: 'Salesforce Dev', name: 'Rebuild each process as a Flow, test in sandbox', dep: 'Inventory complete', validate: 'Each rebuilt Flow passes functional parity test against original process' },
    { role: 'Salesforce Admin', name: 'Deactivate legacy Process Builder processes after Flow cutover', dep: 'Flow parity confirmed', validate: 'Legacy processes deactivated; no regression in production' },
  ],
  sf_uum_4: [
    { role: 'CPQ Specialist', name: 'Configure product catalog, bundles, and pricing rules', dep: 'Pricing strategy and product catalog finalized', validate: 'Pricing rules tested against representative quote scenarios', window: 'Working hours', est_hours: 20 },
    { role: 'CPQ Specialist', name: 'Build approval matrix and contract generation templates', dep: 'Pricing rules validated', validate: 'Approval flow and contract docs tested end-to-end' },
  ],
  sf_uum_5: [
    { role: 'Integration Architect', name: 'Design integration pattern and auth model (MuleSoft/API)', dep: 'Target systems and data contracts identified', validate: 'Integration design reviewed and approved' },
    { role: 'Integration Architect', name: 'Build and test integration flows in sandbox', dep: 'Design approved', validate: 'Integration flows pass functional and error-handling tests' },
    { role: 'Integration Architect', name: 'Cut over to production integration, monitor first sync cycles', dep: 'Sandbox testing signed off', validate: 'Production sync stable for first 5 cycles with no data loss', window: 'Weekend window', est_hours: 6 },
  ],
  sf_uum_6: [
    { role: 'Data Migration Lead', name: 'Map legacy CRM fields to Salesforce object model', dep: 'Legacy data extracted and profiled', validate: 'Field mapping signed off by business' },
    { role: 'Data Migration Lead', name: 'Run mock load and reconcile record counts', dep: 'Mapping approved', validate: 'Mock load reconciles within tolerance' },
    { role: 'Data Migration Lead', name: 'Execute production cutover load', dep: 'Mock load signed off', validate: 'Production load reconciles; spot-check confirms data integrity', window: 'Weekend window', est_hours: 6 },
  ],
  sf_uum_7: [
    { role: 'Salesforce Security Admin', name: 'Audit current permission sets/profiles against least-privilege model', dep: 'Access review requirement raised', validate: 'Gap list produced' },
    { role: 'Salesforce Security Admin', name: 'Redesign and roll out corrected permission sets', dep: 'Gap list reviewed', validate: 'Redesigned permission sets tested per role; no access regressions' },
  ],
  sf_uum_8: [
    { role: 'Salesforce Admin', name: 'Configure Experience Cloud site, branding, and member access', dep: 'Community requirements and branding guide finalized', validate: 'Site configured and passes internal review' },
    { role: 'Salesforce Dev', name: 'Build custom components and self-service flows for community', dep: 'Site configured', validate: 'Self-service flows tested with pilot external users' },
  ],
};

export const designSections = [
  { key: 'salesCloud', label: 'Sales Cloud Config', owner: 'Salesforce Admin', fields: ['org_edition', 'sales_process', 'lead_routing', 'forecasting_model', 'notes'] },
  { key: 'automation', label: 'Automation & Flows', owner: 'Salesforce Dev', fields: ['flow_migration_status', 'process_builder_count', 'approval_processes', 'notes'] },
  { key: 'integration', label: 'Integration', owner: 'Integration Architect', fields: ['integration_platform', 'api_limits', 'callout_pattern', 'notes'] },
  { key: 'dataManagement', label: 'Data Management', owner: 'Data Migration Lead', fields: ['migration_tool', 'dedupe_rules', 'data_volume', 'notes'] },
  { key: 'security', label: 'Security & Sharing', owner: 'Salesforce Security Admin', fields: ['sharing_model', 'permission_sets', 'field_level_security', 'notes'] },
  { key: 'cpq', label: 'CPQ / Quoting', owner: 'CPQ Specialist', fields: ['pricing_model', 'approval_matrix', 'contract_terms', 'notes'] },
];

export const fieldLabels = {
  org_edition: 'Org Edition', sales_process: 'Sales Process & Stages', lead_routing: 'Lead Routing Rules', forecasting_model: 'Forecasting Model',
  flow_migration_status: 'Process Builder to Flow Migration Status', process_builder_count: 'Remaining Process Builder Count', approval_processes: 'Approval Processes',
  integration_platform: 'Integration Platform (MuleSoft/API)', api_limits: 'API Call Limits & Usage', callout_pattern: 'Callout Pattern (Sync/Async/Bulk)',
  migration_tool: 'Migration Tool (Data Loader/ETL)', dedupe_rules: 'Duplicate/Dedupe Rules', data_volume: 'Data Volume (records)',
  sharing_model: 'Org-Wide Sharing Model', permission_sets: 'Permission Set Design', field_level_security: 'Field-Level Security Matrix',
  pricing_model: 'Pricing Model', approval_matrix: 'Quote Approval Matrix', contract_terms: 'Contract Terms Template',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Sales Cloud', 'Service Cloud', 'Experience Cloud', 'CPQ', 'Marketing Cloud', 'Multi-Cloud'],
  ['Enterprise Edition', 'Unlimited Edition', 'Professional Edition', 'Developer Edition'],
  ['Greenfield', 'Re-implementation', 'Org Merge / Consolidation', 'Phased Rollout'],
  ['Standalone', 'MuleSoft Integrated', 'ERP-Integrated (SAP/Oracle)', 'Multi-System Hub'],
];
