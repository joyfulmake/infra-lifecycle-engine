import { create } from 'zustand';

const DESIGN_SECTIONS = [
  { key: 'unix',     label: 'Unix / OS',     owner: 'Unix Admin',    fields: ['cpu','ram','swap','kernel_params','patch_window','ntp_server','dns_server','timezone','monitoring_agent','notes','cpu_governor','numa_policy','hugepages','io_scheduler','ulimits','selinux','auditd','cron_jobs','ssh_config','sudo_policy','syslog_server','fs_type','mount_opts','locale','tuned_profile','kdump','core_dumps','ipv6_mode','hostname_scheme','boot_loader'] },
  { key: 'web',      label: 'Web / HTTP',    owner: 'Web Admin',     fields: ['worker_proc','keepalive','max_conn','ssl_cert_expiry','log_retention','reverse_proxy','load_bal_algo','session_timeout','health_check_url','notes','ssl_protocols','ssl_ciphers','hsts','compression','cache_control','request_timeout','worker_threads','max_req_size','rate_limit','waf','access_log','error_log_level','vhosts','upstream_servers','sticky_sessions','http2','websocket','cdn','cors','sec_headers'] },
  { key: 'app',      label: 'Application',   owner: 'App Admin',     fields: ['jvm_xmx','jvm_xms','thread_pool','datasource_pool','deploy_method','app_port','heap_ratio','gc_policy','log_level','notes','jvm_metaspace','jvm_stack','gc_log','jmx_port','app_context','session_rep','cache_provider','msg_broker','metrics_endpoint','config_server','service_discovery','circuit_breaker','retry_policy','timeout_ms','tracing','log_aggregator','feature_flags','heap_dump','async_pool','apm_agent'] },
  { key: 'db',       label: 'Database',      owner: 'DB Admin',      fields: ['buf_pool','max_conn','redo_size','archive_dest','backup_window','standby_lag','stats_window','tablespace_pct','listener_port','notes','shared_mem','sort_buf','temp_space','undo_ret','parallel_deg','optimizer','charset','collation','replication','failover','query_timeout','slow_query','audit_db','tde','conn_pool','read_replicas','partitioning','index_strategy','vacuum','db_links'] },
  { key: 'storage',  label: 'Storage',       owner: 'Storage Admin', fields: ['lun_size','iops_req','replication_factor','snapshot_policy','multipath_mode','nfs_mount','san_fabric','thin_prov','raid_level','notes','block_size','cache_tier','dedup','compress_stor','tiering','qos_stor','zoning','fc_ports','iscsi_iqn','nfs_version','smb_version','obj_storage','quota','recycle_bin','vg_name','lv_layout','fs_type_stor','mount_point','io_priority','stor_pool'] },
  { key: 'backup',   label: 'Backup / DR',   owner: 'Backup Admin',  fields: ['rpo_hours','rto_hours','full_day','incr_freq','retention_daily','retention_weekly','retention_monthly','offsite_target','encryption','notes','backup_tool','catalog_srv','media_srv','storage_unit','parallel_str','bw_limit','compress_bk','dedup_ratio','test_restore','restore_sla','tape_lib','cloud_tier','immutable','ransomware','bk_window_dur','bk_priority','notify_email','pre_script','post_script','synthetic_full'] },
  { key: 'network',  label: 'Network',       owner: 'Net Admin',     fields: ['bandwidth','vlan_ids','mtu','bond_mode','fw_rules','load_bal','dns_ttl','ntp_source','proxy_url','notes','ipv4_subnet','ipv6_prefix','default_gw','vip_addr','bgp_asn','ospf_area','qos_net','jumbo_vlan','port_sec','dhcp','nat_policy','vpn_gw','sd_wan','ddos','net_monitor','snmp','netflow','trunk_vlans','access_vlan','iface_speed'] },
  { key: 'security', label: 'Security',      owner: 'SecOps',        fields: ['patch_sla','scan_freq','mfa_required','siem_endpoint','vuln_score_max','cert_expiry_alert','compliance_framework','backup_encryption','access_review','notes','pam','secrets_mgr','key_mgmt','hsm','ids_ips','edr','dlp','fw_type','pentest','sec_baseline','hardening','log_ret_sec','ir_playbook','change_ctrl','data_class','enc_rest','enc_transit','zero_trust','supply_chain','sec_training'] },
];

