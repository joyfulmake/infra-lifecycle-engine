// Network Refresh domain catalog — switch/router hardware lifecycle,
// SD-WAN rollout, wireless upgrade, segmentation, and firewall replacement
// programs. Shape mirrors infra's ALL_INC/ALL_UUM/getRealTasks/
// DESIGN_SECTIONS exactly (see src/domains/applyDomain.js for how this
// plugs in).

export const incidents = [
  { code: 'nr_inc_1', grp: 'Core / Distribution', short: 'NR-001', txt: 'NR-001: Core switch stack member flapping on stacking cable link', layers: ['network'] },
  { code: 'nr_inc_2', grp: 'Core / Distribution', short: 'NR-002', txt: 'NR-002: Spanning-tree topology change loop causing intermittent broadcast storms', layers: ['network'] },
  { code: 'nr_inc_3', grp: 'SD-WAN', short: 'NR-003', txt: 'NR-003: SD-WAN overlay tunnel failing to establish after edge device firmware update', layers: ['network'] },
  { code: 'nr_inc_4', grp: 'Wireless', short: 'NR-004', txt: 'NR-004: WiFi 6E access point client density causing airtime contention in open-plan office', layers: ['network'] },
  { code: 'nr_inc_5', grp: 'Segmentation', short: 'NR-005', txt: 'NR-005: Microsegmentation policy blocking legitimate east-west traffic between app tiers', layers: ['network', 'security'] },
  { code: 'nr_inc_6', grp: 'Firewall', short: 'NR-006', txt: 'NR-006: New NGFW HA pair failing to sync session state during failover test', layers: ['network', 'security'] },
  { code: 'nr_inc_7', grp: 'Routing', short: 'NR-007', txt: 'NR-007: BGP route flap between edge routers causing asymmetric routing to DR site', layers: ['network'] },
  { code: 'nr_inc_8', grp: 'Monitoring', short: 'NR-008', txt: 'NR-008: NetFlow collector dropping records under peak traffic, blinding capacity dashboards', layers: ['network'] },
];

export const fixes = {
  nr_inc_1: 'Reseat/replace stacking cable; verify stack ring integrity and firmware match across members.',
  nr_inc_2: 'Identify flapping port causing TCN storm; enable BPDU guard / root guard on edge ports.',
  nr_inc_3: 'Roll back firmware or apply vendor hotfix; re-negotiate IKE/overlay control-plane session.',
  nr_inc_4: 'Add AP density / enable band steering and airtime fairness; adjust channel plan.',
  nr_inc_5: 'Add explicit allow rule for the legitimate flow; re-validate segmentation policy against app dependency map.',
  nr_inc_6: 'Correct HA sync interface/config mismatch; re-test failover with session-state verification.',
  nr_inc_7: 'Correct route-map/prefix-list causing flap; add route dampening if flap persists.',
  nr_inc_8: 'Scale collector capacity or sample rate; verify export bandwidth from sending devices.',
};

export const incidentFixTasks = {
  nr_inc_1: [
    { role: 'Network Eng', name: 'Check stack ring status and member firmware versions', dep: 'Stack flapping alert received', validate: 'Faulty cable or firmware mismatch identified' },
    { role: 'Network Eng', name: 'Replace cable or align firmware, re-verify stack ring', dep: 'Root cause identified', validate: 'Stack ring stable; no flap for 30 min under load' },
  ],
  nr_inc_2: [
    { role: 'Network Eng', name: 'Trace TCN source from spanning-tree logs', dep: 'Broadcast storm reported', validate: 'Flapping port/link identified' },
    { role: 'Network Eng', name: 'Enable BPDU guard/root guard on identified edge ports', dep: 'Flapping port identified', validate: 'TCN events stop; no further storms in 24h' },
  ],
  nr_inc_3: [
    { role: 'SD-WAN Eng', name: 'Compare overlay control-plane logs pre/post firmware update', dep: 'Tunnel-down alert received', validate: 'Firmware-related regression confirmed' },
    { role: 'SD-WAN Eng', name: 'Roll back firmware or apply vendor hotfix', dep: 'Regression confirmed', validate: 'Overlay tunnel re-establishes and stays up 1h+' },
  ],
  nr_inc_4: [
    { role: 'Wireless Eng', name: 'Pull AP client count and airtime utilization for affected zone', dep: 'Poor WiFi performance reported', validate: 'Client density confirmed as root cause' },
    { role: 'Wireless Eng', name: 'Add AP(s) or enable band steering/airtime fairness', dep: 'Density confirmed', validate: 'Airtime utilization back under threshold' },
  ],
  nr_inc_5: [
    { role: 'Network Security Eng', name: 'Identify blocked flow from microsegmentation policy logs', dep: 'App team reports connectivity failure', validate: 'Blocking rule and required flow identified' },
    { role: 'Network Security Eng', name: 'Add scoped allow rule and re-validate against dependency map', dep: 'Blocking rule identified', validate: 'Flow succeeds; no unintended access opened' },
  ],
  nr_inc_6: [
    { role: 'Firewall Eng', name: 'Review HA sync interface config and session table on both units', dep: 'Failover test failed', validate: 'Sync mismatch identified' },
    { role: 'Firewall Eng', name: 'Correct HA configuration and re-run failover test', dep: 'Mismatch corrected', validate: 'Failover completes with zero session drop' },
  ],
  nr_inc_7: [
    { role: 'Network Eng', name: 'Review BGP logs for flap pattern and affected prefixes', dep: 'Asymmetric routing to DR reported', validate: 'Flapping neighbor/prefix identified' },
    { role: 'Network Eng', name: 'Correct route-map/prefix-list or add dampening', dep: 'Root cause identified', validate: 'Routing symmetric; no further flaps in 24h' },
  ],
  nr_inc_8: [
    { role: 'Network Eng', name: 'Check collector CPU/memory and export bandwidth from top talkers', dep: 'Capacity dashboard gaps reported', validate: 'Collector bottleneck confirmed' },
    { role: 'Network Eng', name: 'Scale collector or adjust sample rate', dep: 'Bottleneck confirmed', validate: 'Flow record loss returns to near-zero' },
  ],
};

