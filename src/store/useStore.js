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

export const useStore = create((set, get) => ({
  // Core state flags
  isBuilt: false,
  scanComplete: false,
  designApplied: false,
  phase2Active: false,
  cabApproved: false,
  rtmSigned: false,
  promoted: false,

  // Context
  ctx: { hw: '', os: '', db: '', app: '' },

  // Requirements
  requirements: {
    projectName: '', envType: 'Production', goLiveDate: '', sla: '99.9',
    loadProfile: '', dataVolume: '', compliance: '', drTier: 'Tier 1', constraints: '',
  },

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

  // Closure checklist manual checks: { [id]: boolean }
  closureChecks: {},

  // Closure notes text
  closureNotes: '',

  // Active PM tab
  activeTab: 'exec',

  // System design section expand state
  designSectionOpen: {},

  // Actions
  setCtx: (ctx) => set({ ctx }),
  setRequirements: (req) => set({ requirements: req }),

  build: (ctx) => set({
    isBuilt: true, scanComplete: false, designApplied: false,
    phase2Active: false, cabApproved: false, rtmSigned: false, promoted: false,
    ctx, selInc: [], selUUM: [], selFix: [], sdAiTasks: [],
    sysDesignData: initDesignData(), scanResults: [], activeTab: 'exec',
  }),

  completeScan: (results) => set({ scanComplete: true, scanResults: results || [] }),

  applyDesign: () => set({ designApplied: true }),

  startPhase2: () => set({ phase2Active: true }),

  toggleInc: (code) => set(s => ({
    selInc: s.selInc.includes(code) ? s.selInc.filter(c => c !== code) : [...s.selInc, code],
  })),

  toggleUUM: (code) => set(s => ({
    selUUM: s.selUUM.includes(code) ? s.selUUM.filter(c => c !== code) : [...s.selUUM, code],
  })),

  toggleFix: (code) => set(s => ({
    selFix: s.selFix.includes(code) ? s.selFix.filter(c => c !== code) : [...s.selFix, code],
  })),

  setCabApproved: (val) => set({ cabApproved: val }),

  signRtm: () => set({ rtmSigned: true }),

  promote: () => set({ promoted: true }),

  setDesignField: (section, field, value) => set(s => ({
    sysDesignData: {
      ...s.sysDesignData,
      [section]: { ...s.sysDesignData[section], [field]: value },
    },
  })),

  setAllDesignFields: (data) => set({ sysDesignData: data }),

  setAiTasks: (tasks) => set({ sdAiTasks: tasks }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleDesignSection: (key) => set(s => ({
    designSectionOpen: { ...s.designSectionOpen, [key]: !s.designSectionOpen[key] },
  })),

  addEmergencyChange: (change) => set(s => ({
    emergencyChanges: [...s.emergencyChanges, change],
  })),

  setRtmRow: (id, status) => set(s => ({
    rtmRows: { ...s.rtmRows, [id]: status },
  })),

  setClosureCheck: (id, value) => set(s => ({
    closureChecks: { ...s.closureChecks, [id]: value },
  })),

  setClosureNotes: (notes) => set({ closureNotes: notes }),
}));