const FIELD_LABELS = {
  // Unix / OS
  cpu:'CPU Allocation', ram:'RAM Allocation', swap:'Swap / Page Space', kernel_params:'Kernel Parameters',
  patch_window:'Patch Window', ntp_server:'NTP Server', dns_server:'DNS Server', timezone:'Timezone',
  monitoring_agent:'Monitoring Agent', notes:'Notes / Comments',
  cpu_governor:'CPU Governor / Scheduler', numa_policy:'NUMA Policy', hugepages:'HugePages Config',
  io_scheduler:'I/O Scheduler', ulimits:'ulimits (nofile / nproc)', selinux:'SELinux / AppArmor Mode',
  auditd:'Auditd Policy', cron_jobs:'Scheduled Cron Jobs', ssh_config:'SSH Hardening Config',
  sudo_policy:'Sudo Policy', syslog_server:'Remote Syslog Server', fs_type:'Root Filesystem Type',
  mount_opts:'Mount Options', locale:'System Locale', tuned_profile:'Tuned Profile',
  kdump:'Kdump Config', core_dumps:'Core Dump Config', ipv6_mode:'IPv6 Status',
  hostname_scheme:'Hostname Convention', boot_loader:'Boot Loader Config',
  // Web / HTTP
  worker_proc:'Worker Processes', keepalive:'Keepalive Timeout (s)', max_conn:'Max Connections',
  ssl_cert_expiry:'SSL Cert Expiry', log_retention:'Log Retention', reverse_proxy:'Reverse Proxy Target',
  load_bal_algo:'Load Balancer Algorithm', session_timeout:'Session Timeout (s)', health_check_url:'Health Check URL',
  ssl_protocols:'SSL / TLS Protocols', ssl_ciphers:'SSL Cipher Suite Order', hsts:'HSTS Header',
  compression:'Compression (gzip/brotli)', cache_control:'Cache-Control Policy', request_timeout:'Request Timeout (s)',
  worker_threads:'Worker Threads', max_req_size:'Max Request Body Size', rate_limit:'Rate Limit (req/s)',
  waf:'WAF Config', access_log:'Access Log Format', error_log_level:'Error Log Level',
  vhosts:'Virtual Hosts', upstream_servers:'Upstream Servers', sticky_sessions:'Session Persistence',
  http2:'HTTP/2 Config', websocket:'WebSocket Support', cdn:'CDN Config',
  cors:'CORS Policy', sec_headers:'Security Headers',
  // Application
  jvm_xmx:'JVM Xmx (heap max)', jvm_xms:'JVM Xms (heap min)', thread_pool:'Thread Pool Size',
  datasource_pool:'Datasource Pool Size', deploy_method:'Deployment Method', app_port:'Application Port',
  heap_ratio:'Heap Ratio (%)', gc_policy:'GC Policy', log_level:'Log Level',
  jvm_metaspace:'JVM Metaspace Max', jvm_stack:'Thread Stack Size', gc_log:'GC Logging',
  jmx_port:'JMX Port', app_context:'App Context Path', session_rep:'Session Replication',
  cache_provider:'Cache Provider', msg_broker:'Message Broker', metrics_endpoint:'Metrics Endpoint',
  config_server:'Config Server URL', service_discovery:'Service Discovery', circuit_breaker:'Circuit Breaker',
  retry_policy:'Retry Policy', timeout_ms:'Timeout Config (ms)', tracing:'Distributed Tracing',
  log_aggregator:'Log Aggregator', feature_flags:'Feature Flags', heap_dump:'OOM Heap Dump',
  async_pool:'Async Thread Pool', apm_agent:'APM Agent',
  // Database
  buf_pool:'Buffer Pool Size', redo_size:'Redo / WAL Log Size', archive_dest:'Archive Destination',
  backup_window:'Backup Window', standby_lag:'Standby Lag Target', stats_window:'Stats Gather Window',
  tablespace_pct:'Tablespace Alert % Threshold', listener_port:'Listener Port',
  shared_mem:'Shared Memory / SGA', sort_buf:'Sort Buffer Size', temp_space:'Temp Tablespace / Space',
  undo_ret:'Undo / MVCC Retention', parallel_deg:'Parallel Query Degree', optimizer:'Optimizer Mode',
  charset:'Database Character Set', collation:'Collation', replication:'Replication Mode',
  failover:'Failover Config', query_timeout:'Query Timeout (s)', slow_query:'Slow Query Threshold (ms)',
  audit_db:'DB Audit Level', tde:'TDE / Encryption at Rest', conn_pool:'Connection Pooler Config',
  read_replicas:'Read Replica Count', partitioning:'Partitioning Strategy', index_strategy:'Index Maintenance',
  vacuum:'Vacuum / Purge Policy', db_links:'DB Links / Federation',
  // Storage
  lun_size:'LUN Size Allocation', iops_req:'IOPS Requirement', replication_factor:'Replication Factor',
  snapshot_policy:'Snapshot Policy', multipath_mode:'Multipath Mode', nfs_mount:'NFS Mount Options',
  san_fabric:'SAN Fabric Type', thin_prov:'Thin Provisioning', raid_level:'RAID Level',
  block_size:'Block / Sector Size', cache_tier:'NVMe Cache Tier', dedup:'Deduplication',
  compress_stor:'Storage Compression', tiering:'Auto-Tiering Policy', qos_stor:'QoS Policy',
  zoning:'SAN Zoning Config', fc_ports:'FC Port Count', iscsi_iqn:'iSCSI IQN / Initiator',
  nfs_version:'NFS Version', smb_version:'SMB Version', obj_storage:'Object Storage Endpoint',
  quota:'Quota Policy', recycle_bin:'Recycle Bin Retention', vg_name:'Volume Group Name',
  lv_layout:'LV Layout', fs_type_stor:'Filesystem Type (Storage)', mount_point:'Mount Points',
  io_priority:'I/O Priority Class', stor_pool:'Storage Pool Name',
  // Backup / DR
  rpo_hours:'RPO (hours)', rto_hours:'RTO (hours)', full_day:'Full Backup Schedule',
  incr_freq:'Incremental Frequency', retention_daily:'Daily Retention (days)',
  retention_weekly:'Weekly Retention (weeks)', retention_monthly:'Monthly Retention (months)',
  offsite_target:'Offsite / Cloud Target', encryption:'Backup Encryption',
  backup_tool:'Backup Tool', catalog_srv:'Catalog Server', media_srv:'Media Server',
  storage_unit:'Storage Unit / Pool', parallel_str:'Parallel Streams', bw_limit:'Bandwidth Limit (MB/s)',
  compress_bk:'Backup Compression', dedup_ratio:'Expected Dedup Ratio', test_restore:'Test Restore Frequency',
  restore_sla:'Restore SLA (hours)', tape_lib:'Tape Library', cloud_tier:'Cloud Tier Target',
  immutable:'Immutable Backup', ransomware:'Ransomware Protection', bk_window_dur:'Backup Window Duration',
  bk_priority:'Backup Priority', notify_email:'Notification Email', pre_script:'Pre-Backup Script',
  post_script:'Post-Backup Script', synthetic_full:'Synthetic Full Enabled',
  // Network
  bandwidth:'Network Bandwidth', vlan_ids:'VLAN IDs / Subnets', mtu:'MTU Setting',
  bond_mode:'Bond / LAG Mode', fw_rules:'Firewall Rules', load_bal:'Load Balancer Config',
  dns_ttl:'DNS TTL (seconds)', ntp_source:'NTP Source', proxy_url:'Proxy URL',
  ipv4_subnet:'IPv4 Subnet / CIDR', ipv6_prefix:'IPv6 Prefix', default_gw:'Default Gateway',
  vip_addr:'VIP / Floating IP', bgp_asn:'BGP ASN', ospf_area:'OSPF Area',
  qos_net:'QoS / Traffic Shaping', jumbo_vlan:'Jumbo Frame VLANs', port_sec:'Port Security',
  dhcp:'DHCP Config', nat_policy:'NAT Policy', vpn_gw:'VPN Gateway',
  sd_wan:'SD-WAN Policy', ddos:'DDoS Protection', net_monitor:'Network Monitor',
  snmp:'SNMP Config', netflow:'NetFlow / sFlow', trunk_vlans:'Trunk VLANs',
  access_vlan:'Access VLAN', iface_speed:'Interface Speed',
  // Security
  patch_sla:'Patch SLA (hours by severity)', scan_freq:'Scan Frequency',
  mfa_required:'MFA Required', siem_endpoint:'SIEM Endpoint', vuln_score_max:'Max CVSS Score at Go-Live',
  cert_expiry_alert:'Cert Expiry Alert (days)', compliance_framework:'Compliance Framework',
  backup_encryption:'Backup Encryption Standard', access_review:'Access Review Frequency',
  pam:'PAM Solution', secrets_mgr:'Secrets Manager', key_mgmt:'Key Management',
  hsm:'HSM Config', ids_ips:'IDS / IPS Solution', edr:'EDR Solution',
  dlp:'DLP Config', fw_type:'Firewall / WAF Type', pentest:'Pen Test Schedule',
  sec_baseline:'Security Baseline', hardening:'Hardening Standard', log_ret_sec:'Security Log Retention',
  ir_playbook:'IR Playbook', change_ctrl:'Change Control Process', data_class:'Data Classification',
  enc_rest:'Encryption at Rest', enc_transit:'Encryption in Transit', zero_trust:'Zero Trust Model',
  supply_chain:'Supply Chain Security', sec_training:'Security Training',
};

