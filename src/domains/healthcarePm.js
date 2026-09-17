// Healthcare domain catalog — EHR/EMR implementation, clinical
// interoperability, HIPAA compliance, and medical device/imaging change.

export const incidents = [
  { code: 'hc_inc_1', grp: 'EHR / EMR', short: 'HC-001', txt: 'HC-001: Epic/Cerner order-entry (CPOE) module returning stale medication lists', layers: ['app', 'db'] },
  { code: 'hc_inc_2', grp: 'EHR / EMR', short: 'HC-002', txt: 'HC-002: EHR downtime during scheduled maintenance exceeds approved clinical window', layers: ['app'] },
  { code: 'hc_inc_3', grp: 'Interoperability', short: 'HC-003', txt: 'HC-003: HL7 ADT feed dropping admit/discharge messages to ancillary systems', layers: ['app', 'network'] },
  { code: 'hc_inc_4', grp: 'Interoperability', short: 'HC-004', txt: 'HC-004: FHIR API gateway rejecting valid patient resource requests (schema mismatch)', layers: ['app'] },
  { code: 'hc_inc_5', grp: 'Compliance', short: 'HC-005', txt: 'HC-005: HIPAA audit finds PHI accessible without minimum-necessary role restriction', layers: ['security'] },
  { code: 'hc_inc_6', grp: 'Medical Devices', short: 'HC-006', txt: 'HC-006: Infusion pump interface dropping vitals data to EHR flowsheet', layers: ['app', 'network'] },
  { code: 'hc_inc_7', grp: 'Imaging', short: 'HC-007', txt: 'HC-007: PACS study routing failure delaying radiologist read queue', layers: ['app', 'storage'] },
  { code: 'hc_inc_8', grp: 'Patient Access', short: 'HC-008', txt: 'HC-008: Patient portal MyChart-equivalent login lockouts spiking after MFA change', layers: ['app', 'security'] },
];

export const fixes = {
  hc_inc_1: 'Clear stale cache on med list service; verify pharmacy interface sync.',
  hc_inc_2: 'Extend downtime procedure window; notify care teams via downtime protocol.',
  hc_inc_3: 'Restart ADT interface engine channel; replay dropped messages from queue.',
  hc_inc_4: 'Correct FHIR resource schema mapping; redeploy gateway validation rules.',
  hc_inc_5: 'Apply role-based minimum-necessary access restriction; audit trail review.',
  hc_inc_6: 'Reconnect device gateway; verify vitals bridge mapping to flowsheet.',
  hc_inc_7: 'Reroute PACS study queue; verify DICOM routing rule configuration.',
  hc_inc_8: 'Roll back MFA policy change or raise lockout threshold; reset affected accounts.',
};

export const incidentFixTasks = {
  hc_inc_1: [
    { role: 'EHR Analyst', name: 'Reproduce stale medication list in test patient chart', dep: 'Clinical report received', validate: 'Root cause isolated to cache or interface sync' },
    { role: 'EHR Analyst', name: 'Clear cache and verify pharmacy interface sync restores current list', dep: 'Root cause isolated', validate: 'Medication list reflects latest orders in production' },
  ],
  hc_inc_2: [
    { role: 'EHR Analyst', name: 'Review downtime procedure against actual outage duration', dep: 'Maintenance window overrun reported', validate: 'Overrun cause and clinical impact documented' },
    { role: 'Change Manager', name: 'Notify care teams via downtime protocol and extend window', dep: 'Overrun documented', validate: 'Downtime protocol acknowledged by nursing/clinical leads' },
  ],
  hc_inc_3: [
    { role: 'Interface Engineer', name: 'Check ADT interface engine channel status and message queue', dep: 'Dropped ADT messages reported', validate: 'Blocked or errored channel identified' },
    { role: 'Interface Engineer', name: 'Restart channel and replay dropped messages', dep: 'Blocked channel identified', validate: 'Ancillary systems confirm receipt of replayed messages' },
  ],
  hc_inc_4: [
    { role: 'Interoperability Eng', name: 'Identify FHIR resource schema mismatch from gateway rejection logs', dep: 'API rejections reported', validate: 'Mismatched field/resource identified' },
    { role: 'Interoperability Eng', name: 'Correct schema mapping and redeploy validation rules', dep: 'Mismatch identified', validate: 'Gateway accepts valid requests; rejection rate returns to baseline' },
  ],
  hc_inc_5: [
    { role: 'HIPAA Privacy Officer', name: 'Confirm scope of over-permissioned PHI access from audit finding', dep: 'Audit finding received', validate: 'Affected roles and PHI scope documented' },
    { role: 'EHR Security Admin', name: 'Apply minimum-necessary role restriction and review audit trail', dep: 'Scope documented', validate: 'Access re-scoped; audit re-run confirms compliance' },
  ],
  hc_inc_6: [
    { role: 'Biomed Eng', name: 'Check infusion pump gateway connectivity and vitals bridge mapping', dep: 'Missing vitals reported', validate: 'Disconnected device/mapping identified' },
    { role: 'Biomed Eng', name: 'Reconnect device gateway and verify flowsheet population', dep: 'Disconnection identified', validate: 'Vitals populate flowsheet in real time' },
  ],
  hc_inc_7: [
    { role: 'PACS Admin', name: 'Check DICOM routing rules and study queue for failed routes', dep: 'Read queue delay reported', validate: 'Misrouted studies and rule fault identified' },
    { role: 'PACS Admin', name: 'Correct routing rule and reroute affected studies', dep: 'Rule fault identified', validate: 'Studies route correctly; radiologist queue back to normal' },
  ],
  hc_inc_8: [
    { role: 'Patient Access IT', name: 'Confirm lockout spike correlates with recent MFA policy change', dep: 'Lockout spike reported', validate: 'Correlation confirmed' },
    { role: 'Patient Access IT', name: 'Roll back or adjust MFA threshold and reset affected accounts', dep: 'Correlation confirmed', validate: 'Lockout rate returns to baseline; affected patients can log in' },
  ],
};

