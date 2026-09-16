// SAP Program domain catalog — ECC-to-S/4HANA conversions, greenfield/
// brownfield implementations, and module rollouts.

export const incidents = [
  { code: 'sap_inc_1', grp: 'Basis / Technical', short: 'SAP-001', txt: 'SAP-001: HANA memory pressure causing OOM dumps on production instance', layers: ['db', 'compute'] },
  { code: 'sap_inc_2', grp: 'Basis / Technical', short: 'SAP-002', txt: 'SAP-002: Background job (SM37) queue backlog blocking period-end close', layers: ['app'] },
  { code: 'sap_inc_3', grp: 'Interfaces', short: 'SAP-003', txt: 'SAP-003: IDoc processing failures on EDI interface to 3PL warehouse', layers: ['app', 'network'] },
  { code: 'sap_inc_4', grp: 'Interfaces', short: 'SAP-004', txt: 'SAP-004: PI/PO (or CPI) adapter connection pool exhaustion', layers: ['app'] },
  { code: 'sap_inc_5', grp: 'Security / Authorizations', short: 'SAP-005', txt: 'SAP-005: SoD conflict discovered in production role assignment (GRC audit)', layers: ['security'] },
  { code: 'sap_inc_6', grp: 'Data', short: 'SAP-006', txt: 'SAP-006: Material master data inconsistency post-LSMW load', layers: ['db'] },
  { code: 'sap_inc_7', grp: 'Performance', short: 'SAP-007', txt: 'SAP-007: Long-running ABAP report locking MRP table during business hours', layers: ['app', 'db'] },
  { code: 'sap_inc_8', grp: 'Upgrade / Conversion', short: 'SAP-008', txt: 'SAP-008: Custom code check (ATC) flags 400+ syntax errors ahead of S/4HANA conversion', layers: ['app'] },
];

export const fixes = {
  sap_inc_1: 'Tune HANA memory allocation; identify and kill runaway query.',
  sap_inc_2: 'Re-prioritize job queue; add parallel work processes for close window.',
  sap_inc_3: 'Reprocess failed IDocs after correcting partner profile mapping.',
  sap_inc_4: 'Increase adapter connection pool size; restart affected channel.',
  sap_inc_5: 'Remediate SoD conflict via role split or compensating control.',
  sap_inc_6: 'Correct source data and re-run LSMW load with validation step.',
  sap_inc_7: 'Schedule report for off-peak window; add table lock timeout.',
  sap_inc_8: 'Triage ATC findings by severity; remediate blockers before conversion.',
};

export const incidentFixTasks = {
  sap_inc_1: [
    { role: 'SAP Basis', name: 'Review HANA memory allocation and identify top consumer query', dep: 'OOM dump captured', validate: 'Root query/process identified' },
    { role: 'SAP Basis', name: 'Kill runaway query and adjust workload class limits', dep: 'Root cause identified', validate: 'Memory pressure resolved; no recurrence in 24h' },
  ],
  sap_inc_2: [
    { role: 'SAP Basis', name: 'Review SM37 job queue and identify blocking jobs', dep: 'Close window at risk flagged', validate: 'Blocking job(s) identified' },
    { role: 'SAP Basis', name: 'Re-prioritize / add parallel work processes for close window', dep: 'Blocking jobs identified', validate: 'Job queue drains within close window SLA' },
  ],
  sap_inc_3: [
    { role: 'SAP Integration', name: 'Review failed IDoc status (WE02/WE05) and error segment', dep: 'Interface failure reported', validate: 'Failure category identified (mapping, partner profile, target down)' },
    { role: 'SAP Integration', name: 'Correct mapping/partner profile and reprocess failed IDocs', dep: 'Failure category identified', validate: 'IDocs reprocess successfully; 3PL confirms receipt' },
  ],
  sap_inc_4: [
    { role: 'SAP Integration', name: 'Check adapter connection pool utilization on PI/PO/CPI', dep: 'Interface timeout reported', validate: 'Pool exhaustion confirmed' },
    { role: 'SAP Integration', name: 'Increase pool size and restart affected channel', dep: 'Pool exhaustion confirmed', validate: 'Channel healthy; message backlog clears' },
  ],
  sap_inc_5: [
    { role: 'SAP Security', name: 'Confirm SoD conflict scope from GRC audit finding', dep: 'GRC audit finding received', validate: 'Affected user(s) and conflicting authorizations documented' },
    { role: 'SAP Security', name: 'Remediate via role split or compensating control, get business sign-off', dep: 'Conflict scope documented', validate: 'GRC re-run shows conflict cleared' },
  ],
  sap_inc_6: [
    { role: 'SAP Functional (MM)', name: 'Identify inconsistent material master records from LSMW log', dep: 'Data issue reported', validate: 'Affected material numbers listed' },
    { role: 'SAP Functional (MM)', name: 'Correct source data and re-run load with validation', dep: 'Affected records listed', validate: 'Reload passes validation; no inconsistency remains' },
  ],
  sap_inc_7: [
    { role: 'SAP ABAP Dev', name: 'Identify long-running report and table lock scope', dep: 'MRP lock reported', validate: 'Offending report and lock table identified' },
    { role: 'SAP Basis', name: 'Reschedule report to off-peak and add lock timeout', dep: 'Offending report identified', validate: 'MRP runs without contention next cycle' },
  ],
  sap_inc_8: [
    { role: 'SAP ABAP Dev', name: 'Triage ATC findings by severity (error/warning/info)', dep: 'ATC check complete', validate: 'Findings categorized; blockers separated from warnings' },
    { role: 'SAP ABAP Dev', name: 'Remediate blocking custom code errors', dep: 'Findings categorized', validate: 'Re-run ATC shows zero conversion blockers' },
  ],
};