const HW_OPTIONS = [
  'IBM Power10 / Power11','IBM Power9','IBM Power7 / Power8','IBM z16 Mainframe','Oracle Exadata X10M',
  'Dell PowerEdge (x86_64)','HPE ProLiant (x86_64)','Cisco UCS (x86_64)','Lenovo ThinkSystem (x86_64)',
  'AWS Graviton4 ARM64','AWS Graviton5 ARM64','Azure Cobalt 100/200 ARM64','GCP Axion ARM64',
  'AMD EPYC Turin x86_64','Intel Xeon SP 4th Gen','NVIDIA DGX H100','x86_64 Legacy','x86_64 Cloud',
];
const OS_OPTIONS = [
  'RHEL 9.x','RHEL 8.x','RHEL 7.x (EOL)','Ubuntu 24.04 LTS','Ubuntu 22.04 LTS',
  'AIX 7.3','AIX 7.2','AIX 6.1 (EOL)','Solaris 11.4','Solaris 10 (EOL)',
  'Windows Server 2025','Windows Server 2022','Windows Server 2019','Windows Server 2016',
  'SUSE SLES 15 SP6','SUSE SLES 12 SP5','Debian 12','Rocky Linux 9','AlmaLinux 9',
  'Oracle Linux 9','z/OS 3.1',
];
const DB_OPTIONS = [
  'Oracle 19c (LTS)','Oracle 23ai','Oracle 12cR2','Oracle 11gR2 (EOL)',
  'PostgreSQL 16','PostgreSQL 15','MySQL 8.4 LTS','MySQL 8.0','MariaDB 11.4 LTS',
  'IBM DB2 LUW 12.1','IBM DB2 LUW 11.5','SAP Sybase ASE 16.0 SP04','SAP Sybase ASE 15.7',
  'SAP HANA 2.0 SPS07','SQL Server 2022','SQL Server 2019','MongoDB 7.0 LTS',
  'Redis 7.2','Cassandra 5.0','Elasticsearch 8.x',
];
const APP_OPTIONS = [
  'Apache Tomcat 10.1 (Jakarta EE 10)','Apache Tomcat 9.0','IBM WebSphere 9.0.5',
  'IBM Open Liberty 24.x','Oracle WebLogic 14.1.2','Oracle WebLogic 12.2.1',
  'JBoss EAP 8.0 (Jakarta EE 10)','JBoss EAP 7.4','Spring Boot 3.x','Spring Boot 2.x',
  'Node.js 22 LTS','Node.js 20 LTS','Python 3.12 / Django 5','Python 3.11 / FastAPI',
  'SAP NetWeaver 7.50','Quarkus 3.x','WildFly 32','.NET 8 LTS (ASP.NET Core)',
  'NGINX 1.26','Apache HTTPD 2.4',
];