export const uumItems = [
  { code: 'hc_uum_1', grp: 'EHR / EMR', short: 'EHR-001', txt: 'EHR-001: EHR platform major version upgrade (Epic/Cerner)', layers: ['app', 'db'], type: 'upgrade' },
  { code: 'hc_uum_2', grp: 'Interoperability', short: 'INT-001', txt: 'INT-001: HL7 v2 to FHIR R4 interface engine migration', layers: ['app', 'network'], type: 'migration' },
  { code: 'hc_uum_3', grp: 'Compliance', short: 'CMP-001', txt: 'CMP-001: HIPAA Security Rule remediation program (access controls, encryption)', layers: ['security'], type: 'update' },
  { code: 'hc_uum_4', grp: 'Medical Devices', short: 'DEV-001', txt: 'DEV-001: Bedside medical device integration onboarding (new device class)', layers: ['app', 'network'], type: 'migration' },
  { code: 'hc_uum_5', grp: 'Imaging', short: 'PACS-001', txt: 'PACS-001: PACS/imaging system upgrade with vendor neutral archive (VNA)', layers: ['app', 'storage'], type: 'upgrade' },
  { code: 'hc_uum_6', grp: 'Clinical', short: 'CDS-001', txt: 'CDS-001: Clinical decision support (CDS) rule set rollout', layers: ['app'], type: 'migration' },
  { code: 'hc_uum_7', grp: 'Patient Access', short: 'PRT-001', txt: 'PRT-001: Patient portal platform implementation', layers: ['app', 'security'], type: 'migration' },
  { code: 'hc_uum_8', grp: 'Telehealth', short: 'TLH-001', txt: 'TLH-001: Telehealth video visit platform deployment', layers: ['app', 'network'], type: 'migration' },
];