export const uumItems = [
  { code: 'nr_uum_1', grp: 'Hardware Refresh', short: 'REF-001', txt: 'REF-001: Core/distribution switch refresh (EOL chassis to current-gen)', layers: ['network'], type: 'migration' },
  { code: 'nr_uum_2', grp: 'Hardware Refresh', short: 'REF-002', txt: 'REF-002: Edge router replacement with current-gen platform', layers: ['network'], type: 'migration' },
  { code: 'nr_uum_3', grp: 'SD-WAN', short: 'SDW-001', txt: 'SDW-001: SD-WAN rollout replacing MPLS at branch sites', layers: ['network'], type: 'migration' },
  { code: 'nr_uum_4', grp: 'Wireless', short: 'WIFI-001', txt: 'WIFI-001: WiFi 6E upgrade across campus access layer', layers: ['network'], type: 'upgrade' },
  { code: 'nr_uum_5', grp: 'Segmentation', short: 'SEG-001', txt: 'SEG-001: Microsegmentation rollout for east-west traffic control', layers: ['network', 'security'], type: 'migration' },
  { code: 'nr_uum_6', grp: 'Firewall', short: 'FW-001', txt: 'FW-001: NGFW replacement at internet edge and DMZ', layers: ['network', 'security'], type: 'migration' },
  { code: 'nr_uum_7', grp: 'DDoS', short: 'DOS-001', txt: 'DOS-001: DDoS scrubbing service onboarding for internet-facing ranges', layers: ['network', 'security'], type: 'migration' },
  { code: 'nr_uum_8', grp: 'Monitoring', short: 'MON-001', txt: 'MON-001: NetFlow/sFlow monitoring platform modernization', layers: ['network'], type: 'upgrade' },
];

export const uumTasks = {
  nr_uum_1: [
    { role: 'Network Architect', name: 'Design target core/distribution topology and capacity plan', dep: 'EOL hardware inventory confirmed', validate: 'Topology design peer-reviewed and approved', window: 'Working hours', est_hours: 8 },
    { role: 'Network Eng', name: 'Stage and configure replacement chassis in lab', dep: 'Topology design approved', validate: 'Lab config passes functional test', window: 'Working hours', est_hours: 12 },
    { role: 'Network Eng', name: 'Cutover — swap chassis in maintenance window with rollback plan ready', dep: 'Lab config validated; rollback plan documented', validate: 'Traffic restored on new chassis; no unplanned outage', window: 'Weekend window', est_hours: 6 },
  ],
  nr_uum_2: [
    { role: 'Network Eng', name: 'Migrate routing configuration to new edge router platform', dep: 'Replacement hardware racked and cabled', validate: 'Config migrated and peer-reviewed', window: 'Working hours', est_hours: 6 },
    { role: 'Network Eng', name: 'Cutover edge router with BGP session re-establishment', dep: 'Config migration validated', validate: 'BGP sessions up; routes exchanged correctly', window: 'Weekend window', est_hours: 4 },
  ],
  nr_uum_3: [
    { role: 'SD-WAN Eng', name: 'Deploy SD-WAN edge device at pilot branch site', dep: 'Overlay controller provisioned', validate: 'Pilot site passes connectivity and failover test', window: 'Working hours', est_hours: 6 },
    { role: 'SD-WAN Eng', name: 'Roll out to remaining branch sites in waves', dep: 'Pilot site signed off', validate: 'Each wave passes connectivity test before MPLS decommission', window: 'Working hours', est_hours: 24 },
    { role: 'Network Eng', name: 'Decommission legacy MPLS circuits', dep: 'All branch waves stable on SD-WAN for 2 weeks', validate: 'MPLS circuits terminated; no traffic dependency remains' },
  ],
  nr_uum_4: [
    { role: 'Wireless Eng', name: 'Run predictive site survey for WiFi 6E AP placement', dep: 'Floor plans and RF requirements confirmed', validate: 'Survey signed off with AP placement plan', window: 'Working hours', est_hours: 6 },
    { role: 'Wireless Eng', name: 'Install and configure WiFi 6E access points by zone', dep: 'Survey approved', validate: 'Zone passes coverage and throughput test', window: 'Working hours', est_hours: 16 },
  ],
  nr_uum_5: [
    { role: 'Network Security Eng', name: 'Map application east-west traffic dependencies', dep: 'App inventory available', validate: 'Dependency map validated by app owners' },
    { role: 'Network Security Eng', name: 'Define and stage microsegmentation policy in monitor mode', dep: 'Dependency map validated', validate: 'Monitor mode shows no unexpected blocks for 1 week' },
    { role: 'Network Security Eng', name: 'Enforce segmentation policy in production', dep: 'Monitor mode clean for observation period', validate: 'Policy enforced; no business-impacting blocks reported' },
  ],
  nr_uum_6: [
    { role: 'Firewall Eng', name: 'Migrate rule base from legacy firewall to new NGFW platform', dep: 'New NGFW HA pair racked and licensed', validate: 'Rule base migrated and peer-reviewed', window: 'Working hours', est_hours: 8 },
    { role: 'Firewall Eng', name: 'Cutover internet edge to new NGFW with HA failover test', dep: 'Rule base validated in parallel run', validate: 'Cutover complete; HA failover verified with zero session loss', window: 'Weekend window', est_hours: 6 },
  ],
  nr_uum_7: [
    { role: 'Network Security Eng', name: 'Onboard internet-facing IP ranges to DDoS scrubbing service', dep: 'Scrubbing service contract active', validate: 'Ranges announced via scrubbing provider; BGP/DNS redirect confirmed' },
    { role: 'Network Security Eng', name: 'Run simulated attack test to validate mitigation', dep: 'Onboarding complete', validate: 'Simulated attack mitigated within SLA' },
  ],
  nr_uum_8: [
    { role: 'Network Eng', name: 'Deploy new NetFlow/sFlow collector platform', dep: 'Target platform sized for current traffic volume', validate: 'Collector receiving flow records from pilot devices', window: 'Working hours', est_hours: 6 },
    { role: 'Network Eng', name: 'Migrate flow export configuration from all network devices', dep: 'Collector validated with pilot devices', validate: 'All devices exporting to new collector; legacy platform decommissioned' },
  ],
};

