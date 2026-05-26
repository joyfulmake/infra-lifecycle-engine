const EOL_DB = [
  { match: s => s.os.includes('rhel 7'), sev: 'CRITICAL', component: 'RHEL 7.x', msg: 'EOL June 2024 — no free security patches. ELS available at cost until Jun 2026. Migrate to RHEL 9.x immediately.' },
  { match: s => s.os.includes('rhel 8'), sev: 'MEDIUM', component: 'RHEL 8.x', msg: 'Maintenance mode. EUS available. Upgrade to RHEL 9.x before May 2029 EOM.' },
  { match: s => s.os.includes('aix 6'), sev: 'CRITICAL', component: 'AIX 6.1', msg: 'EOL — no patches available. Migrate to AIX 7.3 immediately.' },
  { match: s => s.os.includes('aix 7.2'), sev: 'HIGH', component: 'AIX 7.2', msg: 'EOS April 2023. Upgrade to AIX 7.3 TL2 SP2+. IBM support void on 7.2.' },
  { match: s => s.os.includes('solaris 10'), sev: 'CRITICAL', component: 'Solaris 10', msg: 'EOL January 2021. Migrate to Solaris 11.4 or RHEL 9 immediately.' },
  { match: s => s.os.includes('windows server 2016'), sev: 'HIGH', component: 'Windows Server 2016', msg: 'EOL January 2027 (<1 year). Plan upgrade to Windows Server 2022 or 2025.' },
  { match: s => s.os.includes('windows server 2019'), sev: 'MEDIUM', component: 'Windows Server 2019', msg: 'EOL January 2029. Begin upgrade planning to Windows Server 2025.' },
  { match: s => s.db.includes('oracle 11g'), sev: 'CRITICAL', component: 'Oracle 11gR2', msg: 'Extended Support ended Dec 2013. Sustaining Support only — no new patches. Migrate to Oracle 19c LTS.' },
  { match: s => s.db.includes('oracle 12c'), sev: 'HIGH', component: 'Oracle 12cR2', msg: 'Extended Support ended Dec 2022. In Sustaining Support. Upgrade: 12c→19c in-place supported.' },
  { match: s => s.db.includes('mysql 8.0'), sev: 'LOW', component: 'MySQL 8.0', msg: 'LTS supported until April 2026. CVE-2024-20998 (patched in 8.0.37). Ensure latest minor version.' },
  { match: s => s.db.includes('postgresql 15'), sev: 'LOW', component: 'PostgreSQL 15', msg: 'Supported until November 2027. Consider upgrading to PG 16 for new features. Apply latest minor.' },
  { match: s => s.db.includes('mariadb 10.6'), sev: 'MEDIUM', component: 'MariaDB 10.6 LTS', msg: 'LTS ends July 2026. Plan migration to MariaDB 11.4 LTS (supported May 2029).' },
  { match: s => s.db.includes('sybase') || s.db.includes('ase 15.7'), sev: 'CRITICAL', component: 'SAP Sybase ASE 15.7', msg: 'EOL. Migrate to SAP ASE 16.0 SP04 or consider PostgreSQL migration.' },
  { match: s => s.app.includes('spring boot 2'), sev: 'HIGH', component: 'Spring Boot 2.x', msg: 'EOL November 2023. CVE-2022-22965 (Spring4Shell) affects 2.x. Migrate to Spring Boot 3.x (JDK 17+ required).' },
  { match: s => s.app.includes('tomcat 8.5') || s.app.includes('tomcat 8'), sev: 'HIGH', component: 'Apache Tomcat 8.5', msg: 'EOL March 2024. Upgrade to Tomcat 9.0 (Jakarta EE 8) or 10.1 (Jakarta EE 10).' },
  { match: s => s.app.includes('tomcat 9.0'), sev: 'LOW', component: 'Apache Tomcat 9.0', msg: 'Supported. CVE-2024-24549 patched in 9.0.87+. Verify latest minor version is deployed.' },
  { match: s => s.app.includes('node.js 18'), sev: 'MEDIUM', component: 'Node.js 18 LTS', msg: 'Maintenance phase — EOL April 2025. Upgrade to Node.js 20 LTS (Apr 2026) or 22 LTS (Apr 2027).' },
  { match: s => s.app.includes('weblogic 12.2.1'), sev: 'HIGH', component: 'Oracle WebLogic 12.2.1', msg: 'EOS January 2027. CVE-2023-21839, CVE-2024-20931 (critical RCEs). Patch immediately + plan upgrade to 14.1.2.' },
  { match: s => s.app.includes('jboss eap 7.4'), sev: 'LOW', component: 'JBoss EAP 7.4', msg: 'LTS until June 2026. Apply latest CP. Begin planning migration to EAP 8.0 (Jakarta EE 10).' },
  { match: s => s.app.includes('websphere 9'), sev: 'MEDIUM', component: 'IBM WebSphere 9.0.5', msg: 'Traditional WebSphere in extended support. CVE-2024-27270 (XSS). Apply latest fix pack. Consider Open Liberty migration.' },
  { match: s => s.hw.includes('power7') || s.hw.includes('power8'), sev: 'HIGH', component: 'IBM POWER7/8', msg: 'Power7/8 hardware EOM. IBM support may require extended agreements. Upgrade path: POWER10 S1022/S1024.' },
  { match: s => s.db.includes('redis 7'), sev: 'INFO', component: 'Redis 7.2', msg: 'Stable. Redis AGPL license change in 7.4+ — review licensing implications for commercial use. Consider Valkey fork.' },
  { match: s => s.db.includes('elasticsearch'), sev: 'INFO', component: 'Elasticsearch 8.x', msg: 'SSPL license. Ensure compliance. CVE-2024-37280 (authenticated info disclosure) — apply 8.14.1+.' },
];

