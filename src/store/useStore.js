import { create } from 'zustand';

const DESIGN_SECTIONS = [
  { key: 'unix',     label: 'Unix / OS',     owner: 'Unix Admin',    fields: ['cpu','ram','swap','kernel_params','patch_window','ntp_server','dns_server','timezone','monitoring_agent','notes'] },
  { key: 'web',      label: 'Web / HTTP',    owner: 'Web Admin',     fields: ['worker_proc','keepalive','max_conn','ssl_cert_expiry','log_retention','reverse_proxy','load_bal_algo','session_timeout','health_check_url','notes'] },
  { key: 'app',      label: 'Application',   owner: 'App Admin',     fields: ['jvm_xmx','jvm_xms','thread_pool','datasource_pool','deploy_method','app_port','heap_ratio','gc_policy','log_level','notes'] },
  { key: 'db',       label: 'Database',      owner: 'DB Admin',      fields: ['buf_pool','max_conn','redo_size','archive_dest','backup_window','standby_lag','stats_window','tablespace_pct','listener_port','notes'] },
  { key: 'storage',  label: 'Storage',       owner: 'Storage Admin', fields: ['lun_size','iops_req','replication_factor','snapshot_policy','multipath_mode','nfs_mount','san_fabric','thin_prov','raid_level','notes'] },
  { key: 'backup',   label: 'Backup / DR',   owner: 'Backup Admin',  fields: ['rpo_hours','rto_hours','full_day','incr_freq','retention_daily','retention_weekly','retention_monthly','offsite_target','encryption','notes'] },
  { key: 'network',  label: 'Network',       owner: 'Net Admin',     fields: ['bandwidth','vlan_ids','mtu','bond_mode','fw_rules','load_bal','dns_ttl','ntp_source','proxy_url','notes'] },
  { key: 'security', label: 'Security',      owner: 'SecOps',        fields: ['patch_sla','scan_freq','mfa_required','siem_endpoint','vuln_score_max','cert_expiry_alert','compliance_framework','backup_encryption','access_review','notes'] },
];

const FIELD_LABELS = {
  cpu:'CPU Allocation', ram:'RAM Allocation', swap:'Swap / Page Space', kernel_params:'Kernel Parameters',
  patch_window:'Patch Window', ntp_server:'NTP Server', dns_server:'DNS Server', timezone:'Timezone',
  monitoring_agent:'Monitoring Agent', notes:'Notes / Comments',
  worker_proc:'Worker Processes', keepalive:'Keepalive Timeout (s)', max_conn:'Max Connections',
  ssl_cert_expiry:'SSL Cert Expiry', log_retention:'Log Retention', reverse_proxy:'Reverse Proxy Target',
  load_bal_algo:'Load Balancer Algorithm', session_timeout:'Session Timeout (s)', health_check_url:'Health Check URL',
  jvm_xmx:'JVM Xmx (heap max)', jvm_xms:'JVM Xms (heap min)', thread_pool:'Thread Pool Size',
  datasource_pool:'Datasource Pool Size', deploy_method:'Deployment Method', app_port:'Application Port',
  heap_ratio:'Heap Ratio (%)', gc_policy:'GC Policy', log_level:'Log Level',
  buf_pool:'Buffer Pool Size', redo_size:'Redo / WAL Log Size', archive_dest:'Archive Destination',
  backup_window:'Backup Window', standby_lag:'Standby Lag Target', stats_window:'Stats Gather Window',
  tablespace_pct:'Tablespace Alert % Threshold', listener_port:'Listener Port',
  lun_size:'LUN Size Allocation', iops_req:'IOPS Requirement', replication_factor:'Replication Factor',
  snapshot_policy:'Snapshot Policy', multipath_mode:'Multipath Mode', nfs_mount:'NFS Mount Options',
  san_fabric:'SAN Fabric Type', thin_prov:'Thin Provisioning', raid_level:'RAID Level',
  rpo_hours:'RPO (hours)', rto_hours:'RTO (hours)', full_day:'Full Backup Schedule',
  incr_freq:'Incremental Frequency', retention_daily:'Daily Retention (days)',
  retention_weekly:'Weekly Retention (weeks)', retention_monthly:'Monthly Retention (months)',
  offsite_target:'Offsite / Cloud Target', encryption:'Backup Encryption',
  bandwidth:'Network Bandwidth', vlan_ids:'VLAN IDs / Subnets', mtu:'MTU Setting',
  bond_mode:'Bond Mode', fw_rules:'Firewall Rules', load_bal:'Load Balancer Config',
  dns_ttl:'DNS TTL (seconds)', ntp_source:'NTP Source', proxy_url:'Proxy URL',
  patch_sla:'Patch SLA (hours by severity)', scan_freq:'Scan Frequency',
  mfa_required:'MFA Required', siem_endpoint:'SIEM Endpoint', vuln_score_max:'Max CVSS Score at Go-Live',
  cert_expiry_alert:'Cert Expiry Alert (days)', compliance_framework:'Compliance Framework',
  backup_encryption:'Backup Encryption Standard', access_review:'Access Review Frequency',
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
