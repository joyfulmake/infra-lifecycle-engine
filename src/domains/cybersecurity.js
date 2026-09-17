// Cybersecurity PM domain catalog — SOC operations, vulnerability
// management, penetration testing engagements, incident response,
// zero-trust rollout, and compliance audit programs. Shape mirrors infra's
// ALL_INC/ALL_UUM/getRealTasks/DESIGN_SECTIONS exactly (see
// src/domains/applyDomain.js for how this plugs in).

export const incidents = [
  { code: 'cyb_inc_1', grp: 'SOC', short: 'CYB-001', txt: 'CYB-001: SIEM ingestion pipeline dropping logs from critical data sources', layers: ['app', 'network'] },
  { code: 'cyb_inc_2', grp: 'SOC', short: 'CYB-002', txt: 'CYB-002: Confirmed phishing campaign — multiple users clicked malicious link', layers: ['app'] },
  { code: 'cyb_inc_3', grp: 'Endpoint', short: 'CYB-003', txt: 'CYB-003: EDR agent reports ransomware-like encryption behavior on endpoint', layers: ['compute'] },
  { code: 'cyb_inc_4', grp: 'Identity', short: 'CYB-004', txt: 'CYB-004: Anomalous privileged account activity outside normal hours/geo', layers: ['security'] },
  { code: 'cyb_inc_5', grp: 'Vulnerability', short: 'CYB-005', txt: 'CYB-005: Critical CVE actively exploited in the wild affecting internet-facing asset', layers: ['app', 'network'] },
  { code: 'cyb_inc_6', grp: 'Third-Party', short: 'CYB-006', txt: 'CYB-006: Third-party vendor breach disclosure — shared credentials/API keys at risk', layers: ['security'] },
  { code: 'cyb_inc_7', grp: 'Data Loss', short: 'CYB-007', txt: 'CYB-007: DLP alert — large volume of sensitive data egress to personal cloud storage', layers: ['app', 'network'] },
  { code: 'cyb_inc_8', grp: 'Zero Trust', short: 'CYB-008', txt: 'CYB-008: Zero-trust policy engine misconfiguration blocking legitimate service-to-service traffic', layers: ['network', 'security'] },
];

export const fixes = {
  cyb_inc_1: 'Restore log forwarders/collectors; backfill gap from source retention where possible.',
  cyb_inc_2: 'Quarantine affected accounts, force password reset, block malicious domain.',
  cyb_inc_3: 'Isolate endpoint from network immediately; begin forensic image before remediation.',
  cyb_inc_4: 'Suspend account pending investigation; verify MFA and session tokens revoked.',
  cyb_inc_5: 'Apply vendor patch or WAF virtual patch immediately; verify exploit no longer functions.',
  cyb_inc_6: 'Rotate all shared credentials/API keys with the vendor immediately.',
  cyb_inc_7: 'Block egress destination; identify and interview involved user; assess data sensitivity.',
  cyb_inc_8: 'Roll back policy change; re-apply with corrected service identity rules.',
};

export const incidentFixTasks = {
  cyb_inc_1: [
    { role: 'SOC Analyst', name: 'Identify affected log sources and last-known-good ingestion timestamp', dep: 'Log gap detected in SIEM', validate: 'Affected sources and outage window documented' },
    { role: 'SOC Analyst', name: 'Restore forwarders/collectors and backfill from source retention', dep: 'Outage window documented', validate: 'Ingestion resumed; backfill reconciled where source retention allows' },
  ],
  cyb_inc_2: [
    { role: 'SOC Analyst', name: 'Identify all recipients and click-through users from phishing campaign', dep: 'Phishing report confirmed malicious', validate: 'Full list of affected users compiled' },
    { role: 'IR Lead', name: 'Quarantine affected accounts, reset credentials, block malicious domain/IOC', dep: 'Affected users identified', validate: 'Accounts secured; IOC blocked at email gateway and firewall' },
  ],
  cyb_inc_3: [
    { role: 'IR Lead', name: 'Isolate affected endpoint from network via EDR containment', dep: 'Ransomware-like behavior alerted', validate: 'Endpoint isolated; lateral spread confirmed stopped' },
    { role: 'Forensics Analyst', name: 'Capture forensic image before any remediation', dep: 'Endpoint isolated', validate: 'Forensic image captured and hashed for chain of custody' },
  ],
  cyb_inc_4: [
    { role: 'SOC Analyst', name: 'Correlate account activity against baseline (geo, hours, resources accessed)', dep: 'Anomaly alert fired', validate: 'Anomalous activity confirmed as out-of-baseline' },
    { role: 'IAM Admin', name: 'Suspend account and revoke active sessions/tokens', dep: 'Anomaly confirmed', validate: 'Account suspended; all sessions revoked; MFA re-enrollment required' },
  ],
  cyb_inc_5: [
    { role: 'Vulnerability Analyst', name: 'Confirm CVE applicability and exploitation evidence against internet-facing asset', dep: 'Active exploitation advisory received', validate: 'Asset confirmed vulnerable and exposed' },
    { role: 'Security Eng', name: 'Apply vendor patch or WAF virtual patch immediately', dep: 'Asset confirmed exposed', validate: 'Exploit attempt no longer succeeds in re-test' },
  ],
  cyb_inc_6: [
    { role: 'Third-Party Risk Analyst', name: 'Confirm scope of vendor breach and which credentials/keys are shared', dep: 'Vendor breach disclosure received', validate: 'Affected credentials/keys enumerated' },
    { role: 'Security Eng', name: 'Rotate all affected shared credentials and API keys', dep: 'Affected credentials enumerated', validate: 'All credentials rotated; old credentials confirmed revoked' },
  ],
  cyb_inc_7: [
    { role: 'SOC Analyst', name: 'Review DLP alert detail — data classification, volume, destination', dep: 'DLP alert fired', validate: 'Data sensitivity and destination confirmed' },
    { role: 'IR Lead', name: 'Block egress destination and interview involved user', dep: 'Sensitivity confirmed', validate: 'Destination blocked; user interview documented; scope of exposure assessed' },
  ],
  cyb_inc_8: [
    { role: 'Security Eng', name: 'Identify policy change that broke legitimate service-to-service traffic', dep: 'Traffic blocking reported', validate: 'Offending policy rule identified' },
    { role: 'Security Eng', name: 'Roll back and re-apply policy with corrected service identity rules', dep: 'Offending rule identified', validate: 'Legitimate traffic restored; policy re-tested against deny-by-default posture' },
  ],
};

