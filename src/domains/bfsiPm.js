// Banking / Financial Services domain catalog — core banking, payments,
// and regulated financial infrastructure change.

export const incidents = [
  { code: 'bfsi_inc_1', grp: 'Payments', short: 'BFSI-001', txt: 'BFSI-001: ISO 8583 authorization switch timeout causing declined transactions', layers: ['app', 'network'] },
  { code: 'bfsi_inc_2', grp: 'Payments', short: 'BFSI-002', txt: 'BFSI-002: SWIFT/ISO 20022 message queue backlog delaying wire settlement', layers: ['app'] },
  { code: 'bfsi_inc_3', grp: 'Core Banking', short: 'BFSI-003', txt: 'BFSI-003: End-of-day batch (EOD) overrun blocking next-day account posting', layers: ['app', 'db'] },
  { code: 'bfsi_inc_4', grp: 'Core Banking', short: 'BFSI-004', txt: 'BFSI-004: Interest accrual calculation discrepancy flagged in reconciliation', layers: ['app', 'db'] },
  { code: 'bfsi_inc_5', grp: 'Compliance', short: 'BFSI-005', txt: 'BFSI-005: AML transaction monitoring rule generating excessive false positives', layers: ['app'] },
  { code: 'bfsi_inc_6', grp: 'Compliance', short: 'BFSI-006', txt: 'BFSI-006: PCI-DSS scope violation — cardholder data found outside segmented zone', layers: ['security', 'network'] },
  { code: 'bfsi_inc_7', grp: 'Channel', short: 'BFSI-007', txt: 'BFSI-007: Mobile banking API gateway rate-limiting legitimate peak-hour traffic', layers: ['app', 'network'] },
  { code: 'bfsi_inc_8', grp: 'Fraud & Risk', short: 'BFSI-008', txt: 'BFSI-008: Real-time fraud scoring engine latency exceeds transaction SLA', layers: ['app'] },
];

export const fixes = {
  bfsi_inc_1: 'Increase switch timeout threshold; failover to backup authorization host.',
  bfsi_inc_2: 'Scale message processing workers; clear backlog under monitored batch.',
  bfsi_inc_3: 'Identify long-running EOD job step; parallelize or reschedule.',
  bfsi_inc_4: 'Correct accrual calculation logic; re-run and reconcile affected accounts.',
  bfsi_inc_5: 'Tune AML rule thresholds with compliance sign-off; re-baseline false-positive rate.',
  bfsi_inc_6: 'Remove cardholder data from out-of-scope zone; re-segment network.',
  bfsi_inc_7: 'Raise rate limit for verified traffic pattern; add burst allowance.',
  bfsi_inc_8: 'Optimize fraud scoring query path; add caching for reference data.',
};

export const incidentFixTasks = {
  bfsi_inc_1: [
    { role: 'Payments Eng', name: 'Review switch logs for timeout pattern and affected acquirer/issuer', dep: 'Decline rate spike detected', validate: 'Timeout root cause and scope identified' },
    { role: 'Payments Eng', name: 'Adjust timeout threshold and confirm failover host healthy', dep: 'Root cause identified', validate: 'Decline rate returns to baseline' },
  ],
  bfsi_inc_2: [
    { role: 'Payments Eng', name: 'Check SWIFT/ISO 20022 queue depth and processing rate', dep: 'Settlement delay reported', validate: 'Backlog size and growth rate quantified' },
    { role: 'Payments Eng', name: 'Scale processing workers and clear backlog', dep: 'Backlog quantified', validate: 'Queue depth returns to normal; settlements caught up' },
  ],
  bfsi_inc_3: [
    { role: 'Core Banking Ops', name: 'Identify long-running EOD job step from batch log', dep: 'EOD overrun detected', validate: 'Blocking step identified' },
    { role: 'Core Banking Ops', name: 'Parallelize or reschedule blocking step, rerun EOD', dep: 'Blocking step identified', validate: 'EOD completes within window; next-day posting unblocked' },
  ],
  bfsi_inc_4: [
    { role: 'Core Banking Ops', name: 'Isolate affected accounts from reconciliation report', dep: 'Discrepancy flagged', validate: 'Affected account list and discrepancy pattern documented' },
    { role: 'Core Banking Dev', name: 'Correct accrual logic and re-run for affected accounts', dep: 'Affected accounts documented', validate: 'Re-run reconciles cleanly; correction approved by Finance' },
  ],
  bfsi_inc_5: [
    { role: 'Compliance Analyst', name: 'Analyze false-positive rate and pattern for the flagged rule', dep: 'Excessive alerts reported', validate: 'False-positive driver identified' },
    { role: 'Compliance Analyst', name: 'Tune rule threshold with compliance officer sign-off', dep: 'Driver identified', validate: 'False-positive rate reduced; true-positive detection unaffected' },
  ],
  bfsi_inc_6: [
    { role: 'PCI Compliance Lead', name: 'Confirm scope of cardholder data found outside segmented zone', dep: 'Scan finding reported', validate: 'Exposure scope and duration documented' },
    { role: 'Network Security', name: 'Remove/relocate data and re-segment network per PCI-DSS scope', dep: 'Exposure scope documented', validate: 'Re-scan confirms data no longer in unsegmented zone' },
  ],
  bfsi_inc_7: [
    { role: 'API Platform Eng', name: 'Confirm rate-limit is blocking legitimate peak traffic, not an attack', dep: '429 error spike reported', validate: 'Traffic legitimacy confirmed' },
    { role: 'API Platform Eng', name: 'Raise rate limit / add burst allowance for verified clients', dep: 'Traffic confirmed legitimate', validate: '429 error rate returns to baseline' },
  ],
  bfsi_inc_8: [
    { role: 'Fraud Eng', name: 'Profile fraud scoring engine latency by call path', dep: 'SLA breach detected', validate: 'Slow path/query identified' },
    { role: 'Fraud Eng', name: 'Optimize query and add reference-data caching', dep: 'Slow path identified', validate: 'Scoring latency back within SLA' },
  ],
};

