// src/lib/infraMap.js
// Generates text-based infrastructure architecture maps from app state.
// Pure functions — no React, no external deps.

const W = 78; // inner content width (total line width = W + 4 with borders + spaces)
const L = 36; // left col inner width for 2-col layouts
const R = W - L - 3; // right col inner width

const pad = (s, n) => {
  const str = s == null ? '' : String(s);
  if (str.length >= n) return str.slice(0, n);
  return str + ' '.repeat(n - str.length);
};
const ctr = (s, n) => {
  const str = s == null ? '' : String(s);
  const sp = Math.max(0, n - str.length);
  return ' '.repeat(Math.floor(sp / 2)) + str + ' '.repeat(Math.ceil(sp / 2));
};
const trunc = (s, n) => {
  const str = s == null ? '' : String(s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
};
const bullet = (k, v) => v ? `● ${k}: ${trunc(String(v), 28)}` : '';
const bullets = (...pairs) => pairs.map(([k, v]) => bullet(k, v)).filter(Boolean).join('  ');
const dot = (k, v) => v ? `· ${k}: ${v}` : '';

// Line constructors
const TOP  = '╔' + '═'.repeat(W + 2) + '╗';
const BOT  = '╚' + '═'.repeat(W + 2) + '╝';
const DIV  = '╠' + '═'.repeat(W + 2) + '╣';
const DIV2T = '╠' + '═'.repeat(L + 2) + '╦' + '═'.repeat(R + 2) + '╣';
const DIV2M = '╠' + '═'.repeat(L + 2) + '╬' + '═'.repeat(R + 2) + '╣';
const DIV2B = '╠' + '═'.repeat(L + 2) + '╩' + '═'.repeat(R + 2) + '╣';
const DIV2I = '╟' + '─'.repeat(L + 2) + '╫' + '─'.repeat(R + 2) + '╢';

const r1 = (s)     => '║ ' + pad(trunc(s || '', W), W) + ' ║';
const rH = (s)     => '║ ' + ctr(s || '', W) + ' ║';
const r2 = (l, r)  => '║ ' + pad(trunc(l || '', L), L) + ' ║ ' + pad(trunc(r || '', R), R) + ' ║';
const rE = ()      => r1('');

// ─── Structural Architecture Map ────────────────────────────────────────────

export function buildStructuralMap(state) {
  const {
    ctx = {}, sysDesignData: d = {}, selInc = [], selUUM = [], customUUM = [],
    customInc = [], liveEolData = {}, requirements = {}, isBuilt, promoted,
    cabApproved, cabDeclined, phase2Active, rtmSigned
  } = state;

  const unix    = d.unix    || {};
  const web     = d.web     || {};
  const app     = d.app     || {};
  const db      = d.db      || {};
  const storage = d.storage || {};
  const backup  = d.backup  || {};
  const network = d.network || {};
  const security = d.security || {};

  const projectLabel = trunc(requirements.projectName || 'Infrastructure Project', 28);
  const envLabel     = requirements.envType || 'Production';
  const status = promoted ? 'PRODUCTION LIVE'
    : cabDeclined   ? 'CHANGE DECLINED'
    : cabApproved   ? 'CAB APPROVED'
    : rtmSigned     ? 'RTM SIGNED'
    : phase2Active  ? 'REMEDIATION ACTIVE'
    : isBuilt       ? 'HEALTHY'
    : 'NOT BUILT';

  const incCount   = selInc.length + (customInc?.length || 0);
  const uumCount   = selUUM.length;
  const customList = customUUM || [];

  const lines = [];
  lines.push(TOP);
  lines.push(rH(`INFRASTRUCTURE ARCHITECTURE MAP  ·  ${projectLabel}  ·  ${envLabel}`));

  // ── Compute ──────────────────────────────────────────────────────────────
  lines.push(DIV);
  lines.push(r1('  COMPUTE / HARDWARE'));
  const hwDetail = [
    ctx.hw || 'Not configured',
    unix.cpu  ? `CPU: ${unix.cpu}` : '',
    unix.ram  ? `RAM: ${unix.ram}` : '',
    unix.virt ? `Virt: ${unix.virt}` : '',
  ].filter(Boolean).join('  ·  ');
  lines.push(r1('  ' + trunc(hwDetail, W - 2)));

  // ── OS | App ─────────────────────────────────────────────────────────────
  lines.push(DIV2T);
  lines.push(r2('  OS / PLATFORM', '  APPLICATION RUNTIME'));
  lines.push(DIV2I);
  lines.push(r2('  ' + (ctx.os || 'Not configured'), '  ' + (ctx.app || 'Not configured')));

  const osRows = [
    unix.kernel_params && `● Kernel tuned`,
    unix.selinux       && `● SELinux: ${unix.selinux}`,
    unix.ntp_server    && `● NTP: ${unix.ntp_server}`,
    unix.patch_window  && `● Patch: ${unix.patch_window}`,
    unix.ulimits       && `● ulimits set`,
    unix.swap_config   && `● Swap: ${unix.swap_config}`,
  ].filter(Boolean);

  const appRows = [
    app.app_port       && `● Port: ${app.app_port}`,
    app.jvm_xmx        && `● Heap: ${app.jvm_xms || '?'} → ${app.jvm_xmx}`,
    app.thread_pool    && `● Thread pool: ${app.thread_pool}`,
    app.gc_policy      && `● GC: ${app.gc_policy}`,
    app.cache_provider && `● Cache: ${app.cache_provider}`,
    app.session_mgmt   && `● Session: ${app.session_mgmt}`,
  ].filter(Boolean);

  const maxRows = Math.max(osRows.length, appRows.length);
  for (let i = 0; i < maxRows; i++) {
    lines.push(r2('  ' + (osRows[i] || ''), '  ' + (appRows[i] || '')));
  }

  // ── DB | Web ─────────────────────────────────────────────────────────────
  lines.push(DIV2M);
  lines.push(r2('  DATABASE ENGINE', '  WEB / HTTP TIER'));
  lines.push(DIV2I);
  lines.push(r2('  ' + (ctx.db || 'Not configured'), '  TLS / HTTP Layer'));

  const dbRows = [
    db.listener_port && `● Port: ${db.listener_port}`,
    db.buf_pool      && `● Buffer pool: ${db.buf_pool}`,
    db.max_conn      && `● Max conn: ${db.max_conn}`,
    db.tde           && `● TDE: ${db.tde}`,
    db.replication   && `● Replication: ${db.replication}`,
    db.standby_lag   && `● Standby lag: ${db.standby_lag}`,
    db.archive_dest  && `● Archive: ${db.archive_dest}`,
  ].filter(Boolean);

  const webRows = [
    web.ssl_protocols  && `● TLS: ${web.ssl_protocols}`,
    web.waf            && `● WAF: ${web.waf}`,
    web.hsts           && `● HSTS: ${web.hsts}`,
    web.load_bal_algo  && `● LB: ${web.load_bal_algo}`,
    web.health_check_url && `● Health: ${web.health_check_url}`,
    web.cdn            && `● CDN: ${web.cdn}`,
  ].filter(Boolean);

  const maxDB = Math.max(dbRows.length, webRows.length);
  for (let i = 0; i < maxDB; i++) {
    lines.push(r2('  ' + (dbRows[i] || ''), '  ' + (webRows[i] || '')));
  }

  // ── Storage & Backup ──────────────────────────────────────────────────────
  lines.push(DIV2B);
  lines.push(r1('  STORAGE & BACKUP'));
  const storLine = [
    storage.raid_level  && `RAID: ${storage.raid_level}`,
    storage.lun_size    && `LUN: ${storage.lun_size}`,
    storage.iops_req    && `IOPS req: ${storage.iops_req}`,
    storage.multipath_mode && `Multipath: ${storage.multipath_mode}`,
    storage.thin_prov   && `Thin: ${storage.thin_prov}`,
    storage.fs_type     && `FS: ${storage.fs_type}`,
  ].filter(Boolean).join('  ·  ');
  if (storLine) lines.push(r1('  ' + trunc(storLine, W - 2)));

  const bakLine = [
    backup.backup_tool  && `Tool: ${backup.backup_tool}`,
    backup.rpo_hours    && `RPO: ${backup.rpo_hours}h`,
    backup.rto_hours    && `RTO: ${backup.rto_hours}h`,
    backup.offsite_target && `Offsite: ${backup.offsite_target}`,
    backup.immutable    && `Immutable: ${backup.immutable}`,
    backup.retention    && `Retention: ${backup.retention}`,
  ].filter(Boolean).join('  ·  ');
  if (bakLine) lines.push(r1('  ' + trunc(bakLine, W - 2)));

  // ── Network & Security ────────────────────────────────────────────────────
  lines.push(DIV);
  lines.push(r1('  NETWORK & SECURITY'));
  const netLine = [
    network.vlan_ids   && `VLANs: ${network.vlan_ids}`,
    network.bandwidth  && `Bandwidth: ${network.bandwidth}`,
    network.bond_mode  && `Bond: ${network.bond_mode}`,
    network.load_bal   && `LB: ${network.load_bal}`,
    network.fw_rules   && `Firewall: ${network.fw_rules} rules`,
    network.dns_servers && `DNS: ${network.dns_servers}`,
  ].filter(Boolean).join('  ·  ');
  if (netLine) lines.push(r1('  ' + trunc(netLine, W - 2)));

  const secLine = [
    security.compliance_framework && `Compliance: ${security.compliance_framework}`,
    security.mfa_required         && `MFA: ${security.mfa_required}`,
    security.siem_endpoint        && `SIEM: ${security.siem_endpoint}`,
    security.edr                  && `EDR: ${security.edr}`,
    security.ids_ips               && `IDS/IPS: ${security.ids_ips}`,
    security.patch_sla            && `Patch SLA: ${security.patch_sla}`,
  ].filter(Boolean).join('  ·  ');
  if (secLine) lines.push(r1('  ' + trunc(secLine, W - 2)));

  // ── Custom Components ─────────────────────────────────────────────────────
  const allCustom = [
    ...(customList.map(u => ({ label: u.short || u.txt || 'Custom', type: u.type || 'update', layers: u.layers || [] }))),
    ...(customInc || []).map(i => ({ label: i.short || i.code, type: 'incident', layers: i.layers || [] })),
  ];

  if (allCustom.length > 0) {
    lines.push(DIV);
    lines.push(r1('  CUSTOM COMPONENTS'));
    allCustom.slice(0, 8).forEach(c => {
      const layerTag = c.layers.length > 0 ? ` [${c.layers.join(', ')}]` : '';
      lines.push(r1(`  + ${trunc(c.label, 40)}${layerTag}  ▶ ${c.type}`));
    });
    if (allCustom.length > 8) lines.push(r1(`  … and ${allCustom.length - 8} more custom entries`));
  }

  // ── Lifecycle & Compatibility ──────────────────────────────────────────────
  const eolEntries = Object.entries(liveEolData || {}).filter(([, v]) => v && !v.error);
  if (eolEntries.length > 0) {
    lines.push(DIV);
    lines.push(r1('  LIFECYCLE & COMPATIBILITY'));
    eolEntries.forEach(([name, data]) => {
      const cycle = data.matchedCycle;
      if (!cycle) return;
      const eos    = cycle.support   || cycle.eol || '';
      const eol    = cycle.eol        || '';
      const now    = new Date();
      const eolD   = eol ? new Date(eol) : null;
      const eosD   = eos ? new Date(eos) : null;
      const daysEol = eolD ? Math.ceil((eolD - now) / 86400000) : null;
      const daysEos = eosD ? Math.ceil((eosD - now) / 86400000) : null;
      const status = eolD && daysEol < 0    ? '✗ EOL'
        : eosD && daysEos < 0              ? '⚠ EOS REACHED'
        : eolD && daysEol < 365            ? `⚠ EOL in ${Math.ceil(daysEol / 30)}mo`
        : eosD && daysEos < 180            ? `⚠ EOS in ${Math.ceil(daysEos / 30)}mo`
        : '✓ SUPPORTED';
      const ver = data.slug ? `(${data.slug} ${cycle.cycle || ''})` : '';
      const nameCol = trunc(`  ${name} ${ver}`, 42);
      const eolCol  = trunc(eol || eos || 'no data', 18);
      const statCol = status;
      lines.push(r1(`  ${pad(name, 24)} EOL: ${pad(eolCol, 14)} ${statCol}`));
    });
  }

  // ── Status bar ────────────────────────────────────────────────────────────
  lines.push(DIV);
  const statBar = [
    `● STATUS: ${status}`,
    incCount > 0 ? `${incCount} incident${incCount > 1 ? 's' : ''}` : null,
    uumCount > 0 ? `${uumCount} UUM change${uumCount > 1 ? 's' : ''}` : null,
    requirements.goLiveDate ? `Go-live: ${requirements.goLiveDate}` : null,
    requirements.slaTarget  ? `SLA: ${requirements.slaTarget}` : null,
  ].filter(Boolean).join('  ·  ');
  lines.push(r1('  ' + trunc(statBar, W - 2)));
  lines.push(BOT);

  return lines.join('\n');
}

// ─── Functional Flow Map ─────────────────────────────────────────────────────

export function buildFunctionalFlow(state) {
  const { ctx = {}, sysDesignData: d = {}, customUUM = [], requirements = {} } = state;
  const web     = d.web     || {};
  const app     = d.app     || {};
  const db      = d.db      || {};
  const backup  = d.backup  || {};
  const storage = d.storage || {};

  const lines = [];
  const W2 = W + 4;
  lines.push('╔' + '═'.repeat(W2 - 2) + '╗');
  lines.push('║' + ctr('FUNCTIONAL FLOW & DEPENDENCY MAP', W2 - 2) + '║');
  lines.push('╠' + '═'.repeat(W2 - 2) + '╣');

  const arrow = (from, proto, to) => {
    const left  = `  [${from}]`;
    const mid   = ` ──${proto}──► `;
    const right = `[${to}]`;
    return '║ ' + pad(left + mid + right, W2 - 4) + ' ║';
  };
  const note = (s) => '║ ' + pad('    ' + s, W2 - 4) + ' ║';
  const sep  = () => '║' + ' '.repeat(W2 - 2) + '║';

  const tls = web.ssl_protocols ? `TLS ${web.ssl_protocols}:443` : 'HTTPS:443';
  const lb  = web.load_bal_algo ? `LB(${web.load_bal_algo})` : 'Ingress';
  const appPort = app.app_port || '8080';
  const dbPort  = db.listener_port || '1521';
  const stor = storage.multipath_mode ? `FC/iSCSI (${storage.multipath_mode})` : 'FC/iSCSI';

  lines.push(arrow('Internet / User', tls, lb + ' / WAF'));
  if (web.waf) lines.push(note(`WAF: ${web.waf}${web.hsts ? `  HSTS: ${web.hsts}` : ''}`));
  lines.push(sep());
  lines.push(arrow(lb + ' / WAF', 'HTTP:' + appPort, ctx.app || 'App Runtime'));
  if (app.jvm_xmx)     lines.push(note(`Heap: ${app.jvm_xms || '?'} → ${app.jvm_xmx}  Threads: ${app.thread_pool || 'default'}`));
  if (app.cache_provider) lines.push(note(`Cache: ${app.cache_provider}`));
  lines.push(sep());
  lines.push(arrow(ctx.app || 'App Runtime', 'JDBC:' + dbPort, ctx.db || 'Database'));
  if (db.tde)          lines.push(note(`TDE: ${db.tde}  Replication: ${db.replication || 'standalone'}`));
  if (db.replication && db.replication.toLowerCase().includes('guard') || db.replication?.toLowerCase().includes('slave') || db.replication?.toLowerCase().includes('standby')) {
    lines.push(note(`Standby lag: ${db.standby_lag || 'not set'}`));
  }
  lines.push(sep());
  lines.push(arrow(ctx.db || 'Database', stor, 'Block Storage'));
  if (storage.raid_level) lines.push(note(`RAID: ${storage.raid_level}  LUN: ${storage.lun_size || '?'}  IOPS: ${storage.iops_req || '?'}`));
  lines.push(sep());

  if (backup.backup_tool) {
    lines.push(arrow('Block Storage', 'backup agent', backup.backup_tool));
    lines.push(note(`RPO: ${backup.rpo_hours || '?'}h  RTO: ${backup.rto_hours || '?'}h  Immutable: ${backup.immutable || 'n/a'}`));
    if (backup.offsite_target) lines.push(note(`Offsite: ${backup.offsite_target}`));
    lines.push(sep());
  }

  if (customUUM && customUUM.length > 0) {
    lines.push('║ ' + pad('  CUSTOM COMPONENT FLOWS (assumed, verify manually):', W2 - 4) + ' ║');
    customUUM.slice(0, 4).forEach(u => {
      const layers = u.layers || [];
      const from = layers[0] || 'app';
      const to   = layers[1] || layers[0] || 'platform';
      lines.push(note(`[${trunc(u.short || u.txt, 28)}] ──${u.type || 'update'}──► [${from} → ${to}]  ⚠ assumption`));
    });
    lines.push(sep());
  }

  lines.push('║' + ctr('All assumptions marked ⚠ — verify protocol/port/cipher details against actual config', W2 - 2) + '║');
  lines.push('╚' + '═'.repeat(W2 - 2) + '╝');

  return lines.join('\n');
}

// ─── Lifecycle & Compatibility Matrix ────────────────────────────────────────

export function buildCompatibilityMatrix(state) {
  const { ctx = {}, liveEolData = {}, customUUM = [], sysDesignData: d = {} } = state;
  const web = d.web || {};
  const security = d.security || {};

  const rows = [];

  // Core stack components
  const components = [
    { name: ctx.hw || 'Hardware', category: 'Compute' },
    { name: ctx.os || 'OS', category: 'Platform' },
    { name: ctx.app || 'Application', category: 'Runtime' },
    { name: ctx.db || 'Database', category: 'Data' },
  ].filter(c => c.name && c.name !== c.category);

  const now = new Date();

  components.forEach(comp => {
    const eolEntry = Object.entries(liveEolData || {}).find(([k]) =>
      k.toLowerCase().includes(comp.name.toLowerCase().split(' ')[0]) ||
      comp.name.toLowerCase().includes(k.toLowerCase().split(' ')[0])
    );

    let lifecycle = 'Unknown — check vendor';
    let breakRisks = '';

    if (eolEntry) {
      const [, data] = eolEntry;
      const cycle = data.matchedCycle;
      if (cycle) {
        const eolD = cycle.eol   ? new Date(cycle.eol)     : null;
        const eosD = cycle.support ? new Date(cycle.support) : null;
        const daysEol = eolD ? Math.ceil((eolD - now) / 86400000) : null;
        const daysEos = eosD ? Math.ceil((eosD - now) / 86400000) : null;

        if (eolD && daysEol < 0)        lifecycle = `✗ EOL reached (${cycle.eol})`;
        else if (eosD && daysEos < 0)   lifecycle = `⚠ EOS reached (${cycle.support})`;
        else if (eolD && daysEol < 365) lifecycle = `⚠ EOL in ${Math.ceil(daysEol / 30)}mo (${cycle.eol})`;
        else if (eolD)                  lifecycle = `✓ EOL ${cycle.eol}`;
        else                            lifecycle = `✓ Support active`;

        if (eolD && daysEol < 0)         breakRisks += 'No security patches · ';
        if (eosD && daysEos < 0)         breakRisks += 'No bugfix support · ';
        if (!cycle.lts && eolD && daysEol < 730) breakRisks += 'No LTS track · ';
      }
    }

    // TLS compatibility check
    if (comp.category === 'Platform' || comp.category === 'Runtime') {
      const tlsConf = web.ssl_protocols || '';
      if (tlsConf.includes('1.0') || tlsConf.includes('1.1')) {
        breakRisks += 'TLS 1.0/1.1 deprecated — PCI-DSS / NIST non-compliant · ';
      }
    }

    // Compliance cipher check
    if (comp.category === 'Security' || (security.compliance_framework && comp.category === 'Platform')) {
      const fw = security.compliance_framework || '';
      if (fw.includes('PCI') && !(web.ssl_protocols || '').includes('1.2') && !(web.ssl_protocols || '').includes('1.3')) {
        breakRisks += 'PCI-DSS requires TLS 1.2+ · ';
      }
    }

    rows.push({
      component: comp.name,
      lifecycle: lifecycle || 'Not checked',
      target: 'Vendor latest stable',
      risks: (breakRisks.slice(0, -3) || 'None identified'),
    });
  });

  // Custom UUM entries
  (customUUM || []).slice(0, 5).forEach(u => {
    const name = u.short || u.txt || 'Custom component';
    const eolEntry = Object.entries(liveEolData || {}).find(([k]) =>
      name.toLowerCase().includes(k.toLowerCase().split(' ')[0])
    );
    let lifecycle = 'Check vendor EOL page';
    if (eolEntry) {
      const cycle = eolEntry[1]?.matchedCycle;
      if (cycle?.eol) lifecycle = `EOL: ${cycle.eol}`;
    }
    rows.push({
      component: trunc(name, 30),
      lifecycle,
      target: u.type === 'migration' ? 'New platform post-migration' : 'Latest patch',
      risks: u.type === 'migration' ? 'Data migration risk · driver compat' : 'Check patch notes for breaking changes',
    });
  });

  if (rows.length === 0) return null;

  // Build markdown table
  const lines = [
    '| Component/OS | Current Lifecycle Status | Target State Compatibility | Breaking Risks & Cert/Cipher |',
    '|---|---|---|---|',
    ...rows.map(r => `| ${r.component} | ${r.lifecycle} | ${r.target} | ${r.risks} |`),
  ];

  return lines.join('\n');
}

// ─── Rule-based Mission Intel (4-section) ────────────────────────────────────
// Used as fallback when Groq is not configured.

export function buildRuleBasedMissionIntel(state) {
  const { ctx = {}, selInc = [], selUUM = [], customUUM = [], customInc = [],
          sysDesignData: d = {}, requirements = {}, liveEolData = {} } = state;

  const stack = [ctx.hw, ctx.os, ctx.app, ctx.db].filter(Boolean);
  const web = d.web || {};
  const security = d.security || {};
  const customEntries = [
    ...(customUUM || []).map(u => u.short || u.txt),
    ...(customInc || []).map(i => i.short || i.code),
  ].filter(Boolean);

  // 1. Context & Keyword Extraction
  const signals = [];
  if (stack.length) signals.push(`Stack detected: ${stack.join(' → ')}`);
  if (selInc.length)  signals.push(`${selInc.length} active incidents flagged — remediation in scope`);
  if (selUUM.length)  signals.push(`${selUUM.length} UUM changes planned (upgrade/migration/patch)`);
  if (customEntries.length) signals.push(`Custom components: ${customEntries.slice(0, 4).join(', ')}`);
  if (web.ssl_protocols) signals.push(`TLS: ${web.ssl_protocols} — check cipher compatibility with all stack layers`);
  if (security.compliance_framework) signals.push(`Compliance scope: ${security.compliance_framework}`);

  const eolWarn = Object.entries(liveEolData || {}).filter(([, v]) => {
    const c = v?.matchedCycle;
    if (!c || !c.eol) return false;
    return new Date(c.eol) < new Date(Date.now() + 365 * 86400000);
  }).map(([name]) => name);
  if (eolWarn.length) signals.push(`EOL approaching (< 12 months): ${eolWarn.join(', ')}`);

  // 2. RTM pointer
  const rtmNote = selInc.length > 0
    ? `${selInc.length} incident(s) require RTM rows — verify PASS/FAIL before CAB approval`
    : 'No active incidents — RTM rows map to planned UUM changes and design controls';

  // 3. Triple-layer summary
  const business = requirements.projectName
    ? `Deliver ${requirements.projectName} into ${requirements.envType || 'Production'} by ${requirements.goLiveDate || 'TBD'} within SLA ${requirements.slaTarget || 'not set'}.`
    : 'Define project name, environment type, go-live date and SLA in Phase 1 to complete the business layer.';

  const functional = stack.length
    ? `User traffic → Web/TLS layer → ${ctx.app || 'App'} runtime → ${ctx.db || 'DB'} engine → Block storage. Backup path: scheduled agent → offsite target.`
    : 'Complete stack selection in Phase 1 to generate the functional flow.';

  const technical = [
    ctx.os  && `Platform: ${ctx.os}`,
    web.ssl_protocols && `TLS: ${web.ssl_protocols}`,
    ctx.db  && `DB: ${ctx.db}`,
    security.compliance_framework && `Compliance: ${security.compliance_framework}`,
  ].filter(Boolean).join(' · ') || 'Fill System Design to generate technical layer detail.';

  // 4. Next steps
  const nextSteps = [];
  if (!selInc.length && !selUUM.length) nextSteps.push('Add incidents or UUM changes in Phase 2 to enrich the map with actual risk signals.');
  if (eolWarn.length)                   nextSteps.push(`Prioritise EOL remediation for: ${eolWarn.join(', ')} — plan upgrade or extended support.`);
  if (!web.ssl_protocols)               nextSteps.push('Set TLS protocol version in System Design → Web section to enable cipher compatibility checks.');
  if (!security.compliance_framework)   nextSteps.push('Specify compliance framework (PCI-DSS, ISO 27001, etc.) to surface regulatory gap alerts.');
  if (nextSteps.length < 2)             nextSteps.push('Enable Groq AI in settings to receive a deeper triple-layer architecture analysis and targeted delivery questions.');

  return {
    signals,
    rtmNote,
    business,
    functional,
    technical,
    nextSteps: nextSteps.slice(0, 2),
  };
}
