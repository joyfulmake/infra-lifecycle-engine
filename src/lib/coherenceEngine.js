import { ALL_INC } from './incidents.js';
import { ALL_UUM } from './uumItems.js';

function hasLayer(code, layer, customInc) {
  const inc = ALL_INC.find(i => i.code === code) || (customInc || []).find(c => c.code === code);
  return inc?.layers?.includes(layer) ?? false;
}

function countFilled(section) {
  if (!section) return 0;
  return Object.values(section).filter(v => v && String(v).trim()).length;
}

function totalFilled(sysDesignData) {
  return Object.values(sysDesignData || {}).reduce((n, sec) => n + countFilled(sec), 0);
}

function totalFields(sysDesignData) {
  return Object.values(sysDesignData || {}).reduce((n, sec) => n + Object.keys(sec || {}).length, 0);
}

export function runCoherenceChecks(state) {
  const alerts = [];
  const {
    isBuilt = false,
    designApplied = false,
    phase2Active = false,
    rtmSigned = false,
    selInc = [],
    selUUM = [],
    customInc = [],
    sysDesignData = {},
    requirements = {},
    rtmRows = {},
    roleAssignments = {},
    // Sign-off flow fields
    promoted = false,
    cabApproved = false,
    rtmStale = false,
    tasksStaleReason = null,
  } = state;

  if (!isBuilt) return alerts;

  // 1. Compliance field gap
  if (requirements.compliance && designApplied) {
    const cf = sysDesignData.security?.compliance_framework;
    if (!cf || !String(cf).trim()) {
      alerts.push({
        id: 'compliance_gap',
        severity: 'warn',
        tabs: ['design', 'exec'],
        message: `Compliance "${requirements.compliance}" set in Requirements but Security → Compliance Framework is empty.`,
        action: 'System Design → Security → Compliance Framework',
      });
    }
  }

  // 2. Tier 1 DR without RPO/RTO
  if (designApplied && requirements.drTier === 'Tier 1') {
    const rpo = sysDesignData.backup?.rpo_hours;
    const rto = sysDesignData.backup?.rto_hours;
    if ((!rpo || !String(rpo).trim()) || (!rto || !String(rto).trim())) {
      alerts.push({
        id: 'dr_backup_gap',
        severity: 'warn',
        tabs: ['design'],
        message: 'Tier 1 DR selected but Backup/DR section is missing RPO and/or RTO targets.',
        action: 'System Design → Backup/DR → RPO (hours) and RTO (hours)',
      });
    }
  }

  // 3. Security incidents with sparse security design
  if (designApplied && selInc.length > 0) {
    const secIncs = selInc.filter(c => hasLayer(c, 'security', customInc));
    if (secIncs.length > 0) {
      const secFilled = countFilled(sysDesignData.security);
      if (secFilled < 4) {
        alerts.push({
          id: 'security_incident_gap',
          severity: 'warn',
          tabs: ['design'],
          message: `${secIncs.length} security-related incident(s) selected but Security design section has only ${secFilled} field(s) filled.`,
          action: 'System Design → Security — review hardening, SIEM, and compliance fields',
        });
      }
    }
  }

  // 4. Network incidents with sparse network design
  if (designApplied && selInc.length > 0) {
    const netIncs = selInc.filter(c => hasLayer(c, 'network', customInc));
    if (netIncs.length > 0) {
      const netFilled = countFilled(sysDesignData.network);
      if (netFilled < 3) {
        alerts.push({
          id: 'network_incident_gap',
          severity: 'info',
          tabs: ['design'],
          message: `${netIncs.length} network-related incident(s) selected but Network design section has only ${netFilled} field(s) filled.`,
          action: 'System Design → Network — add VLAN IDs, bandwidth, firewall rules',
        });
      }
    }
  }

  // 5. High SLA with no monitoring agent
  if (designApplied && requirements.sla) {
    const slaNum = parseFloat(requirements.sla);
    if (slaNum >= 99.99 && !sysDesignData.unix?.monitoring_agent?.trim()) {
      alerts.push({
        id: 'sla_monitoring_gap',
        severity: 'warn',
        tabs: ['design'],
        message: `${requirements.sla}% SLA requires a monitoring agent — Unix/OS section is missing it.`,
        action: 'System Design → Unix/OS → Monitoring Agent',
        fix: [
          { section: 'unix', field: 'monitoring_agent', value: 'Prometheus + Node Exporter + Alertmanager', label: 'monitoring_agent → Prometheus stack' },
          { section: 'unix', field: 'syslog_server',    value: 'rsyslog → centralised SIEM', label: 'syslog_server → centralised SIEM' },
        ],
        fixLabel: 'Add Tier-1 monitoring stack',
      });
    }
  }

  // 6. Design very sparse after applied
  if (designApplied) {
    const tot = totalFields(sysDesignData);
    const fil = totalFilled(sysDesignData);
    const pct = tot > 0 ? Math.round((fil / tot) * 100) : 0;
    if (pct < 8) {
      alerts.push({
        id: 'design_sparse',
        severity: 'info',
        tabs: ['design'],
        message: `Design applied but only ${pct}% of fields are populated (${fil}/${tot}). Key config areas may be incomplete.`,
        action: 'Use AI Fill or manually populate System Design sections before Phase 2',
      });
    }
  }

  // 7. Phase 2 active but no incidents or UUM — unusual
  if (phase2Active && selInc.length === 0 && selUUM.length === 0) {
    alerts.push({
      id: 'empty_phase2',
      severity: 'info',
      tabs: ['exec'],
      message: 'Phase 2 active with no incidents or UUM items selected — unusual for a production change.',
      action: 'Add incidents / UUM items in the Executive Summary tab',
    });
  }

  // 8. RTM FAIL/BLOCKED rows — blocks closure
  if (phase2Active) {
    const failCount = Object.values(rtmRows).filter(v => v === 'FAIL' || v === 'BLOCKED').length;
    if (failCount > 0) {
      alerts.push({
        id: 'rtm_fails',
        severity: 'warn',
        tabs: ['closure', 'rtm'],
        message: `${failCount} RTM row(s) are FAIL or BLOCKED — must be resolved before closure.`,
        action: 'RTM tab → resolve failing rows',
      });
    }
  }

  // 9. Critical roles not assigned
  if (phase2Active) {
    const CRITICAL = ['Unix Admin', 'DB Admin', 'SecOps'];
    const missing = CRITICAL.filter(role => !roleAssignments[role]?.email?.trim());
    if (missing.length > 0) {
      alerts.push({
        id: 'roles_missing',
        severity: 'info',
        tabs: ['roles'],
        message: `Critical role(s) not yet assigned: ${missing.join(', ')}.`,
        action: 'Roles tab → assign email contacts for these roles',
      });
    }
  }

  // 10. Many RTM rows still PENDING
  if (phase2Active && !rtmSigned) {
    const totalRows = 12 + selInc.length + selUUM.length;
    const reviewed = Object.keys(rtmRows).length;
    const pending = totalRows - reviewed;
    if (pending > Math.ceil(totalRows * 0.5) && totalRows > 4) {
      alerts.push({
        id: 'rtm_pending',
        severity: 'info',
        tabs: ['rtm'],
        message: `${pending} of ${totalRows} RTM rows not yet reviewed.`,
        action: 'RTM tab → work through all rows before sign-off',
      });
    }
  }

  // 11. Storage incidents with sparse storage design
  if (designApplied && selInc.length > 0) {
    const storIncs = selInc.filter(c => hasLayer(c, 'storage', customInc));
    if (storIncs.length > 1) {
      const storFilled = countFilled(sysDesignData.storage);
      if (storFilled < 3) {
        alerts.push({
          id: 'storage_incident_gap',
          severity: 'info',
          tabs: ['design'],
          message: `${storIncs.length} storage-related incident(s) selected but Storage design section has only ${storFilled} field(s) filled.`,
          action: 'System Design → Storage — add LUN size, RAID level, snapshot policy',
        });
      }
    }
  }

  // 12a. Gantt tasks changed after RTM was signed
  if (rtmSigned && state.tasksStaleReason) {
    alerts.push({
      id: 'rtm_signed_tasks_stale',
      severity: 'warn',
      tabs: ['gantt', 'rtm'],
      message: 'RTM was signed but Gantt tasks have since changed — implementation scope may have drifted. Regenerate tasks and re-verify RTM rows before proceeding.',
      action: 'Gantt → Regenerate tasks → RTM → re-verify all rows',
    });
  }

  // 12b. Live (promoted) with stale RTM — potential rollback scenario
  if (state.promoted && state.rtmStale) {
    alerts.push({
      id: 'post_live_rtm_stale',
      severity: 'warn',
      tabs: ['exec', 'rtm', 'closure'],
      message: 'System is LIVE but RTM has become stale — changes were made after go-live. If service is degraded or acceptance criteria failed, execute rollback plan immediately.',
      action: 'Closure tab → Rollback plan | RTM tab → re-verify all rows',
    });
  }

  // 12c. Cutover possible but Gantt tasks are stale — implementation may be incomplete
  if (state.rtmSigned && state.cabApproved && state.tasksStaleReason && !state.promoted) {
    alerts.push({
      id: 'cutover_ready_tasks_stale',
      severity: 'warn',
      tabs: ['gantt'],
      message: 'Ready to cut over but Gantt tasks are stale — verify all implementation steps are complete before going live.',
      action: 'Gantt → Regenerate and review task completion before cutover',
    });
  }

  // 12. Live EOL alerts from endoflife.date API
  const liveEolData = state.liveEolData || {};
  const liveEolEntries = Object.entries(liveEolData);
  if (liveEolEntries.length > 0) {
    const today = new Date();
    function liveStatus(cycle) {
      if (!cycle) return 'unknown';
      const eolDate = cycle.eol === true ? new Date('1970-01-01') :
        cycle.eol === false ? null : cycle.eol ? new Date(cycle.eol) : null;
      const eosDate = cycle.support === false ? new Date('1970-01-01') :
        (typeof cycle.support === 'string' ? new Date(cycle.support) : null);
      if (eolDate && eolDate < today) return 'eol';
      if (eosDate && eosDate < today) return 'eos';
      const yr = 365 * 24 * 60 * 60 * 1000;
      if (eolDate && (eolDate - today) < yr) return 'eos_soon';
      if (eosDate && (eosDate - today) < yr) return 'eos_soon';
      return 'active';
    }

    const eolComponents = liveEolEntries
      .filter(([, d]) => liveStatus(d.matchedCycle) === 'eol')
      .map(([name]) => name);
    const eosSoonComponents = liveEolEntries
      .filter(([, d]) => ['eos_soon', 'eos'].includes(liveStatus(d.matchedCycle)))
      .map(([name]) => name);

    if (eolComponents.length > 0) {
      alerts.push({
        id: 'live_eol_detected',
        severity: 'warn',
        tabs: ['cmdb', 'exec', 'design'],
        message: `Live API confirms ${eolComponents.length} stack component(s) are End of Life: ${eolComponents.slice(0, 2).join(', ')}${eolComponents.length > 2 ? ` +${eolComponents.length - 2} more` : ''}.`,
        action: 'CMDB tab for detailed lifecycle report',
      });
    }
    if (eosSoonComponents.length > 0 && !eolComponents.length) {
      alerts.push({
        id: 'live_eos_soon',
        severity: 'info',
        tabs: ['cmdb'],
        message: `${eosSoonComponents.length} component(s) approaching end-of-support in the next 12 months per live API.`,
        action: 'CMDB tab for lifecycle planning',
      });
    }
  }

  // ── Check 13: TLS cipher compatibility ──────────────────────────────────────
  {
    const tlsConf = (state.sysDesignData?.web?.ssl_protocols || '').toLowerCase();
    const compliance = (state.sysDesignData?.security?.compliance_framework || '').toUpperCase();
    const hasTls10 = tlsConf.includes('1.0') || tlsConf.includes('tls1') && !tlsConf.includes('1.2');
    const hasTls11 = tlsConf.includes('1.1');
    const missingTls12 = tlsConf && !tlsConf.includes('1.2') && !tlsConf.includes('1.3');
    const pciScope = compliance.includes('PCI');

    if (hasTls10 || hasTls11) {
      alerts.push({
        id: 'tls_deprecated',
        severity: 'warn',
        tabs: ['design', 'diagram', 'exec'],
        message: `TLS 1.0/1.1 configured — deprecated by NIST (2024) and prohibited under PCI-DSS v4. Remove and enforce TLS 1.2+ only.`,
        action: 'System Design → Web section',
        fix: [
          { section: 'web', field: 'ssl_protocols', value: 'TLSv1.2 TLSv1.3', label: 'ssl_protocols → TLSv1.2 TLSv1.3' },
          { section: 'web', field: 'ssl_ciphers',   value: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-CHACHA20-POLY1305', label: 'ssl_ciphers → strong ECDHE suite' },
          { section: 'web', field: 'hsts',          value: 'max-age=31536000; includeSubDomains; preload', label: 'hsts → max-age 1yr + preload' },
        ],
        fixLabel: 'Apply NIST-compliant TLS 1.2/1.3 config',
      });
    } else if (pciScope && missingTls12) {
      alerts.push({
        id: 'tls_pci_gap',
        severity: 'warn',
        tabs: ['design', 'diagram'],
        message: `PCI-DSS in scope but TLS protocol version not confirmed as 1.2+. Set ssl_protocols explicitly.`,
        action: 'System Design → Web → TLS Protocols',
        fix: [
          { section: 'web', field: 'ssl_protocols', value: 'TLSv1.2 TLSv1.3', label: 'ssl_protocols → TLSv1.2 TLSv1.3' },
          { section: 'web', field: 'ssl_ciphers',   value: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256', label: 'ssl_ciphers → PCI-approved ciphers' },
        ],
        fixLabel: 'Set PCI-DSS v4 compliant TLS config',
      });
    }
  }

  // ── Check 14: Custom entry compatibility signals ──────────────────────────
  {
    const customUUM = state.customUUM || [];
    const liveEol   = state.liveEolData || {};
    const customWithEolRisk = customUUM.filter(u => {
      const name = (u.short || u.txt || '').toLowerCase();
      return Object.entries(liveEol).some(([k, v]) => {
        if (!v?.matchedCycle?.eol) return false;
        const daysLeft = (new Date(v.matchedCycle.eol) - Date.now()) / 86400000;
        return k.toLowerCase().split(' ').some(w => w.length > 3 && name.includes(w)) && daysLeft < 365;
      });
    });
    if (customWithEolRisk.length > 0) {
      alerts.push({
        id: 'custom_entry_eol',
        severity: 'warn',
        tabs: ['diagram', 'cmdb'],
        message: `Custom component "${customWithEolRisk[0].short || customWithEolRisk[0].txt}" matches a stack entry with EOL < 12 months — verify upgrade path before committing to this architecture.`,
        action: 'Infra Diagram → Mission Intel for compatibility analysis',
      });
    }

    // Flag migration-type custom entries that have no Phase 2 UUM equivalent
    const migrationEntries = customUUM.filter(u => u.type === 'migration');
    if (migrationEntries.length > 0 && !state.phase2Active) {
      alerts.push({
        id: 'custom_migration_no_phase2',
        severity: 'info',
        tabs: ['diagram'],
        message: `${migrationEntries.length} custom migration task(s) defined — inject Phase 2 in the sidebar to add them to the Gantt, RTM, and Matrix.`,
        action: 'Phase 2 injection in left sidebar',
      });
    }
  }

  return alerts;
}