export const uumItems = [
  { code: 'bfsi_uum_1', grp: 'Core Banking', short: 'CBS-001', txt: 'CBS-001: Core banking system version upgrade (major release)', layers: ['app', 'db'], type: 'upgrade' },
  { code: 'bfsi_uum_2', grp: 'Payments', short: 'PAY-001', txt: 'PAY-001: ISO 20022 migration for cross-border payments (SWIFT MX)', layers: ['app'], type: 'migration' },
  { code: 'bfsi_uum_3', grp: 'Payments', short: 'PAY-002', txt: 'PAY-002: New card scheme/acquirer onboarding', layers: ['app', 'network'], type: 'migration' },
  { code: 'bfsi_uum_4', grp: 'Compliance', short: 'CMP-001', txt: 'CMP-001: AML/KYC engine upgrade with enhanced screening rules', layers: ['app'], type: 'upgrade' },
  { code: 'bfsi_uum_5', grp: 'Compliance', short: 'CMP-002', txt: 'CMP-002: PCI-DSS v4 remediation program across cardholder data environment', layers: ['security', 'network'], type: 'update' },
  { code: 'bfsi_uum_6', grp: 'Channel', short: 'CHN-001', txt: 'CHN-001: Mobile banking API gateway migration to new platform', layers: ['app', 'network'], type: 'migration' },
  { code: 'bfsi_uum_7', grp: 'Risk', short: 'RSK-001', txt: 'RSK-001: Real-time fraud scoring engine deployment', layers: ['app'], type: 'migration' },
  { code: 'bfsi_uum_8', grp: 'Data', short: 'DAT-001', txt: 'DAT-001: Regulatory reporting data mart rebuild (Basel/CCAR feeds)', layers: ['db'], type: 'migration' },
];

