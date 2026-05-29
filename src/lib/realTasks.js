function T(role, name, dep, validate, window) {
  return { role, name, dep: dep || '', validate: validate || '', window: window || '' };
}

export function getRealTasks(uum, ctx) {
  const layers = uum.layers || [];
  const type = uum.type || 'update';
  const isDB   = layers.includes('db');
  const isOS   = layers.includes('os');
  const isHW   = layers.includes('hardware');
  const isSTG  = layers.includes('storage');
  const isAPP  = layers.includes('app');
  const isNET  = layers.includes('network');
  const isSEC  = layers.includes('security');
  const isBAK  = layers.includes('backup');

  // Detect Oracle specifically for Data Pump vs RMAN export path
  const isOracle = /oracle/i.test(ctx?.db || '');

  // ── MIGRATION ─────────────────────────────────────────────────────────────

  if (type === 'migration') {

    // Full platform migration: new VM/LPAR build + DB data migration
    if (isHW || (isOS && isDB)) {
      return [
        // ── Planning & authorization ──────────────────────────────────────
        T('Change Manager',
          'Raise CAB migration change request',
          'Risk assessment doc complete; rollback plan reviewed by SysAdmin Lead; app impact confirmed by AppAdmin',
          'CAB ticket number issued; change window date approved by all leads; rollback owner named',
          'CAB meeting'),

        T('SysAdmin Lead',
          'Kick-off session — confirm resource availability with all team leads',
          'CAB approval in hand; all team leads reachable and confirmed available for change window',
          'Attendance sheet signed; RACI matrix agreed; stakeholder comms sent; bridge bridge details circulated',
          'Working hours'),

        // ── Target platform build ─────────────────────────────────────────
        T('Unix Admin',
          'Create migration target VM / LPAR profile — CPU, memory, NIC specs',
          'SysAdmin Lead kick-off complete; target HW specs and required VLANs confirmed',
          'VM/LPAR profile document created; CPU/RAM/NIC config peer reviewed by Unix Admin Lead; HBA WWNs captured and recorded',
          'Working hours'),

        T('Unix Admin',
          'Raise storage zoning request — submit HBA WWNs and zone requirements to Storage team',
          'Target VM profile created; HBA WWNs documented; storage requirements confirmed against platform standards',
          'Storage zoning ticket raised with correct HBA WWNs, required zone names, and SAN fabric target; ticket number shared with Storage Admin',
          'Working hours'),

        T('Storage Admin',
          'Zone HBAs on SAN fabric and present storage to target VM',
          'Unix Admin zoning ticket received with correct HBA WWNs and zone specifications',
          'Zoning complete on all fabric paths; LUNs visible from HBA scan on target VM; multipath daemon shows clean paths; confirmation sent to Unix Admin',
          'Weekend window'),

        T('Unix Admin',
          'Raise disk allocation request — LUN sizes and IOPS per storage standards',
          'Storage zoning confirmed complete by Storage Admin; target platform storage requirements approved',
          'Disk allocation ticket raised with correct LUN sizes, IOPS tier, filesystem types, and mount point plan; ticket number shared with Storage Admin',
          'Working hours'),

        T('Storage Admin',
          'Allocate LUNs and present to target VM per approved disk request',
          'Unix Admin disk allocation ticket approved; storage fabric zoning already complete',
          'LUNs provisioned and mapped; visible in multipath -ll on target VM; path count and device names documented and returned to Unix Admin',
          'Working hours'),

        T('Unix Admin',
          'Validate multipath and LUN visibility on target VM',
          'Storage Admin confirms LUN allocation complete and paths active',
          'multipath -ll shows all paths active/ready; device names verified against Storage Admin allocation doc; no stale paths or missing devices',
          'Working hours'),

        T('Unix Admin',
          'Clone OS image disk and allocate to migration target VM',
          'LUNs validated on target VM; approved OS image available in image library',
          'OS image cloned to target boot disk; VM/LPAR starts from new disk; basic boot verified; image version and patch level documented',
          'Working hours'),

        T('NetAdmin',
          'Allocate VLAN membership, IP address, and hostname for target VM — create DNS record',
          'Unix Admin VM profile received with required VLANs and IP range; IPAM allocation pre-approved',
          'VLAN trunked to target VM; IP address allocated in IPAM; forward and reverse DNS records created and verified; confirmation sent to Unix Admin',
          'Working hours'),

        T('Unix Admin',
          'Configure OS baseline on target VM — hostname, NTP, DNS resolution, syslog forwarding',
          'NetAdmin confirms IP, VLAN, and DNS records in place; OS image booted',
          'Hostname matches DNS record; NTP sync confirmed (chronyc tracking); DNS resolution working (forward + reverse); syslog forwarding verified to central log server',
          'Working hours'),

        T('Unix Admin',
          'Configure target VM access, filesystems, mount points, user accounts, and permissions',
          'OS baseline config complete; filesystem layout agreed with DBA and AppAdmin',
          'All mount points created and mounted at boot (fstab verified); user accounts and sudo rights match runbook; directory permissions verified against security baseline',
          'Working hours'),

        // ── DB platform preparation ───────────────────────────────────────
        T('DB Admin',
          'Provide DB software pre-requisites and filesystem layout spec for target VM',
          'Unix Admin confirms OS baseline complete; target OS version confirmed',
          'Pre-req document issued to Unix Admin: required OS packages, kernel parameters, filesystem layout, user/group names, directory permissions, and DB version',
          'Working hours'),

        T('Unix Admin',
          'Install DB OS prerequisite packages on target VM (libaio, compat libs, gcc, etc.)',
          'DB Admin pre-req doc received; target VM OS baseline complete',
          'All packages from DB Admin pre-req list installed; rpm/dpkg output sent to DB Admin for sign-off; no conflicting packages',
          'Working hours'),

        T('Unix Admin',
          'Apply OS kernel parameters per DB pre-req doc — hugepages, ulimits, sysctl settings',
          'DB Admin pre-req doc received; OS packages installed on target VM',
          'hugepages configured; ulimits set in /etc/security/limits.conf; sysctl params applied and persistent; settings verified by DB Admin before proceeding',
          'Working hours'),

        T('Unix Admin',
          'Clone source VM DB disk(s) and allocate to target VM — migration staging',
          'Target VM filesystems configured; DB Admin confirms disk layout for clone',
          'Source DB disks cloned and presented to target VM; disk device names and sizes verified; DB Admin notified for data migration use',
          'Weekend window'),

        T('DB Admin',
          'Install DB software binaries on target Linux server and apply latest patch bundle',
          'Unix Admin confirms all OS prereq packages and kernel params verified; filesystem layout ready',
          'DB software installed in agreed home directory; latest patch bundle applied; DB instance starts clean; alert log checked and clean',
          'Working hours'),

        T('DB Admin',
          'Create blank target database on target server — listener, init params, directories',
          'DB software installed and patched on target; filesystems ready',
          'Target DB instance created; listener registered and tested; init parameter file documented; all required directories and tablespace files created',
          'Working hours'),

        // ── Data migration ────────────────────────────────────────────────
        T('BackupAdmin',
          'Full backup of source database — verify integrity before migration',
          'Source system in stable state; DB Admin confirms no active long-running jobs; backup window clear',
          'Backup complete; test restore verified in staging environment; backup set label and location documented; DB Admin signs off on integrity check',
          'Weekend window'),

        T('DB Admin',
          isOracle
            ? 'Export source database using Oracle Data Pump (expdp — full or schema-level)'
            : 'Export source database (logical dump — full or schema-level)',
          'Source backup verified; DB Admin confirms quiesce or export-consistent state achievable',
          isOracle
            ? 'expdp job completes without errors; dump file set size and location documented; export log reviewed — no ORA- errors; file count and total size shared with Unix Admin'
            : 'Dump complete; file size and location documented; export log reviewed and shared with Unix Admin',
          'Working hours'),

        T('Unix Admin',
          'Transfer export dump files from source to target server (scp / rsync / SAN copy)',
          'DB Admin confirms export complete and dump files intact on source; target filesystem has sufficient space',
          'All dump files transferred; MD5/SHA checksums verified on target match source; Unix Admin confirms target directory permissions correct for DB Admin import',
          'Working hours'),

        T('DB Admin',
          isOracle
            ? 'Import data into blank target database using Oracle Data Pump (impdp — remap tablespaces/schemas if needed)'
            : 'Import data into blank target database',
          'Dump files transferred to target; checksums verified; blank target DB instance ready',
          isOracle
            ? 'impdp job completes; import log reviewed — no fatal ORA- errors; object counts compared to source; tablespace utilisation checked'
            : 'Import complete; object counts verified against source; import log reviewed',
          'Working hours'),

        T('DB Admin',
          'Recompile invalid objects and gather statistics post-import',
          'Import completed; DB Admin confirms import log clean',
          'utlrp.sql / dbms_utility.compile_schema run; invalid objects count = 0 or documented exceptions only; dbms_stats.gather_database_stats completed; alert log clean',
          'Working hours'),

        T('Unix Admin',
          'Continuous Unix support during DB setup — filesystem space, permissions, connectivity',
          'DB migration activities underway on target VM',
          'No filesystem space events; all required mount points available; Unix Admin available on bridge call throughout DB migration activities',
          'Working hours'),

        // ── Cutover ───────────────────────────────────────────────────────
        T('Change Manager',
          'Book production outage window and notify all stakeholders',
          'Staging migration rehearsal passed; all leads signed Go; CAB approved production window',
          'Outage notifications sent to all stakeholders; SLA impact statement issued; on-call rota circulated; rollback decision time agreed',
          'Working hours'),

        T('Unix Admin',
          'Prepare VM snapshot — pre-cutover rollback point',
          'All pre-cutover tasks complete; outage window confirmed and active',
          'Snapshot / image taken and labeled with timestamp; restore procedure documented and tested in non-prod; DB Admin notified',
          'Scheduled outage'),

        T('AppAdmin Lead',
          'Drain application connections and stop services ahead of cutover',
          'Outage window active; LB team coordinated; app team on bridge',
          'All app connections closed; LB pool member removed; no active sessions on source DB confirmed by DBA; services stopped cleanly',
          'Scheduled outage'),

        T('DB Admin',
          'Final data sync and validation — row counts, checksums, alert log clean',
          'App connections drained; source DB quiesced; target DB ready',
          'Row counts match on all critical tables; alert log clean; redo log sequence verified; DB Admin confirms target ready for traffic',
          'Scheduled outage'),

        T('Unix Admin',
          'Update DNS / VIP to cut application traffic to new platform',
          'DB Admin confirms final data validation passed; app team ready for smoke test',
          'DNS TTL flushed; VIP updated in LB; connectivity verified from all app nodes to new platform; old platform no longer receives connections',
          'Scheduled outage'),

        T('AppAdmin',
          'Start application against new platform and verify DB connection pool',
          'Unix Admin confirms DNS / VIP updated; DB listener confirmed up on new platform',
          'App starts without errors; DB connection pool established; health endpoint returns 200; no connection timeout errors in app logs',
          'Scheduled outage'),

        T('QA Team',
          'Functional smoke test — P0 critical transactions on new platform',
          'AppAdmin confirms app started cleanly; DB connections stable',
          'All P0 test cases pass; performance within 10% of pre-migration baseline; QA Lead signs off in writing',
          'Scheduled outage'),

        T('Change Manager',
          'Go / No-Go gate — all leads confirm production on new platform',
          'QA smoke test passed; DB Admin confirms clean alert log; Unix Admin confirms monitoring green',
          'Go decision documented with timestamp; rollback window noted; bridge call closed; incident management stand-down confirmed',
          'Scheduled outage'),

        T('Unix Admin',
          'Decommission old platform — archive configs and update CMDB',
          'Go decision confirmed; 48h post-migration monitoring clean',
          'Old VM/LPAR powered off; all config files archived to version control; CMDB updated with new server baseline; decommission ticket closed',
          'Working hours'),
      ];
    }

    // DB-only migration (logical export/import path — Oracle Data Pump or equivalent)
    if (isDB) {
      return [
        T('Change Manager',
          'Raise CAB change request for DB migration',
          'DBA impact assessment complete; app compatibility with target DB version confirmed by AppAdmin',
          'CAB ticket approved; risk accepted by SysAdmin Lead; rollback procedure documented and owner named',
          'CAB meeting'),

        T('DB Admin',
          'Run pre-migration compatibility and dependency check on source DB',
          'CAB approval confirmed; access to source DB in non-prod for analysis',
          isOracle
            ? 'Pre-upgrade advisor output reviewed; all inhibitors resolved; deprecated features and invalid objects documented; source DB version and patch level recorded'
            : 'Compatibility check complete; deprecated features documented; all blockers resolved',
          'Working hours'),

        T('DB Admin',
          'Provide DB software pre-requisites and filesystem layout spec for target server',
          'Pre-migration check complete; target DB version confirmed',
          'Requirements doc issued to Unix Admin: OS packages, kernel params, filesystem layout, user/group setup, DB binary location',
          'Working hours'),

        T('Unix Admin',
          'Install DB OS prerequisite packages on target server',
          'DB Admin requirements doc received; target server OS confirmed',
          'All listed packages installed; rpm/dpkg output returned to DB Admin for sign-off',
          'Working hours'),

        T('Unix Admin',
          'Apply OS kernel parameters per DB pre-req doc',
          'OS packages installed; DB Admin pre-req doc in hand',
          'hugepages, ulimits, sysctl params applied and persistent; verified by DB Admin',
          'Working hours'),

        T('DB Admin',
          isOracle
            ? 'Install Oracle 19c software binaries on target server and apply latest RU patch'
            : 'Install DB software binaries on target server and apply latest patch bundle',
          'Unix Admin confirms OS prereqs installed and signed off; filesystem layout ready',
          isOracle
            ? 'Oracle 19c home installed; latest Release Update applied; opatch lspatches output documented; DB starts clean; alert log checked'
            : 'DB binaries installed; patch applied; instance starts clean; alert log reviewed',
          'Working hours'),

        T('DB Admin',
          isOracle
            ? 'Create blank target database on target server — init params, listener, directory objects'
            : 'Create blank target database on target server',
          'DB binaries installed and patched on target; filesystems ready',
          isOracle
            ? 'Oracle instance created; listener registered and verified; init.ora / spfile documented; required directory objects created; alert log clean'
            : 'DB instance created; listener registered; alert log clean',
          'Working hours'),

        T('BackupAdmin',
          'Full backup of source database — verify integrity before migration',
          'Source DB in stable state; no active long-running jobs; backup window confirmed',
          'Backup complete; restore verified in staging; backup set label and location documented and retained',
          'Weekend window'),

        T('DB Admin',
          isOracle
            ? 'Export source database using Oracle Data Pump (expdp) — full or schema-level'
            : 'Export source database (logical dump)',
          'Source backup verified; DB Admin confirms export-consistent state achievable',
          isOracle
            ? 'expdp completes; dump file set size recorded; export log reviewed — no ORA- errors; file list and checksums shared with Unix Admin for transfer'
            : 'Dump complete; file size and checksum documented; ready for transfer',
          'Working hours'),

        T('Unix Admin',
          'Transfer export dump files from source to target server',
          'DB Admin confirms export complete; target filesystem has sufficient free space',
          'All dump files transferred; MD5/SHA checksums verified on target; target directory permissions confirmed correct for DB Admin',
          'Working hours'),

        T('DB Admin',
          isOracle
            ? 'Import data into blank target database using Oracle Data Pump (impdp)'
            : 'Import data into blank target database',
          'Dump files on target; checksums verified; blank target DB ready',
          isOracle
            ? 'impdp completes; import log reviewed — no fatal ORA- errors; object counts compared to source; tablespace utilisation and extents checked'
            : 'Import complete; object counts match source; import log reviewed',
          'Working hours'),

        T('DB Admin',
          'Recompile invalid objects and gather statistics post-import',
          'Import complete; import log clean',
          isOracle
            ? 'utlrp.sql run; invalid object count = 0 or documented exceptions only; dbms_stats.gather_database_stats complete; alert log clean'
            : 'Invalid objects recompiled; statistics gathered; DB health confirmed',
          'Working hours'),

        T('DB Admin',
          'Verify DB health — alert log, listeners, tablespace utilisation, redo logs',
          'Post-import recompile and stats complete',
          'No ORA- errors in alert log; all listeners registered; tablespace utilisation < 80%; redo log group count and sizing verified; DB Admin signs off',
          'Working hours'),

        T('AppAdmin Lead',
          'Drain application connections ahead of production cutover',
          'Staging rehearsal passed; cutover window active; LB team coordinated',
          'All connections closed; LB pool member removed; no active sessions on source DB',
          'Scheduled outage'),

        T('AppAdmin',
          'Start application against new DB and verify connectivity',
          'DB Admin confirms target DB up and validated; listener confirmed up; connection string updated if needed',
          'App starts; DB connection pool established; health endpoint returns 200; no errors in app logs',
          'Scheduled outage'),

        T('QA Team',
          'Full regression smoke test on migrated database',
          'AppAdmin confirms app started cleanly; no connection errors',
          'All P0 test cases pass; critical SQL paths verified; DBA and QA Lead sign off',
          'Scheduled outage'),

        T('DB Admin',
          '48h post-migration monitoring — AWR, alert log, replication lag',
          'QA smoke test passed; production traffic restored to new DB',
          'No new ORA- errors after 48h; AWR shows no performance regression vs baseline; monitoring alerts green; DB Admin confirms stable',
          'Working hours'),

        T('Change Manager',
          'Close change ticket — CMDB updated with new DB version and server details',
          '48h clean monitoring confirmed; all leads signed off',
          'CMDB updated; old DB home or server decommissioned; ticket closed; post-migration report issued',
          'Working hours'),
      ];
    }

    // OS-only migration
    if (isOS) {
      return [
        T('Change Manager',
          'Raise CAB change request for OS migration',
          'Impact assessment complete; app compatibility with target OS confirmed; rollback plan documented',
          'CAB ticket approved; change window confirmed; all app and DB teams notified',
          'CAB meeting'),

        T('Unix Admin',
          'Build new target OS platform — install base OS and apply latest patches',
          'CAB approved; hardware or cloud instance available',
          'New OS installed; all pending patches applied; kernel version documented; base config peer reviewed by Unix Admin Lead',
          'Working hours'),

        T('Unix Admin',
          'Configure OS baseline on new platform — hostname, NTP, DNS, syslog, kernel params',
          'OS installed; NetAdmin confirms IP, VLAN, and DNS records in place',
          'Hostname, NTP sync, DNS resolution, and syslog forwarding all verified; kernel parameters match platform standard',
          'Working hours'),

        T('Unix Admin',
          'Configure access, filesystems, mount points, user accounts, and permissions on new platform',
          'OS baseline complete; app and DB teams confirm required layout',
          'All mount points created; user accounts and sudo rights verified; directory permissions match security baseline',
          'Working hours'),

        T('Unix Admin',
          'Migrate application binaries and config to new OS platform',
          'New OS build verified; app team confirms binary and config compatibility',
          'App binaries transferred; all config files migrated and diff-checked; dependency packages installed on new OS; no version conflicts',
          'Working hours'),

        T('AppAdmin',
          'Test application on new OS in staging — verify all connections and dependencies',
          'Unix Admin confirms app migration complete; DB connectivity confirmed on new OS',
          'App starts cleanly in staging; health checks pass; DB connections established; log output clean; performance within 5% of baseline',
          'Weekend window'),

        T('QA Team',
          'Full regression smoke test on new OS platform in staging',
          'AppAdmin confirms app started cleanly and DB connected in staging',
          'All P0 test cases pass; QA Lead signs off',
          'Weekend window'),

        T('Change Manager',
          'Production cutover — update DNS / VIP to new OS platform',
          'QA smoke test passed; all leads confirm Go; production change window active',
          'DNS / VIP updated; traffic cut to new OS platform; 48h monitoring confirmed clean',
          'Scheduled outage'),

        T('Unix Admin',
          'Decommission old OS platform and update CMDB',
          '48h post-cutover monitoring clean; all leads confirmed stable',
          'Old server decommissioned or powered off; config archived to version control; CMDB updated with new OS version and server details',
          'Working hours'),
      ];
    }
  }

  // ── UPGRADE ───────────────────────────────────────────────────────────────

  if (type === 'upgrade') {
    if (isDB) {
      return [
        T('Change Manager',
          'Raise CAB change request for DB version upgrade',
          'Patch notes reviewed; DBA impact assessment complete; app compatibility confirmed',
          'CAB ticket approved; maintenance window confirmed; rollback procedure documented',
          'CAB meeting'),

        T('DB Admin',
          'Review errata, pre-requisites, and compatibility matrix for target DB version',
          'CAB approved; patch bundle downloaded and checksum verified',
          'All pre-requisites met; inhibitors resolved; deprecated feature list issued to AppAdmin',
          'Working hours'),

        T('BackupAdmin',
          'Full DB backup before upgrade — verify restore in staging',
          'DB in stable state; no active long-running jobs',
          'Backup complete; test restore passed in staging; backup set retained for 30 days',
          'Working hours'),

        T('Unix Admin',
          'Apply any OS packages or kernel parameters required by target DB version',
          'DB Admin pre-req doc received',
          'Required OS packages installed; kernel params updated if needed; verified by DBA',
          'Working hours'),

        T('DB Admin',
          'Install new DB version home side-by-side in non-prod and validate',
          'Unix Admin confirms OS prereqs met; staging mirrors production',
          'New DB home installed; patch applied; staging upgrade rehearsal complete; timing documented',
          'Working hours'),

        T('DB Admin',
          'Rehearsal 1 — full upgrade in staging (timing and issues log)',
          'Staging environment matches production; backup verified',
          'Upgrade completed; timing recorded; all issues logged and resolved; app smoke test passes',
          'Weekend window'),

        T('DB Admin',
          'Rehearsal 2 — repeat upgrade in staging (confirm timing fits production window)',
          'Rehearsal 1 issues resolved; staging reset to pre-upgrade state',
          'Upgrade completed within approved window; no new issues; timing signed off by DBA Lead and Change Manager',
          'Weekend window'),

        T('AppAdmin Lead',
          'Drain application connections ahead of production upgrade',
          'Production upgrade window active; LB team coordinated',
          'All app connections closed; LB pool removed; 0 active sessions in DB confirmed by DBA',
          'Scheduled outage'),

        T('DB Admin',
          'Execute DB version upgrade on production',
          'App connections drained; backup verified; outage window active',
          isOracle
            ? 'DBUA / catupgrd.sql exits 0; datapatch run; no ORA-/FATAL in alert log; DB version number confirmed'
            : 'Upgrade script exits 0; catalog updated; alert log clean; DB version confirmed',
          'Scheduled outage'),

        T('DB Admin',
          'Post-upgrade validation — recompile invalids, gather stats, verify HA config',
          'Upgrade script completed cleanly; no outstanding errors',
          isOracle
            ? 'utlrp.sql run; invalid object count = 0 or exceptions documented; dbms_stats gathered; Data Guard lag < 30s; listener up'
            : 'Invalid objects recompiled; stats gathered; HA config verified',
          'Scheduled outage'),

        T('AppAdmin',
          'Restart application and verify DB connectivity on upgraded version',
          'DBA confirms DB up and all services registered',
          'App starts; DB connection pool established; health endpoint returns 200',
          'Scheduled outage'),

        T('QA Team',
          'Smoke test — verify all critical transactions on upgraded DB',
          'AppAdmin confirms clean start',
          'P0 test cases pass; QA Lead signs off',
          'Scheduled outage'),

        T('Change Manager',
          'Close CAB ticket — CMDB updated with new DB version; post-upgrade report issued',
          'QA and DBA both signed off; 48h monitoring clean',
          'CMDB updated; old DB home archived; ticket closed; RCA issued for any incidents during upgrade',
          'Working hours'),
      ];
    }

    if (isOS) {
      return [
        T('Change Manager',
          'Raise CAB change request for OS patch / upgrade',
          'Errata reviewed; Unix Admin impact assessment complete; app teams notified',
          'CAB approved; maintenance window confirmed; rollback procedure (snapshot restore) documented',
          'CAB meeting'),

        T('Unix Admin',
          'Snapshot / image OS before patching — pre-patch rollback point',
          'CAB approved; maintenance window active',
          'Snapshot taken and labeled; restore procedure peer reviewed and tested in staging',
          'Scheduled outage'),

        T('Unix Admin',
          'Apply OS patch bundle or version upgrade',
          'Snapshot complete; all services gracefully stopped if required by patch',
          'Patch applied; system rebooted; no errors in boot log or dmesg; kernel version confirmed',
          'Scheduled outage'),

        T('Unix Admin',
          'Post-patch validation — verify all services, kernel version, and monitoring agent',
          'OS patched and rebooted',
          'All services up; kernel version confirmed correct; monitoring agent healthy; no new alerts triggered',
          'Scheduled outage'),

        T('AppAdmin',
          'Verify application start and health checks post-patch',
          'Unix Admin confirms all system services running',
          'App health endpoint returns 200; no errors in app logs; DB connectivity confirmed',
          'Scheduled outage'),

        T('QA Team',
          'Smoke test post-patch',
          'App confirmed running cleanly',
          'P0 test cases pass; QA Lead signs off',
          'Scheduled outage'),

        T('Change Manager',
          'Close CAB ticket and update CMDB with new OS patch level',
          'All leads signed off; 24h post-patch monitoring clean',
          'CMDB updated; ticket closed; patch level recorded in asset register',
          'Working hours'),
      ];
    }

    if (isAPP) {
      return [
        T('Change Manager',
          'Raise CAB change for middleware / app upgrade',
          'Release notes reviewed; AppAdmin impact assessment complete; DB and OS compatibility confirmed',
          'CAB approved; maintenance window confirmed; rollback package prepared',
          'CAB meeting'),

        T('AppAdmin',
          'Stage new middleware version in non-prod — install, configure, and smoke test',
          'CAB approved; new package downloaded and checksum verified',
          'New version installed in staging; config migrated; smoke test passes; timing documented',
          'Working hours'),

        T('QA Team',
          'Full regression test on new middleware version in staging',
          'AppAdmin confirms staging deployment complete; DB connectivity verified',
          'All P0 test cases pass; performance within baseline; QA Lead signs off',
          'Working hours'),

        T('AppAdmin Lead',
          'Drain LB pool member and stop service in production',
          'Upgrade window active; LB team coordinated',
          'Service drained from LB; no active connections; service stopped cleanly',
          'Scheduled outage'),

        T('AppAdmin',
          'Apply upgrade in production and start service',
          'Service stopped; upgrade package verified against staging',
          'New version running; health endpoint returns 200; no errors in startup log',
          'Scheduled outage'),

        T('QA Team',
          'Smoke test in production post-upgrade',
          'AppAdmin confirms service running cleanly',
          'Critical transactions pass; QA Lead signs off',
          'Scheduled outage'),

        T('Change Manager',
          'Close CAB ticket and update CMDB with new middleware version',
          'All leads signed off; no regressions in 24h monitoring',
          'CMDB updated; ticket closed',
          'Working hours'),
      ];
    }

    if (isSTG) {
      return [
        T('Change Manager',
          'Raise CAB change request for storage expansion / reconfiguration',
          'Capacity report issued; SysAdmin Lead confirms impact assessment',
          'CAB ticket approved; change window confirmed',
          'CAB meeting'),

        T('Unix Admin',
          'Raise storage expansion request with LUN sizes and IOPS requirements',
          'CAB approved; storage requirements documented',
          'Storage ticket raised; ticket number shared with Storage Admin',
          'Working hours'),

        T('Storage Admin',
          'Provision additional LUNs and present to target server(s)',
          'Unix Admin storage ticket received and approved',
          'LUNs provisioned and mapped; multipath -ll confirms new devices on all servers',
          'Working hours'),

        T('Unix Admin',
          'Scan HBAs, verify new LUNs in multipath, and extend volume groups / filesystems',
          'Storage Admin confirms LUN allocation complete',
          'New LUNs visible; pvs/vgs extended; filesystems resized without downtime; df -h confirms available space',
          'Working hours'),

        T('Change Manager',
          'Close CAB ticket — CMDB updated with new storage allocation',
          'Unix Admin confirms expansion complete; monitoring shows no alerts',
          'CMDB updated; ticket closed',
          'Working hours'),
      ];
    }
  }

  // ── Generic update path ───────────────────────────────────────────────────
  return [
    T('Change Manager',
      'Raise CAB change request',
      'Impact assessment complete; rollback plan documented',
      'CAB ticket approved; change window confirmed',
      'CAB meeting'),

    T('Unix Admin',
      'Apply patch / update in non-prod and verify',
      'CAB approved; change package downloaded and checksum verified',
      'Patch applied in non-prod; service restarted cleanly; no errors in logs',
      'Working hours'),

    T('QA Team',
      'Smoke test in non-prod after patch',
      'Unix Admin confirms patch applied cleanly',
      'P0 test cases pass; QA Lead signs off',
      'Working hours'),

    T('Unix Admin',
      'Apply patch / update in production during approved window',
      'QA sign-off confirmed; production change window active',
      'Patch applied; service healthy; monitoring green; no new alerts',
      'Scheduled outage'),

    T('Change Manager',
      'Close change ticket and update CMDB',
      '24h post-patch monitoring clean; all leads confirmed OK',
      'CMDB updated with new patch level; ticket closed',
      'Working hours'),
  ];
}

export function renderRealTasksText(uum, ctx) {
  const tasks = getRealTasks(uum, ctx);
  if (!tasks.length) return '';
  return tasks.map((t, i) => {
    const id = String(i + 1).padStart(2, '0');
    const win = t.window ? ' [' + t.window + ']' : '';
    return `T${id} [${t.role}] ${t.name}${win}\n  Pre-req: ${t.dep || 'None'}\n  Handoff: ${t.validate || 'Proceed to next task'}`;
  }).join('\n\n');
}