export const uumItems = [
  { code: 'cyb_uum_1', grp: 'SOC', short: 'SEC-001', txt: 'SEC-001: SIEM platform deployment and use-case onboarding', layers: ['app'], type: 'migration' },
  { code: 'cyb_uum_2', grp: 'Vulnerability Management', short: 'SEC-002', txt: 'SEC-002: Vulnerability management program launch (scanning + SLA remediation)', layers: ['app', 'compute'], type: 'migration' },
  { code: 'cyb_uum_3', grp: 'Endpoint', short: 'SEC-003', txt: 'SEC-003: EDR/XDR rollout across the endpoint fleet', layers: ['compute'], type: 'migration' },
  { code: 'cyb_uum_4', grp: 'Zero Trust', short: 'SEC-004', txt: 'SEC-004: Zero-trust network access (ZTNA) rollout replacing legacy VPN', layers: ['network', 'security'], type: 'migration' },
  { code: 'cyb_uum_5', grp: 'Penetration Testing', short: 'SEC-005', txt: 'SEC-005: Annual external/internal penetration test engagement', layers: ['app', 'network'], type: 'update' },
  { code: 'cyb_uum_6', grp: 'Awareness', short: 'SEC-006', txt: 'SEC-006: Security awareness training program rollout (phishing simulation)', layers: ['app'], type: 'update' },
  { code: 'cyb_uum_7', grp: 'Third-Party Risk', short: 'SEC-007', txt: 'SEC-007: Third-party/vendor risk assessment program launch', layers: ['security'], type: 'migration' },
  { code: 'cyb_uum_8', grp: 'Compliance', short: 'SEC-008', txt: 'SEC-008: SOC 2 Type II / ISO 27001 certification audit program', layers: ['security'], type: 'update' },
];

