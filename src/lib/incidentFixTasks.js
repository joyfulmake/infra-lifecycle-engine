export function getIncidentFixTasks(inc, ctx) {
  const layers = inc.layers || [];
  const tasks = [];
  const T2 = (role, name, dep, validate) => tasks.push({ role, name, dep: dep || '', validate: validate || '' });

  const isDB  = layers.includes('db');
  const isOS  = layers.includes('os');
  const isHW  = layers.includes('hardware');
  const isSTG = layers.includes('storage');
  const isAPP = layers.includes('app');
  const isNET = layers.includes('network');
  const isWEB = layers.includes('web');

  T2('Change Manager',
    'Open P1/P2 bridge -- assign incident owner, scribe, and comms lead',
    'Incident detected by monitoring or user report',
    'Bridge open; roles assigned; stakeholder comms started; ticket raised in ITSM');
  T2('SysAdmin Lead',
    'Confirm incident scope -- identify affected layers, services, and users',
    'P1 bridge open; initial monitoring alert details available',
    'Scope confirmed; affected system list issued; severity validated against SLA');

  if (isHW) {
    T2('SysAdmin Lead',
      'Check hardware console (iDRAC/iLO/ASMI) -- capture error codes and POST logs',
      'Scope confirmed as hardware layer; console access confirmed',
      'Error codes documented; hardware event log captured; vendor case opened if needed');
    T2('Unix Admin',
      'Failover to redundant path -- LPAR migrate or HA cluster failover if available',
      'SysAdmin Lead confirms fault isolated to specific HW component',
      'Failover complete; service restored to secondary; primary isolated for repair');
    T2('SysAdmin Lead',
      'Engage hardware vendor -- provide error codes and request emergency field dispatch',
      'Error codes documented; no local fix possible',
      'Vendor case open; ETA for part or field engineer confirmed; escalation path documented');
  }

  if (isSTG) {
    T2('Storage Admin',
      'Check multipath -- identify failed paths: multipathd show paths; array event log',
      'Scope confirmed as storage layer; system accessible',
      'Failed path identified; array event log captured; Storage Admin signs off scope to Unix Admin');
    T2('Storage Admin',
      'Isolate fault -- failed HBA, switch port, or array port',
      'Failed path identified from multipath output and array event log',
      'Fault isolated; redundant path active; I/O restored through surviving path');
    T2('Unix Admin',
      'Verify filesystem integrity -- fsck if corruption suspected; remount read-write',
      'Storage Admin confirms I/O path restored through redundant path',
      'Filesystems clean; remounted read-write; application I/O confirmed working');
  }

  if (isNET) {
    T2('NetAdmin',
      'Check interface stats -- ip -s link, ethtool for errors, CRC counts, drops',
      'Scope confirmed as network layer; system accessible from management VLAN',
      'Error stats captured; affected interface and switch port identified');
    T2('NetAdmin',
      'Verify routing -- ip route, traceroute to app and DB tiers',
      'Interface stats captured; routing table available',
      'Routing confirmed or routing issue identified; next hop verified');
    T2('NetAdmin',
      'Check LB pool member health -- verify health check status in F5 / HAProxy / ALB',
      'Routing confirmed; LB access available',
      'LB pool member status documented; failed members re-enabled or root cause identified');
    T2('NetAdmin',
      'Apply network fix -- restore interface, update route, re-enable LB pool member',
      'Root cause identified; rollback understood',
      'Connectivity restored; ping and traceroute clean from all affected tiers');
  }

  if (isOS) {
    T2('Unix Admin',
      'Check system logs -- journalctl -xe, /var/log/messages, dmesg -- identify OOM / panic / error',
      'Scope confirmed as OS layer; SSH or console access available',
      'Root cause identified from logs; evidence captured and attached to incident ticket');
    T2('Unix Admin',
      'Check resource utilisation -- top, vmstat, iostat, sar -- identify bottleneck',
      'Log review complete; no obvious crash but degraded performance',
      'Bottleneck identified (CPU/memory/I/O); evidence documented for RCA');
    T2('Unix Admin',
      'Apply OS-level fix -- kernel param adjustment, service restart, filesystem repair',
      'Root cause confirmed from logs and resource analysis',
      'Fix applied; service restored; alert log reviewed; Unix Admin signs off to DBA if DB layer affected');
  }

  if (isDB) {
    T2('DB Admin',
      'Check DB alert log -- identify ORA- / FATAL / PANIC errors and timestamps',
      'Scope confirmed as DB layer; DB accessible (listener up) or in restricted mode',
      'Error identified; timestamp correlated with incident start; error documented in ticket');
    T2('DB Admin',
      'Check active sessions and waits -- AWR snapshot, pg_stat_activity, SHOW PROCESSLIST',
      'Alert log reviewed; DB accessible',
      'Blocking session or wait event identified; kill query or blocking session if appropriate');
    T2('DB Admin',
      'Apply DB fix -- kill blocking session, resize tablespace, force redo log switch, restart listener',
      'Root cause confirmed from alert log and session analysis',
      'DB fix applied; alert log clean; connectivity from app restored; DBA signs off to AppAdmin');
    T2('DBA Lead',
      'Validate DB health -- all services registered; redo logs healthy; replication lag within SLA',
      'DB Admin confirms immediate fix applied',
      'DB health confirmed; standby lag within SLA; DBA Lead signs off for app team to reconnect');
  }

  if (isAPP || isWEB) {
    T2('AppAdmin',
      'Check application logs -- stack trace, OOM, connection refused, 5xx errors',
      'Scope confirmed as app/web layer; app accessible or service restart needed',
      'Root cause identified from app logs; error correlated with DB or OS event if applicable');
    T2('AppAdmin',
      'Drain LB pool member and restart affected service -- coordinate LB take-out with NetAdmin',
      'Root cause identified; LB team available for drain',
      'Service restarted cleanly; LB pool member added back; health check passes');
    T2('AppAdmin',
      'Verify application health endpoint and critical transaction paths',
      'Service restarted; LB pool member restored',
      'Health endpoint returns 200; critical transaction paths verified; AppAdmin signs off to QA');
  }

  T2('QA Team',
    'Regression smoke test -- verify all critical transactions pass post-fix',
    'All affected layers confirmed fixed and healthy by respective admin leads',
    'P0 test cases pass; QA Lead signs off to Change Manager for bridge closure');
  T2('SecOps',
    'Confirm fix does not introduce new exposure -- quick security review if patch applied',
    'QA smoke test passed; fix confirmed stable',
    'No new CVEs introduced; SecOps confirms fix is clean; signs off to Change Manager');
  T2('Change Manager',
    'Document root cause, timeline, and resolution -- close P1 bridge; issue SLA report',
    'QA and SecOps both signed off; service confirmed stable',
    'RCA document issued; SLA breach or compliance noted; bridge closed; post-incident review scheduled');
  T2('Unix Admin',
    'Update CMDB -- document change made, new configuration baseline, lessons noted',
    'Change Manager confirms incident closed',
    'CMDB updated; configuration baseline recorded; monitoring thresholds adjusted if needed');

  return tasks;
}
