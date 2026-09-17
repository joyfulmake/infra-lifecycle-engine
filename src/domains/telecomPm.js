// Telecom domain catalog — 5G core rollout, OSS/BSS migration, NFV, RAN
// upgrades, and fiber/FTTH buildout programs.

export const incidents = [
  { code: 'tel_inc_1', grp: '5G Core', short: 'TEL-001', txt: 'TEL-001: 5G core AMF registration failures spiking on new gNB cluster', layers: ['app', 'network'] },
  { code: 'tel_inc_2', grp: 'RAN', short: 'TEL-002', txt: 'TEL-002: RAN handover failures between adjacent cell sectors post-upgrade', layers: ['network'] },
  { code: 'tel_inc_3', grp: 'OSS/BSS', short: 'TEL-003', txt: 'TEL-003: Billing mediation platform dropping CDRs during peak traffic', layers: ['app', 'db'] },
  { code: 'tel_inc_4', grp: 'OSS/BSS', short: 'TEL-004', txt: 'TEL-004: Order management system stuck provisioning fiber install orders', layers: ['app'] },
  { code: 'tel_inc_5', grp: 'NFV', short: 'TEL-005', txt: 'TEL-005: VNF auto-scaling failing to scale out under load on NFVI platform', layers: ['app', 'compute'] },
  { code: 'tel_inc_6', grp: 'Fiber / FTTH', short: 'TEL-006', txt: 'TEL-006: OLT port flapping causing intermittent outages for FTTH subscribers', layers: ['network'] },
  { code: 'tel_inc_7', grp: 'Customer Experience', short: 'TEL-007', txt: 'TEL-007: Customer self-service app unable to fetch usage data from BSS', layers: ['app', 'network'] },
  { code: 'tel_inc_8', grp: 'Spectrum', short: 'TEL-008', txt: 'TEL-008: Interference detected on refarmed spectrum band affecting call quality', layers: ['network'] },
];

export const fixes = {
  tel_inc_1: 'Restart AMF instance; verify gNB cluster configuration and capacity.',
  tel_inc_2: 'Correct neighbor list configuration; re-tune handover thresholds.',
  tel_inc_3: 'Scale mediation platform workers; recover dropped CDRs from source.',
  tel_inc_4: 'Clear stuck provisioning workflow; verify OSS-to-field-ops interface.',
  tel_inc_5: 'Correct auto-scaling policy threshold; verify NFVI resource pool capacity.',
  tel_inc_6: 'Replace/reseat OLT port optics; verify fiber signal levels.',
  tel_inc_7: 'Restore BSS API connectivity; verify usage data feed to self-service app.',
  tel_inc_8: 'Adjust channel plan or power levels to mitigate interference.',
};

export const incidentFixTasks = {
  tel_inc_1: [
    { role: 'Core Network Eng', name: 'Review AMF logs for registration failure pattern on new gNB cluster', dep: 'Registration failure spike detected', validate: 'Root cause (config, capacity, signaling) identified' },
    { role: 'Core Network Eng', name: 'Restart AMF instance and correct gNB cluster configuration', dep: 'Root cause identified', validate: 'Registration success rate returns to baseline' },
  ],
  tel_inc_2: [
    { role: 'RAN Eng', name: 'Review neighbor list and handover thresholds for affected sectors', dep: 'Handover failure reported', validate: 'Misconfigured neighbor relation or threshold identified' },
    { role: 'RAN Eng', name: 'Correct configuration and re-tune handover thresholds', dep: 'Misconfiguration identified', validate: 'Handover success rate returns to baseline' },
  ],
  tel_inc_3: [
    { role: 'OSS/BSS Eng', name: 'Check mediation platform worker utilization during peak traffic', dep: 'CDR drops reported', validate: 'Capacity bottleneck confirmed' },
    { role: 'OSS/BSS Eng', name: 'Scale mediation workers and recover dropped CDRs from source switches', dep: 'Bottleneck confirmed', validate: 'CDR completeness reconciles against source' },
  ],
  tel_inc_4: [
    { role: 'OSS/BSS Eng', name: 'Identify stuck provisioning workflow step for fiber install orders', dep: 'Order backlog reported', validate: 'Stuck step and cause identified' },
    { role: 'OSS/BSS Eng', name: 'Clear stuck workflow and verify field-ops interface', dep: 'Stuck step identified', validate: 'Orders resume provisioning; backlog clears' },
  ],
  tel_inc_5: [
    { role: 'NFV Platform Eng', name: 'Check auto-scaling policy and NFVI resource pool headroom', dep: 'Scale-out failure under load reported', validate: 'Policy misconfiguration or resource exhaustion identified' },
    { role: 'NFV Platform Eng', name: 'Correct scaling policy or expand resource pool', dep: 'Cause identified', validate: 'VNF scales out correctly under simulated load' },
  ],
  tel_inc_6: [
    { role: 'Fiber Field Eng', name: 'Check OLT port signal levels and optics for flapping port', dep: 'Intermittent outage reported', validate: 'Faulty optic or signal degradation identified' },
    { role: 'Fiber Field Eng', name: 'Replace/reseat optics and verify signal stability', dep: 'Fault identified', validate: 'Port stable; affected subscribers confirm restored service' },
  ],
  tel_inc_7: [
    { role: 'Customer Experience Eng', name: 'Check BSS API connectivity and usage data feed status', dep: 'Self-service app data outage reported', validate: 'API/feed fault identified' },
    { role: 'Customer Experience Eng', name: 'Restore connectivity and verify usage data displays correctly', dep: 'Fault identified', validate: 'Self-service app shows current usage data' },
  ],
  tel_inc_8: [
    { role: 'Spectrum Eng', name: 'Analyze interference source on refarmed band', dep: 'Call quality degradation reported', validate: 'Interference source and affected sectors identified' },
    { role: 'Spectrum Eng', name: 'Adjust channel plan or power levels to mitigate', dep: 'Interference source identified', validate: 'Call quality metrics return to baseline' },
  ],
};