export const designSections = [
  { key: 'coreNetwork', label: 'Core / Distribution', owner: 'Network Architect', fields: ['topology_design', 'redundancy_model', 'capacity_plan', 'vlan_design', 'notes'] },
  { key: 'sdwan', label: 'SD-WAN', owner: 'SD-WAN Eng', fields: ['overlay_topology', 'transport_mix', 'app_routing_policy', 'notes'] },
  { key: 'wireless', label: 'Wireless', owner: 'Wireless Eng', fields: ['ap_density_plan', 'channel_plan', 'client_auth_method', 'notes'] },
  { key: 'segmentation', label: 'Segmentation', owner: 'Network Security Eng', fields: ['segmentation_model', 'policy_enforcement_point', 'dependency_mapping', 'notes'] },
  { key: 'firewall', label: 'Firewall / Edge Security', owner: 'Firewall Eng', fields: ['ngfw_platform', 'ha_model', 'ddos_mitigation', 'notes'] },
  { key: 'monitoring', label: 'Monitoring', owner: 'Network Eng', fields: ['flow_export_method', 'collector_sizing', 'alert_thresholds', 'notes'] },
];

export const fieldLabels = {
  topology_design: 'Topology Design', redundancy_model: 'Redundancy Model', capacity_plan: 'Capacity Plan', vlan_design: 'VLAN Design',
  overlay_topology: 'Overlay Topology (Hub-Spoke/Mesh)', transport_mix: 'Transport Mix (MPLS/Broadband/LTE)', app_routing_policy: 'Application-Aware Routing Policy',
  ap_density_plan: 'AP Density Plan', channel_plan: 'Channel Plan', client_auth_method: 'Client Authentication Method (802.1X/PSK)',
  segmentation_model: 'Segmentation Model (Zone/Microsegmentation)', policy_enforcement_point: 'Policy Enforcement Point', dependency_mapping: 'App Dependency Mapping',
  ngfw_platform: 'NGFW Platform', ha_model: 'HA Model (Active/Active, Active/Passive)', ddos_mitigation: 'DDoS Mitigation Approach',
  flow_export_method: 'Flow Export Method (NetFlow/sFlow/IPFIX)', collector_sizing: 'Collector Sizing', alert_thresholds: 'Alert Thresholds',
  notes: 'Notes / Comments',
};

export const axisOptions = [
  ['Cisco Catalyst/Nexus', 'Juniper EX/QFX', 'Arista', 'HPE Aruba', 'Mixed Vendor'],
  ['MPLS (legacy)', 'SD-WAN', 'Internet Broadband + LTE Backup', 'Dark Fiber / Metro Ethernet'],
  ['Single Site', 'Multi-Site Campus', 'Branch Network (10+ sites)', 'Data Center Fabric'],
  ['On-Prem Managed', 'Cloud-Managed (Meraki/Mist)', 'Co-Managed with MSP', 'Fully Outsourced NOC'],
];