export const uumItems = [
  { code: 'sap_uum_1', grp: 'Conversion', short: 'CNV-001', txt: 'CNV-001: ECC 6.0 to S/4HANA 2023 brownfield conversion (system conversion)', layers: ['app', 'db'], type: 'migration' },
  { code: 'sap_uum_2', grp: 'Conversion', short: 'CNV-002', txt: 'CNV-002: Custom code remediation (ATC / SPDD / SPAU)', layers: ['app'], type: 'upgrade' },
  { code: 'sap_uum_3', grp: 'Basis', short: 'BAS-001', txt: 'BAS-001: HANA database revision upgrade (SPS stack update)', layers: ['db'], type: 'update' },
  { code: 'sap_uum_4', grp: 'Rollout', short: 'ROL-001', txt: 'ROL-001: New country/legal entity template rollout', layers: ['app'], type: 'migration' },
  { code: 'sap_uum_5', grp: 'Integration', short: 'INT-001', txt: 'INT-001: Migrate PI/PO interfaces to SAP Integration Suite (CPI)', layers: ['app', 'network'], type: 'migration' },
  { code: 'sap_uum_6', grp: 'Security', short: 'SEC-001', txt: 'SEC-001: Role redesign for SoD compliance ahead of go-live', layers: ['security'], type: 'update' },
  { code: 'sap_uum_7', grp: 'Data', short: 'DAT-001', txt: 'DAT-001: Master/transactional data migration via SAP Migration Cockpit (LTMC)', layers: ['db'], type: 'migration' },
  { code: 'sap_uum_8', grp: 'Fiori', short: 'FIO-001', txt: 'FIO-001: Fiori Launchpad rollout replacing SAP GUI transactions', layers: ['app'], type: 'upgrade' },
];

export const uumTasks = {
  sap_uum_1: [
    { role: 'SAP Basis', name: 'Run pre-conversion readiness check (Maintenance Planner, SUM)', dep: 'Target S/4HANA release and add-on compatibility confirmed', validate: 'Readiness check passes with no blockers', window: 'Working hours', est_hours: 8 },
    { role: 'SAP Functional Lead', name: 'Execute sandbox conversion and functional validation', dep: 'Readiness check passed', validate: 'Sandbox conversion complete; core processes validated', window: 'Working hours', est_hours: 24 },
    { role: 'SAP Basis', name: 'Execute production conversion (SUM DMO)', dep: 'Sandbox and quality conversions signed off', validate: 'Production system on target release; smoke test passes', window: 'Weekend window', est_hours: 16 },
  ],
  sap_uum_2: [
    { role: 'SAP ABAP Dev', name: 'Run ATC check against target release simplification list', dep: 'Custom code inventory available', validate: 'ATC report generated with severity breakdown', window: 'Working hours', est_hours: 6 },
    { role: 'SAP ABAP Dev', name: 'Remediate flagged custom code', dep: 'ATC report reviewed', validate: 'Zero blocking findings on re-run', window: 'Working hours', est_hours: 40 },
    { role: 'SAP ABAP Dev', name: 'Complete SPDD/SPAU adjustments post-conversion', dep: 'Conversion technical phase complete', validate: 'All modification adjustments confirmed', window: 'Working hours', est_hours: 8 },
  ],
  sap_uum_3: [
    { role: 'SAP Basis', name: 'Download target SPS stack and review release notes for breaking changes', dep: 'Maintenance window scheduled', validate: 'Breaking-change review complete', window: 'Working hours', est_hours: 3 },
    { role: 'SAP Basis', name: 'Apply SPS update in non-production, validate', dep: 'Breaking-change review complete', validate: 'Non-prod on target SPS; core jobs run clean', window: 'Working hours', est_hours: 4 },
    { role: 'SAP Basis', name: 'Apply SPS update in production', dep: 'Non-prod validated', validate: 'Production on target SPS; post-checks pass', window: 'Weekend window', est_hours: 4 },
  ],
  sap_uum_4: [
    { role: 'SAP Functional Lead', name: 'Configure company code / legal entity per template', dep: 'Country-specific legal requirements gathered', validate: 'Configuration matches template and local statutory needs', est_hours: 16 },
    { role: 'SAP Functional Lead', name: 'Run localization tests (tax, statutory reporting)', dep: 'Configuration complete', validate: 'Local statutory test cases pass' },
  ],
  sap_uum_5: [
    { role: 'SAP Integration', name: 'Model existing PI/PO interface in Integration Suite', dep: 'Interface inventory documented', validate: 'iFlow modeled and unit tested' },
    { role: 'SAP Integration', name: 'Cut over interface traffic to CPI, monitor in parallel', dep: 'iFlow validated in non-prod', validate: 'Message success rate matches or exceeds legacy for 5 days' },
  ],
  sap_uum_6: [
    { role: 'SAP Security', name: 'Run SoD risk analysis against current role matrix', dep: 'GRC access control tool available', validate: 'Conflict list produced and prioritized' },
    { role: 'SAP Security', name: 'Redesign conflicting roles and get business owner sign-off', dep: 'Conflict list prioritized', validate: 'Redesigned roles pass SoD re-analysis' },
  ],
  sap_uum_7: [
    { role: 'SAP Data Migration Lead', name: 'Map source data objects to Migration Cockpit templates', dep: 'Source data extracted and profiled', validate: 'Mapping signed off by functional leads' },
    { role: 'SAP Data Migration Lead', name: 'Execute mock load and reconcile record counts', dep: 'Mapping approved', validate: 'Mock load reconciles within tolerance' },
    { role: 'SAP Data Migration Lead', name: 'Execute production cutover load', dep: 'Mock load signed off', validate: 'Production load reconciles; business validates key records', window: 'Weekend window', est_hours: 8 },
  ],
  sap_uum_8: [
    { role: 'SAP Fiori Dev', name: 'Configure Fiori Launchpad groups/catalogs per role', dep: 'Role-to-app mapping agreed with business', validate: 'Launchpad tested for pilot user group' },
    { role: 'SAP Fiori Dev', name: 'Roll out to full user base with training materials', dep: 'Pilot feedback incorporated', validate: 'Adoption tracked; legacy GUI transaction usage declining' },
  ],
};

