function T(role, name, dep, validate, window) {
  return { role, name, dep: dep || '', validate: validate || '', window: window || '' };
}

export function getRealTasks(uum, ctx) {
  const layers = uum.layers || [];
  const type = uum.type || 'update';
  const isDB = layers.includes('db');
  const isOS = layers.includes('os');
  const isHW = layers.includes('hardware');
  const isSTG = layers.includes('storage');
  const isAPP = layers.includes('app');
  const isNET = layers.includes('network');
  const isSEC = layers.includes('security');
  const isBAK = layers.includes('backup');

  if (type === 'migration') {
    if (isHW || (isOS && isDB)) {
      return [
        T('Change Manager','Raise CAB migration change request','Risk assessment doc ready; rollback plan signed off by SysAdmin Lead','CAB ticket number confirmed; change window date approved by all leads','CAB meeting'),
        T('SysAdmin Lead','Kick-off session -- confirm resource availability','CAB approval in hand; all team leads confirmed available for change window','Attendance sheet signed; RACI agreed; comms sent to stakeholders','Working hours'),
        T('Unix Admin','Raise storage request -- new platform LUN and zone requirements','Target HW platform specs confirmed; HBA WWNs captured from new server','Storage ticket raised with correct LUN sizes, IOPS, and WWNs documented','Working hours'),
        T('Storage Admin','Provision LUNs and FC zoning for target platform','Unix Admin storage ticket approved; target HBA WWNs received; SAN fabric accessible','Zoning complete; LUNs visible on HBA scan from target server (multipath clean)','Weekend window'),
        T('Unix Admin','Build VM / LPAR profile and hardware config for imaging','Storage Admin confirms LUNs zoned and visible; network VLAN confirmed by NetAdmin','LPAR / VM profile created; NIC, storage, and CPU config documented and peer reviewed','Working hours'),
        T('NetAdmin','Allocate VLAN membership and IP address for new platform','Unix Admin profile request received with required VLANs and IP range','VLAN trunked to new server; IP allocated in IPAM; DNS record created','Working hours'),
        T('DB Admin','Provide software pre-requisite list for new platform build','Unix Admin confirms target OS version and base build ready for input','Software list document issued: DB version, OS packages, filesystem layout, user/group setup','Working hours'),
        T('Unix Admin','Install OS on new platform per imaging runbook','LPAR/VM profile complete; LUNs zoned; network VLAN assigned; DB prereq list received from DBA','OS installed; hostname, NTP, DNS, syslog all verified; no outstanding package conflicts','Weekend window'),
        T('Unix Admin','Apply OS tuning and kernel parameters per DB prereq doc','OS install complete; DB Admin prereq doc in hand','hugepages, ulimits, sysctl, selinux mode confirmed; peer-reviewed by Unix Admin Lead','Working hours'),
        T('Unix Admin','Install DB OS prerequisite packages (libaio, compat libs, etc.)','OS tuning signed off; DB Admin software list confirmed','All packages from DBA prereq list installed; rpm -qa output sent to DBA for sign-off','Working hours'),
        T('DB Admin','Install DB binaries and apply latest patch bundle on new platform','Unix Admin confirms all OS prereq packages installed and verified; filesystem layout ready','DB home installed; patch level confirmed; DB instance starts clean; alert log checked','Working hours'),
        T('Unix Admin','Prepare VM / platform snapshot for imaging (pre-data rollback point)','DB Admin confirms binaries installed and instance starts clean on new platform','Snapshot / image taken and labeled; restore tested in isolated environment','Working hours'),
        T('BackupAdmin','Full backup of source database -- verify integrity before migration','Source system in stable state; DB Admin confirms no active jobs; backup window clear','Backup complete; restore verified in staging; RMAN / pg_basebackup output shared with DBA','Weekend window'),
        T('Change Manager','Book production outage window and notify all stakeholders','Staging migration rehearsal passed; all leads signed Go; CAB approved production window','Outage notifications sent; SLA impact statement issued; on-call list circulated','Working hours'),
        T('DB Admin','Migrate database to new platform (RMAN restore / Data Guard sync / export-import)','Source backup verified; target DB home ready; outage window active; app connections drained','All data verified on target: row counts match, checksums pass, alert log clean','Scheduled outage'),
        T('Unix Admin','Update DNS / VIP to cut traffic over to new platform','DB Admin confirms data integrity checks passed; app team ready for smoke test','DNS TTL flushed; VIP updated in LB; connectivity verified from all app nodes','Scheduled outage'),
        T('AppAdmin','Start application against new platform and run connection test','Unix Admin confirms DNS / VIP updated; DB listener confirmed up on new platform','App starts without errors; DB connection pool established; health endpoint returns 200','Scheduled outage'),
        T('QA Team','Functional smoke test -- validate all critical transactions on new platform','AppAdmin confirms app started cleanly; DB connections stable','All P0 test cases pass; performance baseline within 10% of pre-migration; signed off by QA Lead','Scheduled outage'),
        T('Change Manager','Go / No-Go gate -- all leads confirm production on new platform','QA smoke test passed; DB Admin confirms clean alert log; Unix Admin confirms monitoring green','Go decision documented; rollback window noted; bridge call closed','Scheduled outage'),
        T('Unix Admin','Decommission old platform -- archive configs and update CMDB','Go decision confirmed; 48h post-migration monitoring clean','Old LPAR/VM powered off; configs archived to version control; CMDB updated with new baseline','Working hours'),
      ];
    }

    if (isDB) {
      return [
        T('Change Manager','Raise CAB change request for DB version migration','DBA impact assessment complete; app compatibility confirmed by AppAdmin','CAB ticket approved; risk accepted by SysAdmin Lead; rollback procedure documented','CAB meeting'),
        T('DB Admin','Run pre-upgrade advisor / compatibility check on source DB','CAB approval confirmed; access to source DB in non-prod for testing','Pre-upgrade report issued; all inhibitors resolved; deprecated features documented','Working hours'),
        T('DB Admin','Provide software and OS package requirements for new DB version','Pre-upgrade report clean; target DB version confirmed','Requirements doc issued to Unix Admin: new glibc, compat packages, filesystem layout','Working hours'),
        T('Unix Admin','Install new OS packages required by target DB version','DB Admin requirements doc received; non-prod environment available','All listed OS packages installed and verified; rpm / dpkg output sent to DBA for sign-off','Working hours'),
        T('DB Admin','Install new DB version home side-by-side in non-prod','Unix Admin confirms OS prereqs installed and signed off','New DB home installed; patch bundle applied; startup clean in non-prod; alert log reviewed','Working hours'),
        T('BackupAdmin','Full source DB backup before rehearsal -- verify restore in staging','Non-prod staging environment ready; DB Admin confirms quiesce window','Backup complete; test restore validated; backup set retained until migration confirmed stable','Working hours'),
        T('DB Admin','Rehearsal 1 -- full migration in staging (full timing run)','Staging mirrors production; backup verified; Unix Admin and AppAdmin available','Migration completed; timing documented; all issues logged; app smoke test pass in staging','Weekend window'),
        T('DB Admin','Rehearsal 2 -- repeat migration in staging (confirm timing fits window)','Rehearsal 1 issues resolved; staging reset to pre-migration state','Migration completed within window; no new issues; timing signed off by DBA Lead and PM','Weekend window'),
        T('AppAdmin Lead','Drain application connections ahead of production migration','Migration window active; LB team confirmed; app team on bridge call','All app connections closed; LB pool taken out; no active sessions in DB (confirmed by DBA)','Scheduled outage'),
        T('DB Admin','Execute DB migration / upgrade script on production','App connections confirmed drained; source backup verified; outage window active','Migration complete; DBUA / upgrade script exit 0; datapatch run; no ORA-/FATAL in alert log','Scheduled outage'),
        T('DB Admin','Post-migration validation -- recompile invalids, gather stats, verify HA config','Migration script completed cleanly; no outstanding errors in alert log','All invalid objects recompiled; stats fresh; Data Guard / replication lag < 30s; listener up','Scheduled outage'),
        T('AppAdmin','Restart application and verify DB connectivity on new version','DBA confirms DB up and validated; listener updated; connection string unchanged','App starts; DB connection pool established; health check endpoint green','Scheduled outage'),
        T('QA Team','Full regression smoke test on new DB version','AppAdmin confirms app started cleanly; no connection errors in app logs','All P0 test cases pass; critical SQL paths verified; DBA and QA Lead sign off','Scheduled outage'),
        T('DB Admin','48h post-migration monitoring -- AWR, alert log, replication lag','QA smoke test passed; production traffic restored','No new errors after 48h; AWR shows no performance regression; monitoring alerts green','Working hours'),
        T('Change Manager','Close change ticket -- CMDB updated with new DB version','48h clean confirmed; all leads signed off','CMDB updated; old DB home archived; ticket closed','Working hours'),
      ];
    }

    if (isOS) {
      return [
        T('Change Manager','Raise CAB change request for OS migration','Impact assessment complete; rollback plan documented','CAB ticket approved; change window confirmed; all teams notified','CAB meeting'),
        T('Unix Admin','Build new target OS platform in non-prod','CAB approved; hardware / cloud instance available','New OS image built; base packages installed; configuration baseline documented','Working hours'),
        T('Unix Admin','Migrate application binaries and config to new OS','New OS build verified; app team confirms compatibility','App binaries copied; config files migrated; dependency list verified against new OS packages','Working hours'),
        T('AppAdmin','Test application on new OS version in staging','Unix Admin confirms app migration complete; DB connectivity confirmed','App starts cleanly; health checks pass; performance within 5% of baseline','Weekend window'),
        T('QA Team','Full regression smoke test on new OS','AppAdmin confirms app started cleanly in staging','All P0 test cases pass; QA Lead signs off','Weekend window'),
        T('Change Manager','Production cutover -- update DNS / VIP to new platform','QA smoke test passed; all leads confirm go','DNS / VIP updated; traffic cut over to new OS; 48h monitoring confirmed','Scheduled outage'),
        T('Unix Admin','Decommission old OS platform and update CMDB','48h clean confirmed post-cutover','Old server decommissioned; CMDB updated; configs archived to version control','Working hours'),
      ];
    }
  }

  if (type === 'upgrade') {
    if (isDB) {
      return [
        T('Change Manager','Raise CAB change request for DB upgrade','Patch notes reviewed; DBA impact assessment complete','CAB ticket approved; maintenance window confirmed','CAB meeting'),
        T('DB Admin','Review errata and pre-requisites for target DB version','CAB approved; patch bundle downloaded and verified (checksum)','All pre-requisites met; inhibitors resolved; compatibility matrix reviewed','Working hours'),
        T('BackupAdmin','Full DB backup before upgrade -- verify restore in staging','DB in stable state; no active long-running jobs','Backup complete; test restore passed; backup set retained for 30 days post-upgrade','Working hours'),
        T('AppAdmin Lead','Drain active application connections to DB','Upgrade window active; LB team coordinated; app team on bridge','All connections drained; DB in maintenance mode; DBA confirms 0 active sessions','Scheduled outage'),
        T('DB Admin','Apply DB patch bundle / version upgrade','App connections drained; backup verified; outage window active','Patch applied; datapatch / catalog upgrade run; alert log clean; no ORA-/FATAL errors','Scheduled outage'),
        T('DB Admin','Run post-upgrade validation -- recompile, gather stats, verify services','Patch applied; DB instance up','Invalid objects recompiled; stats gathered; all services registered; HA lag < 30s','Scheduled outage'),
        T('AppAdmin','Restart app and verify DB connectivity on upgraded version','DBA confirms DB up and services registered','App starts; connection pool established; health endpoint returns 200','Scheduled outage'),
        T('QA Team','Smoke test -- verify all critical transactions on upgraded DB','AppAdmin confirms clean start','P0 test cases pass; QA Lead signs off','Scheduled outage'),
        T('Change Manager','Close CAB ticket -- confirm upgrade successful in production','QA and DBA both signed off; 48h monitoring clean','CMDB updated; ticket closed; RCA of any issues during upgrade documented','Working hours'),
      ];
    }
    if (isOS) {
      return [
        T('Change Manager','Raise CAB change request for OS patch / upgrade','Errata reviewed; Unix Admin impact assessment complete','CAB approved; maintenance window set; all app teams notified','CAB meeting'),
        T('Unix Admin','Snapshot / backup OS before patching','CAB approved; maintenance window active','Snapshot taken; backup verified; restore procedure documented and peer reviewed','Scheduled outage'),
        T('Unix Admin','Apply OS patch bundle / version upgrade','Snapshot complete; all services stopped (if required)','Patch applied; system rebooted; no errors in boot log; all services started','Scheduled outage'),
        T('Unix Admin','Post-patch validation -- verify all services and kernel version','OS patched and rebooted','All services up; kernel version confirmed; monitoring agent healthy; no new alerts','Scheduled outage'),
        T('AppAdmin','Verify application start and health checks post-patch','Unix Admin confirms all services running','App health endpoint returns 200; no errors in app logs; DB connectivity confirmed','Scheduled outage'),
        T('QA Team','Smoke test post-patch','App confirmed running cleanly','P0 test cases pass; QA Lead signs off','Scheduled outage'),
        T('Change Manager','Close CAB ticket and update CMDB','All leads signed off; 24h post-patch monitoring clean','CMDB updated with new OS patch level; ticket closed','Working hours'),
      ];
    }
    if (isAPP) {
      return [
        T('Change Manager','Raise CAB change for middleware / app upgrade','Release notes reviewed; AppAdmin impact assessment complete','CAB approved; maintenance window confirmed','CAB meeting'),
        T('AppAdmin','Stage new middleware version in non-prod','CAB approved; new package downloaded and verified','New version installed in staging; configuration migrated; smoke test passed','Working hours'),
        T('QA Team','Full regression test on new middleware version in staging','AppAdmin confirms staging deployment complete','All P0 test cases pass; performance within baseline; QA Lead signs off','Working hours'),
        T('AppAdmin Lead','Drain LB pool member and stop service in production','Upgrade window active; LB team coordinated','Service drained; no active connections; service stopped cleanly','Scheduled outage'),
        T('AppAdmin','Apply upgrade in production and start service','Service stopped; upgrade package verified','New version running; health endpoint returns 200; no errors in app logs','Scheduled outage'),
        T('QA Team','Smoke test in production post-upgrade','AppAdmin confirms service running cleanly','Critical transactions pass; QA Lead signs off','Scheduled outage'),
        T('Change Manager','Close CAB ticket and update CMDB','All leads signed off','CMDB updated; ticket closed','Working hours'),
      ];
    }
  }

  // Generic update path
  return [
    T('Change Manager','Raise CAB change request','Impact assessment complete; rollback plan documented','CAB ticket approved; change window confirmed','CAB meeting'),
    T('Unix Admin','Apply patch / update in non-prod and verify','CAB approved; change package downloaded and checksummed','Patch applied in non-prod; service restarted cleanly; no errors detected','Working hours'),
    T('QA Team','Smoke test in non-prod after patch','Unix Admin confirms patch applied cleanly','P0 test cases pass; QA Lead signs off','Working hours'),
    T('Unix Admin','Apply patch / update in production during approved window','QA sign-off confirmed; production change window active','Patch applied; service healthy; monitoring green; no alerts','Scheduled outage'),
    T('Change Manager','Close change ticket and update CMDB','24h post-patch monitoring clean; all leads confirmed OK','CMDB updated with new patch level; ticket closed','Working hours'),
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