export const uumTasks = {
  hc_uum_1: [
    { role: 'EHR Analyst', name: 'Run upgrade compatibility check against current build customizations', dep: 'Target EHR version confirmed', validate: 'Compatibility report signed off', window: 'Working hours', est_hours: 12 },
    { role: 'EHR Analyst', name: 'Execute upgrade in test environment and run clinical workflow regression', dep: 'Compatibility confirmed', validate: 'Core clinical workflows (CPOE, MAR, results) pass regression', window: 'Working hours', est_hours: 24 },
    { role: 'EHR Analyst', name: 'Execute production upgrade in approved downtime window', dep: 'Test regression signed off; clinical leadership approved window', validate: 'Production on target version; go-live checklist passes', window: 'Weekend window', est_hours: 8 },
  ],
  hc_uum_2: [
    { role: 'Interoperability Eng', name: 'Map HL7 v2 message segments to FHIR R4 resources', dep: 'Target FHIR profile confirmed', validate: 'Mapping signed off by clinical informatics' },
    { role: 'Interoperability Eng', name: 'Run parallel HL7/FHIR processing and reconcile message content', dep: 'Mapping implemented', validate: 'Parallel run reconciles for all message types' },
    { role: 'Interoperability Eng', name: 'Cut over consuming systems to FHIR endpoints', dep: 'Parallel run signed off', validate: 'All consumers migrated; no message loss post-cutover' },
  ],
  hc_uum_3: [
    { role: 'HIPAA Privacy Officer', name: 'Run gap assessment against HIPAA Security Rule technical safeguards', dep: 'Current controls documented', validate: 'Gap list produced and prioritized' },
    { role: 'EHR Security Admin', name: 'Remediate access control and encryption gaps', dep: 'Gap list prioritized', validate: 'Remediation verified by internal audit' },
  ],
  hc_uum_4: [
    { role: 'Biomed Eng', name: 'Validate device interface protocol (HL7/IEEE 11073) against gateway', dep: 'Device vendor spec received', validate: 'Interface protocol confirmed compatible' },
    { role: 'Biomed Eng', name: 'Onboard device class to gateway and validate data flow to EHR', dep: 'Protocol confirmed', validate: 'Device data flows correctly to flowsheet in pilot unit' },
  ],
  hc_uum_5: [
    { role: 'PACS Admin', name: 'Plan VNA migration and DICOM routing cutover sequence', dep: 'Target PACS/VNA platform selected', validate: 'Cutover sequence approved by Radiology IT' },
    { role: 'PACS Admin', name: 'Migrate historical studies to VNA and validate retrieval', dep: 'Cutover sequence approved', validate: 'Sample study retrieval passes across modalities' },
    { role: 'PACS Admin', name: 'Cut over live study routing to upgraded PACS', dep: 'Study migration validated', validate: 'Radiologist read queue unaffected post-cutover' },
  ],
  hc_uum_6: [
    { role: 'Clinical Informatics', name: 'Build and validate CDS rule set against clinical guidelines', dep: 'Clinical guideline source approved', validate: 'Rule set validated by clinical committee' },
    { role: 'Clinical Informatics', name: 'Deploy rules in silent/shadow mode before firing alerts', dep: 'Rule set validated', validate: 'Shadow-mode alert rate acceptable to clinicians' },
    { role: 'Clinical Informatics', name: 'Enable rules in production with alert firing', dep: 'Shadow mode signed off', validate: 'Alerts fire correctly; override rate monitored' },
  ],
  hc_uum_7: [
    { role: 'Patient Access IT', name: 'Configure portal identity verification and MFA', dep: 'Platform provisioned', validate: 'Identity verification tested against sample patient records' },
    { role: 'Patient Access IT', name: 'Roll out portal to pilot patient population', dep: 'Identity verification tested', validate: 'Pilot cohort logs in and views records successfully' },
  ],
  hc_uum_8: [
    { role: 'Telehealth Platform Eng', name: 'Integrate video platform with EHR scheduling and clinical documentation', dep: 'Platform contract and API access confirmed', validate: 'Scheduled visit launches video session from EHR' },
    { role: 'Telehealth Platform Eng', name: 'Pilot with select clinics and validate visit documentation flow', dep: 'Integration complete', validate: 'Pilot visits complete with documentation filed correctly' },
  ],
};

export const designSections = [
  { key: 'ehr', label: 'EHR / EMR', owner: 'EHR Analyst', fields: ['ehr_platform', 'downtime_window', 'clinical_modules_in_scope', 'notes'] },
  { key: 'interoperability', label: 'Interoperability', owner: 'Interoperability Eng', fields: ['interface_engine', 'message_standards', 'ancillary_systems', 'notes'] },
  { key: 'compliance', label: 'Compliance', owner: 'HIPAA Privacy Officer', fields: ['hipaa_scope', 'phi_encryption_standard', 'access_control_model', 'notes'] },
  { key: 'devices', label: 'Medical Devices', owner: 'Biomed Eng', fields: ['device_classes_in_scope', 'device_gateway', 'vitals_integration', 'notes'] },
  { key: 'imaging', label: 'Imaging', owner: 'PACS Admin', fields: ['pacs_platform', 'vna_strategy', 'modality_types', 'notes'] },
  { key: 'patientAccess', label: 'Patient Access', owner: 'Patient Access IT', fields: ['portal_platform', 'telehealth_platform', 'identity_verification', 'notes'] },
];

export const fieldLabels = {
  ehr_platform: 'EHR Platform', downtime_window: 'Approved Downtime Window', clinical_modules_in_scope: 'Clinical Modules in Scope',
  interface_engine: 'Interface Engine', message_standards: 'Message Standards (HL7/FHIR)', ancillary_systems: 'Ancillary Systems in Scope',
  hipaa_scope: 'HIPAA Scope', phi_encryption_standard: 'PHI Encryption Standard', access_control_model: 'Access Control Model',
  device_classes_in_scope: 'Device Classes in Scope', device_gateway: 'Device Gateway Platform', vitals_integration: 'Vitals Integration Method',
  pacs_platform: 'PACS Platform', vna_strategy: 'VNA Strategy', modality_types: 'Modality Types in Scope',
  portal_platform: 'Patient Portal Platform', telehealth_platform: 'Telehealth Platform', identity_verification: 'Identity Verification Method',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Hospital System', 'Ambulatory Clinic', 'Payer', 'Health Tech / Digital Health', 'Long-Term Care'],
  ['Epic', 'Oracle Cerner', 'MEDITECH', 'athenahealth', 'Custom / Best-of-Breed'],
  ['US (HIPAA/HITECH)', 'EU (GDPR + national health law)', 'UK (NHS DSPT)', 'Canada (PIPEDA/PHIPA)', 'APAC (Multi-Jurisdiction)'],
  ['Inpatient', 'Ambulatory', 'Emergency Department', 'Telehealth', 'Patient Portal'],
];