export const uumItems = [
  { code: 'tel_uum_1', grp: '5G Core', short: 'CORE-001', txt: 'CORE-001: 5G standalone (SA) core network rollout', layers: ['app', 'network'], type: 'migration' },
  { code: 'tel_uum_2', grp: 'RAN', short: 'RAN-001', txt: 'RAN-001: RAN equipment upgrade (4G to 5G NR overlay)', layers: ['network'], type: 'upgrade' },
  { code: 'tel_uum_3', grp: 'OSS/BSS', short: 'BSS-001', txt: 'BSS-001: OSS/BSS platform migration to cloud-native stack', layers: ['app', 'db'], type: 'migration' },
  { code: 'tel_uum_4', grp: 'NFV', short: 'NFV-001', txt: 'NFV-001: Network function virtualization (NFV) of core network elements', layers: ['app', 'compute'], type: 'migration' },
  { code: 'tel_uum_5', grp: 'Fiber / FTTH', short: 'FTTH-001', txt: 'FTTH-001: Fiber-to-the-home (FTTH) buildout for new service area', layers: ['network'], type: 'migration' },
  { code: 'tel_uum_6', grp: 'Billing', short: 'BILL-001', txt: 'BILL-001: Billing system migration to converged billing platform', layers: ['app', 'db'], type: 'migration' },
  { code: 'tel_uum_7', grp: 'Customer Experience', short: 'CX-001', txt: 'CX-001: Customer experience platform (self-service, chatbot) deployment', layers: ['app'], type: 'migration' },
  { code: 'tel_uum_8', grp: 'Spectrum', short: 'SPEC-001', txt: 'SPEC-001: Spectrum refarming from legacy 3G/4G band to 5G', layers: ['network'], type: 'update' },
];