const UNIVERSAL_FINDINGS = [
  { sev: 'INFO', component: 'CVE Monitoring', msg: 'Subscribe to vendor security advisories for all stack components via RSS or CISA KEV feed (cisa.gov/known-exploited-vulnerabilities).' },
  { sev: 'INFO', component: 'Patch Compliance', msg: 'Enforce 24h SLA for CVSS ≥9.0 Critical, 72h for CVSS ≥7.0 High, 30 days for Medium — per PCI-DSS 6.3.3 and ISO 27001 A.12.6.1.' },
  { sev: 'INFO', component: 'Container/OS Images', msg: 'Run Trivy or Grype image scan in CI/CD pipeline. Enforce no critical CVEs at deploy time (fail pipeline on CVSS ≥9.0).' },
  { sev: 'INFO', component: 'Supply Chain', msg: 'Generate SBOM (CycloneDX/SPDX) per release. Enable Snyk/Dependabot for dependency CVE alerts. Verify checksums for all third-party binaries.' },
];

// Auto-suggest relevant incidents and UUM items based on stack context
function getSuggestedCodes(ctx) {
  const hw = (ctx.hw || '').toLowerCase();
  const os = (ctx.os || '').toLowerCase();
  const db = (ctx.db || '').toLowerCase();
  const app = (ctx.app || '').toLowerCase();

  const inc = [];
  const uum = [];

  // OS-based incident suggestions
  if (os.includes('aix 6')) { inc.push('inc_1','inc_2','inc_59','inc_60','inc_61','inc_62'); }
  if (os.includes('aix 7.2')) { inc.push('inc_1','inc_2','inc_60','inc_61'); uum.push('uum_8'); }
  if (os.includes('aix 7.3')) { inc.push('inc_4','inc_5','inc_8'); }
  if (os.includes('rhel 7')) { inc.push('inc_18','inc_24_1','inc_17'); uum.push('uum_2','uum_94'); }
  if (os.includes('rhel 8')) { inc.push('inc_19','inc_20','inc_24_1'); uum.push('uum_6'); }
  if (os.includes('rhel 9') || os.includes('rhel 10')) { inc.push('inc_21','inc_24_2','inc_67'); }
  if (os.includes('windows server 2016')) { inc.push('inc_9','inc_14','inc_63'); uum.push('uum_3'); }
  if (os.includes('windows server 2019')) { inc.push('inc_11','inc_64','inc_66'); uum.push('uum_3'); }
  if (os.includes('windows server 2022')) { inc.push('inc_12','inc_13','inc_63'); }
  if (os.includes('ubuntu')) { inc.push('inc_24_1','inc_24_2','inc_68'); }
  if (os.includes('solaris 10')) { inc.push('inc_24'); uum.push('uum_5'); }
  if (hw.includes('power7') || hw.includes('power8')) { inc.push('inc_6'); uum.push('uum_37','uum_1'); }
  if (hw.includes('power9')) { inc.push('inc_7'); }

  // DB-based incident suggestions
  if (db.includes('oracle 11g')) { inc.push('inc_25','inc_26','inc_69'); uum.push('uum_9'); }
  if (db.includes('oracle 12c')) { inc.push('inc_27','inc_28','inc_69'); uum.push('uum_10'); }
  if (db.includes('oracle 19c')) { inc.push('inc_27','inc_29','inc_45'); uum.push('uum_15'); }
  if (db.includes('oracle 23')) { inc.push('inc_29','inc_31'); }
  if (db.includes('sybase') || db.includes('ase 15.7')) { inc.push('inc_33','inc_34','inc_73','inc_74'); uum.push('uum_11'); }
  if (db.includes('db2 luw 10.5') || db.includes('db2 10.5')) { inc.push('inc_41','inc_42','inc_77'); uum.push('uum_12'); }
  if (db.includes('db2 luw 11.5') || db.includes('db2 11.5')) { inc.push('inc_43','inc_44','inc_78'); uum.push('uum_13'); }
  if (db.includes('postgresql 15') || db.includes('postgresql 13')) { inc.push('inc_24_1'); uum.push('uum_16'); }
  if (db.includes('mysql 8.0')) { inc.push('inc_24'); }

  // App-based incident suggestions
  if (app.includes('spring boot 2') || app.includes('spring boot 3')) { inc.push('inc_50','inc_53'); uum.push('uum_21'); }
  if (app.includes('tomcat 8.5') || app.includes('tomcat 8')) { inc.push('inc_49','inc_51'); uum.push('uum_18'); }
  if (app.includes('tomcat 9') || app.includes('tomcat 10')) { inc.push('inc_23','inc_51'); }
  if (app.includes('websphere 9') || app.includes('websphere')) { inc.push('inc_46'); uum.push('uum_17'); }
  if (app.includes('weblogic 12.2') || app.includes('weblogic 14')) { inc.push('inc_46','inc_70'); uum.push('uum_20'); }
  if (app.includes('jboss eap 7') || app.includes('jboss eap 8')) { inc.push('inc_22','inc_49'); uum.push('uum_19'); }
  if (app.includes('node.js 18')) { inc.push('inc_24_1'); }

  // Universal CVE suggestions (always relevant)
  inc.push('inc_49','inc_54','inc_24_1'); // Log4Shell, XZ backdoor, OpenSSH regreSSHion
  uum.push('uum_29','uum_32','uum_33'); // TLS 1.3 enforcement, OS kernel CVE bundle, OpenSSL 3.x

  // Deduplicate, limit
  const incUniq = [...new Set(inc)].slice(0, 8);
  const uumUniq = [...new Set(uum)].slice(0, 6);
  return { suggestedInc: incUniq, suggestedUUM: uumUniq };
}

