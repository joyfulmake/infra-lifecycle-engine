/**
 * Rule-based 7-point FSM task metadata enrichment.
 * Returns supplementary metadata for any task record without modifying it.
 *
 * Schema:
 *   hwDimension   — physical resource layer touched
 *   preCondition  — enriched predecessor states (from task.dep + layer rules)
 *   execEngine    — canonical shell command / API call for this task type
 *   postValidation— hard telemetry metric that proves completion
 *   blastRadius   — adjacent stacks that drop if this task faults
 *   downstream    — next tasks unlocked by this state change
 *   fsmState      — current FSM state label: PENDING | IN_FLIGHT | VALIDATED | BLOCKED
 */

// ── Hardware dimension by role ────────────────────────────────────────────────
const ROLE_HW = {
  'StorageAdmin':     'Disk Block I/O — SAN/NVMe LUN allocation',
  'BackupAdmin':      'Disk Block I/O — Backup volume + tape bus',
  'Unix Admin':       'Volatile RAM + Disk I/O — kernel memory maps, mount table',
  'SysAdmin Lead':    'Multi-layer — CPU scheduling + RAM allocation oversight',
  'NetAdmin':         'Network Socket — NIC descriptor table, routing FIB',
  'NetAdmin + WebAdmin': 'Network Socket + CPU Thread — NIC + JVM thread pool',
  'DB Admin':         'Volatile RAM — SGA/Buffer Pool + redo log I/O',
  'DBA':              'Volatile RAM — SGA/Buffer Pool + redo log I/O',
  'DBA Lead':         'Volatile RAM — SGA/Buffer Pool + redo log I/O',
  'DBA + BackupAdmin':'Volatile RAM + Disk Block I/O — DB export + backup stream',
  'AppAdmin':         'CPU Thread Pool + Network Socket — JVM/runtime binding',
  'AppAdmin Lead':    'CPU Thread Pool + Network Socket — JVM/runtime binding',
  'WebAdmin':         'Network Socket + CPU — worker process + connection ceiling',
  'SecOps':           'CPU (audit daemon) + Disk I/O (audit log) + Network (TLS)',
  'QA Team':          'Network Socket — HTTP probe + latency boundary measurement',
  'Change Manager':   'Governance (non-hardware) — ITSM ticket + CAB record',
};

// ── Keyword → exec engine command ─────────────────────────────────────────────
const EXEC_PATTERNS = [
  // Storage
  [/zon|hba|san|fabric/i,       'storageadmin zoneshow; multipath -ll; cat /proc/scsi/scsi'],
  [/lun|disk alloc|pvdisplay/i, 'pvdisplay; lsblk -o NAME,SIZE,TYPE,MOUNTPOINT; multipath -ll'],
  [/multipath|path.*valid/i,    'multipath -ll; multipathd show paths; systemctl status multipathd'],
  [/filesystem|mount|fsck/i,    'mount | grep -v tmpfs; df -hT; fsck -nf /dev/mapper/data-lv'],
  // OS / kernel
  [/kernel|sysctl|shmmax|hugepage/i, 'sysctl -a | grep -E "shm|huge|vm\\."; ulimit -a; cat /proc/meminfo'],
  [/ulimit|fd.*limit|socket.*lim/i,  'ulimit -n; cat /proc/sys/fs/file-max; ss -s'],
  [/patch|yum|rpm|apt|dnf/i,         'yum check-update; rpm -qa --last | head -20; needs-restarting'],
  [/reboot|restart.*os|os.*restart/i,'systemctl list-units --failed; who -r; uptime'],
  [/ntp|time sync|chrony/i,          'chronyc tracking; timedatectl status; chronyc sources -v'],
  [/ssh|sudo|pam|selinux|auditd/i,   'auditctl -l; sestatus; grep -i "failed\|denied" /var/log/audit/audit.log | tail -20'],
  // Database — Oracle
  [/oracle.*sga|sga.*alloc|oracle.*mem/i, 'sqlplus / as sysdba <<EOF\nshow parameter sga;\nEOF'],
  [/oracle.*listen|lsnrctl/i,              'lsnrctl status; lsnrctl services | grep -i established'],
  [/oracle.*redo|archive.*log/i,           'sqlplus / as sysdba <<EOF\nselect * from v$log;\nEOF'],
  [/oracle.*export|data.*pump|expdp/i,     'expdp system/*** directory=DPUMP_DIR dumpfile=export.dmp logfile=export.log'],
  [/rman|backup.*db|db.*backup/i,          'rman target / <<EOF\nbackup database plus archivelog;\nEOF'],
  // Database — PostgreSQL
  [/postgres.*checkpoint|pg_ctl/i, 'psql -U postgres -c "CHECKPOINT;" && pg_ctl status -D $PGDATA'],
  [/postgres.*vacuum|analyze/i,    'psql -U postgres -c "VACUUM ANALYZE;" -c "SELECT schemaname,tablename,last_vacuum FROM pg_stat_user_tables ORDER BY last_vacuum NULLS FIRST LIMIT 20;"'],
  [/postgres.*replica|standby/i,   'psql -U postgres -c "SELECT * FROM pg_stat_replication;" && pg_basebackup --status-interval=10'],
  // Database — MongoDB
  [/mongo.*replica|rs\.init/i,     'mongosh --eval "rs.status(); rs.conf();"'],
  [/mongo.*shard|mongos/i,         'mongosh --eval "sh.status(); db.adminCommand({balancerStatus: 1})"'],
  // Database — DB2
  [/db2.*buffer|db2.*mem/i,        'db2 connect to SAMPLE; db2 get db cfg | grep -i buffer; db2 get dbm cfg | grep -i mem'],
  // App / Web
  [/tomcat|catalina|jvm.*heap/i,   'systemctl status tomcat; jstat -gcutil $(pgrep -f catalina) 1000 5; curl -s localhost:8080/healthz'],
  [/websphere|jvm.*websphere/i,    'wsadmin.sh -lang jython -c "AdminControl.invoke(server, \'getServerStatus\')"'],
  [/weblogic/i,                    'wlst.sh -c "connect(); serverRuntime().getState()"'],
  [/spring.*boot|jar.*java/i,      'java -jar app.jar --server.port=8080 & sleep 5 && curl -s localhost:8080/actuator/health'],
  [/nginx|apache.*httpd/i,         'nginx -t && systemctl reload nginx; apachectl -t && apachectl graceful'],
  [/thread.*pool|connection.*pool/i,'ss -tlnp | grep java; netstat -an | grep ESTABLISHED | wc -l'],
  // Network
  [/route|bgp|ospf|vlan/i,         'ip route show; ip -s link; ss -tlnp; traceroute -T -p 443 target_host'],
  [/dns|resolv|nslookup/i,         'dig +short hostname; nslookup hostname; resolvectl status'],
  [/firewall|iptables|nftables/i,  'iptables -L -n -v | grep -v "0     0"; nft list ruleset'],
  // Security / TLS
  [/ssl|tls|cert|openssl/i,        'openssl x509 -in cert.pem -noout -dates -subject; openssl s_client -connect host:443 -brief'],
  [/vuln|cve|scan|nessus/i,        'openscap-scanner --results-arf arf.xml --report report.html --profile stig ds.xml'],
  // Change management
  [/cab|change.*request|cr\b/i,    'servicenow-cli get-change --number CHG$(date +%Y%m%d); curl -s $SNOW_API/change_request'],
  [/kick.?off|handover|confirm.*scope/i, 'echo "RACI verification: $(date)" | tee -a handover.log'],
  [/smoke|integration.*test|health.*check/i, 'curl -sf https://app/health && pytest tests/smoke/ -v --tb=short'],
  [/rollback/i,                    'ansible-playbook rollback.yml --limit prod -e "target_version=$(cat .prev_version)"'],
];