export const uumTasks = {
  tel_uum_1: [
    { role: 'Core Network Eng', name: 'Design 5G SA core architecture (AMF/SMF/UPF placement)', dep: 'Coverage and capacity targets confirmed', validate: 'Architecture approved by network planning', window: 'Working hours', est_hours: 24 },
    { role: 'Core Network Eng', name: 'Deploy and integrate core network functions in lab', dep: 'Architecture approved', validate: 'End-to-end call/data session succeeds in lab', window: 'Working hours', est_hours: 40 },
    { role: 'Core Network Eng', name: 'Roll out to first commercial market', dep: 'Lab validation signed off', validate: 'Commercial traffic carried with KPIs within target', window: 'Weekend window', est_hours: 16 },
  ],
  tel_uum_2: [
    { role: 'RAN Eng', name: 'Site survey and NR overlay design for target sites', dep: 'Target sites selected', validate: 'Overlay design approved per site' },
    { role: 'RAN Eng', name: 'Install and commission 5G NR equipment on-site', dep: 'Overlay design approved', validate: 'Site commissioned; drive test confirms coverage' },
    { role: 'RAN Eng', name: 'Integrate site into network and activate commercial service', dep: 'Site commissioned', validate: 'Site carries commercial 5G traffic within KPI targets' },
  ],
  tel_uum_3: [
    { role: 'OSS/BSS Eng', name: 'Map legacy OSS/BSS data model to target cloud-native platform', dep: 'Target platform selected', validate: 'Data model mapping signed off' },
    { role: 'OSS/BSS Eng', name: 'Migrate subscriber and billing data, run parallel reconciliation', dep: 'Mapping implemented', validate: 'Parallel run reconciles subscriber/billing records' },
    { role: 'OSS/BSS Eng', name: 'Cut over to cloud-native platform', dep: 'Parallel reconciliation signed off', validate: 'Live orders and billing process correctly post-cutover' },
  ],
  tel_uum_4: [
    { role: 'NFV Platform Eng', name: 'Select target NFVI platform and define VNF onboarding process', dep: 'NFVI platform evaluated and selected', validate: 'Onboarding process approved' },
    { role: 'NFV Platform Eng', name: 'Virtualize pilot network function and validate performance', dep: 'Onboarding process approved', validate: 'Virtualized function meets performance parity with physical' },
  ],
  tel_uum_5: [
    { role: 'Fiber Field Eng', name: 'Complete fiber route design and permitting for service area', dep: 'Service area boundaries confirmed', validate: 'Route design approved; permits obtained' },
    { role: 'Fiber Field Eng', name: 'Deploy fiber and OLT/ONT equipment, activate first subscribers', dep: 'Permits obtained', validate: 'First subscriber cohort activated with target speeds' },
  ],
  tel_uum_6: [
    { role: 'OSS/BSS Eng', name: 'Map prepaid/postpaid rating rules to converged billing platform', dep: 'Rating rules documented', validate: 'Mapping signed off by Revenue Assurance' },
    { role: 'OSS/BSS Eng', name: 'Run parallel billing cycle and reconcile invoices', dep: 'Mapping implemented', validate: 'Parallel cycle reconciles within tolerance' },
    { role: 'OSS/BSS Eng', name: 'Cut over to converged billing platform', dep: 'Parallel cycle signed off', validate: 'Live billing cycle completes correctly on new platform' },
  ],
  tel_uum_7: [
    { role: 'Customer Experience Eng', name: 'Integrate self-service platform with BSS for account/usage data', dep: 'Platform provisioned', validate: 'Account and usage data display correctly in pilot' },
    { role: 'Customer Experience Eng', name: 'Roll out to full subscriber base', dep: 'Pilot validated', validate: 'Adoption tracked; support ticket volume trending down' },
  ],
  tel_uum_8: [
    { role: 'Spectrum Eng', name: 'Plan channel refarming sequence to minimize subscriber impact', dep: 'Refarming approved by regulator', validate: 'Refarming sequence approved by network planning' },
    { role: 'Spectrum Eng', name: 'Execute refarming in phased sequence, monitor call quality', dep: 'Sequence approved', validate: 'Call quality KPIs stable through each phase' },
  ],
};

export const designSections = [
  { key: 'core', label: '5G Core', owner: 'Core Network Eng', fields: ['core_architecture', 'network_slicing', 'interconnect_partners', 'notes'] },
  { key: 'ran', label: 'RAN', owner: 'RAN Eng', fields: ['ran_vendor', 'coverage_targets', 'handover_config', 'notes'] },
  { key: 'ossbss', label: 'OSS/BSS', owner: 'OSS/BSS Eng', fields: ['oss_platform', 'bss_platform', 'billing_model', 'notes'] },
  { key: 'nfv', label: 'NFV', owner: 'NFV Platform Eng', fields: ['nfvi_platform', 'vnf_scope', 'orchestration_platform', 'notes'] },
  { key: 'fiber', label: 'Fiber / FTTH', owner: 'Fiber Field Eng', fields: ['fiber_topology', 'olt_vendor', 'service_area', 'notes'] },
  { key: 'customerExperience', label: 'Customer Experience', owner: 'Customer Experience Eng', fields: ['self_service_platform', 'support_channels', 'sla_targets', 'notes'] },
];

export const fieldLabels = {
  core_architecture: 'Core Architecture (NSA/SA)', network_slicing: 'Network Slicing Strategy', interconnect_partners: 'Interconnect Partners',
  ran_vendor: 'RAN Vendor', coverage_targets: 'Coverage Targets', handover_config: 'Handover Configuration',
  oss_platform: 'OSS Platform', bss_platform: 'BSS Platform', billing_model: 'Billing Model (Prepaid/Postpaid/Converged)',
  nfvi_platform: 'NFVI Platform', vnf_scope: 'VNF Scope', orchestration_platform: 'Orchestration Platform (MANO)',
  fiber_topology: 'Fiber Topology (GPON/XGS-PON)', olt_vendor: 'OLT Vendor', service_area: 'Service Area',
  self_service_platform: 'Self-Service Platform', support_channels: 'Support Channels', sla_targets: 'SLA Targets',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Mobile Network Operator', 'Fixed Broadband Operator', 'MVNO', 'Tower/Infrastructure Provider', 'Cable / Converged Operator'],
  ['Ericsson', 'Nokia', 'Huawei', 'Samsung', 'Multi-Vendor'],
  ['Urban Dense', 'Suburban', 'Rural', 'Nationwide', 'Enterprise/Private Network'],
  ['New Market Launch', 'Network Modernization', 'Capacity Expansion', 'Spectrum Refarm'],
];
