export const SUGGEST_DB = {
  dell:['Dell PowerEdge R760 (2U -- 2x Xeon SP 5th Gen)','Dell PowerEdge R860 (4U -- 4x Xeon, max 12TB RAM)','Dell PowerEdge R660xs (1U -- rack-dense compute)'],
  hpe:['HPE ProLiant DL380 Gen11 (2U -- 2x Xeon SP 5th Gen)','HPE ProLiant DL360 Gen11 (1U -- high-density rack)','HPE ProLiant DL580 Gen11 (4-socket mission-critical)'],
  cisco:['Cisco UCS C240 M7 (2U -- 2x Xeon SP 4th Gen, 35 SFF drives)','Cisco UCS C220 M7 (1U -- compute-optimised)','Cisco UCS X210c M7 (blade -- X-Series modular)'],
  lenovo:['Lenovo ThinkSystem SR650 V3 (2U -- 2x Xeon SP 4th/5th Gen)','Lenovo ThinkSystem SR630 V3 (1U)','Lenovo ThinkSystem SR860 V3 (4-socket scale-up)'],
  ibm:['IBM POWER10 S1022 (2U rack -- scale-out analytics)','IBM POWER10 S1024 (2U -- ERP/database workloads)','IBM POWER10 E1080 (enterprise -- 240 cores max)','IBM z16 (mainframe -- A01 frame)'],
  postgres:['PostgreSQL 16.3 (latest stable -- recommended)','PostgreSQL 15.7 (LTS -- supported to Nov 2027)','PostgreSQL 14.12 (LTS -- supported to Nov 2026)'],
  postgresql:['PostgreSQL 16.3 (recommended)','PostgreSQL 15.7 (LTS)','PostgreSQL 14.12 (LTS)'],
  mysql:['MySQL 8.4.0 LTS (Innovation -- GA May 2024)','MySQL 8.0.38 (LTS -- supported to Apr 2026)','MySQL 5.7 (EOL Oct 2023 -- migrate immediately)'],
  mariadb:['MariaDB 11.4 LTS (supported to May 2029)','MariaDB 10.11 LTS (supported to Feb 2028)','MariaDB 10.6 LTS (supported to Jul 2026)'],
  oracle:['Oracle 19c 19.24 RU (LTS -- supported to Apr 2027+)','Oracle 21c (Innovation -- EOS Apr 2024 -- upgrade to 23ai)','Oracle 23ai (latest -- long-term supported)'],
  mongodb:['MongoDB 7.0 LTS (recommended -- supported to Aug 2026)','MongoDB 6.0 LTS (supported to Jul 2025)','MongoDB 5.0 (EOL Oct 2024 -- upgrade now)'],
  redis:['Redis 7.2.5 (latest stable)','Redis Stack 7.2 (with Search/JSON/TimeSeries modules)'],
  kafka:['Apache Kafka 3.7.1 (latest stable)','Confluent Platform 7.7 (enterprise Kafka)','Redpanda 24.1 (Kafka-compatible -- no JVM)'],
  db2:['IBM Db2 11.5.9 LTS (recommended -- supported to Sep 2027)','IBM Db2 12.1 (latest -- z/OS and LUW)'],
  sybase:['SAP ASE 16.0 SP04 (latest -- previously Sybase)','SAP IQ 16.1 (analytics -- formerly Sybase IQ)'],
  hana:['SAP HANA 2.0 SPS07 Rev 72 (latest stable)','SAP HANA Cloud (fully managed -- SaaS)'],
  rhel:['RHEL 9.4 (latest -- support to May 2032)','RHEL 8.10 (EUS -- support to May 2029)','RHEL 7 (EOL Jun 2024 -- migrate to RHEL 9 now)'],
  ubuntu:['Ubuntu 24.04 LTS Noble (support to Apr 2029)','Ubuntu 22.04 LTS Jammy (support to Apr 2027)','Ubuntu 20.04 LTS Focal (ESM to Apr 2030)'],
  suse:['SLES 15 SP6 (latest -- support to Jul 2028)','SLES 15 SP5 (LTSS available)','SLES 12 SP5 (LTSS -- migrate to 15)'],
  debian:['Debian 12 Bookworm (LTS to Jun 2028)','Debian 11 Bullseye (LTS to Aug 2026)'],
  aix:['AIX 7.3 TL2 SP2 (latest -- EOS Apr 2029)','AIX 7.2 TL5 SP10 (EOS Apr 2023 -- upgrade to 7.3 now)','AIX 7.1 (EOL -- migrate immediately)'],
  solaris:['Solaris 11.4 SRU70 (latest -- supported to 2034)','Solaris 11.4 (upgrade from Solaris 10 -- EOL Jan 2021)'],
  windows:['Windows Server 2025 (LTSC -- support to Oct 2034)','Windows Server 2022 (LTSC -- support to Oct 2031)','Windows Server 2019 (LTSC -- support to Jan 2029)','Windows Server 2016 (EOL Jan 2027 -- plan upgrade)'],
  nginx:['NGINX 1.26.1 (stable -- recommended)','NGINX Plus R32 (enterprise -- HA + WAF)','NGINX 1.27.x (mainline -- bleeding edge)'],
  apache:['Apache HTTPD 2.4.62 (latest stable)','Apache Tomcat 10.1.26 (Jakarta EE 10)','Apache Tomcat 9.0.91 (Jakarta EE 8 -- LTS)'],
  tomcat:['Apache Tomcat 10.1.26 (Jakarta EE 10 -- recommended for Spring Boot 3.x)','Tomcat 9.0.91 (Jakarta EE 8 -- Spring Boot 2.x)','Tomcat 8.5 (EOL Mar 2024 -- upgrade now)'],
  weblogic:['Oracle WebLogic 14.1.2 (latest -- JDK 17/21 support)','WebLogic 12.2.1.4 (LTS -- EOS Jan 2027)'],
  websphere:['IBM WebSphere Application Server 9.0.5.23 (trad)','IBM Open Liberty 24.0.0.8 (cloud-native -- recommended)','IBM WebSphere Liberty (Jakarta EE 10)'],
  jboss:['JBoss EAP 8.0 (Jakarta EE 10 -- latest)','JBoss EAP 7.4 (Jakarta EE 8 -- LTS to Jun 2026)','WildFly 32.0 (community upstream)'],
  spring:['Spring Boot 3.3.2 (latest -- JDK 17+ required)','Spring Boot 3.2.8 (LTS -- support to Feb 2025)','Spring Boot 2.7.18 (EOL Nov 2023 -- migrate to 3.x)'],
  node:['Node.js 22.5.1 LTS (current LTS -- Apr 2027)','Node.js 20.16.0 LTS (active -- Apr 2026)','Node.js 18.20.4 (maintenance -- EOL Apr 2025)'],
  python:['Python 3.12.4 (latest stable)','Python 3.11.9 (security -- supported to Oct 2027)','Python 3.9 (security only -- EOL Oct 2025)'],
  kubernetes:['Kubernetes 1.31 (latest)','K8s 1.30 (LTS candidate -- supported 14 months)'],
  docker:['Docker Engine 27.1 CE','containerd 1.7.18','Podman 5.1 (rootless -- no daemon)'],
  cpu:['32 vCPUs (2x 16-core Xeon SP)','64 vCPUs (2x 32-core AMD EPYC 9004)','48 LPAR threads (POWER10 SMT-8)','16 vCPUs (cloud -- m6i.4xlarge / r7g.4xlarge)'],
  ram:['128GB DDR5 ECC (balanced -- most OLTP workloads)','256GB DDR5 ECC (memory-intensive -- DB/analytics)','512GB DDR5 ECC (in-memory DB -- SAP HANA)','64GB DDR5 (dev/test -- right-size first)'],
  swap:['16GB swap (2x RAM rule for AIX -- hd6 page space)','8GB swap (Linux -- swappiness=10 keeps it cold)','Disabled (Kubernetes nodes -- pods use limits instead)'],
  kernel_params:['vm.swappiness=10, net.core.somaxconn=65535, fs.file-max=2097152, kernel.pid_max=4194304 (Linux DB server)','ioo: maxpgahead=64, vmo: minfree=960 maxfree=1088, no: tcp_recvspace=65536 tcp_sendspace=65536 (AIX)','vm.swappiness=1, vm.dirty_ratio=15, vm.dirty_background_ratio=5, kernel.shmmax=68719476736 (Oracle DB Linux)'],
  patch_window:['Sunday 02:00-06:00 AEST (4h window -- no business impact)','Saturday 22:00-Sunday 04:00 (6h -- DB patching with RMAN)','Monthly second Saturday 01:00-07:00 (CAB-aligned window)'],
  ntp_server:['169.254.169.123 (AWS Time Sync -- chrony, iburst prefer)','10.0.0.1 (internal GPS stratum-1), 1.pool.ntp.org (external fallback)','time.windows.com (Windows domain -- use w32tm)'],
  dns_server:['10.0.0.2 (primary corp DNS), 10.0.0.3 (secondary) -- with forwarder to 8.8.8.8','169.254.169.253 (AWS VPC DNS resolver -- Route53 Resolver)','168.63.129.16 (Azure DNS -- default VNet resolver)'],
  timezone:['Australia/Sydney (AEST/AEDT -- UTC+10/+11)','Asia/Kolkata (IST -- UTC+5:30)','UTC (recommended for cloud/distributed -- convert at app layer)','America/New_York (EST/EDT -- US East)'],
  monitoring_agent:['Datadog Agent 7.55 + node-exporter 1.8 + Fluent Bit 3.0','Prometheus node-exporter 1.8 + Alertmanager 0.27 + Grafana (open source stack)','CloudWatch Agent 1.300085 + X-Ray daemon (AWS-native stack)','Dynatrace OneAgent 1.287 (full-stack APM -- autodiscovery)'],
  worker_proc:['auto (NGINX -- 1 worker per vCPU, worker_connections=2048)','8 workers (Apache mpm_event -- MaxRequestWorkers=400, ThreadsPerChild=25)','4 workers (conservative -- I/O-bound with slow backends)'],
  keepalive:['65 (recommended -- slightly above LB idle timeout of 60s)','75 (match F5/HAProxy timeout + 5s buffer)','0 (disable for microservice mesh -- each request new conn)'],
  max_conn:['10000 (NGINX -- worker_processes * worker_connections)','5000 (Apache -- MaxRequestWorkers balanced)','2048 (conservative -- DB-limited upstream)'],
  ssl_cert_expiry:['2025-06-15 (renew at 30-day mark -- auto via certbot/ACME)','2026-03-01 (internal CA -- submit renewal 60 days before)','Managed (AWS ACM / Azure Key Vault -- auto-renew)'],
  log_retention:['90 days (compressed after 7 days -- logrotate daily with gzip)','30 days (dev/test -- minimal storage)','365 days (PCI-DSS / audit requirement -- archive to S3 cold tier)'],
  jvm_xmx:['8g (standard -- 70% of 12GB container or 16GB host)','16g (large -- analytics / caching-heavy app)','4g (microservice -- right-size per service)'],
  jvm_xms:['2g (start at 25% of Xmx -- JVM grows under load)','8g (set equal to Xmx -- avoid heap resize GC pauses in prod)'],
  thread_pool:['200 (balanced -- (2 x CPU cores) + connection pool overhead)','400 (high-concurrency web tier -- watch GC pressure)','100 (DB-limited backend -- match datasource pool size)'],
  datasource_pool:['100 (HikariCP maxPoolSize -- Oracle RAC: 50 per node)','50 (balanced -- PgBouncer sits in front)','200 (high-throughput -- verify DB max_connections allows this)'],
  deploy_method:['Ansible playbook -- artifact deploy + rolling restart (drain LB, deploy, health check, re-add)','Helm chart -- kubectl apply (Kubernetes rolling update)','Blue-green via F5 iRule -- deploy green, smoke test, flip VIP, drain blue'],
  app_port:['8080 (standard HTTP -- 443 handled by web tier / LB)','8443 (HTTPS direct -- internal services in K8s mesh)','3000 (Node.js default)','5000 (Python Flask/FastAPI default)'],
  heap_ratio:['70 (JVM heap = 70% RAM -- 30% for OS + metaspace)','60 (conservative -- more room for native memory)','80 (aggressive -- only if metaspace tuned)'],
  gc_policy:['G1GC: -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:G1HeapRegionSize=16m (recommended general)','ZGC: -XX:+UseZGC (sub-ms pauses -- JDK 17+ -- latency-sensitive APIs)','Shenandoah: -XX:+UseShenandoahGC (concurrent GC -- Red Hat JDK)'],
  log_level:['INFO (production -- balance visibility vs volume)','WARN (high-volume prod -- only problems + above)','DEBUG (staging/pre-prod -- disable in production)'],
  buf_pool:['32GB SGA (Oracle: SGA_TARGET=32G SGA_MAX_SIZE=36G PGA_AGGREGATE_TARGET=8G)','shared_buffers=32GB effective_cache_size=96GB work_mem=256MB (PostgreSQL -- 25% RAM rule)','innodb_buffer_pool_size=64GB (MySQL/MariaDB -- 50-70% of dedicated DB RAM)'],
  redo_size:['512MB per member 4 groups (Oracle -- ALTER DATABASE ADD LOGFILE GROUP)','wal_segment_size=256MB min_wal_size=2GB max_wal_size=8GB (PG)','innodb_log_file_size=2GB innodb_log_files_in_group=2 (4GB total -- MySQL/MariaDB)'],
  archive_dest:['+FRA (Oracle ASM Fast Recovery Area -- LOG_ARCHIVE_DEST_1=LOCATION=+FRA)','archive_command=\'rsync -az %p /mnt/pgarchive/%f\' (PostgreSQL NFS WAL archive)','/var/lib/mysql/binlog (MySQL -- binlog_expire_logs_seconds=604800 7-day retention)'],
  backup_window:['Saturday 22:00 full level-0 (RMAN -- 6h window), daily 01:00 incr level-1 (Oracle)','Saturday 23:00 pg_basebackup full, daily 01:00 pg_rman incremental (PG)'],
  standby_lag:['< 30s (Oracle DataGuard async -- LOG_ARCHIVE_DEST_2 ASYNC)','< 5s (PostgreSQL Patroni streaming -- recovery_min_apply_delay=0)','< 15s (SQL Server AlwaysOn AG -- synchronous-commit same-DC)'],
  listener_port:['1521 (Oracle TNS Listener -- SCAN VIP for RAC: scan-vip:1521/service_name)','5432 (PostgreSQL) + 6432 (PgBouncer transaction pooler)','3306 (MySQL) + 6033 (ProxySQL read-write split endpoint)','1433 (SQL Server default)'],
  lun_size:['2TB data + 500GB redo + 1TB FRA + 200GB temp (Oracle ASM -- 4 disk groups)','2TB /var/lib/pgsql + 1TB /mnt/pgarchive + 3TB /mnt/backup (PostgreSQL)','4TB /data + 1TB /log + 200GB /tmp (SQL Server -- separate spindles)'],
  iops_req:['50000 IOPS sustained (150000 peak -- NVMe/FC tier -- Oracle OLTP)','20000 IOPS (random 4K read/write, p99 < 2ms -- standard PostgreSQL OLTP)','15000 IOPS (InnoDB random I/O profile -- MySQL workload)'],
  multipath_mode:['DM-Multipath round-robin (Linux FC -- path_grouping_policy=multibus queue_depth=32)','AIX MPIO fail_over (PCM -- hdiskX failover to partner path)','PowerPath round-robin (Dell EMC arrays -- preferred for VMAX/PowerStore)'],
  snapshot_policy:['Hourly retain-24, daily retain-30, weekly retain-12, monthly retain-12 (production)','AWS DLM: hourly 24h, daily 7d, weekly 4wk (AWS native -- lifecycle manager)'],
  raid_level:['RAID-10 (striped mirrors -- 2x read IOPS, 2x protection, 50% usable -- recommended for DB)','RAID-6 (dual parity -- capacity-efficient -- use for backup/archive not OLTP)'],
  rpo_hours:['0 (zero data loss -- synchronous DataGuard/HSR/AlwaysOn-sync)','0.25 (15min -- async log shipping)','1 (1hr -- standard async replication)','4 (4hr -- backup-based PITR)'],
  rto_hours:['0.5 (30min -- automated failover via DataGuard / Patroni / Pacemaker)','2 (2hr -- semi-automated failover + DNS change)','4 (4hr -- manual failover + restore)','8 (8hr -- cold restore from tape)'],
  full_day:['Saturday 22:00 (low-traffic weekend -- estimated 3-6h for 2TB)','Sunday 02:00 (deepest low-traffic window)'],
  encryption:['AES-256-CBC (backup-level -- RMAN encryption with wallet key)','AES-256-GCM (authenticated encryption -- Veeam / Commvault native)','N/A (using cloud-native KMS -- S3 SSE-KMS / Azure SSE / GCP CMEK)'],
  bandwidth:['25Gbps uplink (2x 25G LACP bond) + 10Gbps dedicated storage VLAN (iSCSI/NFS)','10Gbps uplink (2x 10G LACP bond) -- adequate for most mid-tier apps','40Gbps SR-IOV (Azure Accelerated Networking)'],
  vlan_ids:['App VLAN 110 (10.10.110.0/24), DB VLAN 120 (10.10.120.0/24), Storage VLAN 200 (10.20.200.0/24)','App subnet 10.0.1.0/24, DB subnet 10.0.2.0/24 (AWS VPC / Azure VNet)'],
  mtu:['9000 (jumbo frames -- storage VLAN 200 iSCSI/NFS, enable on all hops)','1500 (standard -- app/web VLAN -- default)','9001 (AWS VPC jumbo -- within VPC)'],
  fw_rules:['App:8080 -> DB:1521 ALLOW, Web:443 from 0/0, SSH:22 from Bastion-IP/32 only (Oracle)','App:8080 -> DB:5432 ALLOW, PgBouncer:6432 ALLOW, replication:5433 between replicas (PG)'],
  compliance_framework:['CIS Level 2 Benchmark + ISO 27001:2022 (annual audit)','CIS Level 2 + PCI-DSS 4.0 (cardholder data -- quarterly ASV scan)','SOC 2 Type II + ISO 27001:2022 + NIST CSF 2.0 (SaaS / cloud)','ISM Essential Eight (Australian Government)'],
  patch_sla:['24h (CVSS >= 9.0 Critical) / 72h (CVSS >= 7.0 High) / 30d (Medium) -- PCI-DSS','48h (CVSS >= 9.0) / 7d (CVSS >= 7.0 High) / 30d (Medium) -- ISO 27001'],
  scan_freq:['Weekly automated (Qualys/Tenable) + triggered on every change (CI/CD pipeline)','Monthly full scan + weekly agent-based delta scan (Rapid7 InsightVM)'],
  mfa_required:['Yes -- CyberArk PAM for all privileged access (no direct root/admin login)','Yes -- Okta MFA (TOTP) for all admin portals + Vault for secrets'],
  siem_endpoint:['Splunk HEC: https://splunk.corp.com:8088/services/collector (token-auth)','Elastic/ELK: logstash.corp.com:5044 (Beats protocol -- Filebeat agent)'],
};

export function matchSuggestKeys(val, fieldId) {
  const v = (val || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const words = v.split(/\s+/).filter(w => w.length > 1);
  const hits = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (SUGGEST_DB[w]) hits.push(...SUGGEST_DB[w]);
    if (i < words.length - 1) {
      const bg = w + ' ' + words[i + 1];
      if (SUGGEST_DB[bg]) hits.push(...SUGGEST_DB[bg]);
    }
  }

  // 2. Match by field ID suffix
  const suffix = (fieldId || '').replace(/^.*-/, '').replace(/^sd-[a-z]+-/, '');
  if (SUGGEST_DB[suffix] && hits.length < 3) hits.push(...SUGGEST_DB[suffix]);

  // 3. Fuzzy partial match if fewer than 3 hits
  if (hits.length < 3) {
    const keys = Object.keys(SUGGEST_DB);
    for (const key of keys) {
      if (v.includes(key) || key.includes(v.split(' ')[0] || '')) {
        hits.push(...SUGGEST_DB[key]);
        if (hits.length >= 6) break;
      }
    }
  }

  // Deduplicate and return up to 6
  return [...new Set(hits)].slice(0, 6);
}