function deriveExecEngine(task) {
  const text = `${task.name || ''} ${task.title || ''} ${task.dep || ''}`.toLowerCase();
  for (const [pat, cmd] of EXEC_PATTERNS) {
    if (pat.test(text)) return cmd;
  }
  // Role-based fallback
  const role = (task.role || task.team || '').toLowerCase();
  if (role.includes('storage'))      return 'multipath -ll; pvdisplay; lsblk';
  if (role.includes('unix'))         return 'systemctl --failed; df -hT; free -h';
  if (role.includes('dba') || role.includes('db admin')) return 'psql -U postgres -c "\\l"; sqlplus / as sysdba';
  if (role.includes('app'))          return 'jstat -gcutil $(pgrep java) 1000 3; curl -s localhost:8080/health';
  if (role.includes('net'))          return 'ip route show; ss -tlnp; ping -c3 gateway';
  if (role.includes('sec'))          return 'auditctl -l; sestatus; openssl verify cert.pem';
  if (role.includes('backup'))       return 'rman target / <<EOF\nlist backup summary;\nEOF';
  if (role.includes('change'))       return 'servicenow-cli get-change --latest; cat change_log.txt';
  return 'systemctl status <service>; journalctl -u <service> -n 50';
}

// ── Blast radius by role ───────────────────────────────────────────────────────
const ROLE_BLAST = {
  'StorageAdmin':  'OS loses block device → kernel I/O wait spike → DB crash (ORA-27072 / PANIC) → App timeout cascade',
  'BackupAdmin':   'Backup job fails → RPO breach → DR rehearsal blocked → compliance gap',
  'Unix Admin':    'Mount point unavailable → DB tablespace offline → App JDBC pool exhaustion → 503 responses',
  'SysAdmin Lead': 'Coordination failure → parallel tasks diverge → rollback confusion → extended outage window',
  'NetAdmin':      'Route table corrupted → App tier unreachable → DB listener timeouts → monitoring blind',
  'NetAdmin + WebAdmin': 'Web traffic black-holes → session loss → DB connection orphans → App restart required',
  'DB Admin':      'Listener down → App pool exhausted (HikariCP timeout) → 500 errors → cache cold on restart',
  'DBA':           'Listener down → App pool exhausted (HikariCP timeout) → 500 errors → cache cold on restart',
  'DBA Lead':      'Listener down → App pool exhausted (HikariCP timeout) → 500 errors → cache cold on restart',
  'DBA + BackupAdmin': 'Export fails → migration blocked → rollback to source required → extended downtime',
  'AppAdmin':      'JVM crash → active sessions lost → DB connection zombie pool → health check failure',
  'AppAdmin Lead': 'JVM crash → active sessions lost → DB connection zombie pool → health check failure',
  'WebAdmin':      'Worker threads saturated → requests queue → LB health probe fails → node pulled from rotation',
  'SecOps':        'Certificate expiry → HTTPS connections refused → all app tiers inaccessible → P1 incident',
  'QA Team':       'Smoke test fails → cutover blocked → rollback triggered → extended maintenance window',
  'Change Manager':'CAB not updated → undocumented change → audit trail gap → compliance finding',
};

