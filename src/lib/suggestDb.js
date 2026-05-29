export const SUGGEST_DB = {
  // Requirements / project fields
  sla:['99.9% (three nines — 8.7 h downtime/year, standard prod)','99.95% (4.4 h/year — enhanced SLA)','99.99% (four nines — 52 min/year, high-availability)','99.999% (five nines — 5.3 min/year, mission-critical)'],
  compliance:['ISO 27001:2022 (ISMS — annual audit)','PCI-DSS 4.0 (cardholder data — quarterly ASV scan)','SOC 2 Type II (service org trust services)','ASD Essential Eight (Australian government)','NIST CSF 2.0 + ISO 27001 (dual framework)','HIPAA (US protected health information)'],
  load_profile:['OLTP high-concurrency (1000+ users, sub-100 ms response)','Batch overnight (large data processing, 6 h window)','Mixed OLTP + reporting (80/20 read/write split)','Event-driven spikes (10× burst — auto-scale required)','Steady-state 24/7 (predictable load, no significant spikes)'],
  data_volume:['< 1 TB (small — standard RAID-10 SAN)','1–10 TB (medium — tiered storage, NVMe hot data)','10–100 TB (large — Flash array + NL-SAS cold)','> 100 TB (very large — Exadata or Hadoop ecosystem)','PB-scale (petabyte — cloud-native data lake)'],
  constraints:['No maintenance windows EOFY Apr–Jun','Change freeze Dec 15 – Jan 10 (holiday period)','Budget cap $500 K total project cost','Must integrate with existing SAP landscape','Greenfield — no legacy dependencies','Zero-downtime migration required (online cutover)'],
  // Emergency change fields
  title:['Emergency patch: critical CVE remediation (CVSS ≥ 9.0)','Unplanned failover: primary DB hardware fault','Emergency disk expansion: storage critical >90%','Out-of-band kernel patch: zero-day exploit','Emergency cert replacement: expired SSL certificate','Unplanned app restart: memory leak / OOM kill'],
  desc:['Immediate patch required. Impact: potential RCE. Tested in staging. Window: 2 h. Rollback: snapshot.','Failover triggered: promote standby, update DNS, verify app connections, notify stakeholders.','Storage >90% threshold. Adding LUN + extending filesystem. Online operation, zero downtime.','Zero-day exploit confirmed in prod stack. Patch tested in staging (45 min). Rollback: snapshot restore.'],
  owner:['Unix Admin','DBA / Database Administrator','App Admin','Net Admin / Network Engineer','Storage Admin','Backup Admin','SecOps / Security Engineer','Change Manager','PM / Project Manager','Infrastructure Lead'],
  type:['Emergency (unplanned — immediate risk to service)','Weekend (scheduled — low-traffic window)','Weekday (scheduled — business hours risk acknowledged)','Out-of-Band (unscheduled but non-emergency)'],
  impact:['Critical (business-wide outage — P1 escalation)','High (major service degraded — P2 escalation)','Medium (minor service impact — P3)','Low (no user impact — cosmetic / backend only)'],
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
  // Unix new fields
  cpu_governor:['performance (disable C-states -- cpupower frequency-set -g performance)','powersave (cloud/dev -- let hypervisor manage)','N/A (AIX/Windows -- managed by platform)'],
  numa_policy:['numactl --interleave=all (DB workloads -- spread memory across NUMA nodes)','N/A (single-socket or AIX -- no NUMA tuning required)','numactl --cpunodebind=0 --membind=0 (bind to first NUMA node)'],
  hugepages:['4096 x 2MB = 8GB (vm.nr_hugepages=4096 -- Oracle/HANA SGA)','0 (disabled -- enable only for DB/high-memory workloads)','1024 x 2MB = 2GB (PostgreSQL shared_buffers huge_pages=try)'],
  io_scheduler:['mq-deadline (block storage DB -- lowest latency for random I/O)','none (NVMe -- bypass scheduler, kernel handles natively)','cfq (spinning disk -- fair queuing for mixed workloads)'],
  ulimits:['nofile=65536, nproc=65536, stack=8192KB (/etc/security/limits.d/99-app.conf)','nofile=131072, nproc=unlimited (high-connection services -- Elasticsearch, Redis)','chsec /etc/security/limits -- nofiles_hard=65536 (AIX)'],
  selinux:['SELinux enforcing (setenforce 1, SELINUXTYPE=targeted -- audit2allow for app tuning)','AppArmor enforcing (aa-status -- profiles for nginx, mysqld, apache2 -- Ubuntu)','disabled (legacy -- STRONGLY discouraged; use permissive for tuning then enforcing)'],
  auditd:['auditd: -a always,exit -F arch=b64 -S execve,connect,open,unlink -k syscalls','auditd enabled: file integrity rules for /etc /bin /sbin + login/logout events','Windows Event Log Audit Policy (auditpol /set /category:* /success:enable /failure:enable)'],
  cron_jobs:['logrotate (daily 02:00), patch check (Mon 06:00), stats gather (Sun 04:00), backup verify (daily 07:00)','logrotate (daily), DB stats gather (Sun 04:00), certificate expiry check (weekly Mon 05:00)','Task Scheduler: logrotate (daily 02:00), patch scan (Mon 06:00) -- Windows'],
  ssh_config:['SSHd: Protocol 2, PermitRootLogin no, PasswordAuthentication no, MaxAuthTries 3','SSHd: PermitRootLogin no, X11Forwarding no, AllowGroups ssh-users sysadmins -- key-only','AIX sshd: Protocol 2, PermitRootLogin no, X11Forwarding no, AllowTcpForwarding no'],
  sudo_policy:['NOPASSWD sudo for service restart only (app OS user). PAM+CyberArk for privileged cmds.','sudoers: %dba ALL=(oracle) NOPASSWD: /sbin/service oracle* -- scoped per role','JEA (PowerShell Just Enough Administration) -- Windows role-based constrained endpoints'],
  syslog_server:['rsyslog -> Splunk HEC (TCP 6514 TLS) -- /etc/rsyslog.d/50-remote.conf','rsyslog -> Elasticsearch via Filebeat -- JSON structured logs (ECS format)','Windows Event Forwarding (WEF) -> Splunk UF -- subscription + Splunk Add-on for Windows'],
  fs_type:['XFS (data/app volumes, 4K block, inode64) / ext4 (OS root) / tmpfs (tmp)','ZFS (Solaris -- compression=lz4, atime=off, copies=2 for data integrity)','JFS2 (AIX -- journaled, inline logging, large file support)','NTFS (Windows system + data) / ReFS (optional large volumes)'],
  mount_opts:['noatime,nodiratime (data volume -- write performance) / defaults,noexec,nosuid (tmp/var)','rw,log=/dev/loglv00 (JFS2 AIX -- inline logging)','noatime,nobarrier (SSD/NVMe data volume -- avoid unnecessary writes)'],
  locale:['en_AU.UTF-8 (LANG=en_AU.UTF-8, LC_ALL=en_AU.UTF-8)','UTC (recommended for distributed systems -- convert at app layer)','en_US.UTF-8 (US standard -- common for US-based cloud deployments)'],
  tuned_profile:['throughput-performance (DB host -- tuned-adm profile)','latency-performance (low-latency trading/API -- CPU isolation)','balanced (default -- good for mixed workloads, K8s nodes)'],
  kdump:['kdump enabled (crashkernel=512M) -- dump to /var/crash, sync to S3 post-capture','AIX sysdumpdev -l (dump device: /dev/lg_dumplv) -- notify ops@corp.com on crash','kdump disabled (resource-constrained VM) -- ensure OOM killer logging enabled'],
  core_dumps:['Disabled in prod (ulimit -c 0). Enable: sysctl kernel.core_pattern=/tmp/core-%e-%p','WER (Windows Error Reporting) -- user-mode crash dumps to %LOCALAPPDATA%\\CrashDumps','Enabled for debug sessions only -- disable immediately after capture'],
  ipv6_mode:['Disabled (net.ipv6.conf.all.disable_ipv6=1) -- IPv4 only in this environment','Enabled (dual-stack -- IPv4 preferred, IPv6 for future compliance)','Disabled (AIX -- ifconfig en0 inet6 delete, or /etc/rc.net)'],
  hostname_scheme:['srv-{env}-{role}-{seq} (e.g. srv-prd-db-01) -- DNS A+PTR registered in corp DNS','{role}{seq}.{env}.corp.com (e.g. db01.prd.corp.com) -- FQDN convention','ip-{a}-{b}-{c}-{d}.region.compute.internal (AWS default -- consider custom CNAME)'],
  boot_loader:['GRUB2 -- timeout=5s, console=ttyS0,115200 (serial for iDRAC/iLO OOB)','GRUB2 -- UEFI Secure Boot enabled, crashkernel=512M','AIX SMS (System Management Services) -- bootlist -m normal hdisk0','Windows Boot Manager (bcdedit) -- EFI/UEFI, Secure Boot enabled'],
  // Web new fields
  ssl_protocols:['TLSv1.2 TLSv1.3 (disable TLSv1.0 and TLSv1.1 -- PCI-DSS 4.0 requirement)','TLSv1.3 only (most secure -- drop TLSv1.2 only if all clients support 1.3)','TLSv1.2 only (legacy compatibility -- deprecated clients)'],
  ssl_ciphers:['TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES256-GCM-SHA384','ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM (modern cipher suite -- ECDHE preferred for PFS)','HIGH:!aNULL:!MD5:!RC4 (minimum -- avoid RC4/NULL/MD5)'],
  hsts:['Strict-Transport-Security: max-age=31536000; includeSubDomains; preload','Strict-Transport-Security: max-age=15768000 (6 months -- ramp up before enabling preload)','Strict-Transport-Security: max-age=86400 (1 day -- testing phase -- increase for production)'],
  compression:['gzip level 6 (text/html text/css application/json application/javascript -- min-size 1024)','brotli level 4 (NGINX + ngx_brotli module -- better compression ratio than gzip, modern clients)','gzip level 4 (lower CPU -- high-traffic sites where CPU is the bottleneck)'],
  cache_control:['static: max-age=31536000, immutable | API: no-store | HTML: no-cache, must-revalidate','Cache-Control: public, max-age=3600 (moderate TTL -- semi-static content)','Cache-Control: no-store (sensitive API responses -- no caching anywhere)'],
  request_timeout:['30 (upstream timeout -- match app server timeout minus 5s buffer)','60 (long-running API -- file upload / report generation)','5 (fast API -- fail fast, circuit-break slow backends)'],
  worker_threads:['200 (Tomcat maxThreads -- match app thread_pool)','25 (web tier proxy -- thread per connection, async I/O preferred)','400 (high-concurrency -- watch GC pressure if JVM-based)'],
  max_req_size:['50MB (client_max_body_size / LimitRequestBody -- file upload limit)','10MB (API gateway -- reject oversized payloads early)','1MB (strict API -- prevent abuse, no file uploads expected)'],
  rate_limit:['100 req/s per IP (NGINX limit_req_zone, burst=200 nodelay)','20 req/s per IP for API (strict -- prevent scraping/abuse)','1000 req/s global (high-traffic site -- use WAF for per-IP limits)'],
  waf:['ModSecurity 3.x with OWASP CRS 4.0 -- detection mode first, block after 2-week tuning','AWS WAF (managed rules -- AWSManagedRulesCommonRuleSet + SQLi/XSS rule groups)','Cloudflare WAF (managed ruleset -- OWASP Top 10 coverage, free with Pro+)'],
  access_log:['combined + $request_time $upstream_response_time (custom log_format perf)','JSON structured log (ECS format -- index into Elasticsearch/Splunk directly)','%h %l %u %t \\"%r\\" %>s %b %D (Apache combined + microsecond timing)'],
  error_log_level:['warn (production -- reduce noise)','info (staging/pre-prod -- verbose for troubleshooting)','debug (short-term debugging -- disable immediately after capture)'],
  vhosts:['2 virtual hosts: app.corp.com (HTTPS:443) + health.internal (LB health HTTPS:8443)','3 vhosts: www.corp.com (redirect to HTTPS), app.corp.com, api.corp.com','Single vhost (simple deployment -- all traffic on one endpoint)'],
  upstream_servers:['server 10.10.110.11:8080 weight=5 max_fails=3; server 10.10.110.12:8080 weight=5;','server app01.internal:8080; server app02.internal:8080; server app03.internal:8080;','upstream: 127.0.0.1:8080 (single-node -- no upstream pool)'],
  sticky_sessions:['Cookie SERVERID (F5 iRule persistence) / ip_hash (NGINX) -- stateful session affinity','None (stateless app -- sessions in Redis, no affinity needed -- preferred for HA)','JSESSIONID cookie persistence (Java EE -- Tomcat session manager)'],
  http2:['HTTP/2 enabled (listen 443 ssl http2 -- requires TLS; h2c disabled)','HTTP/2 + HTTP/3 (QUIC) -- NGINX 1.25+ / Cloudflare automatic HTTP/3','HTTP/1.1 only (legacy -- plan upgrade path to HTTP/2)'],
  websocket:['proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "Upgrade" (/ws/* paths)','WebSocket disabled (not required for this application)','Socket.io with NGINX proxy -- sticky session required for polling fallback'],
  cdn:['CloudFront (static /static/* with origin shield ap-southeast-2) -- 1-year cache TTL','Cloudflare (full proxy -- caching + DDoS + WAF) -- free/Pro plan','Akamai (enterprise -- advanced caching rules + EdgeWorkers for personalization)'],
  cors:['Access-Control-Allow-Origin: https://app.corp.com (no wildcard * in production)','CORS: allow-origin list (spa.corp.com, mobile.corp.com) -- pre-flight cache 600s','Access-Control-Allow-Origin: * (public API -- read-only, no credentials)'],
  sec_headers:['X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin, CSP enforced','Content-Security-Policy: default-src self; script-src self cdn.corp.com; (strict CSP)','X-XSS-Protection: 1; mode=block (legacy header -- CSP supersedes in modern browsers)'],
  // App new fields
  jvm_metaspace:['-XX:MaxMetaspaceSize=512m (prevent classloader leak)','-XX:MaxMetaspaceSize=256m (microservice -- smaller classpath)','-XX:MaxMetaspaceSize=1g (large EE app -- many classloaders)'],
  jvm_stack:['-Xss512k per thread (200 threads ≈ 100MB native)','-Xss256k (memory-optimised -- simple stack depth)','-Xss1m (deep recursion / complex frameworks)'],
  gc_log:['-Xlog:gc*,safepoint:file=/app/logs/gc.log:time,uptime:filecount=10,filesize=20m','-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:/app/logs/gc.log (JDK 8 legacy)','N/A (non-JVM runtime -- Node.js/Python/Go)'],
  jmx_port:['9999 (JMX -- restricted to mgmt VLAN, TLS + auth enabled)','1099 (default JMX -- restrict with firewall, never expose publicly)','Disabled (use Micrometer + Prometheus scrape instead of JMX)'],
  app_context:['/ (root context -- single app per server)','/{app-name} (e.g. /myapp -- sharing server with other apps)','/api/v1 (API gateway prefix -- versioned context path)'],
  session_rep:['Redis session store (spring-session-data-redis -- stateless app tier for HA)','WebSphere in-memory replication (cluster peer -- overhead for small clusters)','None (stateless API -- JWT tokens, no server-side session state)'],
  cache_provider:['Redis 7.2 Cluster (3 masters + 3 replicas -- TTL=3600s reference data)','Memcached 1.6 (simple K-V cache -- no persistence, very fast)','Caffeine (in-process L1 cache -- 1000 entries TTL=300s -- backed by Redis L2)'],
  msg_broker:['Apache Kafka 3.7 (async event streaming -- 3-broker cluster, RF=3)','RabbitMQ 3.13 (queued jobs -- classic queues with DLX + TTL)','AWS SQS + SNS (managed -- no ops overhead, at-least-once delivery)'],
  metrics_endpoint:['/actuator/metrics + /actuator/prometheus (Micrometer -- Prometheus scrape)','/metrics (prom-client Node.js -- Prometheus scrape at :9090/metrics)','/health/metrics (custom endpoint -- JSON format)'],
  config_server:['Spring Cloud Config Server (git-backed) or env vars via Kubernetes ConfigMap','Environment variables (12-factor app) + HashiCorp Vault for secrets','AWS Systems Manager Parameter Store (hierarchical, versioned, audited)'],
  service_discovery:['Kubernetes CoreDNS (within cluster) / Consul 1.19 (multi-DC service mesh)','Consul 1.19 (health checks + KV store + service mesh)','Eureka (Spring Cloud Netflix -- legacy, consider replacing with Kubernetes DNS)'],
  circuit_breaker:['Resilience4j (CircuitBreaker + Retry + Bulkhead) -- 50% failure threshold in 10 req window','Hystrix (legacy Spring Cloud Netflix -- replaced by Resilience4j in modern stacks)','Istio service mesh (circuit breaking at sidecar level -- no code changes needed)'],
  retry_policy:['3 retries with exponential backoff (1s, 2s, 4s) for 5xx / timeout only','2 retries with jitter (avoid thundering herd) -- idempotent operations only','No retry (write operations -- prevent double-submit; use idempotency keys instead)'],
  timeout_ms:['5000 (HTTP client) + 3000 (DB query) + 500 (cache get) -- fail fast','30000 (long-running report) / 5000 (normal API) -- differentiate by operation','1000 (strict SLA API) -- tight timeout, circuit-break at 3× p99'],
  tracing:['OpenTelemetry OTLP -> Jaeger (100% staging, 5% prod adaptive sampling)','Datadog APM (dd-trace agent -- auto-instrumentation)','Zipkin (simple -- spring-cloud-sleuth integration)'],
  log_aggregator:['Fluent Bit 3.x -> Kafka -> Elasticsearch (structured JSON ECS format)','Filebeat -> Logstash -> Elasticsearch (ELK stack)','Datadog Log Management (DD agent -- automatic parsing + alerting)'],
  feature_flags:['LaunchDarkly SDK (kill switch per feature -- 0% rollout default)','Unleash self-hosted (open-source -- gradual rollout + A/B testing)','Environment variable flags (simple -- rebuild required to change)'],
  heap_dump:['-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/dumps (S3 sync post-dump)','heap dump disabled in prod (privacy risk -- enable only for debugging with consent)','jmap -dump:format=b,file=/tmp/heap.hprof <pid> (manual on-demand)'],
  async_pool:['20 core / 50 max async threads (Spring @Async -- queue=100, reject=CallerRuns)','10 core / 20 max (IO-bound tasks -- DB calls, HTTP clients)','Virtual threads (JDK 21 -- Project Loom, unlimited concurrency for blocking I/O)'],
  apm_agent:['Datadog Java Agent 1.39 (-javaagent:/opt/dd-java-agent.jar dd.service=app-name)','New Relic Java Agent (newrelic.jar -- auto-instrumentation of JVM + DB queries)','OpenTelemetry Java Agent (otel-javaagent.jar -- vendor-neutral, OTLP export)'],
  // DB new fields
  shared_mem:['SGA_TARGET=32G, PGA_AGGREGATE_TARGET=8G (Oracle AMM)','shared_buffers=32GB (25% RAM), huge_pages=try (PostgreSQL)','innodb_buffer_pool_size=64GB, innodb_buffer_pool_instances=8 (MySQL/MariaDB)'],
  sort_buf:['work_mem=256MB per sort (PostgreSQL -- watch multi-sort × connections)','sort_buffer_size=4MB, read_rnd_buffer_size=4MB (MySQL/MariaDB)','SORT_AREA_SIZE=65536 (Oracle -- auto PGA governs this)'],
  temp_space:['TEMP tablespace 200GB AUTOEXTEND ON MAXSIZE 500GB (Oracle)','temp_tablespaces=pg_temp (/data/pgsql-tmp 64GB) (PostgreSQL)','tmpdir=/data/mysql-tmp 100GB, tmp_table_size=256MB (MySQL)'],
  undo_ret:['UNDO_RETENTION=900s AUTOEXTEND UNDO 50GB (Oracle)','old_snapshot_threshold=-1 (PostgreSQL -- monitor long txns via pg_stat_activity)','innodb_undo_log_truncate=ON, innodb_purge_rseg_truncate_frequency=128 (MySQL)'],
  parallel_deg:['PARALLEL_DEGREE_POLICY=AUTO PARALLEL_MAX_SERVERS=32 (Oracle)','max_parallel_workers_per_gather=4, max_parallel_workers=16 (PostgreSQL)','innodb_parallel_read_threads=4 (MySQL 8.0.14+)'],
  optimizer:['OPTIMIZER_MODE=ALL_ROWS OPTIMIZER_FEATURES_ENABLE=19.1.0 (Oracle)','default_statistics_target=200, enable_partitionwise_join=on (PostgreSQL)','optimizer_switch=batched_key_access=on (MySQL/MariaDB)'],
  charset:['AL32UTF8 (Oracle -- recommended for multilingual)','UTF8 (PostgreSQL standard)','utf8mb4 (MySQL/MariaDB -- full Unicode including emoji)'],
  collation:['BINARY (Oracle NLS_SORT -- case-sensitive)','en_US.UTF-8 LC_COLLATE (PostgreSQL)','utf8mb4_unicode_ci (MySQL/MariaDB -- case-insensitive general)'],
  replication:['DataGuard async (Oracle -- LGWR ASYNC, 1 physical standby + 1 snapshot standby)','Patroni streaming (PostgreSQL -- primary + 2 standbys, WAL shipping to S3)','GTID async replication binlog_format=ROW (MySQL -- MHA/Group Replication)'],
  failover:['DataGuard FSFO Observer node 30s threshold (Oracle)','Patroni etcd consensus + HAProxy read/write split + keepalived VIP (PostgreSQL)','MHA or Group Replication + ProxySQL automatic failover (MySQL)'],
  query_timeout:['statement_timeout=30000 (30s) -- lock_timeout=10000 per session (PostgreSQL)','max_execution_time=30000 (30s) innodb_lock_wait_timeout=30 (MySQL)','Resource Manager plan CPU_PER_CALL=30 (Oracle)'],
  slow_query:['log_min_duration_statement=1000 (1s) + pg_stat_statements (PostgreSQL)','slow_query_log=ON long_query_time=1 log_queries_not_using_indexes=ON (MySQL)','SQL Monitor DBMS_SQLTUNE threshold 5s + AWR Top SQL weekly (Oracle)'],
  audit_db:['Unified Auditing: CREATE USER, GRANT, DROP TABLE, LOGON (Oracle mandatory)','pgaudit extension: all DDL + SELECT on sensitive tables (PostgreSQL)','audit_log plugin: audit_log_policy=ALL audit_log_format=JSON (MySQL)'],
  tde:['Oracle TDE (ENCRYPTION ON -- ASM encrypted disk groups + wallet auto-login)','LUKS2 volume + pgcrypto column-level encryption for PII (PostgreSQL)','InnoDB tablespace encryption innodb_encrypt_tables=ON keyring_file (MySQL)'],
  conn_pool:['PgBouncer 1.23 transaction-mode pool_size=200 server_idle_timeout=600 (PostgreSQL)','DRCP + UCP min=10 max=100 (Oracle)','ProxySQL 2.6 max_connections=2000 read-write split (MySQL/MariaDB)'],
  read_replicas:['2 read replicas (async -- reporting/analytics routed via read VIP port +1)','3 read replicas (HA reads -- load-balanced, one in DR site)','No read replicas (simple deployment -- add when read load grows > 60% total)'],
  partitioning:['Range-Interval partitioning on date column (Oracle)','Declarative RANGE partitioning by month PARTITION BY RANGE(created_at) (PostgreSQL)','RANGE COLUMNS(created_date) PARTITIONS 12 monthly auto-add via event (MySQL)'],
  index_strategy:['Auto-indexing (19c+) + nightly rebuild fragmented indexes (Oracle)','pg_repack bloat-free rebuild + CONCURRENTLY zero-downtime (PostgreSQL)','Ola Hallengren solution: rebuild > 30% frag, reorganize 10-30% (SQL Server)'],
  vacuum:['autovacuum: scale_factor=0.01, cost_delay=2, vacuum_cost_limit=400 (aggressive -- PostgreSQL)','innodb_purge_threads=4, innodb_purge_rseg_truncate_frequency=128 (MySQL)','Automatic undo management + DBMS_STATS.FLUSH_DATABASE_MONITORING_INFO (Oracle)'],
  db_links:['DB Links to reporting DB only (Oracle -- encrypted TNS REPORT_DB link)','postgres_fdw for ETL pipelines only -- dblink disabled on prod (PostgreSQL)','Linked Servers to reporting instance only read-only login (SQL Server)'],
  // Storage new fields
  block_size:['4KB (default -- optimal for most DB I/O patterns)','8KB (SAP HANA in-memory / SQL Server page size alignment)','512B (legacy -- avoid; use 4KB+ for modern storage)'],
  cache_tier:['NVMe SSD cache tier (Pure Storage DirectFlash / NetApp Flash Cache -- auto-tiering ON)','No separate cache tier (all-NVMe array -- inherently fast)','SSD read cache only (write-through -- protect DB write integrity)'],
  dedup:['Disabled for DB data volumes (OLTP random writes defeat dedup)','Enabled for backup volumes (3:1 dedup ratio typical)','Enabled for VDI/boot images (10:1 dedup ratio typical)'],
  compress_stor:['Disabled for DB data volumes (latency impact)','Enabled for backup+archive volumes (3:1 typical ratio)','Array-level LZ4 compression (all volumes -- low CPU overhead NVMe arrays)'],
  tiering:['Auto-tiering: hot NVMe, warm SAS SSD, cold NL-SAS / object (policy-driven)','Manual tiering (fixed tier assignment per LUN -- predictable performance)','All-NVMe (no tiering needed -- single tier for maximum performance)'],
  qos_stor:['DB LUN: max 50000 IOPS / 1000MB/s | Backup: max 500MB/s | App: best-effort','IOPS limit per LUN: DB 100000, App 10000, Backup 5000 (multi-tenant isolation)','No QoS (single workload -- full array bandwidth available)'],
  zoning:['Single initiator-target zoning (FC) -- each HBA to dedicated target port (best practice)','Peer zoning (less strict -- easier management, more exposure risk)','No zoning (iSCSI -- use iSCSI authentication (CHAP) instead)'],
  fc_ports:['4 FC HBA ports (2 per fabric -- dual fabric HA): 32Gbps per port','8 FC HBA ports (4 per fabric -- high bandwidth workload: DGX/Exadata)','2 FC HBA ports (1 per fabric -- minimum HA, lower bandwidth)'],
  iscsi_iqn:['iqn.2024-01.com.corp:server-01 (unique per host -- registered in array)','iqn.2024-01.com.corp:{hostname} (auto-generated from hostname in kickstart)','N/A (FC SAN -- no iSCSI)'],
  nfs_version:['NFSv4.1 (pNFS -- /mnt/nfs_archive -- sec=krb5p encryption)','NFSv4.0 (stateful -- good default for most archive mounts)','NFSv3 (legacy -- no encryption, use only on isolated storage VLAN)'],
  smb_version:['SMB 3.1.1 (SMB 1.0 globally disabled, SMB signing enforced)','SMB 3.0 (older Windows clients -- SMB 1.0 still disabled)','N/A (Linux-only environment -- no SMB required)'],
  obj_storage:['AWS S3 (ap-southeast-2) -- backup offload target, S3 Intelligent-Tiering','MinIO on-prem (S3-compatible -- self-hosted, no egress cost)','Azure Blob Storage (Standard LRS -- cool tier for infrequent backup access)'],
  quota:['Soft 80% (alert ops-storage@corp.com), hard 90% (write-block)','Soft 70% (early warning for long-running batch growth)','No quota (dedicated single-use volume -- monitor via Grafana dashboard)'],
  recycle_bin:['7-day recycle bin (NetApp ONTAP SnapRestore / Pure SafeMode)','30-day recycle bin (compliance environments -- extended recovery window)','Disabled (backup/archive volumes -- no recycle bin, point-in-time via snapshot)'],
  vg_name:['vg_data (data LUNs), vg_redo (redo/WAL), vg_backup (backup) -- separate per purpose','vg_app (app + OS), vg_db (database data + redo) -- simplified 2-VG layout','Single VG (simple -- not recommended for DB; mix of IOPS profiles)'],
  lv_layout:['lv_data (1.8TB/2TB VG), lv_redo (480GB/500GB) -- 10% free for LVM snapshots','lv_data (90% VG), lv_swap (10%) -- simple layout for non-DB servers','LVM thin pool (dynamic allocation -- not recommended for DB; use thick)'],
  fs_type_stor:['XFS (data volumes 4K block inode64 noatime) / ext4 (OS) / tmpfs (tmp: 8GB)','ZFS (Solaris -- compression=lz4, atime=off, checksum=sha256)','NTFS (Windows data volumes) / ReFS (SQL Server recommended for large DBs)'],
  mount_point:['/data, /redo, /backup, /arch (separate mount per purpose)','/ (root), /var, /tmp, /home (OS volumes), /data (application data)','D:\\ (Windows data), E:\\ (logs), F:\\ (backup) -- drive letter assignment'],
  io_priority:['DB: ionice -c 1 -n 0 (real-time RT) | Backup: ionice -c 3 (idle) | App: -c 2 -n 4','All: ionice -c 2 -n 4 (best-effort -- simple single-workload server)','N/A (SSD/NVMe array -- I/O latency so low priority scheduling is moot)'],
  stor_pool:['POOL-TIER1-NVMe (DB), POOL-TIER2-SSD (app), POOL-TIER3-NL-SAS (backup/archive)','StoragePool-01 (single tier -- all-flash array, no tiering)','SAN-POOL-PROD (production), SAN-POOL-DR (disaster recovery replica)'],
  // Backup new fields
  backup_tool:['Oracle RMAN (DB) + Veeam B&R 12.1 (OS/app) -- integrated in Veeam Orchestrator','Commvault Complete (unified -- DB + OS + cloud in single console)','Veritas NetBackup 10.x (enterprise -- tape + disk + cloud support)'],
  catalog_srv:['RMAN catalog DB: rman-catalog.corp.com:1521/RCATPRD (dedicated 19c catalog instance)','Veeam Backup Server catalog (PostgreSQL backend) -- dedicated Windows Server','Commvault CommServe (catalog + orchestration -- SQL Server backend)'],
  media_srv:['Veeam Backup Server: veeam01.corp.com (16 vCPU, 64GB RAM) + 2 proxy servers','NetBackup Media Server (master-client architecture -- SAN-attached tape/disk)','RMAN only (no media server -- direct disk-to-disk + S3 channels)'],
  storage_unit:['Veeam Scale-Out Repository 40TB usable dedup+compress','NetBackup Storage Unit (AdvancedDisk) -- 20TB usable per unit','RMAN disk channel: /backup (NFS 10TB, alert at 70%)'],
  parallel_str:['4 parallel RMAN channels (DEVICE TYPE disk PARALLELISM 4)','8 parallel streams (large DB > 5TB -- scale with vCPU count)','2 parallel streams (small DB / shared backup window)'],
  bw_limit:['500MB/s max (backup window 22:00-04:00) / 100MB/s (business hours throttle)','1GB/s max (dedicated backup VLAN -- no throttle needed)','50MB/s (WAN backup to DR site -- limited by WAN link)'],
  compress_bk:['RMAN ZLIB medium (2:1 ratio) + storage-level dedup (effective 4-6:1 total)','LZ4 (Veeam -- fast, 1.5:1 ratio, low CPU) + storage dedup','None (already compressed source data -- DB with compressed tablespaces)'],
  dedup_ratio:['2:1 typical DB backup / 3:1 OS image -- storage dedup layered on top','4:1 (VM images) / 6:1 (file servers with many similar files)','1.2:1 (encrypted DB backup -- encryption prevents dedup effectiveness)'],
  test_restore:['Monthly automated restore test (Veeam SureBackup isolated sandbox) < 30min','Quarterly full restore test to standby environment -- verify application starts','Weekly spot-test (restore 1 random file per server -- verify catalog integrity)'],
  restore_sla:['4 hours (single DB restore -- staged to test env then re-snapshot for prod)','2 hours (critical DB -- pre-staged standby server, minimal restore time)','8 hours (archive restore -- Glacier retrieval + restore)'],
  tape_lib:['N/A (disk-to-disk-to-cloud -- no tape; review for 7-year regulatory archive)','Quantum Scalar i6000 (LTO-9 -- 18TB native per cartridge -- long-term archive)','Iron Mountain off-site tape vaulting (physical rotation, WORM media)'],
  cloud_tier:['AWS S3 Glacier IR (ap-southeast-2) -- Veeam capacity tier offload after 30 days','Azure Archive Blob Storage (LRS -- 180-day minimum retention)','GCP Coldline Storage (90-day minimum -- low-cost long-term archive)'],
  immutable:['S3 Object Lock COMPLIANCE mode (30-day lock) -- ransomware/admin deletion protection','Veeam Hardened Repository (Linux immutable backup -- chattr +i)','Wasabi (object storage with 90-day immutability -- no egress fees)'],
  ransomware:['3-2-1-1-0: 3 copies, 2 media types, 1 offsite, 1 immutable, 0 SureBackup errors','Air-gapped backup copy (physically disconnected network -- weekly rotation)','Veeam Ransomware Protection (inline entropy analysis + automatic rollback)'],
  bk_window_dur:['6 hours maximum (22:00-04:00) -- PagerDuty alert if backup exceeds window','4 hours (tight SLA -- backup must complete before business hours at 06:00)','12 hours (weekend only -- large DB with extended window Saturday-Sunday)'],
  bk_priority:['Priority 1: DB (RMAN) | Priority 2: App server | Priority 3: Config/OS image','Priority 1: Tier-1 systems (production DB, email) | Priority 2: Tier-2 | Priority 3: Dev/test','All equal priority (simple environment -- sequential backup of all servers)'],
  notify_email:['ops-backup@corp.com (success+failure) -- PagerDuty P2 on 3 consecutive failures','backup-alerts@corp.com -> ServiceNow auto-ticket on failure','SMS + email to on-call (PagerDuty escalation: 15min -> P1 if no ack)'],
  pre_script:['/opt/scripts/pre-backup.sh (quiesce app, flush DB buffer, log snapshot metadata)','RMAN pre-backup: ALTER SYSTEM CHECKPOINT + archive log current (Oracle)','pg_start_backup() / CHECKPOINT (PostgreSQL -- consistent backup point)'],
  post_script:['/opt/scripts/post-backup.sh (verify catalog, cleanup old, update CMDB ticket)','RMAN post-backup: validate backupset (Oracle -- verify blocks)','pg_stop_backup() + verify WAL archived (PostgreSQL)'],
  synthetic_full:['Enabled (Veeam synthetic full Sunday -- avoids re-reading source data for weekly full)','Disabled (RMAN -- use consolidated incremental instead: image copy + apply incr)','Weekly synthetic full (Commvault -- merge incrementals into new full)'],
  // Network new fields
  ipv4_subnet:['App: 10.10.110.0/24 (VLAN 110), DB: 10.10.120.0/24 (VLAN 120), Mgmt: 10.10.130.0/24','10.0.0.0/8 (large enterprise -- /24 per subnet per VLAN)','172.16.0.0/12 (medium enterprise) / 192.168.0.0/16 (small/dev)'],
  ipv6_prefix:['Disabled (IPv6 disabled at OS level -- see unix.ipv6_mode)','2001:db8::/32 (documentation range -- replace with actual ISP allocation)','fd00::/8 (ULA -- unique local for internal IPv6 if required)'],
  default_gw:['10.10.110.1 (App VLAN GW -- HSRPv2: core-sw-01 active, core-sw-02 standby)','10.0.0.1 (standard /24 default gateway)','172.31.0.1 (AWS default VPC gateway -- auto-assigned)'],
  vip_addr:['App VIP: 10.10.110.100:443 (F5) + DB SCAN VIP: 10.10.120.10:1521 (Oracle RAC)','App VIP: 10.10.110.100 (keepalived VRRP) -- single IP, no port specificity','Multiple VIPs: web 10.10.110.100, app 10.10.110.101, db 10.10.120.10'],
  bgp_asn:['AS65001 (internal iBGP -- private ASN range 64512-65534)','AS65000 (multi-DC iBGP -- same ASN, MED for preference)','N/A (single-DC no BGP -- static routes only)'],
  ospf_area:['Area 0 (backbone -- OSPF within DC fabric)','Area 0 (backbone) + Area 1 (stub -- branch sites)','N/A (small deployment -- static routes, no dynamic routing protocol)'],
  qos_net:['DSCP EF (46) storage iSCSI/NFS, CS6 DB/app, CS1 backup -- Cisco MQC policy-map','QoS DSCP marking at server NIC (RHEL: ip link set ... txqueuelen)','No QoS (single workload, dedicated network -- all bandwidth available)'],
  jumbo_vlan:['VLAN 200 (storage iSCSI/NFS): MTU 9000 -- enabled end-to-end on all switches/NICs','All VLANs MTU 9000 (jumbo throughout -- ensure all switch ports configured)','MTU 1500 only (standard -- jumbo not supported end-to-end)'],
  port_sec:['Cisco port-security: max-mac-count 2, sticky MAC, violation shutdown -- edge ports','802.1X port authentication (RADIUS -- EAP-TLS certificate-based)','No port security (internal DC ports -- physical security controls sufficient)'],
  dhcp:['Static IPs all servers (DHCP only for OOBM iDRAC/iLO reservation by MAC)','DHCP with long lease (8h) + DDNS update (DNS auto-registration)','No DHCP (fully static IP environment)'],
  nat_policy:['No NAT server-to-server (RFC1918 routed) -- NAT only at internet edge (PAT overload)','DNAT (destination NAT) for inbound public services -- DMZ design','SNAT for outbound internet (all servers via single egress IP -- proxy.corp.com)'],
  vpn_gw:['IPsec VPN 10.10.0.1 (Cisco ASA 5525-X -- IKEv2 AES-256-GCM site-to-site + remote access)','AWS VPN Gateway (BGP dynamic routing -- VGW attached to VPC)','GlobalProtect VPN (Palo Alto) -- split tunnel, always-on for managed devices'],
  sd_wan:['N/A (single DC -- evaluate for multi-site expansion)','Cisco Catalyst SD-WAN (multi-site HA -- active/active DC failover)','Meraki SD-WAN (small branch -- auto-VPN, central dashboard)'],
  ddos:['Arbor Networks SP (volumetric) + Cloudflare Magic Transit + F5 AFM (app-layer)','Cloudflare DDoS Protection (free with Enterprise -- automatic mitigation)','AWS Shield Standard (automatic -- SYN flood / UDP reflection protection)'],
  net_monitor:['SolarWinds NPM + PRTG + Cisco ThousandEyes (synthetic path monitoring)','Prometheus + Grafana (node-exporter, blackbox-exporter, SNMP-exporter)','Zabbix 6.x (open-source -- SNMP polling + agent-based monitoring)'],
  snmp:['SNMPv3 authPriv (SHA-256/AES-128): read-only, trap target 10.10.130.10:162','SNMPv2c (read-only community string -- restrict to monitoring VLAN only)','SNMP disabled (use Prometheus SNMP exporter or vendor API instead)'],
  netflow:['NetFlow v9 (Cisco IOS-XE) -> SolarWinds NTA: 10.10.130.11:2055','sFlow v5 (Arista/Juniper) -> ntopng collector','IPFIX (industry standard -- Cisco ASR/ISR supports IPFIX export)'],
  trunk_vlans:['Allowed: 110,120,130,200 -- prune all other VLANs, native VLAN 999 (unused)','Allowed: 1-4094 (open trunk -- NOT recommended; explicitly prune per design)','Allowed: 110,120 (minimal -- only production VLANs, no mgmt on trunk)'],
  access_vlan:['110 (app), 120 (DB), 130 (management), 200 (storage NICs -- dedicated)','VLAN per server role (one VLAN per tier -- app/web/DB/storage segregated)','VLAN 1 (default -- NEVER use for production; always explicitly assign)'],
  iface_speed:['25GbE (app+DB interconnect), 100GbE (storage uplinks), 1GbE (OOB iDRAC/iLO)','10GbE (app+DB), 40GbE (storage) -- typical for older rack deployments','100GbE (all production NICs) + 1GbE (OOB) -- modern all-NVMe deployments'],
  // Security new fields
  pam:['CyberArk PAM 14.x -- all privileged accounts (root, oracle, svc_*) rotated after each use','BeyondTrust Password Safe (PAM + session recording + approval workflow)','HashiCorp Vault Dynamic Secrets (ephemeral DB credentials -- no static passwords)'],
  secrets_mgr:['HashiCorp Vault 1.17 (app secrets) / AWS Secrets Manager (cloud creds) -- zero hardcoded','AWS Secrets Manager (auto-rotation every 30 days -- RDS, IAM, custom)','Azure Key Vault (certificates + secrets + keys -- RBAC controlled access)'],
  key_mgmt:['HashiCorp Vault Transit (app-layer encryption) / AWS KMS (cloud) / KMIP for TDE','AWS KMS (CMK per environment -- CloudTrail audit, automatic key rotation)','On-premises HSM (Thales Luna / Utimaco -- FIPS 140-2 Level 3)'],
  hsm:['Thales Luna HSM 7 (FIPS 140-2 Level 3) -- TDE + PKI root CA + code signing','AWS CloudHSM (dedicated HSM in VPC -- FIPS 140-2 Level 3 validated)','N/A (software-only key management -- use only for non-critical systems)'],
  ids_ips:['Suricata IPS 7.x (inline, ET Pro ruleset) + Darktrace AI (anomaly/insider threat)','Snort 3.x (IDS mode -- inline IPS requires policy tuning to avoid false positives)','AWS GuardDuty (cloud-native threat detection -- ML-based anomaly detection)'],
  edr:['CrowdStrike Falcon Insight XDR (v7.x -- MDR for after-hours SOC coverage)','Microsoft Defender for Endpoint (P2 -- ATP, EDR, vulnerability management)','SentinelOne Singularity (AI-driven behavioral detection -- no signature dependency)'],
  dlp:['Symantec DLP 16.x (DB query monitoring > 500 rows + outbound > 10MB, PII rules)','Microsoft Purview DLP (M365/Teams/OneDrive -- unified compliance platform)','Varonis (file system + email DLP -- automated least-privilege remediation)'],
  fw_type:['Palo Alto PA-5450 NGFW (app-layer policy, threat prevention, SSL inspection)','Fortinet FortiGate 3000F (UTM -- IPS + antivirus + web filtering)','AWS Security Groups + Network Firewall (managed -- Suricata-compatible rules)'],
  pentest:['Quarterly external pen test (CREST-certified) + annual red team / purple team exercise','Bi-annual pen test (ISO 27001 minimum) -- scope: external + internal + web apps','Continuous pen testing (HackerOne / Bugcrowd bug bounty program)'],
  sec_baseline:['CIS Benchmark Level 2 via Ansible hardening playbook -- OpenSCAP scored quarterly','DISA STIG (DoD-level hardening -- use for government / defense contracts)','ISO 27001 A.12.6 baseline -- self-assessment + 3rd-party audit annually'],
  hardening:['STIG (ASD/DISA) + CIS Level 2 -- ansible-role-hardening (auto-remediate on detect)','CIS Level 1 (baseline -- less restrictive, suitable for mixed workloads)','Custom hardening playbook (based on CIS + internal security policy deviations)'],
  log_ret_sec:['12 months online (Splunk hot/warm) + 7 years cold archive (S3 Glacier -- ISO 27001/PCI)','1 year online + 3 years archive (SOC 2 Type II minimum -- Elasticsearch ILM)','6 months online (GDPR minimum for security logs -- right-to-erasure considered)'],
  ir_playbook:['IR Playbook v3.2 (Confluence /wiki/ir-playbook) -- NIST CSF Tier 3, contain < 2h','NIST SP 800-61r2 playbooks (public template -- customise per threat actor type)','IRP reviewed annually + tabletop exercise every 6 months (ISO 27001 A.16)'],
  change_ctrl:['ServiceNow CAB: standard 5-business-day lead | emergency 2h E-CAB approval','ITIL v4 change management -- RFC → CAB → CAB-approved → scheduled → PIR','Jira + GitOps (infrastructure-as-code changes approved via PR + automated tests)'],
  data_class:['RESTRICTED (PII/cardholder -- AES-256 + access log) / CONFIDENTIAL / PUBLIC','OFFICIAL/PROTECTED/SECRET (government classification) -- apply DLP labels','PII (personal), PHI (health), PCI (card), CONFIDENTIAL, PUBLIC -- DLP auto-label'],
  enc_rest:['AES-256-GCM (LUKS2 volume + TDE) + Vault Transit per-field encryption for PII','AES-256 LUKS2 (all disks) -- no column-level (non-sensitive data only)','AWS EBS encryption (KMS-managed) + RDS encryption -- cloud-native at-rest'],
  enc_transit:['TLS 1.3 mandatory -- mutual TLS (mTLS) for service-mesh east-west traffic (Istio)','TLS 1.2+ (minimum -- schedule TLS 1.3 migration within 12 months)','IPsec for DB replication traffic (encrypted at network layer -- Oracle DataGuard)'],
  zero_trust:['Verify identity (Okta + MFA) + device posture (CrowdStrike) + least-privilege RBAC','BeyondCorp (Google model) -- no implicit trust on network; verify every request','Zscaler ZPA (ZTNA -- replace VPN with identity-aware proxy for remote access)'],
  supply_chain:['SBOM (CycloneDX) per release + Snyk + Dependabot in CI -- fail on CVSS >= 9.0','Sigstore (cosign) for container image signing -- verify before deploy (Kubernetes admission)','GitHub Advanced Security (GHAS) -- CodeQL + dependency review + secret scanning'],
  sec_training:['Annual KnowBe4 security awareness + OWASP Top 10 for devs + quarterly phishing sim','Security champions program (1 per dev team) + SANS training budget per engineer','CISM/CISSP study support + ASD Essential Eight awareness for all staff'],
};

