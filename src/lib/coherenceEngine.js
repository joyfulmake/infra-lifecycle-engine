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

  return alerts;
}