export const designSections = [
  { key: 'basis', label: 'Basis / Technical', owner: 'SAP Basis', fields: ['hana_sizing', 'sap_release', 'sizing_sapsproduct', 'ha_dr_setup', 'notes'] },
  { key: 'functional', label: 'Functional Scope', owner: 'SAP Functional Lead', fields: ['modules_in_scope', 'org_structure', 'fit_gap_items', 'notes'] },
  { key: 'security', label: 'Security & Authorizations', owner: 'SAP Security', fields: ['role_model', 'sod_ruleset', 'grc_tool', 'notes'] },
  { key: 'integration', label: 'Integration', owner: 'SAP Integration', fields: ['interface_inventory', 'integration_platform', 'idoc_monitoring', 'notes'] },
  { key: 'dataMigration', label: 'Data Migration', owner: 'SAP Data Migration Lead', fields: ['migration_tool', 'object_scope', 'cutover_sequence', 'notes'] },
  { key: 'customCode', label: 'Custom Code', owner: 'SAP ABAP Dev', fields: ['custom_object_count', 'atc_baseline', 'remediation_plan', 'notes'] },
];

export const fieldLabels = {
  hana_sizing: 'HANA Sizing', sap_release: 'Target SAP Release', sizing_sapsproduct: 'SAPS Sizing', ha_dr_setup: 'HA/DR Setup',
  modules_in_scope: 'Modules in Scope', org_structure: 'Org Structure (Company Codes/Plants)', fit_gap_items: 'Fit-Gap Items',
  role_model: 'Role Model', sod_ruleset: 'SoD Ruleset', grc_tool: 'GRC Tool',
  interface_inventory: 'Interface Inventory', integration_platform: 'Integration Platform (PI/PO/CPI)', idoc_monitoring: 'IDoc Monitoring Setup',
  migration_tool: 'Migration Tool (LTMC/LSMW/LTMOM)', object_scope: 'Object Scope', cutover_sequence: 'Cutover Sequence',
  custom_object_count: 'Custom Object Count', atc_baseline: 'ATC Baseline Findings', remediation_plan: 'Remediation Plan',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['SAP ECC 6.0', 'SAP S/4HANA 2023', 'SAP S/4HANA Cloud Public Edition', 'SAP S/4HANA Cloud Private Edition', 'SAP Business One'],
  ['On-Premise', 'RISE with SAP', 'Cloud (Hyperscaler IaaS)', 'Cloud (SAP-managed)'],
  ['Greenfield', 'Brownfield (System Conversion)', 'Bluefield (Selective Data Transition)', 'Hybrid'],
  ['Finance (FI/CO)', 'Supply Chain (MM/SD/PP)', 'HR (HCM/SuccessFactors)', 'Full Scope (All Modules)'],
];
