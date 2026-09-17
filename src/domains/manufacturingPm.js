// Manufacturing / Industry 4.0 domain catalog — MES/SCADA, IIoT, predictive
// maintenance, digital twin, and OT/IT convergence programs on the shop floor.

export const incidents = [
  { code: 'mfg_inc_1', grp: 'MES', short: 'MFG-001', txt: 'MFG-001: MES work-order dispatch stalled, halting line-side production tracking', layers: ['app', 'db'] },
  { code: 'mfg_inc_2', grp: 'MES', short: 'MFG-002', txt: 'MFG-002: MES-to-ERP genealogy sync dropping lot/serial records', layers: ['app'] },
  { code: 'mfg_inc_3', grp: 'SCADA / PLC', short: 'MFG-003', txt: 'MFG-003: SCADA HMI losing PLC tag communication on line 3', layers: ['network', 'app'] },
  { code: 'mfg_inc_4', grp: 'SCADA / PLC', short: 'MFG-004', txt: 'MFG-004: PLC firmware update causing unexpected fault-stop on conveyor', layers: ['app'] },
  { code: 'mfg_inc_5', grp: 'IIoT', short: 'MFG-005', txt: 'MFG-005: IIoT sensor gateway dropping vibration telemetry to analytics platform', layers: ['network', 'app'] },
  { code: 'mfg_inc_6', grp: 'OT/IT', short: 'MFG-006', txt: 'MFG-006: OT/IT firewall rule change blocking historian data replication', layers: ['network', 'security'] },
  { code: 'mfg_inc_7', grp: 'Quality', short: 'MFG-007', txt: 'MFG-007: QMS non-conformance workflow stuck in approval state', layers: ['app'] },
  { code: 'mfg_inc_8', grp: 'Predictive Maintenance', short: 'MFG-008', txt: 'MFG-008: Predictive maintenance model generating false-positive failure alerts', layers: ['app'] },
];

export const fixes = {
  mfg_inc_1: 'Restart MES dispatch service; requeue stalled work orders.',
  mfg_inc_2: 'Reprocess failed genealogy sync batch; verify ERP interface mapping.',
  mfg_inc_3: 'Restore PLC network path; verify tag subscription on HMI.',
  mfg_inc_4: 'Roll back PLC firmware or apply corrected fault-stop logic patch.',
  mfg_inc_5: 'Restart IIoT gateway; verify telemetry buffer forwards to analytics platform.',
  mfg_inc_6: 'Correct firewall rule to restore historian replication path.',
  mfg_inc_7: 'Identify and clear stuck approval step; reassign workflow owner.',
  mfg_inc_8: 'Retrain/recalibrate model threshold against recent sensor baseline.',
};

export const incidentFixTasks = {
  mfg_inc_1: [
    { role: 'MES Engineer', name: 'Check MES dispatch service health and stalled work-order queue', dep: 'Line dispatch halt reported', validate: 'Stalled queue and service state identified' },
    { role: 'MES Engineer', name: 'Restart dispatch service and requeue stalled work orders', dep: 'Service state identified', validate: 'Work orders dispatching; line tracking resumes' },
  ],
  mfg_inc_2: [
    { role: 'MES Engineer', name: 'Identify failed genealogy sync batch from interface log', dep: 'Missing lot/serial records reported', validate: 'Failed batch and error cause identified' },
    { role: 'MES Engineer', name: 'Reprocess batch and verify ERP interface mapping', dep: 'Failed batch identified', validate: 'Genealogy records reconcile between MES and ERP' },
  ],
  mfg_inc_3: [
    { role: 'Controls Eng', name: 'Check network path and switch status between HMI and PLC', dep: 'Tag communication loss reported', validate: 'Faulty network segment identified' },
    { role: 'Controls Eng', name: 'Restore network path and re-verify tag subscriptions', dep: 'Faulty segment identified', validate: 'HMI displays live tag values from line 3' },
  ],
  mfg_inc_4: [
    { role: 'Controls Eng', name: 'Review firmware changelog for fault-stop logic change', dep: 'Unexpected fault-stop reported', validate: 'Root cause in firmware logic confirmed' },
    { role: 'Controls Eng', name: 'Roll back firmware or apply corrected logic patch', dep: 'Root cause confirmed', validate: 'Conveyor runs without unexpected fault-stops' },
  ],
  mfg_inc_5: [
    { role: 'IIoT Engineer', name: 'Check gateway connectivity and telemetry buffer status', dep: 'Missing vibration telemetry reported', validate: 'Gateway fault or buffer overflow identified' },
    { role: 'IIoT Engineer', name: 'Restart gateway and verify telemetry resumes to analytics platform', dep: 'Fault identified', validate: 'Vibration telemetry flowing and visible in analytics dashboard' },
  ],
  mfg_inc_6: [
    { role: 'OT Network Eng', name: 'Identify firewall rule change that blocked historian replication', dep: 'Replication failure reported', validate: 'Offending rule change identified' },
    { role: 'OT Network Eng', name: 'Correct firewall rule and verify replication resumes', dep: 'Offending rule identified', validate: 'Historian replication caught up and current' },
  ],
  mfg_inc_7: [
    { role: 'Quality Eng', name: 'Identify stuck approval step and current workflow owner', dep: 'Stuck NCR workflow reported', validate: 'Stuck step and owner identified' },
    { role: 'Quality Eng', name: 'Reassign or clear stuck step, resume workflow', dep: 'Owner identified', validate: 'NCR workflow proceeds to next approval stage' },
  ],
  mfg_inc_8: [
    { role: 'Reliability Eng', name: 'Compare recent sensor baseline against model training data', dep: 'False-positive alert pattern reported', validate: 'Baseline drift or threshold issue identified' },
    { role: 'Reliability Eng', name: 'Recalibrate model threshold or retrain against current baseline', dep: 'Drift identified', validate: 'False-positive rate returns to acceptable level' },
  ],
};