export const uumTasks = {
  bfsi_uum_1: [
    { role: 'Core Banking Ops', name: 'Run upgrade readiness assessment against current customization footprint', dep: 'Target release confirmed', validate: 'Readiness assessment signed off', window: 'Working hours', est_hours: 12 },
    { role: 'Core Banking Ops', name: 'Execute upgrade in UAT and run full regression (incl. EOD batch)', dep: 'Readiness assessment passed', validate: 'UAT regression passes; EOD batch completes on time', window: 'Working hours', est_hours: 24 },
    { role: 'Core Banking Ops', name: 'Execute production upgrade in approved change window', dep: 'UAT signed off; CAB approved', validate: 'Production on target version; smoke test and EOD pass', window: 'Weekend window', est_hours: 12 },
  ],
  bfsi_uum_2: [
    { role: 'Payments Eng', name: 'Map legacy MT message fields to ISO 20022 MX schema', dep: 'Target MX schema version confirmed', validate: 'Field mapping signed off by Payments Ops' },
    { role: 'Payments Eng', name: 'Run parallel MT/MX processing and reconcile message-for-message', dep: 'Mapping implemented', validate: 'Reconciliation shows 100% match for parallel run period' },
    { role: 'Payments Eng', name: 'Cut over to MX-only processing', dep: 'Parallel run signed off', validate: 'MX processing stable; no reconciliation breaks post-cutover' },
  ],
  bfsi_uum_3: [
    { role: 'Payments Eng', name: 'Complete scheme/acquirer certification test suite', dep: 'Scheme technical spec received', validate: 'Certification test suite passes' },
    { role: 'Payments Eng', name: 'Go live with new scheme in production, monitor first settlement cycle', dep: 'Certification complete; scheme approval received', validate: 'First settlement cycle reconciles cleanly' },
  ],
  bfsi_uum_4: [
    { role: 'Compliance Analyst', name: 'Define enhanced screening rule set with compliance officer', dep: 'Regulatory requirement documented', validate: 'Rule set approved by Compliance' },
    { role: 'Compliance Analyst', name: 'Deploy and tune rules in shadow mode before enforcement', dep: 'Rule set approved', validate: 'Shadow-mode false-positive rate acceptable' },
    { role: 'Compliance Analyst', name: 'Enable rules in enforcement mode', dep: 'Shadow mode signed off', validate: 'Enforcement live; screening SLA met' },
  ],
  bfsi_uum_5: [
    { role: 'PCI Compliance Lead', name: 'Run gap assessment against PCI-DSS v4 requirements', dep: 'Current CDE scope documented', validate: 'Gap list produced and prioritized' },
    { role: 'Network Security', name: 'Remediate segmentation and access-control gaps', dep: 'Gap list prioritized', validate: 'Segmentation re-tested and confirmed' },
    { role: 'PCI Compliance Lead', name: 'Complete QSA assessment for v4 attestation', dep: 'Remediation complete', validate: 'QSA issues v4 Attestation of Compliance' },
  ],
  bfsi_uum_6: [
    { role: 'API Platform Eng', name: 'Stand up new gateway platform in parallel with legacy', dep: 'Target platform provisioned', validate: 'New gateway passes functional and load test' },
    { role: 'API Platform Eng', name: 'Migrate client traffic in phased cohorts', dep: 'New gateway validated', validate: 'Each cohort migrates with no SLA regression' },
  ],
  bfsi_uum_7: [
    { role: 'Fraud Eng', name: 'Deploy scoring engine in shadow mode alongside legacy rules', dep: 'Model validated by Risk team', validate: 'Shadow-mode scoring compared against legacy for accuracy' },
    { role: 'Fraud Eng', name: 'Cut traffic to new engine with legacy as fallback', dep: 'Shadow mode signed off by Risk', validate: 'New engine live; fraud catch rate at or above baseline' },
  ],
  bfsi_uum_8: [
    { role: 'Regulatory Reporting Analyst', name: 'Map source systems to new regulatory data mart schema', dep: 'Regulatory feed specification confirmed', validate: 'Mapping signed off by Regulatory Reporting' },
    { role: 'Regulatory Reporting Analyst', name: 'Run parallel reporting cycle and reconcile against legacy submission', dep: 'Mapping implemented', validate: 'Parallel cycle reconciles within tolerance' },
  ],
};

export const designSections = [
  { key: 'coreBanking', label: 'Core Banking', owner: 'Core Banking Ops', fields: ['cbs_platform', 'batch_window', 'account_types_in_scope', 'notes'] },
  { key: 'payments', label: 'Payments', owner: 'Payments Eng', fields: ['payment_rails', 'switch_provider', 'settlement_window', 'notes'] },
  { key: 'compliance', label: 'Compliance & Regulatory', owner: 'Compliance Analyst', fields: ['regulatory_framework', 'aml_engine', 'reporting_cadence', 'notes'] },
  { key: 'security', label: 'Security', owner: 'PCI Compliance Lead', fields: ['pci_scope', 'encryption_standard', 'key_management', 'notes'] },
  { key: 'channel', label: 'Digital Channel', owner: 'API Platform Eng', fields: ['channel_type', 'api_gateway', 'auth_method', 'notes'] },
  { key: 'risk', label: 'Risk & Fraud', owner: 'Fraud Eng', fields: ['fraud_engine', 'scoring_sla', 'model_governance', 'notes'] },
];

export const fieldLabels = {
  cbs_platform: 'Core Banking Platform', batch_window: 'EOD Batch Window', account_types_in_scope: 'Account Types in Scope',
  payment_rails: 'Payment Rails (ACH/RTGS/SWIFT/Card)', switch_provider: 'Switch Provider', settlement_window: 'Settlement Window',
  regulatory_framework: 'Regulatory Framework', aml_engine: 'AML/KYC Engine', reporting_cadence: 'Regulatory Reporting Cadence',
  pci_scope: 'PCI-DSS Scope', encryption_standard: 'Encryption Standard', key_management: 'Key Management',
  channel_type: 'Channel Type', api_gateway: 'API Gateway', auth_method: 'Authentication Method',
  fraud_engine: 'Fraud Scoring Engine', scoring_sla: 'Scoring Latency SLA', model_governance: 'Model Governance Process',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Retail Bank', 'Commercial Bank', 'Credit Union', 'Payments Processor', 'Fintech / Neobank'],
  ['Temenos T24/Transact', 'FIS Profile', 'Oracle FLEXCUBE', 'Finacle', 'Custom / In-House'],
  ['US (Federal Reserve / OCC)', 'EU (ECB / PSD2)', 'UK (FCA / PRA)', 'India (RBI)', 'APAC (Multi-Jurisdiction)'],
  ['Branch / Teller', 'Online Banking', 'Mobile Banking', 'Card / POS', 'API / Open Banking'],
];