export function runSmartScan(ctx) {
  const hw = (ctx.hw || '').toLowerCase();
  const os = (ctx.os || '').toLowerCase();
  const db = (ctx.db || '').toLowerCase();
  const app = (ctx.app || '').toLowerCase();
  const stack = { hw, os, db, app };

  const findings = EOL_DB.filter(e => e.match(stack)).map(({ sev, component, msg }) => ({ sev, component, msg }));
  findings.push(...UNIVERSAL_FINDINGS);

  const critCount = findings.filter(f => f.sev === 'CRITICAL').length;
  const highCount = findings.filter(f => f.sev === 'HIGH').length;
  const riskLevel = critCount > 0 ? 'CRITICAL' : highCount > 1 ? 'HIGH' : highCount > 0 ? 'MEDIUM' : 'LOW';

  const { suggestedInc, suggestedUUM } = getSuggestedCodes(ctx);
  return { findings, riskLevel, suggestedInc, suggestedUUM };
}

export function generateTaskPlan(sysDesignData, ctx) {
  const tasks = [];
  let seq = 1;
  const id = () => 'T' + String(seq++).padStart(2, '0');

  const net = sysDesignData?.network || {};
  const stor = sysDesignData?.storage || {};
  const unix = sysDesignData?.unix || {};
  const db = sysDesignData?.db || {};
  const web = sysDesignData?.web || {};
  const app = sysDesignData?.app || {};
  const bk = sysDesignData?.backup || {};
  const sec = sysDesignData?.security || {};

  tasks.push({ id: id(), name: 'Network — VLAN provisioning and firewall rules', team: 'Net Admin', duration_hours: 4, depends_on: [], phase: 1, milestone: false, description: `Configure VLANs (${net.vlan_ids || 'per design'}), firewall rules (${net.fw_rules || 'per design'}), MTU ${net.mtu || '9000'}. Verify routing between tiers.` });
  tasks.push({ id: id(), name: 'Network — Load balancer VIP and health check', team: 'Net Admin', duration_hours: 3, depends_on: ['T01'], phase: 1, milestone: false, description: `Configure LB VIP (${net.vip_addr || net.load_bal || 'per design'}), algorithm: ${net.load_bal_algo || 'round-robin'}, health check on ${web.health_check_url || '/health'}.` });
  tasks.push({ id: id(), name: 'Network — Bonding, NTP, DNS, and monitoring', team: 'Net Admin', duration_hours: 2, depends_on: ['T01'], phase: 1, milestone: false, description: `Bond mode: ${net.bond_mode || 'LACP 802.3ad'}. NTP source: ${net.ntp_source || unix.ntp_server || '10.0.0.1'}. DNS: ${unix.dns_server || '10.0.0.2'}.` });
  tasks.push({ id: id(), name: 'Storage — LUN provisioning and multipath config', team: 'Storage Admin', duration_hours: 6, depends_on: ['T01'], phase: 1, milestone: false, description: `Provision ${stor.lun_size || '2TB data + 500GB redo'}. RAID: ${stor.raid_level || 'RAID-10'}. Multipath: ${stor.multipath_mode || 'DM-Multipath round-robin'}.` });
  tasks.push({ id: id(), name: 'Storage — Filesystem creation and snapshot policy', team: 'Storage Admin', duration_hours: 3, depends_on: ['T04'], phase: 1, milestone: false, description: `Create ${stor.fs_type_stor || 'XFS'} filesystems on ${stor.mount_point || '/data, /redo, /backup'}. Snapshot policy: ${stor.snapshot_policy || 'hourly-24, daily-30, weekly-12'}.` });
  tasks.push({ id: id(), name: 'Storage — QoS, tiering, and I/O priority', team: 'Storage Admin', duration_hours: 2, depends_on: ['T04'], phase: 1, milestone: false, description: `QoS policy: ${stor.qos_stor || 'DB: max 50K IOPS, backup: 500MB/s'}. Cache tier: ${stor.cache_tier || 'NVMe auto-tiering ON'}.` });
  tasks.push({ id: id(), name: 'Unix — OS provisioning, kernel tuning, ulimits', team: 'Unix Admin', duration_hours: 6, depends_on: ['T04'], phase: 1, milestone: false, description: `Platform: ${ctx.hw} / ${ctx.os}. CPU: ${unix.cpu || 'per design'}. RAM: ${unix.ram || 'per design'}. Kernel params: ${unix.kernel_params?.substring(0, 60) || 'per design'}...` });
  tasks.push({ id: id(), name: 'Unix — NTP, DNS, syslog, auditd, SSH hardening', team: 'Unix Admin', duration_hours: 3, depends_on: ['T07'], phase: 1, milestone: false, description: `NTP: ${unix.ntp_server || '10.0.0.1'}. SELinux: ${unix.selinux || 'Enforcing'}. SSH: ${unix.ssh_config || 'PermitRootLogin no, key-based only'}. Auditd: ${unix.auditd || 'enabled'}.` });
  tasks.push({ id: id(), name: 'Unix — Monitoring agent, hugepages, tuned profile', team: 'Unix Admin', duration_hours: 2, depends_on: ['T07'], phase: 1, milestone: false, description: `Deploy ${unix.monitoring_agent || 'Datadog Agent 7.x + node-exporter'}. Hugepages: ${unix.hugepages || 'per design'}. Tuned: ${unix.tuned_profile || 'throughput-performance'}.` });
  tasks.push({ id: id(), name: 'Database — Instance creation and memory config', team: 'DBA', duration_hours: 8, depends_on: ['T05', 'T07'], phase: 1, milestone: false, description: `Database: ${ctx.db}. Buffer pool: ${db.buf_pool?.substring(0, 60) || 'per design'}. Charset: ${db.charset || 'UTF8'}. TDE: ${db.tde || 'enabled'}.` });
  tasks.push({ id: id(), name: 'Database — Redo/WAL, archive, standby replication', team: 'DBA', duration_hours: 6, depends_on: ['T10'], phase: 1, milestone: false, description: `Redo: ${db.redo_size?.substring(0, 50) || 'per design'}. Archive: ${db.archive_dest || 'per design'}. Replication: ${db.replication || 'async streaming'}.` });
  tasks.push({ id: id(), name: 'Database — Connection pooler, max conn, failover', team: 'DBA', duration_hours: 4, depends_on: ['T10'], phase: 1, milestone: false, description: `Max connections: ${db.max_conn?.substring(0, 40) || 'per design'}. Pool: ${db.conn_pool || 'PgBouncer/DRCP'}. Failover: ${db.failover || 'Patroni / DataGuard FSFO'}.` });
  tasks.push({ id: id(), name: 'Database — Stats, indexes, vacuum, audit policy', team: 'DBA', duration_hours: 3, depends_on: ['T10'], phase: 1, milestone: false, description: `Stats window: ${db.stats_window || 'Sunday 04:00'}. Index strategy: ${db.index_strategy || 'auto-indexing + nightly rebuild'}. Audit: ${db.audit_db || 'DDL + privileged'}.` });
  tasks.push({ id: id(), name: 'Web — Web server install and SSL/TLS config', team: 'Web Admin', duration_hours: 4, depends_on: ['T02', 'T07'], phase: 1, milestone: false, description: `App: ${ctx.app}. Workers: ${web.worker_proc || 'auto'}. SSL protocols: ${web.ssl_protocols || 'TLS 1.2+1.3'}. HSTS: ${web.hsts || 'max-age=31536000'}.` });
  tasks.push({ id: id(), name: 'Web — Reverse proxy, rate limiting, WAF rules', team: 'Web Admin', duration_hours: 4, depends_on: ['T14'], phase: 1, milestone: false, description: `Proxy to: ${web.reverse_proxy || '127.0.0.1:8080'}. Rate limit: ${web.rate_limit || '100 req/s'}. WAF: ${web.waf || 'ModSecurity OWASP CRS 4.0'}.` });
  tasks.push({ id: id(), name: 'Web — Security headers, compression, CDN', team: 'Web Admin', duration_hours: 2, depends_on: ['T14'], phase: 1, milestone: false, description: `Security headers: ${web.sec_headers || 'X-Frame-Options, X-Content-Type-Options, CSP'}. Compression: ${web.compression || 'gzip level 6'}. CDN: ${web.cdn || 'CloudFront static'}.` });
  tasks.push({ id: id(), name: 'App — Runtime deploy and JVM/runtime tuning', team: 'App Admin', duration_hours: 6, depends_on: ['T12', 'T14'], phase: 1, milestone: false, description: `Deploy method: ${app.deploy_method?.substring(0, 60) || 'Ansible rolling deploy'}. JVM Xmx: ${app.jvm_xmx || '8g'}. GC: ${app.gc_policy || 'G1GC'}. Port: ${app.app_port || '8080'}.` });
  tasks.push({ id: id(), name: 'App — Connection pool, cache, service discovery', team: 'App Admin', duration_hours: 3, depends_on: ['T17'], phase: 1, milestone: false, description: `DS pool: ${app.datasource_pool || '100 HikariCP'}. Cache: ${app.cache_provider || 'Redis 7.2 Cluster'}. Discovery: ${app.service_discovery || 'Kubernetes DNS / Consul'}.` });
  tasks.push({ id: id(), name: 'App — Tracing, metrics, log aggregator, APM', team: 'App Admin', duration_hours: 3, depends_on: ['T17'], phase: 1, milestone: false, description: `Tracing: ${app.tracing || 'OpenTelemetry → Jaeger'}. Metrics: ${app.metrics_endpoint || '/actuator/metrics'}. APM: ${app.apm_agent || 'Datadog Java Agent'}.` });
  tasks.push({ id: id(), name: 'Backup — RMAN/Veeam policy and full backup test', team: 'Backup Admin', duration_hours: 6, depends_on: ['T11'], phase: 1, milestone: false, description: `Tool: ${bk.backup_tool || 'RMAN + Veeam B&R'}. RPO: ${bk.rpo_hours || '1'}h / RTO: ${bk.rto_hours || '4'}h. Full: ${bk.full_day || 'Saturday 22:00'}. Encryption: ${bk.encryption || 'AES-256'}.` });
  tasks.push({ id: id(), name: 'Backup — Offsite/cloud tier and immutable copy', team: 'Backup Admin', duration_hours: 3, depends_on: ['T20'], phase: 1, milestone: false, description: `Offsite: ${bk.offsite_target || 'AWS S3 Glacier IR ap-southeast-2'}. Immutable: ${bk.immutable || 'S3 Object Lock COMPLIANCE 30-day'}. Ransomware: ${bk.ransomware || '3-2-1-1-0 rule'}.` });
  tasks.push({ id: id(), name: 'SecOps — PAM, secrets, MFA, SIEM integration', team: 'SecOps', duration_hours: 8, depends_on: ['T08'], phase: 2, milestone: false, description: `PAM: ${sec.pam || 'CyberArk Vault'}. Secrets: ${sec.secrets_mgr || 'HashiCorp Vault'}. MFA: ${sec.mfa_required || 'Yes — all privileged'}. SIEM: ${sec.siem_endpoint?.substring(0, 40) || 'Splunk HEC'}.` });
  tasks.push({ id: id(), name: 'SecOps — IDS/IPS, EDR, WAF, firewall policy', team: 'SecOps', duration_hours: 6, depends_on: ['T22'], phase: 2, milestone: false, description: `IDS/IPS: ${sec.ids_ips || 'Suricata IPS + Darktrace'}. EDR: ${sec.edr || 'CrowdStrike Falcon'}. FW: ${sec.fw_type || 'Palo Alto NGFW'}. DLP: ${sec.dlp || 'Symantec DLP'}.` });
  tasks.push({ id: id(), name: 'SecOps — CIS hardening, audit, compliance scan', team: 'SecOps', duration_hours: 4, depends_on: ['T22'], phase: 2, milestone: false, description: `Baseline: ${sec.sec_baseline || 'CIS Benchmark Level 2'}. Hardening: ${sec.hardening || 'STIG/OpenSCAP'}. Compliance: ${sec.compliance_framework || 'ISO 27001 + CIS Level 2'}. Scan: ${sec.scan_freq || 'weekly Qualys'}.` });
  tasks.push({ id: id(), name: 'All Teams — End-to-end smoke test and sign-off', team: 'PM / All Teams', duration_hours: 8, depends_on: ['T19', 'T21', 'T24'], phase: 2, milestone: true, description: 'Verify health checks, load balancer failover, DB failover, backup restore test, security scan PASS. Sign off RTM before CAB.' });

  return tasks;
}
