export function getDefaultDesignValues(ctx) {
  const hw  = (ctx.hw  || '').toLowerCase();
  const os  = (ctx.os  || '').toLowerCase();
  const db  = (ctx.db  || '').toLowerCase();
  const app = (ctx.app || '').toLowerCase();

  const isAix     = os.includes('aix');
  const isWindows = os.includes('windows');
  const isRhel    = os.includes('rhel') || os.includes('alma') || os.includes('rocky') || os.includes('oracle linux');
  const isUbuntu  = os.includes('ubuntu') || os.includes('debian');
  const isSles    = os.includes('suse') || os.includes('sles');
  const isZos     = os.includes('z/os');
  const isSolaris = os.includes('solaris');

  const isOracle  = db.includes('oracle');
  const isPostgres= db.includes('postgres');
  const isMysql   = db.includes('mysql');
  const isMariadb = db.includes('mariadb');
  const isMssql   = db.includes('sql server');
  const isHana    = db.includes('hana');
  const isDb2     = db.includes('db2');
  const isMongo   = db.includes('mongodb');

  const isNginx   = app.includes('nginx');
  const isApache  = app.includes('apache') || app.includes('httpd');
  const isTomcat  = app.includes('tomcat');
  const isWas     = app.includes('websphere');
  const isWls     = app.includes('weblogic');
  const isJboss   = app.includes('jboss') || app.includes('wildfly');
  const isSpring  = app.includes('spring');
  const isNode    = app.includes('node');
  const isPython  = app.includes('python') || app.includes('django') || app.includes('fastapi');
  const isAws     = hw.includes('graviton') || hw.includes('aws');
  const isAzure   = hw.includes('cobalt') || hw.includes('azure');
  const isGcp     = hw.includes('axion') || hw.includes('gcp');
  const isPower   = hw.includes('power');
  const isZ16     = hw.includes('z16');
  const isDgx     = hw.includes('dgx');
  const isExadata = hw.includes('exadata');

  // ── CPU default ──────────────────────────────────────────────────────────
  const cpuDefault =
    hw.includes('power7') || hw.includes('power8') ? '16 LPAR threads (POWER7/8 dedicated)' :
    hw.includes('power9')  ? '32 LPAR threads (POWER9 SMT-4)' :
    hw.includes('power10') || hw.includes('power11') ? '48 LPAR threads (POWER10 SMT-8)' :
    isAws    ? '32 vCPUs (Graviton4 r8g.8xlarge)' :
    isAzure  ? '96 vCPUs (Azure Cobalt 100)' :
    isGcp    ? '72 vCPUs (GCP Axion C4A)' :
    hw.includes('epyc') ? '64 cores (AMD EPYC Turin 9654, 2-socket)' :
    hw.includes('xeon') ? '48 cores (Intel Xeon SP 4th Gen, 2-socket)' :
    isZ16    ? '20 CPs + 4 zIIPs (IBM z16 LPAR)' :
    isDgx    ? '128 vCPUs (NVIDIA DGX H100 host)' :
    isExadata? '48 cores (Oracle Exadata X10M DB node)' :
    '32 vCPUs (x86_64, 2-socket)';

  // ── RAM default ───────────────────────────────────────────────────────────
  const ramDefault =
    hw.includes('power7') || hw.includes('power8') ? '256 GB (POWER7/8 LPAR allocation)' :
    hw.includes('power9')  ? '512 GB (POWER9 LPAR)' :
    hw.includes('power10') || hw.includes('power11') ? '1 TB (POWER10 LPAR)' :
    isAws    ? '128 GB (r8g.8xlarge Graviton4)' :
    isZ16    ? '512 GB (z16 LPAR)' :
    isDgx    ? '2 TB (DGX H100)' :
    isExadata? '768 GB (Exadata X10M)' :
    '128 GB ECC DDR5';

  const swapDefault =
    isAix     ? '64 GB page space (hd6 — AIX 2×RAM rule)' :
    isWindows ? 'Managed by Windows — pagefile.sys auto (1.5× RAM)' :
    isZos     ? 'N/A (z/OS memory managed by WLM)' :
    '16 GB swap partition (sda3) — vm.swappiness=10';

  const kernelDefault =
    isAix     ? 'ioo: maxpgahead=64, vmo: minfree=960 maxfree=1088, no: tcp_recvspace=65536 tcp_sendspace=65536' :
    isRhel    ? 'vm.swappiness=10, net.core.somaxconn=65535, kernel.pid_max=4194304, fs.file-max=2097152, vm.dirty_ratio=15' :
    isUbuntu  ? 'vm.swappiness=10, net.ipv4.tcp_keepalive_time=600, fs.inotify.max_user_watches=524288, fs.file-max=2097152' :
    isSles    ? 'vm.swappiness=10, net.core.netdev_max_backlog=10000, kernel.shmmax=68719476736, vm.dirty_ratio=20' :
    isSolaris ? 'ndd /dev/tcp tcp_recv_hiwater_mark=65536, project.max-sem-ids=512, resource control' :
    isWindows ? 'N/A — managed via Group Policy and registry (HKLM\\SYSTEM\\CurrentControlSet)' :
    'vm.swappiness=10, net.core.somaxconn=65535, fs.file-max=2097152, kernel.pid_max=4194304';

  // ── DB-specific ───────────────────────────────────────────────────────────
  const bufPool =
    isOracle   ? '32 GB SGA (SGA_TARGET=32G, SGA_MAX_SIZE=36G, PGA_AGGREGATE_TARGET=8G)' :
    isPostgres ? 'shared_buffers=32 GB (25% RAM), effective_cache_size=96 GB, work_mem=256 MB' :
    isMysql || isMariadb ? 'innodb_buffer_pool_size=64 GB (50% of 128 GB RAM), innodb_buffer_pool_instances=8' :
    isMssql    ? 'Max server memory: 96 GB (leaving 32 GB for OS — sp_configure)' :
    isHana     ? 'Managed by HANA Memory Manager — global_allocation_limit=110 GB' :
    isDb2      ? 'BUFFERPOOL BP32K size 524288 (32K pages = 16 GB, auto-resize ON)' :
    isMongo    ? 'WiredTiger cache: 64 GB (wiredTigerCacheSizeGB: 64 in mongod.conf)' :
    '32 GB buffer pool (25% of total RAM)';

  const dbMaxConn =
    isOracle   ? '500 sessions (processes=500, sessions=555, transactions=610)' :
    isPostgres ? 'max_connections=400 (+ PgBouncer pool_size=200 per DB)' :
    isMysql || isMariadb ? 'max_connections=500 (thread_cache_size=100, wait_timeout=600)' :
    isMssql    ? '0 (unlimited — governed by max_worker_threads=1024)' :
    isMongo    ? 'net.maxIncomingConnections: 2000 (mongod.conf)' :
    '500 maximum connections';

  const redoSize =
    isOracle   ? '512 MB per member, 4 groups (ALTER DATABASE ADD LOGFILE GROUP)' :
    isPostgres ? 'wal_segment_size=256 MB, min_wal_size=2 GB, max_wal_size=8 GB, checkpoint_completion_target=0.9' :
    isMysql || isMariadb ? 'innodb_log_file_size=2 GB, innodb_log_files_in_group=2 (4 GB total redo)' :
    isMssql    ? 'VLF auto-managed — set DB recovery model to FULL, backup log every 15 min' :
    isDb2      ? 'LOGFILSIZ=65536 (256 MB), LOGPRIMARY=12, LOGSECOND=50' :
    '512 MB per log segment, retain 7 days';

  const listenerPort =
    isOracle   ? '1521 (TNS Listener — SCAN VIP for RAC: scan-vip:1521/svc_name)' :
    isPostgres ? '5432 (PostgreSQL) + 6432 (PgBouncer transaction pool)' :
    isMysql    ? '3306 (MySQL) + 6033 (ProxySQL read-write split)' :
    isMariadb  ? '3306 (MariaDB) + 4567 (Galera replication port)' :
    isMssql    ? '1433 (SQL Server default instance)' :
    isDb2      ? '50000 (Db2 — SVCENAME=db2c_db2inst1)' :
    isHana     ? '30015 (SAP HANA MDC System DB tenant)' :
    isMongo    ? '27017 (MongoDB) + 27018 (mongos router)' :
    '5432';

  const jvmXmx =
    isWas  ? '8 g (-Xmx8g WebSphere JVM custom property)' :
    isWls  ? '8 g (-Xmx8g -XX:+UseG1GC WebLogic managed server)' :
    isJboss? '6 g (-Xmx6g WildFly standalone.conf)' :
    '8 g (-Xmx8g — 70% of available instance memory)';

  const gcPolicy =
    isWas || isWls  ? 'G1GC (-XX:+UseG1GC -XX:MaxGCPauseMillis=200)' :
    isZ16 || isZos  ? 'gencon (IBM J9 — default for z/OS)' :
    'G1GC (-XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:G1HeapRegionSize=16m)';

  const deployMethod =
    isWas  ? 'wsadmin.sh AdminApp.install (Enterprise Archive .ear deployment)' :
    isWls  ? 'WLST / weblogic.Deployer (WAR/EAR — AdminServer target)' :
    isJboss? 'jboss-cli.sh deploy app.war (WildFly managed domain)' :
    isTomcat? 'Tomcat Manager API PUT /manager/text/deploy?path=/ (WAR)' :
    isSpring? 'Ansible role: copy JAR + systemd restart (Blue-Green via LB drain)' :
    isNode  ? 'PM2 deploy ecosystem.config.js --env production' :
    'Ansible playbook: artifact deploy + rolling restart via LB drain';

  const healthUrl =
    isSpring? '/actuator/health (Spring Boot Actuator — returns {"status":"UP"})' :
    isNode  ? '/health (Express middleware — returns 200 OK {"status":"ok"})' :
    isPython? '/health/ (Django/FastAPI health check — returns 200 OK)' :
    isWas   ? '/wps/health (WebSphere health check endpoint)' :
    isWls   ? '/weblogic/ready (WebLogic health check endpoint)' :
    '/health (HTTP 200 {"status":"UP","uptime":"..."})';

  const workerProc =
    isNginx ? '8 worker_processes (auto — 2× vCPU), 2048 worker_connections each' :
    isApache? 'mpm_event: MaxRequestWorkers=400, ThreadsPerChild=25, ServerLimit=16' :
    '8 workers (auto), max_connections=10000';

  const monAgent =
    isAws   ? 'CloudWatch Agent 1.300085 + Datadog 7.x + node-exporter 1.8' :
    isAzure ? 'Azure Monitor Agent + Datadog 7.x + node-exporter 1.8' :
    isGcp   ? 'Google Cloud Ops Agent + Prometheus node-exporter 1.8' :
    'Datadog Agent 7.x + Prometheus node-exporter 1.8 + Fluent Bit 3.0';

  const sslExpiry = (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10) + ' (renew 30 days before — auto via certbot/ACME)';
  })();

  // ── RETURN 30 fields per section ─────────────────────────────────────────
  return {
    unix: {
      cpu:            cpuDefault,
      ram:            ramDefault,
      swap:           swapDefault,
      kernel_params:  kernelDefault,
      patch_window:   isAix     ? 'Saturday 02:00–06:00 AEST (AIX TL/SP bundle — 4 h window)' :
                      isWindows ? 'Sunday 01:00–05:00 (WSUS/SCCM patching — reboot required)' :
                      'Sunday 02:00–06:00 (yum/apt — 4 h window, no reboot for minor patches)',
      ntp_server:     isAws ? '169.254.169.123 (AWS Time Sync — chrony, iburst prefer)' :
                      '10.0.0.1 (internal GPS stratum-1), 1.pool.ntp.org (external fallback)',
      dns_server:     isAws ? '169.254.169.253 (AWS VPC DNS — Route53 Resolver)' :
                      '10.0.0.2 (primary corp DNS), 10.0.0.3 (secondary)',
      timezone:       'Australia/Sydney (AEST/AEDT — UTC+10/+11)',
      monitoring_agent: monAgent,
      notes:          '',
      cpu_governor:   isAix     ? 'N/A (AIX — LPAR CPU is managed by HMC)' :
                      isWindows ? 'High Performance power plan (powercfg /setactive SCHEME_MIN)' :
                      'performance (cpupower frequency-set -g performance — disable C-states for DB)',
      numa_policy:    isAix ? 'N/A (AIX NUMA managed by WPAR/LPAR configuration)' :
                      'numactl --interleave=all (spread memory across nodes for DB workloads)',
      hugepages:      isAix || isWindows ? 'N/A — managed by OS' :
                      isOracle || isHana  ? '4096 × 2 MB = 8 GB (vm.nr_hugepages=4096 for Oracle/HANA SGA)' :
                      '0 (disabled — enable only for DB/high-memory workloads)',
      io_scheduler:   isAix     ? 'N/A (AIX Deadline I/O scheduler — managed by ODM)' :
                      isWindows ? 'N/A (Windows I/O managed by Storage Spaces/MPIO)' :
                      'mq-deadline (block storage DB) / none (NVMe — bypass scheduler)',
      ulimits:        isAix ? 'chsec /etc/security/limits — nofiles_hard=65536, stack=65536' :
                      isWindows ? 'N/A — Windows uses handle limits (registry)' :
                      'nofile=65536, nproc=65536, stack=8192 KB (/etc/security/limits.d/99-app.conf)',
      selinux:        isAix || isWindows || isSolaris ? 'N/A (not applicable to this OS)' :
                      isUbuntu ? 'AppArmor enforcing (aa-status) — profiles for nginx, mysqld, apache2' :
                      'SELinux enforcing (setenforce 1, SELINUXTYPE=targeted — audit2allow for tuning)',
      auditd:         isAix ? 'AIX Audit: /etc/security/audit/config (file, commands classes enabled)' :
                      isWindows ? 'Windows Event Log Audit Policy (auditpol /set /category:* /success:enable)' :
                      'auditd enabled: -a always,exit -F arch=b64 -S execve,connect,open -k syscalls',
      cron_jobs:      isWindows ? 'Task Scheduler: logrotate (daily 02:00), patch scan (Mon 06:00)' :
                      'logrotate (daily 02:00), patch check (Mon 06:00), stats gather (Sun 04:00), backup verify (daily 07:00)',
      ssh_config:     isWindows ? 'OpenSSH Server: PermitRootLogin no, PasswordAuthentication no (Group Policy)' :
                      isAix ? 'AIX sshd: Protocol 2, PermitRootLogin no, X11Forwarding no' :
                      'SSHd: Protocol 2, PermitRootLogin no, PasswordAuthentication no, MaxAuthTries 3, Port 22',
      sudo_policy:    isWindows ? 'N/A — Windows uses RBAC via Active Directory groups and Just Enough Admin (JEA)' :
                      'NOPASSWD sudo for service restart only (app OS user). PAM+CyberArk for privileged cmds.',
      syslog_server:  isWindows ? 'Windows Event Forwarding → Splunk UF (WEF subscription + Splunk Add-on)' :
                      'rsyslog → Splunk HEC (TCP 6514 TLS) — /etc/rsyslog.d/50-remote.conf',
      fs_type:        isAix     ? 'JFS2 (journaled — /data, /app) + NFS (archive mounts)' :
                      isWindows ? 'NTFS (system + data) / ReFS (optional for large volumes)' :
                      isSolaris  ? 'ZFS (data volumes with compression=lz4, atime=off)' :
                      'XFS (data/app volumes, inode64) / ext4 (OS root) / tmpfs (tmp)',
      mount_opts:     isAix ? 'rw,log=/dev/loglv00 (JFS2 — inline logging)' :
                      isWindows ? 'N/A (NTFS mount managed by Disk Management)' :
                      'noatime,nodiratime (data vol) / defaults,noexec,nosuid (tmp/var)',
      locale:         isAix ? 'en_AU.UTF-8 (LANG=en_AU.UTF-8, set in /etc/environment)' :
                      isWindows ? 'en-AU (Regional Settings → System Locale: English Australia)' :
                      'en_AU.UTF-8 (LANG=en_AU.UTF-8, LC_ALL=en_AU.UTF-8 in /etc/locale.conf)',
      tuned_profile:  isAix || isWindows || isSolaris ? 'N/A' :
                      isOracle || isPostgres || isMysql ? 'throughput-performance (DB host — tuned-adm profile throughput-performance)' :
                      'throughput-performance (tuned-adm profile) — auto-selected on most RHEL/Ubuntu',
      kdump:          isAix ? 'AIX sysdumpdev -l (dump device: /dev/lg_dumplv) — notify ops@corp.com' :
                      isWindows ? 'Complete Memory Dump (System Properties → Advanced → Startup and Recovery)' :
                      'kdump enabled (crashkernel=512M) — dump to /var/crash, sync to S3 post-capture',
      core_dumps:     isWindows ? 'WER (Windows Error Reporting) — user-mode crash dumps to %LOCALAPPDATA%\\CrashDumps' :
                      'Disabled in prod (ulimit -c 0). Enable temporarily: sysctl kernel.core_pattern=/tmp/core-%e-%p',
      ipv6_mode:      'Disabled (net.ipv6.conf.all.disable_ipv6=1 in sysctl.d) — IPv4 only in this environment',
      hostname_scheme: 'srv-{env}-{role}-{seq} (e.g. srv-prd-db-01) — DNS A record + PTR registered in corp DNS',
      boot_loader:    isAix ? 'AIX SMS (System Management Services) — boot list managed by bootlist command' :
                      isWindows ? 'Windows Boot Manager (bcdedit — EFI/UEFI, Secure Boot enabled)' :
                      'GRUB2 — timeout=5s, console=ttyS0,115200 (serial for iDRAC/iLO OOB access)',
    },

    web: {
      worker_proc:    workerProc,
      keepalive:      '65 (recommended — slightly above LB idle timeout of 60 s)',
      max_conn:       isNginx ? '10000 (worker_processes × worker_connections)' : '5000 (Apache MaxRequestWorkers balanced)',
      ssl_cert_expiry: sslExpiry,
      log_retention:  '90 days (compressed after 7 days — logrotate daily with gzip)',
      reverse_proxy:  'http://127.0.0.1:8080 (local app server — proxy_pass / ProxyPass)',
      load_bal_algo:  isNginx ? 'least_conn (NGINX upstream — sticky sessions via ip_hash fallback)' :
                      'round-robin (HAProxy/F5 — persist via cookie SERVERID)',
      session_timeout: '3600',
      health_check_url: healthUrl,
      notes:          '',
      ssl_protocols:  'TLSv1.2 TLSv1.3 (disable TLSv1.0 and TLSv1.1 — PCI-DSS 4.0 requirement)',
      ssl_ciphers:    'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES256-GCM-SHA384',
      hsts:           'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
      compression:    'gzip level 6 (text/html text/css application/json application/javascript — min-size 1024)',
      cache_control:  'static assets: max-age=31536000, immutable | API: no-store | HTML: no-cache, must-revalidate',
      request_timeout: '30 (upstream_read_timeout/ProxyTimeout — 5 s less than app-tier timeout)',
      worker_threads: isTomcat ? '200 (Tomcat connector maxThreads — match app thread_pool)' :
                      isWas ? '50 (WebSphere web container thread pool — default 50-100)' :
                      '25 (balanced for proxy/web tier)',
      max_req_size:   '50 MB (client_max_body_size NGINX / LimitRequestBody Apache — file upload limit)',
      rate_limit:     '100 req/s per IP (NGINX limit_req_zone zone=req_limit, burst=200 nodelay)',
      waf:            'ModSecurity 3.x with OWASP CRS 4.0 — detection mode first, block after 2-week tuning',
      access_log:     isNginx ? 'combined + $request_time $upstream_response_time (custom log_format perf)' :
                      '"%h %l %u %t \\"%r\\" %>s %b %D" (combined + request time microseconds)',
      error_log_level: 'warn (production — reduce noise; use info on staging)',
      vhosts:         '2 virtual hosts: app.corp.com (primary HTTPS:443) + health.internal (LB health HTTPS:8443)',
      upstream_servers: 'server 10.10.110.11:8080 weight=5 max_fails=3; server 10.10.110.12:8080 weight=5 max_fails=3;',
      sticky_sessions: 'Cookie SERVERID (F5 iRule persistence) / ip_hash (NGINX) — required for stateful sessions',
      http2:          'HTTP/2 enabled (listen 443 ssl http2 — requires TLS; h2c disabled for security)',
      websocket:      'WebSocket upgrade: proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "Upgrade"',
      cdn:            'CloudFront (static /static/* with origin shield ap-southeast-2) — 1-year cache TTL',
      cors:           'Access-Control-Allow-Origin: https://app.corp.com (no wildcard * in production)',
      sec_headers:    'X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin, CSP enforced',
    },

    app: {
      jvm_xmx:        jvmXmx,
      jvm_xms:        '2 g (-Xms2g — start at 25% of Xmx, grow under load)',
      thread_pool:    '200 (balanced: 2× vCPU + connection pool overhead)',
      datasource_pool: '100 (HikariCP maxPoolSize — Oracle RAC: 50 per node)',
      deploy_method:  deployMethod,
      app_port:       '8080',
      heap_ratio:     '70',
      gc_policy:      gcPolicy,
      log_level:      'INFO',
      notes:          '',
      jvm_metaspace:  '-XX:MaxMetaspaceSize=512m (prevent classloader leak in long-running apps)',
      jvm_stack:      '-Xss512k per thread (200 threads ≈ 100 MB native memory for stacks)',
      gc_log:         '-Xlog:gc*,safepoint:file=/app/logs/gc.log:time,uptime:filecount=10,filesize=20m',
      jmx_port:       '9999 (JMX — restricted to mgmt VLAN, TLS + auth enabled, not exposed publicly)',
      app_context:    '/ (root context — adjust if deploying alongside other apps on shared server)',
      session_rep:    isSpring ? 'Redis session store (spring-session-data-redis — stateless app tier for HA)' :
                      isWas    ? 'WebSphere memory-to-memory session replication (cluster peer)' :
                      isWls    ? 'WebLogic in-memory replication (cluster multicast)' :
                      'Redis 7.2 session store — stateless app tier for horizontal scale',
      cache_provider: 'Redis 7.2 Cluster (3 masters + 3 replicas — TTL=3600 s for reference data, L2 cache)',
      msg_broker:     isPython || isNode ? 'Celery + Redis broker (async tasks) / RabbitMQ 3.13 for queued jobs' :
                      'Apache Kafka 3.7 (async event streaming) / RabbitMQ 3.13 (queued jobs)',
      metrics_endpoint: isSpring ? '/actuator/metrics + /actuator/prometheus (Micrometer — Prometheus scrape)' :
                        isNode   ? '/metrics (prom-client — Prometheus scrape at :9090/metrics)' :
                        '/metrics (Prometheus-compatible endpoint for monitoring)',
      config_server:  isSpring ? 'Spring Cloud Config Server (git-backed) or env vars via Kubernetes ConfigMap' :
                      'Environment variables (12-factor) — secrets via HashiCorp Vault / AWS Secrets Manager',
      service_discovery: 'Kubernetes CoreDNS (within cluster) / Consul 1.19 (multi-DC service mesh + health checks)',
      circuit_breaker: 'Resilience4j (CircuitBreaker + Retry + Bulkhead) — threshold 50% failures in 10 req window',
      retry_policy:   '3 retries with exponential backoff (1 s, 2 s, 4 s) for 5xx / connection timeout only',
      timeout_ms:     '5000 (HTTP client) + 3000 (DB query) + 500 (cache get) — fail fast, circuit-break at 5× p99',
      tracing:        'OpenTelemetry OTLP → Jaeger (or Datadog APM) — 100% sample staging, 5% prod adaptive',
      log_aggregator: 'Fluent Bit 3.x → Kafka → Elasticsearch / Splunk (structured JSON logs, ECS format)',
      feature_flags:  'LaunchDarkly SDK (or Unleash self-hosted) — kill switch per major feature, 0% rollout default',
      heap_dump:      '-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/dumps (S3 sync post-dump via script)',
      async_pool:     '20 core / 50 max async threads (Spring @Async TaskExecutor — queue=100, reject=CallerRuns)',
      apm_agent:      isNode   ? 'Datadog Node.js Tracer (dd-trace) / New Relic Node Agent' :
                      isPython ? 'Datadog ddtrace (ddtrace-run) / OpenTelemetry Python SDK' :
                      'Datadog Java Agent 1.39 (-javaagent:/opt/dd-java-agent.jar dd.service=app-name)',
    },

    db: {
      buf_pool:       bufPool,
      max_conn:       dbMaxConn,
      redo_size:      redoSize,
      archive_dest:   isOracle   ? '+FRA (ASM Fast Recovery Area — LOG_ARCHIVE_DEST_1=LOCATION=+FRA, 500 GB)' :
                      isPostgres ? "archive_command='rsync -az %p /mnt/pgarchive/%f' (NFS WAL archive)" :
                      '/arch01 (NFS — 1 TB allocated, alert at 80%)',
      backup_window:  'Saturday 22:00 full backup (estimated 3–6 h window)',
      standby_lag:    isOracle   ? '< 30 s (DataGuard async — LOG_ARCHIVE_DEST_2 ASYNC VALID_FOR=ONLINE_LOGFILES)' :
                      isPostgres ? '< 5 s (Patroni streaming replication — recovery_min_apply_delay=0)' :
                      '< 30 s (async replication target)',
      stats_window:   'Sunday 04:00 — automated statistics gather job (DBMS_STATS / ANALYZE / OPTIMIZE)',
      tablespace_pct: '80',
      listener_port:  listenerPort,
      notes:          '',
      shared_mem:     isOracle   ? 'SGA_TARGET=32 G, PGA_AGGREGATE_TARGET=8 G (AMM managed)' :
                      isPostgres ? 'shared_buffers=32 GB (25% RAM), huge_pages=try' :
                      isMysql || isMariadb ? 'innodb_buffer_pool_size=64 GB, innodb_buffer_pool_instances=8' :
                      isMssql    ? 'Max server memory 96 GB (sp_configure + lock pages in memory)' :
                      '32 GB shared memory allocation',
      sort_buf:       isOracle   ? 'SORT_AREA_SIZE=65536 (auto PGA — pga_aggregate_target governs)' :
                      isPostgres ? 'work_mem=256 MB (per sort operation — watch multi-sort queries × connections)' :
                      isMysql || isMariadb ? 'sort_buffer_size=4 MB, read_rnd_buffer_size=4 MB' :
                      isMssql    ? 'N/A (SQL Server manages sort memory via Buffer Pool)' :
                      '256 MB sort buffer',
      temp_space:     isOracle   ? 'TEMP tablespace 200 GB (AUTOEXTEND ON MAXSIZE 500 GB — tempfile /data/temp01.dbf)' :
                      isPostgres ? 'temp_tablespaces=pg_temp (/data/pgsql-tmp, 64 GB partition)' :
                      isMysql || isMariadb ? 'tmpdir=/data/mysql-tmp (100 GB), tmp_table_size=256 MB, max_heap_table_size=256 MB' :
                      '200 GB temp space (auto-extend)',
      undo_ret:       isOracle   ? 'UNDO_RETENTION=900 s (15 min) — AUTOEXTEND UNDO tablespace 50 GB' :
                      isPostgres ? 'old_snapshot_threshold=-1 (disabled) — use pg_stat_activity to monitor long txns' :
                      isMysql || isMariadb ? 'innodb_undo_log_truncate=ON, innodb_purge_rseg_truncate_frequency=128' :
                      '900 s undo/MVCC retention',
      parallel_deg:   isOracle   ? 'PARALLEL_DEGREE_POLICY=AUTO, PARALLEL_MAX_SERVERS=32 (PARALLEL_MIN_SERVERS=4)' :
                      isPostgres ? 'max_parallel_workers_per_gather=4, max_parallel_workers=16, parallel_setup_cost=200' :
                      isMysql    ? 'innodb_parallel_read_threads=4 (8.0.14+)' :
                      'Parallel DOP: AUTO (4 min, 32 max)',
      optimizer:      isOracle   ? 'OPTIMIZER_MODE=ALL_ROWS (throughput), OPTIMIZER_FEATURES_ENABLE=19.1.0' :
                      isPostgres ? 'default_statistics_target=200, enable_partitionwise_join=on, enable_hashagg=on' :
                      isMysql || isMariadb ? "optimizer_switch='batched_key_access=on,mrr_cost_based=off'" :
                      isMssql    ? 'MAXDOP=8 (sp_configure), Cost Threshold for Parallelism=50' :
                      'Optimizer: AUTO / ALL_ROWS',
      charset:        isOracle   ? 'AL32UTF8 (NLS_CHARACTERSET — recommended for multilingual support)' :
                      isPostgres ? 'UTF8 (LC_COLLATE=en_US.UTF-8, LC_CTYPE=en_US.UTF-8)' :
                      isMysql || isMariadb ? 'utf8mb4 (character_set_server=utf8mb4 — full Unicode incl emoji)' :
                      isMssql    ? 'SQL_Latin1_General_CP1_CI_AS (or Latin1_General_100_CI_AS_SC_UTF8 for SQL 2019+)' :
                      'UTF-8 (AL32UTF8 / UTF8)',
      collation:      isOracle   ? 'BINARY (NLS_SORT — case-sensitive binary collation)' :
                      isPostgres ? 'en_US.UTF-8 (LC_COLLATE — use C for performance on equality-only queries)' :
                      isMysql || isMariadb ? 'utf8mb4_unicode_ci (collation_server)' :
                      isMssql    ? 'Latin1_General_100_CI_AS_SC_UTF8 (SQL Server 2019+ UTF-8 collation)' :
                      'UTF8_GENERAL_CI',
      replication:    isOracle   ? 'DataGuard async (LGWR ASYNC, MaxPerformance) — 1 physical standby, 1 snapshot standby' :
                      isPostgres ? 'Patroni streaming replication (primary + 2 standbys — WAL shipping to S3)' :
                      isMysql    ? 'GTID async replication (binlog_format=ROW, gtid_mode=ON, enforce_gtid_consistency=ON)' :
                      isMariadb  ? 'Galera Cluster (wsrep_provider) OR GTID async replication' :
                      isMssql    ? 'AlwaysOn AG — synchronous-commit same DC, async remote DR' :
                      'Async streaming replication (primary + 1 standby)',
      failover:       isOracle   ? 'DataGuard Fast-Start Failover (FSFO) — Observer node, 30 s threshold' :
                      isPostgres ? 'Patroni (etcd/ZooKeeper consensus) + HAProxy (read/write split) + keepalived VIP' :
                      isMysql    ? 'MHA (MySQL HA) or Group Replication + ProxySQL automatic failover' :
                      isMssql    ? 'AlwaysOn AG automatic failover (Windows Server Failover Clustering)' :
                      'Automatic failover via cluster agent (30 s RTO)',
      query_timeout:  isOracle   ? 'Resource Manager plan: CPU_PER_CALL=30 (seconds), IDLE_TIME=60' :
                      isPostgres ? 'statement_timeout=30000 (30 s), lock_timeout=10000 (per session or role)' :
                      isMysql || isMariadb ? 'max_execution_time=30000 (30 s), innodb_lock_wait_timeout=30' :
                      isMssql    ? 'SET QUERY_GOVERNOR_COST_LIMIT 30000 (estimated cost — not exact seconds)' :
                      '30 s query timeout',
      slow_query:     isOracle   ? 'SQL Monitor (DBMS_SQLTUNE) — threshold 5 s; AWR Top SQL report weekly' :
                      isPostgres ? 'log_min_duration_statement=1000 (1 s — pg_stat_statements enabled)' :
                      isMysql || isMariadb ? 'slow_query_log=ON, long_query_time=1, log_queries_not_using_indexes=ON' :
                      isMssql    ? 'Query Store (QUERY_STORE=ON) — capture queries > 1000 ms' :
                      '1000 ms slow query threshold',
      audit_db:       isOracle   ? 'Unified Auditing: CREATE USER, ALTER USER, GRANT, DROP TABLE, LOGON (mandatory policies)' :
                      isPostgres ? 'pgaudit extension (pgaudit.log=all_except_misc DDL + READ on sensitive tables)' :
                      isMysql || isMariadb ? 'audit_log plugin (audit_log_policy=ALL, audit_log_format=JSON)' :
                      isMssql    ? 'SQL Server Audit (CREATE DATABASE AUDIT SPECIFICATION — login + DML on sensitive objects)' :
                      'DDL auditing + privileged access auditing enabled',
      tde:            isOracle   ? 'Oracle TDE (ENCRYPTION ON — ASM encrypted disk groups + wallet auto-login)' :
                      isPostgres ? 'LUKS2 volume encryption + pgcrypto for column-level encryption of PII fields' :
                      isMysql || isMariadb ? 'InnoDB tablespace encryption (innodb_encrypt_tables=ON, keyring_file plugin)' :
                      isMssql    ? 'TDE (ALTER DATABASE ENCRYPTION ON — DMK + certificate stored in master DB)' :
                      'AES-256 encryption at rest (TDE or volume-level)',
      conn_pool:      isOracle   ? 'DRCP (Database Resident Connection Pooling) + UCP (Universal Connection Pool, min=10 max=100)' :
                      isPostgres ? 'PgBouncer 1.23 transaction-mode (pool_size=200, server_idle_timeout=600)' :
                      isMysql || isMariadb ? 'ProxySQL 2.6 (max_connections=2000, connection_pool_size=200, read-write split)' :
                      isMssql    ? 'SQL Server connection pooling (ADO.NET/JDBC — min=5, max=100 per app)' :
                      'Connection pooler (min=10, max=200 per database)',
      read_replicas:  '2 read replicas (async — reporting/analytics queries routed via read VIP on port +1)',
      partitioning:   isOracle   ? 'Range-Interval partitioning on date column + composite list-range for multi-tenant' :
                      isPostgres ? 'Declarative partitioning (RANGE by month — PARTITION BY RANGE(created_at))' :
                      isMysql || isMariadb ? 'RANGE COLUMNS(created_date) PARTITIONS 12 (monthly — auto-add via event)' :
                      isMssql    ? 'Partition function + partition scheme on date column (monthly sliding window)' :
                      'Range partitioning on date column (monthly)',
      index_strategy: isOracle   ? 'Auto-indexing (19c+) + nightly rebuild job for fragmented indexes (ALTER INDEX … REBUILD)' :
                      isPostgres ? 'pg_repack for bloat-free index rebuild + CONCURRENTLY for zero-downtime' :
                      isMysql || isMariadb ? 'OPTIMIZE TABLE monthly off-peak + pt-online-schema-change for large tables' :
                      isMssql    ? 'Ola Hallengren maintenance solution (rebuild > 30% frag, reorganize 10–30%)' :
                      'Weekly fragmentation check + rebuild indexes > 30% fragmentation',
      vacuum:         isOracle   ? 'Automatic undo management + segment shrink (DBMS_STATS.FLUSH_DATABASE_MONITORING_INFO)' :
                      isPostgres ? 'autovacuum: scale_factor=0.01, cost_delay=2, vacuum_cost_limit=400 (aggressive tuning)' :
                      isMysql || isMariadb ? 'innodb_purge_threads=4, innodb_purge_rseg_truncate_frequency=128, optimize monthly' :
                      isMssql    ? 'Auto shrink OFF — manual shrink only after large deletes (DBCC SHRINKFILE)' :
                      'Autovacuum / purge enabled with aggressive tuning for OLTP',
      db_links:       isOracle   ? 'DB Links to reporting DB only (LINK=REPORT_DB — encrypted TNS, TNS_ADMIN=/app/oracle/network/admin)' :
                      isPostgres ? 'postgres_fdw for ETL pipelines only — dblink disabled on prod' :
                      isMssql    ? 'Linked Servers to reporting instance only (sp_addlinkedserver — read-only login)' :
                      'Federated query to reporting DB only (read-only, encrypted connection)',
    },

    storage: {
      lun_size:         '2 TB data + 500 GB redo + 1 TB FRA + 200 GB temp',
      iops_req:         '20000 IOPS sustained (random 4 K — SAN tier), peak 50000 IOPS',
      replication_factor: 'RAID-10 (stripe + mirror — 2× read IOPS, 2× protection, 50% usable)',
      snapshot_policy:  'Hourly retain-24, daily retain-30, weekly retain-12, monthly retain-12',
      multipath_mode:   isAix ? 'AIX MPIO fail_over (PCM — hdiskX failover to partner path)' :
                        'DM-Multipath round-robin (Linux FC — path_grouping_policy=multibus, queue_depth=32)',
      nfs_mount:        'N/A (using SAN/iSCSI block storage — NFS only for archive/backup target)',
      san_fabric:       'FC 32 Gbps — Brocade G720 — 4 paths per LUN (dual fabric HA)',
      thin_prov:        'No — thick provisioned (guarantee IOPS, avoid thin for DB workloads)',
      raid_level:       'RAID-10 (striped mirrors — recommended for DB OLTP workloads)',
      notes:            '',
      block_size:       '4 KB (default — optimal for most DB I/O; 8 KB for SAP HANA in-memory)',
      cache_tier:       'NVMe SSD cache tier (Pure Storage DirectFlash / NetApp Flash Cache — auto-tiering ON)',
      dedup:            'Disabled for DB data volumes (OLTP random writes defeat dedup) / Enabled for backup volumes',
      compress_stor:    'Disabled for DB data volumes (latency impact) / Enabled for backup+archive (3:1 typical ratio)',
      tiering:          'Auto-tiering: hot data on NVMe, warm on SAS SSD, cold to NL-SAS / object storage (policy-driven)',
      qos_stor:         'DB LUN: max 50000 IOPS / 1000 MB/s | Backup: max 500 MB/s | App: best-effort',
      zoning:           'Single initiator-target zoning (FC): each HBA zoned to dedicated target port (best practice)',
      fc_ports:         '4 FC HBA ports (2 per fabric — dual fabric HA): 32 Gbps per port (total 128 Gbps raw BW)',
      iscsi_iqn:        'iqn.2024-01.com.corp:server-01 (iSCSI initiator IQN — unique per host, registered in array)',
      nfs_version:      'NFSv4.1 (pNFS support — /mnt/nfs_archive — sec=krb5p Kerberos encryption enabled)',
      smb_version:      'SMB 3.1.1 (Windows file sharing — SMB 1.0 globally disabled, SMB signing enforced)',
      obj_storage:      'AWS S3 (ap-southeast-2) / MinIO on-prem — backup offload target, S3 Intelligent-Tiering',
      quota:            'Soft quota 80% (alert ops-storage@corp.com), hard quota 90% (write-block)',
      recycle_bin:      '7-day recycle bin (NetApp ONTAP SnapRestore / Pure SafeMode) — accidental-delete protection',
      vg_name:          'vg_data (data LUNs), vg_redo (redo/WAL), vg_backup (backup) — separate VGs per purpose',
      lv_layout:        'lv_data (1.8 TB / 2 TB VG), lv_redo (480 GB / 500 GB VG) — 10% free for LVM snapshots',
      fs_type_stor:     'XFS (data volumes — 4 K block, inode64, noatime) / ext4 (OS root) / tmpfs (tmp: size=8 GB)',
      mount_point:      '/data (data LUN), /redo (redo LUN), /backup (backup LUN), /arch (archive NFS mount)',
      io_priority:      'DB: ionice -c 1 -n 0 (real-time RT) | Backup: ionice -c 3 (idle) | App: -c 2 -n 4 (BE)',
      stor_pool:        'POOL-TIER1-NVMe (DB workloads) / POOL-TIER2-SSD (app) / POOL-TIER3-NL-SAS (backup+archive)',
    },

    backup: {
      rpo_hours:      '1',
      rto_hours:      '4',
      full_day:       'Saturday 22:00 (estimated 3–6 h for 2 TB)',
      incr_freq:      'Daily 01:00 (Mon–Fri) + continuous log backup for PITR',
      retention_daily: '30',
      retention_weekly: '12',
      retention_monthly: '12',
      offsite_target: 'AWS S3 Glacier IR (ap-southeast-2 — 30-day lifecycle to Glacier Deep Archive)',
      encryption:     'AES-256-CBC (backup-level — RMAN encryption with wallet key / Veeam AES-256)',
      notes:          '',
      backup_tool:    'Oracle RMAN (DB) + Veeam B&R 12.1 (OS/app) — integrated in Veeam Orchestrator',
      catalog_srv:    'RMAN catalog DB: rman-catalog.corp.com:1521/RCATPRD (dedicated 19c catalog instance)',
      media_srv:      'Veeam Backup Server: veeam01.corp.com (16 vCPU, 64 GB RAM) + 2 proxy servers',
      storage_unit:   'Veeam Scale-Out Repository (backup02.corp.com) — 40 TB usable, dedup + compress enabled',
      parallel_str:   '4 parallel RMAN channels (DEVICE TYPE disk PARALLELISM 4) — matches DB vCPU count',
      bw_limit:       '500 MB/s max (backup window 22:00–04:00) / 100 MB/s (business hours throttle)',
      compress_bk:    'RMAN: ZLIB medium (2:1 ratio) / Veeam: LZ4 fast (1.5:1) — both layered with storage dedup',
      dedup_ratio:    '2:1 typical DB backup / 3:1 OS image — with storage-level dedup (effective 4–6:1 total)',
      test_restore:   'Monthly automated restore test (Veeam SureBackup — isolated sandbox VM) — verify < 30 min',
      restore_sla:    '4 hours (RTO for single DB restore — staged to test env, then re-snapshot for prod)',
      tape_lib:       'N/A (disk-to-disk-to-cloud — no tape in current design; review for 7-year regulatory archive)',
      cloud_tier:     'AWS S3 Glacier Instant Retrieval (ap-southeast-2) — Veeam capacity tier offload after 30 days',
      immutable:      'S3 Object Lock COMPLIANCE mode (30-day lock) — protects against ransomware/admin deletion',
      ransomware:     '3-2-1-1-0: 3 copies, 2 media types, 1 offsite, 1 immutable, 0 errors (SureBackup verified)',
      bk_window_dur:  '6 hours maximum (22:00–04:00) — PagerDuty alert if backup duration exceeds window',
      bk_priority:    'Priority 1: DB (RMAN full + incr) | Priority 2: App server | Priority 3: Config/OS image',
      notify_email:   'ops-backup@corp.com (success + failure) — PagerDuty P2 alert on 3 consecutive failures',
      pre_script:     '/opt/scripts/pre-backup.sh (quiesce app connections, flush DB buffer, log snapshot metadata)',
      post_script:    '/opt/scripts/post-backup.sh (verify catalog entry, cleanup expired jobs, update CMDB ticket)',
      synthetic_full: 'Enabled (Veeam synthetic full Sunday — avoids re-reading source data for weekly full creation)',
    },

    network: {
      bandwidth:      '25 Gbps uplink (2× 25G LACP bond) + 10 Gbps dedicated storage VLAN',
      vlan_ids:       'App VLAN 110 (10.10.110.0/24), DB VLAN 120 (10.10.120.0/24), Storage VLAN 200 (10.20.200.0/24)',
      mtu:            '9000 (jumbo frames — storage VLAN 200 iSCSI/NFS, enable on all hops)',
      bond_mode:      'LACP 802.3ad (bond0 — active/active, xmit_hash_policy=layer3+4, miimon=100)',
      fw_rules:       isOracle   ? 'App:8080 → DB:1521 ALLOW, Web:443 from 0/0, SSH:22 from Bastion-IP/32 only' :
                      isPostgres ? 'App:8080 → DB:5432 ALLOW, PgBouncer:6432 ALLOW, replication:5433 between replicas' :
                      'App:8080 → DB:3306 ALLOW, Web:443 from 0/0, SSH:22 from Bastion only',
      load_bal:       'F5 BIG-IP VIP: 10.10.110.100:443 (Active/Standby HA pair — iRule cookie persistence)',
      dns_ttl:        '300',
      ntp_source:     isAws ? '169.254.169.123 (AWS Time Sync)' : '10.0.0.1 (internal GPS stratum-1), pool.ntp.org',
      proxy_url:      'http://proxy.corp.com:3128 (Squid — bypass: *.internal, 10.0.0.0/8, 169.254.0.0/16)',
      notes:          '',
      ipv4_subnet:    'App: 10.10.110.0/24 (VLAN 110), DB: 10.10.120.0/24 (VLAN 120), Mgmt: 10.10.130.0/24 (VLAN 130)',
      ipv6_prefix:    'Disabled (IPv6 disabled at OS level — see unix.ipv6_mode) / 2001:db8::/32 if future requirement',
      default_gw:     '10.10.110.1 (App VLAN GW — HSRPv2 pair: core-sw-01 active, core-sw-02 standby)',
      vip_addr:       isOracle ? 'App VIP: 10.10.110.100:443 (F5), DB SCAN VIP: 10.10.120.10:1521 (Oracle RAC)' :
                      'App VIP: 10.10.110.100:443 (F5 BIG-IP), DB VIP: 10.10.120.10 (keepalived)',
      bgp_asn:        'AS65001 (internal iBGP — edge-to-core distribution) / static routes for single-DC deployments',
      ospf_area:      'Area 0 (backbone — OSPF within DC fabric) / static routes for inter-VLAN in smaller environments',
      qos_net:        'DSCP EF (46) for storage iSCSI/NFS, CS6 for DB/app, CS1 for backup — Cisco MQC policy-map',
      jumbo_vlan:     'VLAN 200 (storage iSCSI/NFS) MTU 9000 — must be enabled end-to-end on all switches/NICs',
      port_sec:       'Cisco port-security: max-mac-count 2, sticky MAC learning, violation shutdown — edge ports only',
      dhcp:           'Static IPs for all servers (DHCP only for mgmt OOB — iDRAC/iLO DHCP reservation by MAC)',
      nat_policy:     'No NAT server-to-server (RFC1918 routed internally) — NAT only at internet edge (PAT overload)',
      vpn_gw:         'IPsec VPN: 10.10.0.1 (Cisco ASA 5525-X — IKEv2, AES-256-GCM, site-to-site + remote access)',
      sd_wan:         'N/A (single DC — evaluate Cisco Catalyst SD-WAN or Meraki for multi-site expansion)',
      ddos:           'Arbor Networks SP (volumetric) + Cloudflare Magic Transit (ISP-level) + F5 AFM (app-layer)',
      net_monitor:    'SolarWinds NPM + PRTG (bandwidth/latency) + Cisco ThousandEyes (synthetic path monitoring)',
      snmp:           'SNMPv3 authPriv (SHA-256/AES-128): community read-only, trap target 10.10.130.10:162',
      netflow:        'NetFlow v9 (Cisco IOS-XE) / sFlow (Arista) → SolarWinds NTA collector: 10.10.130.11:2055',
      trunk_vlans:    'Trunk allowed: 110,120,130,200 — prune all other VLANs, native VLAN 999 (unused)',
      access_vlan:    '110 (app servers), 120 (DB servers), 130 (management), 200 (storage NICs — dedicated)',
      iface_speed:    '25 GbE (app + DB interconnect), 100 GbE (storage uplinks), 1 GbE (OOB iDRAC/iLO)',
    },

    security: {
      patch_sla:       '24 h (CVSS ≥ 9.0 Critical) / 72 h (CVSS ≥ 7.0 High) / 30 d (Medium) — PCI-DSS 6.3.3',
      scan_freq:       'Weekly automated (Qualys/Tenable) + triggered on every deployment (CI/CD pipeline gate)',
      mfa_required:    'Yes — CyberArk PAM for all privileged access (no direct root/admin login permitted)',
      siem_endpoint:   'Splunk HEC: https://splunk.corp.com:8088/services/collector (token-auth TLS)',
      vuln_score_max:  '7.0 (no CVSS ≥ 7.0 open at go-live — exception process via CAB for accepted risk)',
      cert_expiry_alert: '30 (alert at 30 d — auto-renew via certbot ACME at 60 d, Vault PKI for internal certs)',
      compliance_framework: 'CIS Level 2 Benchmark + ISO 27001:2022 (annual audit) + ASD Essential Eight',
      backup_encryption: 'AES-256 at rest + TLS 1.3 in transit (backup channels and replication)',
      access_review:   'Quarterly (SOC 2 Type II / ISO 27001 A.9.2.5 — Saviynt / SailPoint IGA)',
      notes:           '',
      pam:             'CyberArk PAM 14.x — all privileged accounts (root, oracle, svc_*) rotated after each use',
      secrets_mgr:     'HashiCorp Vault 1.17 (app secrets) / AWS Secrets Manager (cloud creds) — zero hardcoded secrets',
      key_mgmt:        'HashiCorp Vault Transit (app-layer encryption) / AWS KMS (cloud keys) / KMIP for TDE',
      hsm:             'Thales Luna HSM 7 (FIPS 140-2 Level 3) — HSM-backed keys for TDE, PKI root CA, code signing',
      ids_ips:         'Suricata IPS 7.x (inline mode, ET Pro ruleset) + Darktrace AI (anomaly/insider threat detection)',
      edr:             'CrowdStrike Falcon Insight XDR (all servers — agent v7.x) + MDR service for after-hours SOC',
      dlp:             'Symantec DLP 16.x (monitor DB queries > 500 rows + outbound file transfers > 10 MB — PII rules)',
      fw_type:         'Palo Alto PA-5450 NGFW (app-layer policy, threat prevention, URL filtering, SSL inspection)',
      pentest:         'Quarterly external pen test (CREST-certified firm) + annual red team / purple team exercise',
      sec_baseline:    'CIS Benchmark Level 2 (applied via Ansible hardening playbook — OpenSCAP scored quarterly)',
      hardening:       'STIG (ASD/DISA) + CIS Level 2 — automated via ansible-role-hardening (auto-remediate on detect)',
      log_ret_sec:     '12 months online (Splunk hot/warm tier) + 7 years cold archive (S3 Glacier — ISO 27001 / PCI DSS)',
      ir_playbook:     'IR Playbook v3.2 (Confluence /wiki/ir-playbook) — NIST CSF Tier 3 containment < 2 h target',
      change_ctrl:     'ServiceNow CAB workflow — standard: 5-business-day lead | emergency: 2 h E-CAB approval',
      data_class:      'RESTRICTED (PII/cardholder — AES-256 + access log) / CONFIDENTIAL (internal) / PUBLIC',
      enc_rest:        'AES-256-GCM (LUKS2 volume + TDE) + Vault Transit per-field encryption for PII columns',
      enc_transit:     'TLS 1.3 mandatory for all connections — mutual TLS (mTLS) for service-mesh east-west traffic',
      zero_trust:      'Zero Trust: verify identity (Okta + MFA) + device posture (CrowdStrike) + least-privilege RBAC',
      supply_chain:    'SBOM (CycloneDX) generated per release — Snyk + Dependabot for dependency CVE scanning in CI',
      sec_training:    'Annual KnowBe4 security awareness + OWASP Top 10 training for devs + quarterly phishing sim',
    },
  };
}