// ── Downstream successors by layer keywords ───────────────────────────────────
const DOWNSTREAM_MAP = [
  [/storage.*zon|hba|san.*pres/i,  'OS kernel detects new SCSI target → Unix Admin mounts filesystem'],
  [/lun|disk.*alloc|multipath/i,   'Unix Admin creates filesystem (mkfs) and mounts → DB Admin allocates tablespace'],
  [/mount|filesystem.*creat/i,     'DB Admin creates tablespace / data files → App pool configuration'],
  [/sga|buffer.*pool|db.*mem/i,    'DB listener opens port → App Admin configures JDBC connection pool'],
  [/listen|port.*open|db.*start/i, 'App Admin binds thread pool → QA runs smoke integration test'],
  [/thread.*pool|jvm.*start|app.*start/i, 'WebAdmin validates worker count → QA smoke test → Load balancer health probe'],
  [/smoke|health.*check|integration/i,    'Change Manager marks change complete → post-impl review scheduled'],
  [/rollback/i,                           'SysAdmin Lead confirms rollback complete → CAB post-incident review'],
  [/patch|yum|rpm|apt/i,                  'Unix Admin validates kernel version → DB Admin validates DB binary compat'],
  [/reboot|restart/i,                     'Unix Admin confirms services up → DB Admin validates listener → App Admin checks pool'],
  [/cert|ssl|tls/i,                       'WebAdmin validates HTTPS handshake → QA runs TLS smoke test'],
  [/backup|rman|expdp/i,                  'BackupAdmin confirms backup catalog → DR drill can be scheduled'],
  [/route|vlan|firewall/i,                'NetAdmin confirms connectivity → App Admin validates DB reachability'],
  [/cab|change.*appro/i,                  'SysAdmin Lead distributes change window details → all team leads on standby'],
];

function deriveDownstream(task) {
  const text = `${task.name || ''} ${task.validate || ''} ${task.dep || ''}`;
  for (const [pat, next] of DOWNSTREAM_MAP) {
    if (pat.test(text)) return next;
  }
  const role = (task.role || task.team || '').toLowerCase();
  if (role.includes('storage'))   return 'Unix Admin mounts volume → DB Admin creates data files';
  if (role.includes('unix'))      return 'DB Admin validates shared memory → App Admin validates connectivity';
  if (role.includes('db') || role.includes('dba')) return 'App Admin configures JDBC pool → QA smoke test';
  if (role.includes('app'))       return 'QA Team runs integration test → Change Manager closes change record';
  if (role.includes('net'))       return 'App Admin validates DB reachability → WebAdmin validates ingress routes';
  if (role.includes('change'))    return 'All team leads alerted → change window execution begins';
  return 'Next sequential task in the dependency chain';
}

// ── Main export ───────────────────────────────────────────────────────────────

export function enrichTask(task, ctx = {}) {
  const role = task.role || task.team || '';
  const name = task.name || task.title || '';
  const dep  = task.dep || (task.depends_on || []).join(', ') || '';
  const validate = task.validate || '';

  return {
    hwDimension:    ROLE_HW[role] || 'Multi-layer — review role assignment',
    preCondition:   dep || 'No predecessor defined — verify dependency chain',
    execEngine:     deriveExecEngine(task),
    postValidation: validate || 'Peer review confirmation + ticket closure',
    blastRadius:    ROLE_BLAST[role] || 'Downstream services may timeout — verify dependency map',
    downstream:     deriveDownstream(task),
    fsmState:       'PENDING',
    // Context-aware overlays
    stackContext: [ctx.hw, ctx.os, ctx.db, ctx.app].filter(Boolean).join(' / ') || 'Stack not specified',
  };
}

// FSM state labels for display
export const FSM_STATE_STYLE = {
  PENDING:    { label: 'PENDING',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  IN_FLIGHT:  { label: 'IN FLIGHT',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  VALIDATED:  { label: 'VALIDATED',  cls: 'bg-green-50 text-green-700 border-green-200' },
  BLOCKED:    { label: 'BLOCKED',    cls: 'bg-red-50 text-red-700 border-red-200' },
};

// Hardware dimension → icon map for the Matrix tab (used later)
export const HW_DIM_ICON = {
  'cpu':     '⚙',
  'ram':     '▦',
  'disk':    '◫',
  'network': '⇄',
  'multi':   '◈',
  'gov':     '✦',
};
