export function buildDesignTasks(sysDesignData) {
  const d = sysDesignData;
  const tasks = [];
  const push = (team, title, dur, dep, note) =>
    tasks.push({ team, title, dur: dur || 1, dep: dep || 'Start', note: note || '' });

  if (d.network && d.network.vlan_ids)
    push('NetAdmin', 'Configure VLANs and IP allocation: ' + d.network.vlan_ids.substring(0,45), 2, 'Network design approved', 'MTU: ' + (d.network.mtu || '1500'));
  if (d.network && d.network.fw_rules)
    push('NetAdmin', 'Implement firewall rules: ' + (d.network.fw_rules || '').substring(0,45), 1, 'VLAN config done', '');
  if (d.network && d.network.load_bal)
    push('NetAdmin + WebAdmin', 'Configure load balancer / VIP: ' + (d.network.load_bal || '').substring(0,40), 1, 'FW rules applied', '');

  if (d.storage && d.storage.lun_size)
    push('StorageAdmin', 'Provision LUNs: ' + (d.storage.lun_size || '').substring(0,40) + ' IOPS: ' + (d.storage.iops_req || 'TBD'), 2, 'Storage design approved', 'RAID: ' + (d.storage.raid_level || 'TBD'));
  if (d.storage && d.storage.multipath_mode)
    push('StorageAdmin', 'Configure multipath: ' + (d.storage.multipath_mode || '').substring(0,40), 1, 'LUNs provisioned', '');
  if (d.storage && d.storage.snapshot_policy)
    push('StorageAdmin', 'Snapshot policy: ' + (d.storage.snapshot_policy || '').substring(0,40), 1, 'Multipath verified', '');

  if (d.backup && d.backup.rpo_hours)
    push('BackupAdmin', 'Configure backup SLA: RPO ' + (d.backup.rpo_hours || '1') + 'h / RTO ' + (d.backup.rto_hours || '4') + 'h', 1, 'Storage ready', 'Encrypt: ' + (d.backup.encryption || 'TBD'));
  if (d.backup && d.backup.full_day)
    push('BackupAdmin', 'Schedule full backup: ' + (d.backup.full_day || '').substring(0,40) + ', incr: ' + (d.backup.incr_freq || 'daily'), 1, 'Backup SLA confirmed', '');

  if (d.unix && d.unix.patch_window)
    push('Unix Admin', 'OS patch window: ' + (d.unix.patch_window || '').substring(0,45), 2, 'Backup verified', 'CPU: ' + (d.unix.cpu || 'TBD') + ', RAM: ' + (d.unix.ram || 'TBD'));
  if (d.unix && d.unix.kernel_params)
    push('Unix Admin', 'Apply kernel tuning: ' + (d.unix.kernel_params || '').substring(0,45), 1, 'OS patched', '');
  if (d.unix && d.unix.monitoring_agent)
    push('Unix Admin', 'Deploy monitoring agent: ' + (d.unix.monitoring_agent || '').substring(0,40), 1, 'OS baseline done', '');

  if (d.db && d.db.buf_pool)
    push('DBA', 'Configure DB buffer pool: ' + (d.db.buf_pool || '').substring(0,40) + ' max-conn: ' + (d.db.max_conn || 'TBD'), 1, 'DB binaries installed', 'Listener: ' + (d.db.listener_port || ':1521'));
  if (d.db && d.db.redo_size)
    push('DBA', 'Tune redo/WAL logs: ' + (d.db.redo_size || '').substring(0,40) + ' archive: ' + (d.db.archive_dest || 'TBD'), 1, 'Buffer pool set', '');
  if (d.db && d.db.backup_window)
    push('DBA + BackupAdmin', 'DB backup window: ' + (d.db.backup_window || '').substring(0,40) + ' standby lag: ' + (d.db.standby_lag || 'TBD'), 1, 'DB config complete', '');

  if (d.web && d.web.worker_proc)
    push('WebAdmin', 'Web server tuning: ' + (d.web.worker_proc || '').substring(0,40) + ' keepalive: ' + (d.web.keepalive || '65') + 's', 1, 'App runtime deployed', 'Max conn: ' + (d.web.max_conn || 'TBD'));
  if (d.web && d.web.ssl_cert_expiry)
    push('WebAdmin', 'SSL cert renewal check -- expiry: ' + (d.web.ssl_cert_expiry || ''), 0.5, 'Web server running', '');
  if (d.web && d.web.health_check_url)
    push('WebAdmin', 'Health check endpoint verify: ' + (d.web.health_check_url || ''), 0.5, 'Web server config done', '');

  if (d.app && d.app.jvm_xmx)
    push('AppAdmin', 'JVM sizing: Xms' + (d.app.jvm_xms || '2g') + ' Xmx' + (d.app.jvm_xmx || '8g') + ' GC: ' + (d.app.gc_policy || 'G1GC'), 1, 'App server installed', 'Heap: ' + (d.app.heap_ratio || '70') + '%');
  if (d.app && d.app.thread_pool)
    push('AppAdmin', 'Thread pool tuning: ' + (d.app.thread_pool || '200') + ' threads, DS pool: ' + (d.app.datasource_pool || '100'), 1, 'JVM configured', '');
  if (d.app && d.app.deploy_method)
    push('AppAdmin', 'Application deploy: ' + (d.app.deploy_method || '').substring(0,40) + ' port: ' + (d.app.app_port || '8080'), 2, 'App tuning done', 'Log: ' + (d.app.log_level || 'INFO'));

  if (d.security && d.security.compliance_framework)
    push('SecOps', 'Compliance baseline: ' + (d.security.compliance_framework || '').substring(0,40), 2, 'All systems deployed', 'Scan: ' + (d.security.scan_freq || 'weekly'));
  if (d.security && d.security.patch_sla)
    push('SecOps', 'Patch SLA policy: ' + (d.security.patch_sla || '').substring(0,40), 1, 'Compliance baseline', '');
  if (d.security && d.security.mfa_required)
    push('SecOps', 'MFA and SIEM: ' + (d.security.mfa_required || '').substring(0,30) + ' SIEM: ' + (d.security.siem_endpoint || 'TBD').substring(0,25), 1, 'Patch SLA active', '');

  return tasks;
}