// Context-aware suggestion engine — enriches base suggestions with build-specific hints
export function buildContextSuggestions(val, fieldId, ctx, sysDesignData, scanResults) {
  const { hw = '', os = '', db = '', app = '' } = ctx || {};
  const contextual = [];

  // --- scan findings → title / desc fields ---
  if ((fieldId === 'title' || fieldId === 'desc') && Array.isArray(scanResults) && scanResults.length) {
    const lower = (val || '').toLowerCase();
    const relevant = scanResults
      .map(r => (typeof r === 'string' ? r : `[${r.sev || 'INFO'}] ${r.component || ''}: ${r.msg || ''}`))
      .filter(r => lower.length < 2 || r.toLowerCase().includes(lower))
      .slice(0, 3);
    contextual.push(...relevant);
  }

  if (fieldId === 'title' || fieldId === 'desc') {
    if (/oracle/i.test(db)) {
      contextual.push(
        `Oracle DB patch required (${db.split(' ')[0]} ${db.split(' ')[1] || ''}) — apply RU via OPatch in patch window`,
        'Oracle tablespace approaching threshold — TEMP/UNDO growth detected',
        'Oracle listener not responding — TNS-12541, review listener.log',
        'Oracle archive log destination full — archivelog mode at risk',
      );
    } else if (/postgres/i.test(db)) {
      contextual.push(
        `PostgreSQL replication lag — standby behind primary by > 30s (${db})`,
        'PostgreSQL bloat detected — autovacuum not keeping pace with write load',
        'PostgreSQL connection exhaustion — max_connections limit approaching',
      );
    } else if (/mysql|mariadb/i.test(db)) {
      contextual.push(
        `${db} replication broken — slave_io_running or slave_sql_running = NO`,
        `${db} table space full — ibdata1 growth, enable innodb_file_per_table`,
        'MySQL slow queries causing lock contention — long-running transactions',
      );
    } else if (/db2/i.test(db)) {
      contextual.push(
        `IBM DB2 tablespace full — container resize or redirect restore required`,
        `DB2 log space full — LOGFULL condition, increase LOGPRIMARY/LOGSECOND`,
      );
    }

    if (/aix/i.test(os)) {
      contextual.push(
        'AIX errpt hardware error — disk path failure detected (AIX MPIO path down)',
        `AIX TL/SP maintenance required — current OS: ${os.split(' ')[0]} ${os.split(' ')[1] || ''}`,
        'AIX ODM corruption — boot device issue, run bosboot -ad /dev/hdisk0',
      );
    } else if (/rhel|centos|rocky|alma|oracle linux/i.test(os)) {
      contextual.push(
        `RHEL kernel security patch required — glibc / kernel-core CVE advisory (${os})`,
        `RHEL subscription not registered — yum/dnf update blocked`,
        `RHEL filesystem full — /var or /tmp threshold breached`,
      );
    } else if (/ubuntu|debian/i.test(os)) {
      contextual.push(
        `Ubuntu security patch required — apt-get dist-upgrade (${os})`,
        'Ubuntu kernel update requires reboot — livepatch not applied',
      );
    } else if (/solaris/i.test(os)) {
      contextual.push(
        `Solaris zone / non-global zone fault — zoneadm list -cv`,
        `Solaris patch required — pkg update (IPS) or patchadd (legacy ${os})`,
      );
    } else if (/windows/i.test(os)) {
      contextual.push(
        `Windows Server patch cycle — WSUS pending reboot (${os})`,
        'Windows service crash — event log ID 7034 / 7031, service restart required',
      );
    }

    if (/ibm power|power10|power9/i.test(hw)) {
      contextual.push(
        `IBM Power firmware update required — ${hw} HMC-managed, schedule outage`,
        'IBM Power disk path failure — PVID path degraded, check errpt / MPIO',
      );
    }
    if (/exadata/i.test(hw)) {
      contextual.push(
        'Oracle Exadata cell disk degraded — replace failed disk in IORM pool',
        'Exadata smart scan disabled — check cell offload, rerun db full checks',
      );
    }

    if (/websphere|liberty/i.test(app)) {
      contextual.push(
        `IBM WebSphere out-of-memory — JVM heap exhausted, review ${app} JVM Xmx`,
        'WebSphere thread pool exhaustion — maxThreads exceeded, check datasource pool',
      );
    } else if (/tomcat/i.test(app)) {
      contextual.push(
        `Apache Tomcat OOM / GC overhead — heap tuning required (${app})`,
        'Tomcat connector threads exhausted — maxThreads 200 reached, queue backing up',
      );
    } else if (/weblogic/i.test(app)) {
      contextual.push(
        `Oracle WebLogic managed server down — check AdminServer logs (${app})`,
        'WebLogic datasource connection leak — connection pool depleted, restart required',
      );
    }
  }

  if (fieldId === 'owner') {
    if (/oracle|db2|postgres|mysql|mariadb/i.test(db)) contextual.unshift('DB Admin / DBA');
    if (/aix|rhel|ubuntu|solaris|suse|linux/i.test(os)) contextual.unshift('Unix Admin');
    if (/tomcat|websphere|weblogic|jboss|spring|node/i.test(app)) contextual.unshift('App Admin');
    if (/power|exadata|dell|hpe|cisco ucs/i.test(hw)) contextual.unshift('SysAdmin Lead / Infrastructure Lead');
  }

  if (fieldId === 'constraints') {
    if (/(eol)/i.test(os)) {
      contextual.unshift(`OS EOL migration required — ${os.split(' (')[0]} is end-of-life, plan upgrade`);
    }
    if (/(eol)/i.test(db)) {
      contextual.unshift(`DB version EOL — ${db.split(' (')[0]} no longer supported, upgrade required`);
    }
    if (/oracle/i.test(db)) {
      contextual.push('Oracle licensing review required — CPU factor applies before adding sockets');
    }
    if (sysDesignData?.db?.backup_window) {
      contextual.push(`DB backup window constraint: ${sysDesignData.db.backup_window.substring(0, 60)}`);
    }
  }

  if (fieldId === 'sla') {
    if (/oracle/i.test(db) || /power/i.test(hw)) {
      contextual.unshift('99.99% (four nines — 52 min/year, standard for Oracle OLTP on Power)');
    }
    if (/exadata/i.test(hw)) {
      contextual.unshift('99.999% (five nines — Exadata RAC with DataGuard)');
    }
  }

  if (fieldId === 'compliance') {
    if (/financial|bank|payment/i.test((sysDesignData?.security?.data_class || ''))) {
      contextual.unshift('PCI-DSS 4.0 (cardholder data — quarterly ASV scan)');
    }
    if (/health|phi|hipaa/i.test((sysDesignData?.security?.data_class || ''))) {
      contextual.unshift('HIPAA (US protected health information)');
    }
  }

  const base = matchSuggestKeys(val, fieldId);
  return [...new Set([...contextual, ...base])].slice(0, 7);
}

export function matchSuggestKeys(val, fieldId, minChars = 3) {
  if ((val || '').trim().length < minChars) return [];
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