export const uumTasks = {
  cyb_uum_1: [
    { role: 'SOC Lead', name: 'Onboard priority log sources (identity, network, endpoint, cloud)', dep: 'SIEM platform provisioned', validate: 'Priority sources ingesting and normalized correctly', window: 'Working hours', est_hours: 12 },
    { role: 'SOC Analyst', name: 'Build and tune detection use-cases against MITRE ATT&CK coverage', dep: 'Priority sources onboarded', validate: 'Use-cases fire correctly in purple-team validation', window: 'Working hours', est_hours: 16 },
    { role: 'SOC Lead', name: 'Establish on-call rotation and escalation runbooks', dep: 'Use-cases validated', validate: 'Runbooks documented; first on-call rotation live' },
  ],
  cyb_uum_2: [
    { role: 'Vulnerability Analyst', name: 'Deploy scanning tooling across internal and external asset scope', dep: 'Asset inventory confirmed', validate: 'Full scope scanning on schedule', window: 'Working hours', est_hours: 8 },
    { role: 'Vulnerability Analyst', name: 'Define remediation SLAs by severity with asset owners', dep: 'Scanning live', validate: 'SLA policy agreed and published' },
    { role: 'Vulnerability Analyst', name: 'Run first full remediation cycle and track SLA compliance', dep: 'SLA policy published', validate: 'First cycle SLA compliance rate measured and reported' },
  ],
  cyb_uum_3: [
    { role: 'Security Eng', name: 'Pilot EDR/XDR agent on a representative endpoint group', dep: 'Tool selected and licensed', validate: 'Pilot group reports healthy telemetry with no performance regression', window: 'Working hours', est_hours: 6 },
    { role: 'Security Eng', name: 'Roll out agent fleet-wide in managed waves', dep: 'Pilot signed off', validate: '95%+ fleet coverage with healthy agent status' },
  ],
  cyb_uum_4: [
    { role: 'Security Eng', name: 'Design ZTNA policy model (identity, device posture, least-privilege access)', dep: 'Application/service inventory documented', validate: 'Policy model peer-reviewed' },
    { role: 'Security Eng', name: 'Migrate pilot user group from VPN to ZTNA', dep: 'Policy model approved', validate: 'Pilot group productive on ZTNA with no access regressions' },
    { role: 'Security Eng', name: 'Migrate remaining users and decommission legacy VPN', dep: 'Pilot signed off', validate: 'All users migrated; VPN decommissioned' },
  ],
  cyb_uum_5: [
    { role: 'Pentest Lead', name: 'Scope engagement and confirm rules of engagement with target owners', dep: 'Engagement scheduled', validate: 'Rules of engagement signed by all stakeholders' },
    { role: 'Pentest Lead', name: 'Execute testing and deliver findings report', dep: 'Rules of engagement signed', validate: 'Findings report delivered with severity ratings', window: 'Working hours', est_hours: 40 },
    { role: 'Security Eng', name: 'Remediate critical/high findings and confirm with retest', dep: 'Findings report delivered', validate: 'Retest confirms critical/high findings resolved' },
  ],
  cyb_uum_6: [
    { role: 'Security Awareness Lead', name: 'Launch baseline phishing simulation to measure current click rate', dep: 'Training platform provisioned', validate: 'Baseline click-rate measured' },
    { role: 'Security Awareness Lead', name: 'Roll out training modules and run recurring simulations', dep: 'Baseline measured', validate: 'Click rate trending down over successive simulations' },
  ],
  cyb_uum_7: [
    { role: 'Third-Party Risk Analyst', name: 'Build vendor risk questionnaire and tiering model', dep: 'Vendor inventory compiled', validate: 'Questionnaire and tiering model approved by Security leadership' },
    { role: 'Third-Party Risk Analyst', name: 'Run initial assessment cycle across top-tier vendors', dep: 'Questionnaire approved', validate: 'Top-tier vendors assessed; risk register populated' },
  ],
  cyb_uum_8: [
    { role: 'Compliance Analyst', name: 'Run gap assessment against target framework controls', dep: 'Target certification confirmed (SOC 2 / ISO 27001)', validate: 'Gap list produced and prioritized' },
    { role: 'Compliance Analyst', name: 'Remediate control gaps and collect evidence', dep: 'Gap list prioritized', validate: 'Evidence collected for every in-scope control' },
    { role: 'Compliance Analyst', name: 'Complete external auditor assessment', dep: 'Evidence collection complete', validate: 'Auditor issues certification report' },
  ],
};

export const designSections = [
  { key: 'soc', label: 'SOC Operations', owner: 'SOC Lead', fields: ['siem_platform', 'log_sources', 'detection_coverage', 'oncall_model', 'notes'] },
  { key: 'vulnerability', label: 'Vulnerability Management', owner: 'Vulnerability Analyst', fields: ['scanning_tool', 'scan_scope', 'remediation_sla', 'notes'] },
  { key: 'endpoint', label: 'Endpoint Security', owner: 'Security Eng', fields: ['edr_platform', 'fleet_coverage_target', 'isolation_policy', 'notes'] },
  { key: 'identity', label: 'Identity & Zero Trust', owner: 'Security Eng', fields: ['ztna_platform', 'mfa_policy', 'privileged_access_model', 'notes'] },
  { key: 'compliance', label: 'Compliance & Audit', owner: 'Compliance Analyst', fields: ['target_frameworks', 'audit_cadence', 'evidence_repository', 'notes'] },
  { key: 'thirdParty', label: 'Third-Party Risk', owner: 'Third-Party Risk Analyst', fields: ['vendor_tiering_model', 'assessment_cadence', 'notes'] },
];

export const fieldLabels = {
  siem_platform: 'SIEM Platform', log_sources: 'Log Sources in Scope', detection_coverage: 'Detection Coverage (MITRE ATT&CK)', oncall_model: 'SOC On-Call Model',
  scanning_tool: 'Vulnerability Scanning Tool', scan_scope: 'Scan Scope', remediation_sla: 'Remediation SLA by Severity',
  edr_platform: 'EDR/XDR Platform', fleet_coverage_target: 'Fleet Coverage Target', isolation_policy: 'Auto-Isolation Policy',
  ztna_platform: 'ZTNA Platform', mfa_policy: 'MFA Policy', privileged_access_model: 'Privileged Access Model',
  target_frameworks: 'Target Frameworks (SOC 2 / ISO 27001)', audit_cadence: 'Audit Cadence', evidence_repository: 'Evidence Repository',
  vendor_tiering_model: 'Vendor Tiering Model', assessment_cadence: 'Assessment Cadence',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Enterprise SOC', 'MSSP-Managed SOC', 'Hybrid SOC', 'Startup Security Function'],
  ['Splunk', 'Microsoft Sentinel', 'CrowdStrike Falcon', 'Elastic Security', 'QRadar'],
  ['SOC 2 Type II', 'ISO 27001', 'PCI-DSS', 'HIPAA', 'FedRAMP'],
  ['Cloud-Native', 'On-Prem Data Center', 'Hybrid', 'Multi-Cloud'],
];
