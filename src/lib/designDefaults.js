export function getDefaultDesignValues(ctx) {
  const hw  = (ctx.hw  || '').toLowerCase();
  const os  = (ctx.os  || '').toLowerCase();
  const db  = (ctx.db  || '').toLowerCase();
  const app = (ctx.app || '').toLowerCase();

  const cpuDefault =
    hw.includes('power7') || hw.includes('power8') ? '16 LPAR threads (POWER7/8 dedicated)' :
    hw.includes('power9')  ? '32 LPAR threads (POWER9 SMT-4)' :
    hw.includes('power10') || hw.includes('power11') ? '48 LPAR threads (POWER10 SMT-8)' :
    hw.includes('graviton') ? '32 vCPUs (Graviton4 Arm64 EC2)' :
    hw.includes('cobalt')  ? '96 vCPUs (Azure Cobalt 100)' :
    hw.includes('axion')   ? '72 vCPUs (GCP Axion Arm)' :
    hw.includes('epyc')    ? '64 cores (AMD EPYC Turin, 2-socket)' :
    hw.includes('xeon')    ? '48 cores (Intel Xeon SP 4th Gen, 2-socket)' :
    hw.includes('z16')     ? '20 CPs + 4 zIIPs (IBM z16 LPAR)' :
    hw.includes('dgx')     ? '128 vCPUs (NVIDIA DGX H100 host)' :
    hw.includes('exadata') ? '48 cores (Oracle Exadata X10M DB node)' :
    '32 vCPUs (x86_64)';

  const ramDefault =
    hw.includes('power7') || hw.includes('power8') ? '256GB (POWER7/8 LPAR allocation)' :
    hw.includes('power9')  ? '512GB (POWER9 LPAR)' :
    hw.includes('power10') || hw.includes('power11') ? '1TB (POWER10 LPAR)' :
    hw.includes('graviton') ? '128GB (r7g.4xlarge)' :
    hw.includes('z16')     ? '512GB (z16 LPAR)' :
    hw.includes('dgx')     ? '2TB (DGX H100)' :
    hw.includes('exadata') ? '768GB (Exadata X10M)' :
    '128GB ECC DDR5';

  const swapDefault =
    os.includes('aix') ? '64GB page space (hd6 -- AIX 2x RAM rule)' :
    os.includes('windows') ? 'Managed by Windows -- pagefile.sys auto' :
    '16GB swap partition (sda3)';

  const kernelDefault =
    os.includes('aix') ? 'ioo: maxpgahead=64, vmo: minfree=960 maxfree=1088, no: tcp_recvspace=65536' :
    os.includes('rhel') || os.includes('alma') || os.includes('rocky') ? 'vm.swappiness=10, net.core.somaxconn=65535, kernel.pid_max=4194304, fs.file-max=2097152' :
    os.includes('ubuntu') || os.includes('debian') ? 'vm.swappiness=10, net.ipv4.tcp_keepalive_time=600, fs.inotify.max_user_watches=524288' :
    os.includes('suse') || os.includes('sles') ? 'vm.swappiness=10, net.core.netdev_max_backlog=10000, kernel.shmmax=68719476736' :
    os.includes('solaris') ? 'ndd /dev/tcp tcp_recv_hiwater_mark=65536, project.max-sem-ids=512' :
    os.includes('windows') ? 'N/A -- managed via Group Policy and registry' :
    'vm.swappiness=10, net.core.somaxconn=65535, fs.file-max=2097152';

  const bufPool =
    db.includes('oracle')   ? '32GB SGA (SGA_TARGET=32G, SGA_MAX_SIZE=36G, PGA_AGGREGATE_TARGET=8G)' :
    db.includes('postgres')  ? 'shared_buffers=32GB (25% of RAM), effective_cache_size=96GB, work_mem=256MB' :
    db.includes('mysql') || db.includes('mariadb') ? 'innodb_buffer_pool_size=64GB (50% of 128GB RAM)' :
    db.includes('sql server') ? 'Max server memory: 96GB (leaving 32GB for OS -- sp_configure)' :
    db.includes('hana')     ? 'Managed by HANA Memory Manager -- global_allocation_limit=110GB' :
    db.includes('db2')      ? 'BUFFERPOOL BP32K size 524288 (32K pages = 16GB, auto-resize ON)' :
    db.includes('mongodb')  ? 'WiredTiger cache: 64GB (wiredTigerCacheSizeGB: 64 in mongod.conf)' :
    '32GB buffer pool (25% of total RAM)';

  const dbMaxConn =
    db.includes('oracle')   ? '500 sessions (processes=500, sessions=555, transactions=610)' :
    db.includes('postgres')  ? 'max_connections=400 (+ PgBouncer pool_size=200 per DB)' :
    db.includes('mysql') || db.includes('mariadb') ? 'max_connections=500 (thread_cache_size=100)' :
    db.includes('sql server') ? '0 (unlimited -- governed by max_worker_threads=1024)' :
    db.includes('mongodb')  ? 'net.maxIncomingConnections: 2000 (mongod.conf)' :
    '500 maximum connections';

  const redoSize =
    db.includes('oracle')   ? '512MB per member, 4 groups (ALTER DATABASE ADD LOGFILE GROUP)' :
    db.includes('postgres')  ? 'wal_segment_size=256MB, min_wal_size=2GB, max_wal_size=8GB, checkpoint_completion_target=0.9' :
    db.includes('mysql') || db.includes('mariadb') ? 'innodb_log_file_size=2GB, innodb_log_files_in_group=2 (4GB total redo)' :
    db.includes('sql server') ? 'VLF auto-managed -- set DB recovery model to FULL, backup log every 15min' :
    db.includes('db2')      ? 'LOGFILSIZ=65536 (256MB), LOGPRIMARY=12, LOGSECOND=50' :
    '512MB per log segment, retain 7 days';

  const listenerPort =
    db.includes('oracle')   ? '1521 (TNS Listener -- SCAN VIP for RAC: scan-vip:1521/svc_name)' :
    db.includes('postgres')  ? '5432 (PostgreSQL) + 6432 (PgBouncer transaction pool)' :
    db.includes('mysql')    ? '3306 (MySQL) + 6033 (ProxySQL read-write split)' :
    db.includes('mariadb')  ? '3306 (MariaDB) + 4567 (Galera replication port)' :
    db.includes('sql server') ? '1433 (SQL Server default)' :
    db.includes('db2')      ? '50000 (Db2 -- SVCENAME=db2c_db2inst1)' :
    db.includes('hana')     ? '30015 (SAP HANA MDC System DB tenant)' :
    db.includes('mongodb')  ? '27017 (MongoDB) + 27018 (mongos router)' :
    '5432';

  const jvmXmx =
    app.includes('websphere') ? '8g (-Xmx8g WebSphere JVM custom property)' :
    app.includes('weblogic') ? '8g (-Xmx8g -XX:+UseG1GC WebLogic managed server)' :
    app.includes('jboss') || app.includes('wildfly') ? '6g (-Xmx6g WildFly standalone.conf)' :
    '8g (-Xmx8g -- 70% of available instance memory)';

  const gcPolicy =
    app.includes('websphere') || app.includes('weblogic') ? 'G1GC (-XX:+UseG1GC -XX:MaxGCPauseMillis=200)' :
    os.includes('z/os') || hw.includes('z16') ? 'gencon (IBM J9 -- default for zOS)' :
    'G1GC (-XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:G1HeapRegionSize=16m)';

  const deployMethod =
    app.includes('websphere') ? 'wsadmin.sh AdminApp.install (Enterprise Archive .ear deployment)' :
    app.includes('weblogic')  ? 'WLST / weblogic.Deployer (WAR/EAR -- AdminServer target)' :
    app.includes('jboss') || app.includes('wildfly') ? 'jboss-cli.sh deploy app.war (WildFly managed domain)' :
    app.includes('tomcat')    ? 'Tomcat Manager API PUT /manager/text/deploy?path=/ (WAR)' :
    app.includes('spring') || app.includes('java') ? 'Ansible role: copy JAR + systemd restart (Blue-Green via LB)' :
    app.includes('node')      ? 'PM2 deploy ecosystem.config.js --env production' :
    'Ansible playbook: artifact deploy + rolling restart via LB drain';

  const healthUrl =
    app.includes('spring') || app.includes('java') ? '/actuator/health (Spring Boot Actuator -- returns {"status":"UP"})' :
    app.includes('node') ? '/health (Express middleware -- returns 200 OK {"status":"ok"})' :
    app.includes('python') || app.includes('django') ? '/health/ (Django health check -- returns 200 OK)' :
    app.includes('websphere') ? '/wps/PA_WPS_OOBE_DEMO_PORT/health' :
    app.includes('weblogic') ? '/weblogic/ready (WebLogic health check endpoint)' :
    '/health (returns HTTP 200 with {"status":"UP","uptime":"..."})';

  const workerProc =
    app.includes('nginx') ? '8 worker_processes (auto -- 2x vCPU), 2048 worker_connections each' :
    app.includes('apache') || app.includes('httpd') ? 'mpm_event: MaxRequestWorkers=400, ThreadsPerChild=25' :
    app.includes('iis') ? 'IIS 10 -- DefaultAppPool: maxProcesses=0 (auto), queue=1000' :
    '8 workers (auto), max_connections=10000';

  const monAgent =
    hw.includes('aws') || hw.includes('graviton') ? 'CloudWatch Agent 1.300085 + Datadog 7.x' :
    hw.includes('azure') || hw.includes('cobalt')  ? 'Azure Monitor Agent + Datadog 7.x' :
    hw.includes('gcp')  || hw.includes('axion')    ? 'Google Cloud Ops Agent + Prometheus node-exporter 1.7.x' :
    'Datadog Agent 7.x + Prometheus node-exporter 1.7.x';

  const sslExpiry = (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0,10) + ' (renew 30 days before -- auto via certbot/ACME)';
  })();

  return {
    unix: {
      cpu: cpuDefault, ram: ramDefault, swap: swapDefault, kernel_params: kernelDefault,
      patch_window: os.includes('aix') ? 'Saturday 02:00-06:00 AEST (AIX TL/SP bundle -- 4h window)' :
        os.includes('windows') ? 'Sunday 01:00-05:00 (WSUS / SCCM patching -- reboot required)' :
        'Sunday 02:00-06:00 (yum/apt -- 4h window, no reboot for minor patches)',
      ntp_server: hw.includes('aws') ? '169.254.169.123 (AWS Time Sync -- chrony, iburst prefer)' : '10.0.0.1 (internal GPS stratum-1), 1.pool.ntp.org (external fallback)',
      dns_server: hw.includes('aws') ? '169.254.169.253 (AWS VPC DNS resolver -- Route53 Resolver)' : '10.0.0.2 (primary corp DNS), 10.0.0.3 (secondary)',
      timezone: 'Australia/Sydney (AEST/AEDT -- UTC+10/+11)',
      monitoring_agent: monAgent,
      notes: '',
    },
    web: {
      worker_proc: workerProc, keepalive: '65', max_conn: '10000',
      ssl_cert_expiry: sslExpiry, log_retention: '90 days (compressed after 7 days)',
      reverse_proxy: 'http://127.0.0.1:8080 (local app server -- proxy_pass)',
      load_bal_algo: app.includes('nginx') ? 'least_conn (NGINX upstream -- sticky sessions via ip_hash fallback)' : 'round-robin (HAProxy / F5 -- persist via cookie SERVERID)',
      session_timeout: '3600',
      health_check_url: healthUrl,
      notes: '',
    },
    app: {
      jvm_xmx: jvmXmx, jvm_xms: '2g (-Xms2g)', thread_pool: '200',
      datasource_pool: '100 (HikariCP maxPoolSize)',
      deploy_method: deployMethod, app_port: '8080',
      heap_ratio: '70', gc_policy: gcPolicy, log_level: 'INFO',
      notes: '',
    },
    db: {
      buf_pool: bufPool, max_conn: dbMaxConn, redo_size: redoSize,
      archive_dest: db.includes('oracle') ? '+FRA (ASM Fast Recovery Area, 500GB)' :
        db.includes('postgres') ? "archive_command='rsync -az %p /mnt/pgarchive/%f'" :
        '/arch01 (NFS -- 1TB allocated, alert at 80%)',
      backup_window: 'Saturday 22:00 full backup (estimated 3-6h window)',
      standby_lag: db.includes('oracle') ? '< 30s (DataGuard async -- LOG_ARCHIVE_DEST_2 ASYNC)' :
        db.includes('postgres') ? '< 5s (Patroni streaming replication)' :
        '< 30s (async replication target)',
      stats_window: 'Sunday 04:00 -- automated statistics gather job',
      tablespace_pct: '80',
      listener_port: listenerPort,
      notes: '',
    },
    storage: {
      lun_size: '2TB data + 500GB redo + 1TB FRA + 200GB temp',
      iops_req: '20000 IOPS sustained (random 4K -- SAN tier)',
      replication_factor: 'RAID-10 (stripe + mirror -- 2x read IOPS, 2x protection)',
      snapshot_policy: 'Hourly retain-24, daily retain-30, weekly retain-12',
      multipath_mode: os.includes('aix') ? 'AIX MPIO fail_over (PCM -- hdiskX failover)' : 'DM-Multipath round-robin (Linux FC -- path_grouping_policy=multibus)',
      nfs_mount: 'N/A (using SAN/iSCSI block storage)',
      san_fabric: 'FC 32Gbps -- Brocade G720 -- 4 paths per LUN',
      thin_prov: 'No -- thick provisioned (guarantee IOPS, avoid thin for DB)',
      raid_level: 'RAID-10 (striped mirrors -- recommended for DB OLTP workloads)',
      notes: '',
    },
    backup: {
      rpo_hours: '1', rto_hours: '4',
      full_day: 'Saturday 22:00 (estimated 3-6h for 2TB)',
      incr_freq: 'Daily 01:00 (Mon-Fri) + continuous log backup for PITR',
      retention_daily: '30',
      retention_weekly: '12',
      retention_monthly: '12',
      offsite_target: 'AWS S3 Glacier IR (ap-southeast-2 -- 30-day lifecycle to Glacier)',
      encryption: 'AES-256-CBC (backup-level -- RMAN encryption with wallet key)',
      notes: '',
    },
    network: {
      bandwidth: '25Gbps uplink (2x 25G LACP bond) + 10Gbps dedicated storage VLAN',
      vlan_ids: 'App VLAN 110 (10.10.110.0/24), DB VLAN 120 (10.10.120.0/24), Storage VLAN 200 (10.20.200.0/24)',
      mtu: '9000 (jumbo frames -- storage VLAN 200 iSCSI/NFS, enable on all hops)',
      bond_mode: 'LACP 802.3ad (bond0 -- active/active, xmit_hash_policy=layer3+4, miimon=100)',
      fw_rules: db.includes('oracle') ? 'App:8080 -> DB:1521 ALLOW, Web:443 from 0/0, SSH:22 from Bastion-IP/32 only' :
        db.includes('postgres') ? 'App:8080 -> DB:5432 ALLOW, PgBouncer:6432 ALLOW, replication:5433 between replicas' :
        'App:8080 -> DB:3306 ALLOW, Web:443 from 0/0, SSH:22 from Bastion only',
      load_bal: 'F5 BIG-IP VIP: 10.10.110.100:443 (Active/Standby pair -- iRule persistence)',
      dns_ttl: '300',
      ntp_source: hw.includes('aws') ? '169.254.169.123 (AWS Time Sync)' : '10.0.0.1 (internal GPS stratum-1), pool.ntp.org',
      proxy_url: 'http://proxy.corp.com:3128 (Squid -- bypass: *.internal,10.0.0.0/8)',
      notes: '',
    },
    security: {
      patch_sla: '24h (CVSS >= 9.0 Critical) / 72h (CVSS >= 7.0 High) / 30d (Medium)',
      scan_freq: 'Weekly automated (Qualys/Tenable) + triggered on every change',
      mfa_required: 'Yes -- CyberArk PAM for all privileged access (no direct root/admin login)',
      siem_endpoint: 'Splunk HEC: https://splunk.corp.com:8088/services/collector (token-auth)',
      vuln_score_max: '7.0 (no CVSS >= 7.0 open at go-live)',
      cert_expiry_alert: '30 (alert at 30d -- auto-renew via certbot ACME at 60d)',
      compliance_framework: 'CIS Level 2 Benchmark + ISO 27001:2022 (annual audit)',
      backup_encryption: 'AES-256 at rest + TLS 1.3 in transit',
      access_review: 'Quarterly (SOC 2 Type II / ISO 27001 standard)',
      notes: '',
    },
  };
}