export const uumItems = [
  { code: 'mfg_uum_1', grp: 'MES', short: 'MES-001', txt: 'MES-001: MES implementation for new production line', layers: ['app', 'db'], type: 'migration' },
  { code: 'mfg_uum_2', grp: 'SCADA / PLC', short: 'SCD-001', txt: 'SCD-001: SCADA platform upgrade with PLC firmware refresh', layers: ['app'], type: 'upgrade' },
  { code: 'mfg_uum_3', grp: 'IIoT', short: 'IOT-001', txt: 'IOT-001: IIoT sensor rollout across production line (vibration/temp/pressure)', layers: ['network', 'app'], type: 'migration' },
  { code: 'mfg_uum_4', grp: 'Predictive Maintenance', short: 'PDM-001', txt: 'PDM-001: Predictive maintenance platform deployment', layers: ['app'], type: 'migration' },
  { code: 'mfg_uum_5', grp: 'Digital Twin', short: 'DGT-001', txt: 'DGT-001: Digital twin implementation for production line simulation', layers: ['app'], type: 'migration' },
  { code: 'mfg_uum_6', grp: 'Integration', short: 'ERP-001', txt: 'ERP-001: ERP-to-shop-floor integration (production orders, genealogy)', layers: ['app', 'db'], type: 'migration' },
  { code: 'mfg_uum_7', grp: 'OT/IT', short: 'NET-001', txt: 'NET-001: OT/IT network convergence and segmentation project', layers: ['network', 'security'], type: 'migration' },
  { code: 'mfg_uum_8', grp: 'Quality', short: 'QMS-001', txt: 'QMS-001: Quality management system (QMS) digitization', layers: ['app'], type: 'migration' },
];