const initDesignData = () => {
  const d = {};
  DESIGN_SECTIONS.forEach(s => { d[s.key] = {}; s.fields.forEach(f => { d[s.key][f] = ''; }); });
  return d;
};

export { DESIGN_SECTIONS, FIELD_LABELS, HW_OPTIONS, OS_OPTIONS, DB_OPTIONS, APP_OPTIONS };

// Migrate old single-freeze fields to changePeriods array format
function migrateLegacyFreeze(b) {
  const periods = [];
  if (b.requirements?.changeFreezeStart) {
    periods.push({ id: '1', type: 'freeze', label: 'Change Freeze', start: b.requirements.changeFreezeStart, end: b.requirements.changeFreezeEnd || '' });
  }
  if (b.requirements?.holidays) {
    b.requirements.holidays.split(',').map(h => h.trim()).filter(Boolean).forEach((h, i) => {
      periods.push({ id: 'h' + i, type: 'holiday', label: 'Holiday', start: h, end: h });
    });
  }
  return periods;
}

export const useStore = create((set, get) => ({
  // Core state flags
  isBuilt: false,
  scanComplete: false,
  designApplied: false,
  phase2Active: false,
  cabApproved: false,
  rtmSigned: false,
  rtmStale: false,
  promoted: false,
  rtmBaseline: null, // { ctx, sysDesignData } snapshot captured at RTM sign-off

  // Dirty tracking — true whenever state has changed since last save/load
  isDirty: false,
  currentBuildId: null,

  // Context
  ctx: { hw: '', os: '', db: '', app: '' },

  // Requirements
  requirements: {
    projectName: '', envType: 'Production', goLiveDate: '', sla: '99.9',
    loadProfile: '', dataVolume: '', compliance: '', drTier: 'Tier 1', constraints: '',
    projectStartDate: '', changeFreezeStart: '', changeFreezeEnd: '', holidays: '',
    hoursPerDay: '8', pmEmail: '', pmBackupEmail: '',
    pmDecisionLog: '', // PM-only freeform decision journal (restricted edit)
  },

  // Regions in scope
  selRegions: ['Production'],

  // Change periods: [{ id, type: 'freeze'|'holiday'|'break', label, start, end }]
  changePeriods: [],

  // Gantt task overrides: { [taskKey]: { durationHours, dep, parallel } }
  ganttOverrides: {},

  // Selections (as arrays, not Sets, for Zustand serialization)
  selInc: [],
  selUUM: [],
  selFix: [],

  // System design
  sysDesignData: initDesignData(),
  sdAiTasks: [],

  // Scan results
  scanResults: [],

  // Emergency changes
  emergencyChanges: [],

  // RTM row statuses: { [id]: 'PASS' | 'FAIL' | 'PENDING' | 'NA' | 'BLOCKED' }
  rtmRows: {},

  // Custom incidents added by user beyond catalog
  customInc: [],

  // Custom UUM items added by user beyond catalog
  customUUM: [],

  // CAB declined state
  cabDeclined: false,

  // Revision mode — unlocked after CAB decline so PM can update any tab
  unlockedForRevision: false,

  // Live EOL data from endoflife.date API: { [componentName]: { slug, matchedCycle, allCycles, fetchedAt, error } }
  liveEolData: {},

  // Tasks stale reason — set when design/incidents/periods change after tasks generated
  tasksStaleReason: null,

  // Role assignments: { [roleName]: { name, email, backup, raci } }
  roleAssignments: {},

  // Locked design fields: { 'section.field': { lockedBy: string, note: string, value: string } }
  lockedDesignFields: {},

  // Closure checklist manual checks: { [id]: boolean }
  closureChecks: {},

  // Closure notes text
  closureNotes: '',

  // Cross-tab coherence alerts from the agent engine: [{ id, severity, tabs, message, action }]
  coherenceAlerts: [],

  // OpsMentor user-added tasks: [{ id, title, est_hours, addedAt, notes }]
  customMentorTasks: [],

  // OpsMentor user-added RAID entries: [{ id, type, description, severity, mitigation, status, owner, addedAt }]
  customRaidEntries: [],

  // Per-section custom tasks: { [groupKey]: [{ id, title, est_hours, role, notes }] }
  customSectionTasks: {},

  // Vulnerability registry: [{ id, title, cveId, component, severity, description, status, businessDecision, workaround, source, addedAt, updatedAt, fixTargetDate }]
  // status: ACTIVE | PARKED | WORKAROUND | FIXED | ACCEPTED_RISK
  vulnRegistry: [],

  // Risk tracker acknowledgments: { [riskId]: { status, notes, acknowledgedAt } }
  // Keyed by computed risk id. Not all live risks will have an entry (default is 'open').
  riskAcknowledgments: {},

  // Cost management config (optional feature — enabled: false by default)
  costConfig: {
    enabled: false,
    currency: 'USD',
    totalBudget: 0,
    dailyRatePerPerson: 800,
    teamSize: 5,
    contingencyPct: 20,
  },

  // Stakeholder discussion log: [{ id, topic, question, owner, type, status, addedAt, resolvedAt, notes }]
  // type: team-agreement | client-review | acceptance-criteria | compliance-sign-off
  // status: PENDING | IN_DISCUSSION | AGREED | REJECTED
  stakeholderDiscussions: [],

  // Persistent action audit log: [{ id, ts, type, description, user, phase, status }]
  // Capped at 500 entries. Persisted to Dexie + Firestore with the build.
  actionAuditLog: [],

  // Active PM tab
  activeTab: 'exec',

  // System design section expand state
  designSectionOpen: {},

  // UI theme: 'dark' (default navy sidebar) | 'light' (white sidebar)
  theme: (() => {
    const t = (typeof localStorage !== 'undefined' && localStorage.getItem('opsmanifest_theme')) || 'dark';
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
    return t;
  })(),

  // Actions
  setCoherenceAlerts: (alerts) => set({ coherenceAlerts: alerts }),

  toggleTheme: () => set(s => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('opsmanifest_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    return { theme: next };
  }),

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  setCurrentBuildId: (id) => set({ currentBuildId: id }),

  setCtx: (ctx) => set({ ctx }),
  setRequirements: (req) => set(s => {
    const scheduleChanged = s.designApplied && (
      req.hoursPerDay !== s.requirements.hoursPerDay ||
      req.projectStartDate !== s.requirements.projectStartDate
    );
    return { requirements: req, isDirty: true, ...(scheduleChanged ? { tasksStaleReason: 'Project schedule changed — tasks may not reflect new dates' } : {}) };
  }),

  setSelRegions: (regions) => set({ selRegions: regions, isDirty: true }),
  setChangePeriods: (periods) => set(s => ({
    changePeriods: periods, isDirty: true,
    ...(s.designApplied ? { tasksStaleReason: 'Change periods updated — task schedule may have shifted' } : {}),
  })),
  setGanttOverride: (key, patch) => set(s => ({
    ganttOverrides: { ...s.ganttOverrides, [key]: { ...(s.ganttOverrides[key] || {}), ...patch } },
    isDirty: true,
  })),
  clearGanttOverride: (key) => set(s => {
    const next = { ...s.ganttOverrides };
    delete next[key];
    return { ganttOverrides: next, isDirty: true };
  }),

  build: (ctx) => set({
    isBuilt: true, scanComplete: false, designApplied: false,
    phase2Active: false, cabApproved: false, cabDeclined: false, rtmSigned: false, promoted: false,
    ctx, selInc: [], selUUM: [], selFix: [], sdAiTasks: [], customInc: [], customUUM: [],
    customMentorTasks: [], customRaidEntries: [], customSectionTasks: {},
    vulnRegistry: [], stakeholderDiscussions: [], actionAuditLog: [], riskAcknowledgments: {},
    sysDesignData: initDesignData(), scanResults: [], activeTab: 'exec',
    lockedDesignFields: {}, isDirty: true, currentBuildId: null,
    unlockedForRevision: false, tasksStaleReason: null, rtmStale: false, roleAssignments: {},
  }),

  completeScan: (results) => set({ scanComplete: true, scanResults: results || [], isDirty: true }),

  applyDesign: () => set({ designApplied: true, isDirty: true }),

  startPhase2: () => set({ phase2Active: true, isDirty: true }),

  toggleInc: (code) => set(s => ({
    selInc: s.selInc.includes(code) ? s.selInc.filter(c => c !== code) : [...s.selInc, code],
    isDirty: true,
    ...(s.phase2Active ? { tasksStaleReason: 'Incidents changed — tasks may not reflect current scope' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  toggleUUM: (code) => set(s => ({
    selUUM: s.selUUM.includes(code) ? s.selUUM.filter(c => c !== code) : [...s.selUUM, code],
    isDirty: true,
    ...(s.phase2Active ? { tasksStaleReason: 'UUM items changed — task sequences may have changed' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  toggleFix: (code) => set(s => ({
    selFix: s.selFix.includes(code) ? s.selFix.filter(c => c !== code) : [...s.selFix, code],
    isDirty: true,
  })),

  setCabApproved: (val) => set({ cabApproved: val, cabDeclined: false, isDirty: true }),
  setCabDeclined: (val) => set({ cabDeclined: val, cabApproved: false, isDirty: true }),

  addCustomInc: (inc) => set(s => ({ customInc: [...s.customInc, inc], isDirty: true })),
  removeCustomInc: (id) => set(s => ({ customInc: s.customInc.filter(i => i.id !== id), isDirty: true })),

  addCustomMentorTask: (task) => set(s => ({ customMentorTasks: [...(s.customMentorTasks || []), task], isDirty: true })),
  removeCustomMentorTask: (id) => set(s => ({ customMentorTasks: (s.customMentorTasks || []).filter(t => t.id !== id), isDirty: true })),
  addCustomRaidEntry: (entry) => set(s => ({ customRaidEntries: [...(s.customRaidEntries || []), entry], isDirty: true })),
  removeCustomRaidEntry: (id) => set(s => ({ customRaidEntries: (s.customRaidEntries || []).filter(e => e.id !== id), isDirty: true })),
  updateCustomRaidEntry: (id, patch) => set(s => ({
    customRaidEntries: (s.customRaidEntries || []).map(e => e.id === id ? { ...e, ...patch } : e),
    isDirty: true,
  })),
  addSectionTask: (groupKey, task) => set(s => ({
    customSectionTasks: { ...(s.customSectionTasks || {}), [groupKey]: [...(s.customSectionTasks?.[groupKey] || []), task] },
    isDirty: true,
  })),
  removeSectionTask: (groupKey, taskId) => set(s => ({
    customSectionTasks: { ...(s.customSectionTasks || {}), [groupKey]: (s.customSectionTasks?.[groupKey] || []).filter(t => t.id !== taskId) },
    isDirty: true,
  })),
  updateSectionTask: (groupKey, taskId, patch) => set(s => ({
    customSectionTasks: { ...(s.customSectionTasks || {}), [groupKey]: (s.customSectionTasks?.[groupKey] || []).map(t => t.id === taskId ? { ...t, ...patch } : t) },
    isDirty: true,
  })),

  // Vulnerability registry actions
  addVuln: (vuln) => set(s => ({ vulnRegistry: [...(s.vulnRegistry || []), vuln], isDirty: true })),
  updateVuln: (id, patch) => set(s => ({
    vulnRegistry: (s.vulnRegistry || []).map(v => v.id === id ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v),
    isDirty: true,
  })),
  removeVuln: (id) => set(s => ({ vulnRegistry: (s.vulnRegistry || []).filter(v => v.id !== id), isDirty: true })),

  // Stakeholder discussion actions
  addStakeholderDiscussion: (entry) => set(s => ({ stakeholderDiscussions: [...(s.stakeholderDiscussions || []), entry], isDirty: true })),
  updateStakeholderDiscussion: (id, patch) => set(s => ({
    stakeholderDiscussions: (s.stakeholderDiscussions || []).map(d => d.id === id ? { ...d, ...patch } : d),
    isDirty: true,
  })),

  // Risk acknowledgment
  acknowledgeRisk: (id, data) => set(s => ({
    riskAcknowledgments: { ...s.riskAcknowledgments, [id]: data },
    isDirty: true,
  })),

  // Cost config
  setCostConfig: (cfg) => set({ costConfig: cfg, isDirty: true }),

  // Action audit log
  logAuditAction: (entry) => set(s => {
    const log = [...(s.actionAuditLog || []), entry];
    return { actionAuditLog: log.slice(-500), isDirty: true };
  }),

  addCustomUUM: (uum) => set(s => ({ customUUM: [...(s.customUUM || []), uum], isDirty: true })),
  updateCustomUUM: (id, patch) => set(s => ({
    customUUM: (s.customUUM || []).map(u => u.id === id ? { ...u, ...patch } : u),
    isDirty: true,
  })),
  removeCustomUUM: (id) => set(s => ({
    customUUM: (s.customUUM || []).filter(u => u.id !== id),
    selUUM: s.selUUM.filter(c => c !== id),
    isDirty: true,
  })),

  lockDesignField: (key, data) => set(s => ({
    lockedDesignFields: { ...s.lockedDesignFields, [key]: data }, isDirty: true,
  })),
  unlockDesignField: (key) => set(s => {
    const next = { ...s.lockedDesignFields };
    delete next[key];
    return { lockedDesignFields: next, isDirty: true };
  }),

  signRtm: () => set(s => ({
    rtmSigned: true, rtmStale: false, isDirty: true,
    rtmBaseline: { ctx: s.ctx, sysDesignData: s.sysDesignData },
  })),

  promote: () => set({ promoted: true, isDirty: true }),

  setDesignField: (section, field, value) => set(s => ({
    sysDesignData: {
      ...s.sysDesignData,
      [section]: { ...s.sysDesignData[section], [field]: value },
    },
    isDirty: true,
    ...(s.designApplied ? { tasksStaleReason: 'System design changed — tasks may not reflect current configuration' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  setAllDesignFields: (data) => set(s => ({
    sysDesignData: data, isDirty: true,
    ...(s.designApplied ? { tasksStaleReason: 'System design changed — tasks may not reflect current configuration' } : {}),
    ...(s.rtmSigned ? { rtmStale: true } : {}),
  })),

  setAiTasks: (tasks) => set({ sdAiTasks: tasks, isDirty: true }),
  setTasksStaleReason: (reason) => set({ tasksStaleReason: reason }),
  setRtmStale: (val) => set({ rtmStale: val }),
  setUnlockedForRevision: (val) => set(s => ({
    unlockedForRevision: val,
    ...(val && s.designApplied ? { tasksStaleReason: 'Build unlocked for revision — regenerate tasks to reflect current scope' } : {}),
  })),
  setRoleAssignment: (role, data) => set(s => ({ roleAssignments: { ...s.roleAssignments, [role]: data }, isDirty: true })),
  resubmitCAB: () => set({ cabDeclined: false, unlockedForRevision: false, isDirty: true }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleDesignSection: (key) => set(s => ({
    designSectionOpen: { ...s.designSectionOpen, [key]: !s.designSectionOpen[key] },
  })),

  addEmergencyChange: (change) => set(s => ({
    emergencyChanges: [...s.emergencyChanges, change], isDirty: true,
  })),

  setRtmRow: (id, status) => set(s => ({
    rtmRows: { ...s.rtmRows, [id]: status }, isDirty: true,
  })),

  setClosureCheck: (id, value) => set(s => ({
    closureChecks: { ...s.closureChecks, [id]: value }, isDirty: true,
  })),

  setClosureNotes: (notes) => set({ closureNotes: notes, isDirty: true }),

  setLiveEolData: (componentName, data) => set(s => ({
    liveEolData: { ...s.liveEolData, [componentName]: data },
  })),

  // Live compatibility data — fetched from endoflife.date on every app open.
  // Keyed by COMPAT_RULES rule id. Runtime-only — not persisted.
  liveCompatData: {},
  liveCompatVerifiedAt: null,
  setLiveCompatData: (ruleId, data) => set(s => ({
    liveCompatData: { ...s.liveCompatData, [ruleId]: data },
  })),
  setLiveCompatVerifiedAt: ts => set({ liveCompatVerifiedAt: ts }),

  loadBuild: (b) => set({
    isBuilt: b.isBuilt ?? false,
    scanComplete: b.scanComplete ?? false,
    designApplied: b.designApplied ?? false,
    phase2Active: b.phase2Active ?? false,
    cabApproved: b.cabApproved ?? false,
    cabDeclined: b.cabDeclined ?? false,
    rtmSigned: b.rtmSigned ?? false,
    promoted: b.promoted ?? false,
    ctx: b.ctx ?? { hw: '', os: '', db: '', app: '' },
    requirements: b.requirements ?? {},
    selInc: b.selInc ?? [],
    selUUM: b.selUUM ?? [],
    selFix: b.selFix ?? [],
    customInc: b.customInc ?? [],
    customUUM: b.customUUM ?? [],
    customMentorTasks: b.customMentorTasks ?? [],
    customRaidEntries: b.customRaidEntries ?? [],
    customSectionTasks: b.customSectionTasks ?? {},
    sysDesignData: b.sysDesignData ?? initDesignData(),
    sdAiTasks: b.sdAiTasks ?? [],
    scanResults: b.scanResults ?? [],
    rtmRows: b.rtmRows ?? {},
    closureChecks: b.closureChecks ?? {},
    closureNotes: b.closureNotes ?? '',
    emergencyChanges: b.emergencyChanges ?? [],
    lockedDesignFields: b.lockedDesignFields ?? {},
    selRegions: b.selRegions ?? ['Production'],
    changePeriods: b.changePeriods ?? migrateLegacyFreeze(b),
    ganttOverrides: b.ganttOverrides ?? {},
    unlockedForRevision: b.unlockedForRevision ?? false,
    tasksStaleReason: b.tasksStaleReason ?? null,
    rtmStale: b.rtmStale ?? false,
    roleAssignments: b.roleAssignments ?? {},
    vulnRegistry: b.vulnRegistry ?? [],
    stakeholderDiscussions: b.stakeholderDiscussions ?? [],
    actionAuditLog: b.actionAuditLog ?? [],
    riskAcknowledgments: b.riskAcknowledgments ?? {},
    costConfig: b.costConfig ?? { enabled: false, currency: 'USD', totalBudget: 0, dailyRatePerPerson: 800, teamSize: 5, contingencyPct: 20 },
    activeTab: 'exec',
    isDirty: false,
  }),
}));