export const uumTasks = {
  mfg_uum_1: [
    { role: 'MES Engineer', name: 'Define work-order and routing model for new line', dep: 'Line layout and BOM finalized', validate: 'Routing model signed off by Production Engineering', window: 'Working hours', est_hours: 16 },
    { role: 'MES Engineer', name: 'Configure MES-to-PLC data collection for new line', dep: 'Routing model approved', validate: 'Real-time data collection verified on pilot shift', window: 'Working hours', est_hours: 24 },
    { role: 'MES Engineer', name: 'Go-live on new line with dispatch and tracking active', dep: 'Data collection verified; operator training complete', validate: 'First production shift completes with full MES tracking', window: 'Working hours', est_hours: 8 },
  ],
  mfg_uum_2: [
    { role: 'Controls Eng', name: 'Inventory current PLC firmware versions and SCADA tag database', dep: 'Upgrade scheduled', validate: 'Inventory complete with compatibility matrix' },
    { role: 'Controls Eng', name: 'Upgrade SCADA platform in test cell, validate tag mapping', dep: 'Inventory complete', validate: 'Test cell SCADA operational with no tag loss' },
    { role: 'Controls Eng', name: 'Roll out PLC firmware and SCADA upgrade to production lines', dep: 'Test cell validated', validate: 'All lines operational on upgraded firmware/SCADA' },
  ],
  mfg_uum_3: [
    { role: 'IIoT Engineer', name: 'Install and commission sensors on pilot equipment', dep: 'Sensor hardware procured; mounting points identified', validate: 'Sensors reporting telemetry from pilot equipment' },
    { role: 'IIoT Engineer', name: 'Validate telemetry pipeline into analytics/historian platform', dep: 'Pilot sensors commissioned', validate: 'Telemetry visible and queryable in analytics platform' },
    { role: 'IIoT Engineer', name: 'Scale rollout across full production line', dep: 'Pipeline validated', validate: 'All target equipment reporting telemetry reliably' },
  ],
  mfg_uum_4: [
    { role: 'Reliability Eng', name: 'Select failure modes and train predictive model on historical sensor data', dep: 'Historical sensor data available', validate: 'Model validated against known past failures' },
    { role: 'Reliability Eng', name: 'Deploy model in shadow mode against live telemetry', dep: 'Model validated', validate: 'Shadow-mode alerts reviewed and false-positive rate acceptable' },
    { role: 'Reliability Eng', name: 'Enable model in production maintenance workflow', dep: 'Shadow mode signed off', validate: 'Alerts feed maintenance work-order system correctly' },
  ],
  mfg_uum_5: [
    { role: 'Digital Twin Eng', name: 'Build simulation model of target production line', dep: 'Line process data and layout available', validate: 'Simulation model validated against actual line throughput' },
    { role: 'Digital Twin Eng', name: 'Connect twin to live telemetry for real-time sync', dep: 'Simulation model validated', validate: 'Twin state matches live line state within tolerance' },
  ],
  mfg_uum_6: [
    { role: 'Integration Eng', name: 'Map ERP production order and genealogy fields to shop-floor schema', dep: 'ERP and MES data models documented', validate: 'Field mapping signed off by both teams' },
    { role: 'Integration Eng', name: 'Build and test bi-directional interface, run parallel validation', dep: 'Mapping approved', validate: 'Parallel run reconciles orders and genealogy records' },
    { role: 'Integration Eng', name: 'Cut over to live integration', dep: 'Parallel validation signed off', validate: 'Production orders flow end-to-end with no manual re-entry' },
  ],
  mfg_uum_7: [
    { role: 'OT Network Eng', name: 'Assess current OT/IT network architecture and segmentation gaps', dep: 'Network topology documented', validate: 'Gap assessment and target architecture approved' },
    { role: 'OT Network Eng', name: 'Implement segmentation (firewalls, VLANs, DMZ) per target architecture', dep: 'Target architecture approved', validate: 'Segmentation tested; OT traffic isolated from general IT' },
  ],
  mfg_uum_8: [
    { role: 'Quality Eng', name: 'Digitize non-conformance and CAPA workflows from paper/spreadsheet process', dep: 'Current process documented', validate: 'Digital workflow mirrors approved quality process' },
    { role: 'Quality Eng', name: 'Pilot digital QMS on one production line and gather feedback', dep: 'Workflow digitized', validate: 'Pilot line runs NCR/CAPA fully digitally for two weeks' },
  ],
};

export const designSections = [
  { key: 'mes', label: 'MES', owner: 'MES Engineer', fields: ['mes_platform', 'work_order_model', 'genealogy_tracking', 'notes'] },
  { key: 'controls', label: 'SCADA / Controls', owner: 'Controls Eng', fields: ['scada_platform', 'plc_vendor', 'hmi_architecture', 'notes'] },
  { key: 'iiot', label: 'IIoT', owner: 'IIoT Engineer', fields: ['sensor_types', 'gateway_platform', 'telemetry_pipeline', 'notes'] },
  { key: 'otit', label: 'OT/IT Convergence', owner: 'OT Network Eng', fields: ['network_segmentation', 'historian_platform', 'remote_access_policy', 'notes'] },
  { key: 'quality', label: 'Quality', owner: 'Quality Eng', fields: ['qms_platform', 'compliance_standard', 'capa_workflow', 'notes'] },
  { key: 'reliability', label: 'Reliability / Predictive Maintenance', owner: 'Reliability Eng', fields: ['pdm_platform', 'digital_twin_scope', 'failure_modes_tracked', 'notes'] },
];

export const fieldLabels = {
  mes_platform: 'MES Platform', work_order_model: 'Work Order / Routing Model', genealogy_tracking: 'Genealogy Tracking Method',
  scada_platform: 'SCADA Platform', plc_vendor: 'PLC Vendor', hmi_architecture: 'HMI Architecture',
  sensor_types: 'Sensor Types in Scope', gateway_platform: 'IIoT Gateway Platform', telemetry_pipeline: 'Telemetry Pipeline / Historian',
  network_segmentation: 'Network Segmentation Model', historian_platform: 'Historian Platform', remote_access_policy: 'Remote Access Policy',
  qms_platform: 'QMS Platform', compliance_standard: 'Compliance Standard (ISO 9001/IATF 16949)', capa_workflow: 'CAPA Workflow Model',
  pdm_platform: 'Predictive Maintenance Platform', digital_twin_scope: 'Digital Twin Scope', failure_modes_tracked: 'Failure Modes Tracked',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Discrete Manufacturing', 'Process Manufacturing', 'Automotive', 'Pharma / Life Sciences', 'Consumer Packaged Goods'],
  ['Siemens Opcenter', 'Rockwell FactoryTalk', 'SAP ME/MII', 'Wonderware/AVEVA', 'Custom / In-House'],
  ['Single Plant', 'Multi-Plant (Same Region)', 'Multi-Plant (Global)', 'Greenfield Plant'],
  ['New Line Commissioning', 'Brownfield Retrofit', 'Line Consolidation', 'Plant-Wide Rollout'],
];
