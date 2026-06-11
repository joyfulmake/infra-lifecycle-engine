import XLSX from 'xlsx-js-style';
import { ALL_INC, FIXES } from './incidents.js';
import { ALL_UUM } from './uumItems.js';
import { getRealTasks } from './realTasks.js';
import { getIncidentFixTasks } from './incidentFixTasks.js';
import { buildDesignTasks } from './designTasks.js';
import { DESIGN_SECTIONS, FIELD_LABELS } from '../store/useStore.js';
import { getEolInfo } from './eolData.js';
import { buildStructuralMap, buildFunctionalFlow, buildRuleBasedMissionIntel } from './infraMap.js';

// ── Colour palette ─────────────────────────────────────────────────────────
const C = {
  NAVY:    'FF1A2E4A',  // dark navy header
  TEAL:    'FF0D9488',  // teal accent
  AMBER:   'FFB45309',  // amber / warning
  RED:     'FFB91C1C',  // red / critical
  GREEN:   'FF15803D',  // green / pass
  BLUE:    'FF1D4ED8',  // blue / info
  PURPLE:  'FF6D28D9',  // purple / milestone

  H_NAVY:  'FF1A2E4A',  // header fill
  H_TEAL:  'FF0F766E',
  H_AMBER: 'FFFEF3C7',
  H_RED:   'FFFEF2F2',
  H_GREEN: 'FFF0FDF4',
  H_BLUE:  'FFEFF6FF',
  H_GRAY:  'FFF8FAFC',

  ROW_ALT: 'FFF8FAFC',  // alternating row
  ROW_STD: 'FFFFFFFF',  // standard row
  WHITE:   'FFFFFFFF',
  SLATE:   'FF64748B',
  BORDER:  'FFE2E8F0',
};

// ── Style builders ─────────────────────────────────────────────────────────
function s(fill, fontColor = C.WHITE, bold = false, sz = 10, border = true, hcenter = false) {
  const base = {
    font: { name: 'Calibri', sz, bold, color: { rgb: fontColor } },
    alignment: { wrapText: true, vertical: 'center', ...(hcenter ? { horizontal: 'center' } : {}) },
  };
  if (fill) base.fill = { patternType: 'solid', fgColor: { rgb: fill } };
  if (border) base.border = {
    top:    { style: 'thin', color: { rgb: C.BORDER } },
    bottom: { style: 'thin', color: { rgb: C.BORDER } },
    left:   { style: 'thin', color: { rgb: C.BORDER } },
    right:  { style: 'thin', color: { rgb: C.BORDER } },
  };
  return base;
}

const ST = {
  H1:     s(C.H_NAVY, C.WHITE, true, 12),       // main title row
  H2:     s(C.H_TEAL, C.WHITE, true, 10),       // section header
  AMBER_H: s(C.AMBER, C.WHITE, true, 10),
  RED_H:   s(C.RED, C.WHITE, true, 10),
  GREEN_H: s(C.GREEN, C.WHITE, true, 10),
  BLUE_H:  s(C.BLUE, C.WHITE, true, 10),
  LABEL:  s(C.H_GRAY, '334155', true, 9),       // key column
  BODY:   s(C.ROW_STD, '1E293B', false, 9),
  BODY_A: s(C.ROW_ALT, '1E293B', false, 9),     // alternating
  PASS:   s(C.H_GREEN, C.GREEN, true, 9),
  FAIL:   s(C.H_RED, C.RED, true, 9),
  AMBER_V: s(C.H_AMBER, C.AMBER, true, 9),      // PENDING / warning value
  BOLD_L: s(C.H_GRAY, '0F172A', true, 9),
  SUB_H:  s('FFE2E8F0', '475569', true, 9),     // sub-section header
  BLANK:  s(null, C.WHITE, false, 9, false),
};

// Build a cell object
function c(value, style) {
  const t = typeof value === 'number' ? 'n' : 's';
  return { v: value ?? '', t, s: style || ST.BODY };
}

// Return a copy of style with horizontal center alignment (for short values, codes, numbers)
function ctd(style) {
  return { ...style, alignment: { ...(style.alignment || {}), horizontal: 'center', vertical: 'center', wrapText: true } };
}

// Write a row of cells into a sheet at row `r`
function writeRow(ws, cells, r, defaultStyle) {
  cells.forEach((cell, col) => {
    const addr = XLSX.utils.encode_cell({ r, c: col });
    if (cell && typeof cell === 'object' && 's' in cell) {
      ws[addr] = cell;
    } else {
      ws[addr] = c(cell, defaultStyle || ST.BODY);
    }
  });
}

// Sheet builder that tracks row index for dynamic merges
function sheetBuilder(cols) {
  const rows = [];
  const merges = [];

  function row(cells) { rows.push(cells); }

  function headerRow(text, style, spanCols) {
    rows.push([c(text, style), ...Array(spanCols - 1).fill('')]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: spanCols - 1 } });
  }

  function build() {
    const ws = buildSheet(rows);
    ws['!cols'] = cols;
    if (merges.length) ws['!merges'] = [...(ws['!merges'] || []), ...merges];
    return ws;
  }

  return { row, headerRow, build, rows, merges };
}

function buildSheet(rows) {
  const ws = {};
  const ref = { s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 0 } };
  rows.forEach((row, r) => {
    row.forEach((cell, col) => {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      if (cell && typeof cell === 'object' && 's' in cell) {
        ws[addr] = cell;
      } else {
        ws[addr] = c(cell ?? '', ST.BODY);
      }
      if (col > ref.e.c) ref.e.c = col;
    });
  });
  ref.e.r = rows.length - 1;
  ws['!ref'] = XLSX.utils.encode_range(ref);
  return ws;
}

function statusStyle(status) {
  if (status === 'PASS' || status === 'VERIFIED' || status === 'RESOLVED' || status === 'COMPLETED' || status === 'APPROVED') return ctd(ST.PASS);
  if (status === 'FAIL' || status === 'FAILED' || status === 'ACTIVE' || status === 'CRITICAL' || status === 'BLOCKED') return ctd(ST.FAIL);
  if (status === 'PENDING' || status === 'PENDING APPROVAL' || status === 'SCHEDULED') return ctd(ST.AMBER_V);
  return ctd(ST.BODY);
}

const BUFFER = 1.3;

function addWorkingHours(startDate, hours, hpd = 8) {
  const d = new Date(startDate);
  let remaining = Math.ceil(hours);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining -= hpd;
  }
  return d;
}

function excelCalcDates(tasks, startDateStr, hpd = 8, durKey = 'duration_hours') {
  if (!startDateStr) return tasks.map(() => ({ start: '—', end: '—', buffered: '—' }));
  let cursor = new Date(startDateStr);
  return tasks.map(t => {
    const raw = t[durKey] || t.est_hours || t.hours || 2;
    const buffered = Math.ceil(raw * BUFFER);
    const start = cursor.toISOString().slice(0, 10);
    cursor = addWorkingHours(cursor, buffered, hpd);
    const end = cursor.toISOString().slice(0, 10);
    return { start, end, buffered };
  });
}

export function exportExcel(state) {
  const {
    ctx, selInc, selUUM, selFix, promoted, cabApproved, rtmSigned,
    sysDesignData, sdAiTasks, requirements, emergencyChanges,
    customInc = [], customUUM = [],
    rtmRows = {}, liveEolData = {},
    isBuilt = true, phase2Active = false,
    cabDeclined = false, rtmStale = false,
    selRegions,
    fullExport = false,  // Pro+ gets CMDB, Gantt, System Design, Closure Summary
  } = state;

  const wb = XLSX.utils.book_new();
  const projName = requirements.projectName || 'Infrastructure Lifecycle Project';
  const today = new Date().toISOString().slice(0, 10);

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 1: Executive Summary
  // ══════════════════════════════════════════════════════════════════════════
  {
    const ws = buildSheet([
      [c(projName + ' — Executive Summary', ST.H1), '', '', ''],
      [c('Generated: ' + today, ST.SUB_H), '', '', ''],
      ['', '', '', ''],
      [c('PROJECT OVERVIEW', ST.H2), '', '', ''],
      [c('Field', ST.LABEL), c('Value', ST.LABEL), c('Field', ST.LABEL), c('Value', ST.LABEL)],
      [c('Project Name', ST.LABEL), c(requirements.projectName || '—', ST.BODY), c('Environment', ST.LABEL), c(requirements.envType || '—', ST.BODY)],
      [c('Go-Live Date', ST.LABEL), c(requirements.goLiveDate || 'TBD', ST.BODY), c('SLA Target', ST.LABEL), c((requirements.sla || '99.9') + '%', ST.BODY)],
      [c('Compliance', ST.LABEL), c(requirements.compliance || '—', ST.BODY), c('DR Tier', ST.LABEL), c(requirements.drTier || 'Tier 1', ST.BODY)],
      [c('Load Profile', ST.LABEL), c(requirements.loadProfile || '—', ST.BODY), c('Data Volume', ST.LABEL), c(requirements.dataVolume || '—', ST.BODY)],
      [c('Constraints', ST.LABEL), c(requirements.constraints || 'None', ST.BODY), '', ''],
      ['', '', '', ''],
      [c('TECHNOLOGY STACK', ST.H2), '', '', ''],
      [c('Hardware', ST.LABEL), c(ctx.hw || '—', ST.BODY), c('Operating System', ST.LABEL), c(ctx.os || '—', ST.BODY)],
      [c('Database', ST.LABEL), c(ctx.db || '—', ST.BODY), c('Application Tier', ST.LABEL), c(ctx.app || '—', ST.BODY)],
      ['', '', '', ''],
      [c('PROJECT STATUS DASHBOARD', ST.H2), '', '', ''],
      [c('Gate', ST.LABEL), c('Status', ST.LABEL), c('Items', ST.LABEL), c('Notes', ST.LABEL)],
      [c('Active Incidents', ST.LABEL), c(selInc.length > 0 ? 'ACTIVE' : 'NONE', selInc.length > 0 ? ST.FAIL : ST.PASS), c(selInc.length, ST.BODY), c(selInc.length + ' incident(s) in scope', ST.BODY)],
      [c('UUM Items', ST.LABEL), c(selUUM.length > 0 ? 'SCHEDULED' : 'NONE', selUUM.length > 0 ? ST.AMBER_V : ST.PASS), c(selUUM.length, ST.BODY), c(selUUM.length + ' UUM item(s) in scope', ST.BODY)],
      [c('CAB Approval', ST.LABEL), c(cabApproved ? 'APPROVED' : 'PENDING', cabApproved ? ST.PASS : ST.AMBER_V), '', c(cabApproved ? 'Change authorised' : 'Awaiting CAB review', ST.BODY)],
      [c('RTM Sign-Off', ST.LABEL), c(rtmSigned ? 'SIGNED' : 'PENDING', rtmSigned ? ST.PASS : ST.AMBER_V), '', c(rtmSigned ? 'QA Lead signed off' : 'Review in progress', ST.BODY)],
      [c('Production Status', ST.LABEL), c(promoted ? 'PROMOTED' : 'PENDING', promoted ? ST.PASS : ST.AMBER_V), '', c(promoted ? 'System live in production' : 'Awaiting cutover', ST.BODY)],
    ]);
    ws['!cols'] = [{ width: 28 }, { width: 38 }, { width: 28 }, { width: 38 }];
    ws['!rows'] = [{ hpx: 24 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 3 } },
      { s: { r: 15, c: 0 }, e: { r: 15, c: 3 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Executive Summary');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 2: Infrastructure Topology Diagram
  // ══════════════════════════════════════════════════════════════════════════
  {
    const DGM = {
      BOX:    s('FF1E3A5F', C.WHITE, true, 10),
      BOX_T:  s(C.H_TEAL, C.WHITE, true, 10),
      BOX_A:  s('FFFBBF24', '1E293B', true, 10),
      BOX_R:  s('FFFCA5A5', C.RED, true, 10),
      BOX_G:  s('FF86EFAC', C.GREEN, true, 10),
      ARROW:  s(null, '94A3B8', false, 14, false),
      BLANK:  s(null, C.WHITE, false, 10, false),
      DETAIL: s('FFF8FAFC', '334155', false, 9),
      DH:     s('FFE2E8F0', '0F172A', true, 9),
    };
    const rows = [
      [c(projName + ' — Infrastructure Topology Diagram', ST.H1), '', '', '', '', ''],
      ['', '', '', '', '', ''],
      [c('INTERNET / EXTERNAL CLIENTS', DGM.BOX), '', '', '', c('LEGEND', DGM.DH), ''],
      [c('           ▼', DGM.ARROW), '', '', '', c('Dark Blue', DGM.BOX), c('Security / External Layer', DGM.DETAIL)],
      [c('CDN / WAF  (' + (ctx.hw?.includes('Cloud') ? 'Cloud-native WAF' : 'Enterprise WAF') + ')', DGM.BOX_T), '', '', '', c('Teal', DGM.BOX_T), c('Presentation / CDN / Load Balancer', DGM.DETAIL)],
      [c('           ▼', DGM.ARROW), '', '', '', c('Amber', DGM.BOX_A), c('Application Tier', DGM.DETAIL)],
      [c('LOAD BALANCER  (' + (ctx.app?.toLowerCase().includes('nginx') ? 'NGINX' : 'F5 / HAProxy') + ')', DGM.BOX_T), '', '', '', c('Green', DGM.BOX_G), c('Database / Storage Tier', DGM.DETAIL)],
      [c('           ▼', DGM.ARROW), '', '', '', c('Red bg', DGM.BOX_R), c('Warning / Risk / Incident tier', DGM.DETAIL)],
      [c('WEB TIER  (' + (ctx.app || 'Apache / NGINX / IIS') + ')', DGM.BOX_A), '', '', '', '', ''],
      [c('           ▼', DGM.ARROW), '', '', '', c('ACTIVE INCIDENTS (' + selInc.length + ')', selInc.length > 0 ? DGM.BOX_R : DGM.DETAIL), ''],
      [c('APPLICATION TIER  (' + (ctx.app || 'JBoss / Tomcat / WebLogic') + ')', DGM.BOX_A), '', '', '', ...selInc.slice(0, 2).map(code => {
        const inc = ALL_INC.find(i => i.code === code);
        return inc ? c(inc.short + ': ' + inc.txt.substring(inc.short.length + 2, 50), DGM.BOX_R) : c('', DGM.BLANK);
      }).concat(Array(2).fill(c('', DGM.BLANK))).slice(0, 2)],
      [c('           ▼', DGM.ARROW), '', '', '', ...selInc.slice(2, 4).map(code => {
        const inc = ALL_INC.find(i => i.code === code);
        return inc ? c(inc.short + ': ' + inc.txt.substring(inc.short.length + 2, 50), DGM.BOX_R) : c('', DGM.BLANK);
      }).concat(Array(2).fill(c('', DGM.BLANK))).slice(0, 2)],
      [c('DATABASE TIER  (' + (ctx.db || 'Oracle / PostgreSQL / DB2') + ')', DGM.BOX_G), '', '', '', c('UUM ITEMS SCHEDULED (' + selUUM.length + ')', selUUM.length > 0 ? DGM.BOX_A : DGM.DETAIL), ''],
      [c('           ▼', DGM.ARROW), '', '', '', ...selUUM.slice(0, 2).map(code => {
        const uum = ALL_UUM.find(u => u.code === code);
        return uum ? c(uum.short + ' [' + uum.type.toUpperCase() + ']: ' + uum.txt.substring(uum.short.length + 2, 45), DGM.BOX_A) : c('', DGM.BLANK);
      }).concat(Array(2).fill(c('', DGM.BLANK))).slice(0, 2)],
      [c('STORAGE  (' + (sysDesignData?.storage?.san_fabric || 'SAN / NFS / NVMe-oF') + ')', DGM.BOX_G), '', '', '', '', ''],
      [c('           ▼', DGM.ARROW), '', '', '', c('PLATFORM', DGM.DH), ''],
      [c('BACKUP / DR  (' + (sysDesignData?.backup?.backup_tool || 'RMAN / Veeam / CommVault') + ')', DGM.BOX_T), '', '', '', c('Hardware', DGM.DETAIL), c(ctx.hw || '—', DGM.DETAIL)],
      ['', '', '', '', c('OS', DGM.DETAIL), c(ctx.os || '—', DGM.DETAIL)],
      [c('SECURITY CONTROLS (ALL LAYERS)', DGM.BOX), '', '', '', c('Database', DGM.DETAIL), c(ctx.db || '—', DGM.DETAIL)],
      [c(
        'SIEM: ' + (sysDesignData?.security?.siem_endpoint || 'Splunk/QRadar') +
        '  |  IDS/IPS: ' + (sysDesignData?.security?.ids_ips || 'Suricata') +
        '  |  EDR: ' + (sysDesignData?.security?.edr || 'CrowdStrike') +
        '  |  PAM: ' + (sysDesignData?.security?.pam || 'CyberArk'),
        DGM.DETAIL
      ), '', '', '', c('Application', DGM.DETAIL), c(ctx.app || '—', DGM.DETAIL)],
    ];
    const ws = buildSheet(rows);
    ws['!cols'] = [{ width: 50 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 30 }, { width: 45 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      ...[2, 4, 6, 8, 10, 12, 14, 16, 18, 19].map(r => ({ s: { r, c: 0 }, e: { r, c: 3 } })),
      { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } },
      { s: { r: 9, c: 0 }, e: { r: 9, c: 3 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 3 } },
      { s: { r: 13, c: 0 }, e: { r: 13, c: 3 } },
      { s: { r: 15, c: 0 }, e: { r: 15, c: 3 } },
      { s: { r: 17, c: 0 }, e: { r: 17, c: 3 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Infrastructure Diagram');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 3: Platform Topology
  // ══════════════════════════════════════════════════════════════════════════
  {
    const rows = [
      [c('Platform Topology — Component Register', ST.H1), '', '', '', ''],
      [c('Layer', ST.H2), c('Component / Version', ST.H2), c('Configuration Detail', ST.H2), c('Status', ST.H2), c('Notes', ST.H2)],
    ];
    const layers = [
      ['Hardware', ctx.hw, sysDesignData?.unix?.cpu + ' CPU | ' + sysDesignData?.unix?.ram + ' RAM', 'Provisioned', sysDesignData?.unix?.hostname_scheme || ''],
      ['Operating System', ctx.os, 'Kernel: ' + (sysDesignData?.unix?.kernel_params || '—') + ' | Patch: ' + (sysDesignData?.unix?.patch_window || '—'), 'Provisioned', sysDesignData?.unix?.monitoring_agent || ''],
      ['Web / HTTP', ctx.app?.includes('NGINX') || ctx.app?.includes('Apache') ? ctx.app : (sysDesignData?.web?.notes || 'See app tier'), sysDesignData?.web?.ssl_protocols + ' | Max conn: ' + sysDesignData?.web?.max_conn, 'Provisioned', sysDesignData?.web?.waf || ''],
      ['Application', ctx.app, 'Port: ' + (sysDesignData?.app?.app_port || '—') + ' | Deploy: ' + (sysDesignData?.app?.deploy_method || '—'), 'Provisioned', sysDesignData?.app?.apm_agent || ''],
      ['Database', ctx.db, 'Port: ' + (sysDesignData?.db?.listener_port || '—') + ' | Pool: ' + (sysDesignData?.db?.max_conn || '—'), 'Provisioned', sysDesignData?.db?.replication || ''],
      ['Storage', sysDesignData?.storage?.san_fabric || 'SAN / NFS', sysDesignData?.storage?.lun_size + ' LUN | IOPS: ' + sysDesignData?.storage?.iops_req, 'Provisioned', sysDesignData?.storage?.raid_level || ''],
      ['Backup / DR', sysDesignData?.backup?.backup_tool || 'RMAN / Veeam', 'RPO: ' + (sysDesignData?.backup?.rpo_hours || '—') + 'h | RTO: ' + (sysDesignData?.backup?.rto_hours || '—') + 'h', 'Provisioned', sysDesignData?.backup?.offsite_target || ''],
      ['Network', sysDesignData?.network?.bandwidth || 'Ethernet', 'VLAN: ' + (sysDesignData?.network?.vlan_ids || '—') + ' | Bond: ' + (sysDesignData?.network?.bond_mode || '—'), 'Provisioned', sysDesignData?.network?.fw_rules || ''],
      ['Security', sysDesignData?.security?.compliance_framework || 'ISO 27001:2022', 'Patch SLA: ' + (sysDesignData?.security?.patch_sla || '—') + ' | MFA: ' + (sysDesignData?.security?.mfa_required || '—'), 'Provisioned', sysDesignData?.security?.siem_endpoint || ''],
    ];
    layers.forEach(([layer, comp, cfg, status, notes], i) => {
      rows.push([
        c(layer, ST.BOLD_L),
        c(comp || '—', i % 2 === 0 ? ST.BODY : ST.BODY_A),
        c(cfg || '—', i % 2 === 0 ? ST.BODY : ST.BODY_A),
        c(status, ST.PASS),
        c(notes || '—', i % 2 === 0 ? ST.BODY : ST.BODY_A),
      ]);
    });
    const ws = buildSheet(rows);
    ws['!cols'] = [{ width: 18 }, { width: 35 }, { width: 55 }, { width: 14 }, { width: 40 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Platform Topology');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 4: Mission Intel — Architecture Map
  // ══════════════════════════════════════════════════════════════════════════
  {
    const intelState = {
      ctx, sysDesignData, selInc, selUUM, customUUM, customInc, liveEolData,
      requirements, isBuilt, promoted, cabApproved, cabDeclined, phase2Active, rtmSigned,
    };
    const intel = buildRuleBasedMissionIntel(intelState);
    // Terminal-style monospace rows for the ASCII box-drawing maps
    const MONO = {
      font: { name: 'Consolas', sz: 9, color: { rgb: 'FFA5F3FC' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0F172A' } },
      alignment: { vertical: 'center' },
    };

    const sb = sheetBuilder([{ width: 16 }, { width: 105 }]);
    sb.headerRow(projName + ' — Mission Intel & Architecture Map', ST.H1, 2);
    sb.row(['', '']);

    sb.headerRow('CONTEXT & SIGNAL EXTRACTION', ST.H2, 2);
    if (intel.signals.length === 0) {
      sb.row([c('Signals', ST.LABEL), c('No signals yet — complete Phase 1 stack selection', ST.BODY)]);
    } else {
      intel.signals.forEach((sig, i) => {
        sb.row([c(i === 0 ? 'Signals' : '', ST.LABEL), c(sig, i % 2 === 0 ? ST.BODY : ST.BODY_A)]);
      });
    }

    sb.row(['', '']);
    sb.headerRow('DELIVERY / RTM', ST.BLUE_H, 2);
    sb.row([c('RTM note', ST.LABEL), c(intel.rtmNote, ST.BODY)]);
    const rtmVals = Object.values(rtmRows);
    if (rtmVals.length > 0) {
      const count = st => rtmVals.filter(v => v === st).length;
      const failing = count('FAIL') + count('BLOCKED');
      sb.row([c('RTM status', ST.LABEL), c(
        'PASS: ' + count('PASS') + ' · FAIL: ' + count('FAIL') + ' · BLOCKED: ' + count('BLOCKED') +
        ' · PENDING: ' + count('PENDING') + ' · N/A: ' + count('NA') + (rtmSigned ? '  —  SIGNED OFF' : ''),
        failing > 0 ? ST.AMBER_V : ST.BODY)]);
    }
    if (rtmStale) {
      sb.row([c('Advisory', ST.LABEL), c('RTM is stale — scope changed after sign-off. Re-verify before cutover.', ST.AMBER_V)]);
    }

    sb.row(['', '']);
    sb.headerRow('ARCHITECTURE LAYERS', ST.H2, 2);
    sb.row([c('Business', ST.LABEL), c(intel.business, ST.BODY)]);
    sb.row([c('Functional', ST.LABEL), c(intel.functional, ST.BODY_A)]);
    sb.row([c('Technical', ST.LABEL), c(intel.technical, ST.BODY)]);

    sb.row(['', '']);
    sb.headerRow('NEXT STEPS', ST.AMBER_H, 2);
    intel.nextSteps.forEach((step, i) => {
      sb.row([c(String(i + 1), ctd(ST.BOLD_L)), c(step, i % 2 === 0 ? ST.BODY : ST.BODY_A)]);
    });

    sb.row(['', '']);
    sb.headerRow('STRUCTURAL MAP', ST.H2, 2);
    buildStructuralMap(intelState).split('\n').forEach(line => sb.headerRow(line, MONO, 2));

    sb.row(['', '']);
    sb.headerRow('FUNCTIONAL FLOW', ST.H2, 2);
    buildFunctionalFlow(intelState).split('\n').forEach(line => sb.headerRow(line, MONO, 2));

    XLSX.utils.book_append_sheet(wb, sb.build(), 'Mission Intel');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 5: CMDB Register
  // ══════════════════════════════════════════════════════════════════════════
  {
    // Layer key → which inc.layers / uum.layers values map to it
    const layerKeys = {
      'Hardware':       ['unix', 'hw'],
      'Operating System': ['unix', 'os'],
      'Web / HTTP':     ['web'],
      'Application':    ['app'],
      'Database':       ['db'],
      'Storage':        ['storage', 'stor'],
      'Backup / DR':    ['backup', 'bk'],
      'Network':        ['network', 'net'],
      'Security':       ['security', 'sec'],
    };

    const allCustom = customInc || [];

    function ciIncs(layerName) {
      const keys = layerKeys[layerName] || [];
      return selInc.filter(code => {
        const inc = ALL_INC.find(i => i.code === code) || allCustom.find(i => i.code === code);
        return inc && inc.layers && keys.some(k => inc.layers.includes(k));
      }).map(code => {
        const inc = ALL_INC.find(i => i.code === code) || allCustom.find(i => i.code === code);
        return inc ? inc.short : code;
      }).join(', ') || '—';
    }

    function ciUums(layerName) {
      const keys = layerKeys[layerName] || [];
      return selUUM.filter(code => {
        const uum = ALL_UUM.find(u => u.code === code);
        return uum && uum.layers && keys.some(k => uum.layers.includes(k));
      }).map(code => {
        const uum = ALL_UUM.find(u => u.code === code);
        return uum ? uum.short : code;
      }).join(', ') || '—';
    }

    function eolBadge(comp) {
      const info = getEolInfo(comp);
      if (!info || info.status === 'unknown') return '—';
      if (info.status === 'active') return 'Active until ' + info.date;
      if (info.status === 'eos_soon') return 'EOS Soon: ' + info.date;
      return 'EOL: ' + info.date;
    }

    function eolStyle(comp) {
      const info = getEolInfo(comp);
      if (!info || info.status === 'unknown' || info.status === 'active') return ST.PASS;
      if (info.status === 'eos_soon') return ST.AMBER_V;
      return ST.FAIL;
    }

    const ciRows = [
      { layer: 'Hardware',         comp: ctx.hw,   config: [sysDesignData?.unix?.cpu, sysDesignData?.unix?.ram, sysDesignData?.unix?.hostname_scheme].filter(Boolean).join(' | ') || '—', owner: 'Unix Admin' },
      { layer: 'Operating System', comp: ctx.os,   config: ['Kernel: ' + (sysDesignData?.unix?.kernel_params || '—'), 'Patch: ' + (sysDesignData?.unix?.patch_window || '—'), sysDesignData?.unix?.monitoring_agent].filter(Boolean).join(' | '), owner: 'Unix Admin' },
      { layer: 'Web / HTTP',       comp: sysDesignData?.web?.notes || ctx.app || '—', config: ['SSL: ' + (sysDesignData?.web?.ssl_protocols || '—'), 'MaxConn: ' + (sysDesignData?.web?.max_conn || '—'), 'WAF: ' + (sysDesignData?.web?.waf || '—')].join(' | '), owner: 'Web Admin' },
      { layer: 'Application',      comp: ctx.app,  config: ['Port: ' + (sysDesignData?.app?.app_port || '—'), 'Deploy: ' + (sysDesignData?.app?.deploy_method || '—'), 'APM: ' + (sysDesignData?.app?.apm_agent || '—')].join(' | '), owner: 'App Admin' },
      { layer: 'Database',         comp: ctx.db,   config: ['Port: ' + (sysDesignData?.db?.listener_port || '—'), 'Pool: ' + (sysDesignData?.db?.max_conn || '—'), 'Repl: ' + (sysDesignData?.db?.replication || '—')].join(' | '), owner: 'DB Admin' },
      { layer: 'Storage',          comp: sysDesignData?.storage?.san_fabric || 'SAN / NFS', config: ['LUN: ' + (sysDesignData?.storage?.lun_size || '—'), 'IOPS: ' + (sysDesignData?.storage?.iops_req || '—'), 'RAID: ' + (sysDesignData?.storage?.raid_level || '—')].join(' | '), owner: 'Storage Admin' },
      { layer: 'Backup / DR',      comp: sysDesignData?.backup?.backup_tool || 'RMAN / Veeam', config: ['RPO: ' + (sysDesignData?.backup?.rpo_hours || '—') + 'h', 'RTO: ' + (sysDesignData?.backup?.rto_hours || '—') + 'h', 'Offsite: ' + (sysDesignData?.backup?.offsite_target || '—')].join(' | '), owner: 'Backup Admin' },
      { layer: 'Network',          comp: sysDesignData?.network?.bandwidth || 'Ethernet', config: ['VLAN: ' + (sysDesignData?.network?.vlan_ids || '—'), 'Bond: ' + (sysDesignData?.network?.bond_mode || '—'), 'FW: ' + (sysDesignData?.network?.fw_rules || '—')].join(' | '), owner: 'Net Admin' },
      { layer: 'Security',         comp: sysDesignData?.security?.compliance_framework || 'ISO 27001:2022', config: ['PatchSLA: ' + (sysDesignData?.security?.patch_sla || '—'), 'MFA: ' + (sysDesignData?.security?.mfa_required || '—'), 'SIEM: ' + (sysDesignData?.security?.siem_endpoint || '—')].join(' | '), owner: 'SecOps' },
    ];

    const sb = sheetBuilder([{ width: 5 }, { width: 20 }, { width: 35 }, { width: 22 }, { width: 60 }, { width: 28 }, { width: 28 }, { width: 18 }]);
    sb.headerRow(projName + ' — CMDB Configuration Item Register', ST.H1, 8);
    sb.row([c('#', ST.H2), c('Layer', ST.H2), c('Component', ST.H2), c('EOL Status', ST.H2), c('Key Configuration', ST.H2), c('Active Incidents', ST.H2), c('UUM Items', ST.H2), c('Owner', ST.H2)]);

    ciRows.forEach(({ layer, comp, config, owner }, i) => {
      const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
      sb.row([
        c(i + 1, ctd(ST.BOLD_L)),
        c(layer, ST.BOLD_L),
        c(comp || '—', bg),
        c(eolBadge(comp), ctd(eolStyle(comp))),
        c(config, bg),
        c(ciIncs(layer), ciIncs(layer) !== '—' ? ctd(ST.FAIL) : ctd(bg)),
        c(ciUums(layer), ciUums(layer) !== '—' ? ctd(ST.AMBER_V) : ctd(bg)),
        c(owner, ctd(bg)),
      ]);
    });

    // EOL risk summary section
    const eolRisks = ciRows.filter(({ comp }) => {
      const info = getEolInfo(comp);
      return info && (info.status === 'eol' || info.status === 'eos_soon');
    });

    sb.row(['', '', '', '', '', '', '', '']);
    sb.headerRow('EOL / EOS RISK SUMMARY (' + eolRisks.length + ' component(s) at risk)', eolRisks.length > 0 ? ST.RED_H : ST.GREEN_H, 8);
    if (eolRisks.length === 0) {
      sb.row([c('All components within active support lifecycle', ST.PASS), '', '', '', '', '', '', '']);
    } else {
      sb.row([c('Layer', ST.LABEL), c('Component', ST.LABEL), c('Status', ST.LABEL), c('Date', ST.LABEL), c('Recommended Action', ST.LABEL), '', '', '']);
      eolRisks.forEach(({ layer, comp }, i) => {
        const info = getEolInfo(comp);
        const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
        const action = info.status === 'eol'
          ? 'Immediate upgrade or migration required — component is out of support'
          : 'Plan upgrade within 6 months — EOS approaching';
        sb.row([
          c(layer, ST.BOLD_L),
          c(comp, bg),
          c(info.status === 'eol' ? 'EOL' : 'EOS Soon', info.status === 'eol' ? ST.FAIL : ST.AMBER_V),
          c(info.date || '—', bg),
          c(action, bg),
          '', '', '',
        ]);
      });
    }

    if (fullExport) XLSX.utils.book_append_sheet(wb, sb.build(), 'CMDB Register');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 6: Incidents Register
  // ══════════════════════════════════════════════════════════════════════════
  {
    const rows = [
      [c('Incident Register — Active & Resolved', ST.H1), '', '', '', '', '', '', ''],
      [c('ID', ST.RED_H), c('Description', ST.RED_H), c('Group', ST.RED_H), c('Layers', ST.RED_H), c('Status', ST.RED_H), c('Fix Action', ST.RED_H), c('Task 1', ST.RED_H), c('Task 2', ST.RED_H)],
    ];
    if (selInc.length === 0) {
      rows.push([c('No incidents selected', ST.BODY), '', '', '', '', '', '', '']);
    } else {
      selInc.forEach((code, i) => {
        const inc = ALL_INC.find(ix => ix.code === code);
        if (!inc) return;
        const fixed = promoted || selFix.includes(code);
        const tasks = getIncidentFixTasks(inc, ctx);
        const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
        rows.push([
          c(inc.short, ctd(ST.BOLD_L)),
          c(inc.txt.substring(inc.short.length + 2, 90), bg),
          c(inc.grp, ctd(bg)),
          c(inc.layers.join(', '), bg),
          c(fixed ? 'RESOLVED' : 'ACTIVE', fixed ? ctd(ST.PASS) : ctd(ST.FAIL)),
          c(FIXES[code] || 'Patch applied', bg),
          c(tasks[0] ? tasks[0].name : '—', bg),
          c(tasks[1] ? tasks[1].name : '—', bg),
        ]);
      });
    }
    const ws = buildSheet(rows);
    ws['!cols'] = [{ width: 12 }, { width: 60 }, { width: 28 }, { width: 28 }, { width: 12 }, { width: 55 }, { width: 45 }, { width: 45 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Incidents');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 7: UUM Items
  // ══════════════════════════════════════════════════════════════════════════
  {
    const rows = [
      [c('UUM (Unix / User / Middleware) Items Register', ST.H1), '', '', '', '', '', ''],
      [c('ID', ST.AMBER_H), c('Description', ST.AMBER_H), c('Type', ST.AMBER_H), c('Layers', ST.AMBER_H), c('Status', ST.AMBER_H), c('Task 1', ST.AMBER_H), c('Task 2', ST.AMBER_H)],
    ];
    const allSelUUM = selUUM.length === 0 ? [] : selUUM;
    if (allSelUUM.length === 0 && customUUM.length === 0) {
      rows.push([c('No UUM items selected', ST.BODY), '', '', '', '', '', '']);
    } else {
      allSelUUM.forEach((code, i) => {
        const uum = ALL_UUM.find(u => u.code === code) || customUUM.find(u => u.id === code);
        if (!uum) return;
        const tasks = getRealTasks(uum, ctx);
        const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
        const uumType = (uum.type || 'update').toUpperCase();
        const typeStyle = uum.type === 'migration' ? ST.BLUE_H : uum.type === 'upgrade' ? ST.AMBER_V : ST.BODY;
        const label = uum.short || uum.id || code;
        const desc = uum.txt ? uum.txt.substring((uum.short || '').length + 2, 90) : (uum.txt || '—');
        rows.push([
          c(label, ctd(ST.BOLD_L)),
          c(desc, bg),
          c(uumType, ctd(typeStyle)),
          c((uum.layers || []).join(', ') || '—', bg),
          c(promoted ? 'COMPLETED' : 'SCHEDULED', ctd(promoted ? ST.PASS : ST.AMBER_V)),
          c(tasks[0] ? '[' + tasks[0].role + '] ' + tasks[0].name : '—', bg),
          c(tasks[1] ? '[' + tasks[1].role + '] ' + tasks[1].name : '—', bg),
        ]);
      });
      // Custom UUM entries not already in selUUM
      customUUM.filter(u => !selUUM.includes(u.id)).forEach((uum, i) => {
        const tasks = getRealTasks({ ...uum, code: uum.id }, ctx);
        const bg = (allSelUUM.length + i) % 2 === 0 ? ST.BODY : ST.BODY_A;
        const typeStyle = uum.type === 'migration' ? ST.BLUE_H : uum.type === 'upgrade' ? ST.AMBER_V : ST.BODY;
        rows.push([
          c((uum.short || uum.id) + ' ✦', ctd(ST.BOLD_L)),
          c(uum.txt || '—', bg),
          c((uum.type || 'update').toUpperCase(), ctd(typeStyle)),
          c((uum.layers || []).join(', ') || '—', bg),
          c('CUSTOM', ctd(ST.AMBER_V)),
          c(tasks[0] ? '[' + tasks[0].role + '] ' + tasks[0].name : '—', bg),
          c(tasks[1] ? '[' + tasks[1].role + '] ' + tasks[1].name : '—', bg),
        ]);
      });
    }
    const ws = buildSheet(rows);
    ws['!cols'] = [{ width: 14 }, { width: 65 }, { width: 14 }, { width: 35 }, { width: 14 }, { width: 55 }, { width: 55 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'UUM Items');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 8: RTM Checklist
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sb = sheetBuilder([{ width: 22 }, { width: 75 }, { width: 40 }, { width: 16 }]);
    sb.headerRow('Requirements Traceability Matrix (RTM)', ST.H1, 4);
    sb.headerRow('RTM Status: ' + (rtmSigned ? 'SIGNED — Production cutover authorised' : 'PENDING — Review in progress'), rtmSigned ? ST.GREEN_H : ST.AMBER_V, 4);
    sb.row(['', '', '', '']);
    sb.row([c('RTM ID', ST.H2), c('Requirement / Verification Check', ST.H2), c('Test Method', ST.H2), c('Status', ST.H2)]);

    const baseChecks = [
      ['RTM-REQ-001', 'Infrastructure hardware topology and firmware alignment verified', 'Physical/VM inventory matches CMDB', rtmSigned ? 'VERIFIED' : 'PENDING'],
      ['RTM-REQ-002', 'OS kernel, middleware, and runtime compatibility confirmed', 'rpm -qa / dpkg -l / oslevel', rtmSigned ? 'VERIFIED' : 'PENDING'],
      ['RTM-REQ-003', 'Incident runbook fix sequences tested in isolated staging sandbox', 'Post-fix smoke test + QA sign-off', rtmSigned ? 'VERIFIED' : 'PENDING'],
      ['RTM-REQ-004', 'Storage, DR replication, and backup integrity checks passed', 'Backup restore drill + DR failover test', rtmSigned ? 'VERIFIED' : 'PENDING'],
      ['RTM-REQ-005', 'Security compliance baseline and CVE patch level cleared by SecOps', 'Lynis / OpenSCAP scan ≥ 90%', rtmSigned ? 'VERIFIED' : 'PENDING'],
      ['RTM-REQ-006', 'Network connectivity, VLANs, and load balancer paths validated', 'ping + traceroute + port scan all paths', rtmSigned ? 'VERIFIED' : 'PENDING'],
      ['RTM-REQ-007', 'CAB change record approved and linked in ITSM', 'ITSM record review + CAB minutes', cabApproved ? 'VERIFIED' : 'PENDING'],
      ['RTM-REQ-008', 'Rollback plan documented, rehearsed, and approved', 'Rollback drill log + approval', rtmSigned ? 'VERIFIED' : 'PENDING'],
    ];
    baseChecks.forEach(([id, req, method, status], i) => {
      sb.row([c(id, ST.BOLD_L), c(req, i % 2 === 0 ? ST.BODY : ST.BODY_A), c(method, i % 2 === 0 ? ST.BODY : ST.BODY_A), c(status, statusStyle(status))]);
    });

    sb.row(['', '', '', '']);
    sb.headerRow('INCIDENT FIXES (' + selInc.length + ' in scope)', ST.RED_H, 4);
    if (selInc.length === 0) {
      sb.row([c('No incidents in scope', ST.BODY), '', '', '']);
    } else {
      selInc.forEach((code, i) => {
        const inc = ALL_INC.find(ix => ix.code === code);
        if (!inc) return;
        const fixed = promoted || selFix.includes(code);
        const status = fixed ? 'VERIFIED' : 'PENDING';
        sb.row([c('RTM-FIX-' + inc.short, ST.BOLD_L), c('Fix for "' + inc.short + '" tested and approved in staging', i % 2 === 0 ? ST.BODY : ST.BODY_A), c('Post-fix smoke test + QA sign-off', i % 2 === 0 ? ST.BODY : ST.BODY_A), c(status, statusStyle(status))]);
      });
    }

    sb.row(['', '', '', '']);
    sb.headerRow('UUM CHANGE ITEMS (' + selUUM.length + ' in scope)', ST.AMBER_H, 4);
    if (selUUM.length === 0) {
      sb.row([c('No UUM items in scope', ST.BODY), '', '', '']);
    } else {
      selUUM.forEach((code, i) => {
        const uum = ALL_UUM.find(u => u.code === code);
        if (!uum) return;
        const status = promoted ? 'COMPLETED' : 'SCHEDULED';
        sb.row([c('RTM-UUM-' + uum.short, ST.BOLD_L), c(uum.short + ' [' + uum.type.toUpperCase() + ']: Change reviewed and scheduled', i % 2 === 0 ? ST.BODY : ST.BODY_A), c('Version query + regression test suite', i % 2 === 0 ? ST.BODY : ST.BODY_A), c(status, statusStyle(status))]);
      });
    }

    XLSX.utils.book_append_sheet(wb, sb.build(), 'RTM Checklist');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 9: Gantt Timeline
  // ══════════════════════════════════════════════════════════════════════════
  {
    const ganttTasks = sdAiTasks.length > 0 ? sdAiTasks : buildDesignTasks(sysDesignData);
    const hpd = parseInt(requirements.hoursPerDay || '8', 10);
    const regions = selRegions || ['Production'];
    const regionsStr = regions.join(' · ');
    const designDates = excelCalcDates(ganttTasks, requirements.projectStartDate, hpd, 'duration_hours');

    const sb = sheetBuilder([{ width: 16 }, { width: 20 }, { width: 55 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 35 }, { width: 20 }, { width: 18 }]);
    sb.headerRow('Execution Gantt — Task Plan & Timeline', ST.H1, 9);

    // Project timeline summary row
    const tl = [];
    if (requirements.projectStartDate) tl.push('Start: ' + requirements.projectStartDate);
    if (requirements.goLiveDate) tl.push('Go-Live: ' + requirements.goLiveDate);
    if (requirements.changeFreezeStart) tl.push('Freeze: ' + requirements.changeFreezeStart + '→' + (requirements.changeFreezeEnd || '?'));
    if (requirements.holidays) tl.push('Holidays: ' + requirements.holidays);
    tl.push('Regions: ' + regionsStr);
    if (tl.length > 0) {
      sb.headerRow(tl.join('  |  '), ST.SUB_H, 9);
    }
    sb.row(['', '', '', '', '', '', '', '', '']);
    sb.headerRow('SYSTEM DESIGN TASKS', ST.H2, 9);
    sb.row([c('Phase', ST.H2), c('Role / Team', ST.H2), c('Task Name', ST.H2), c('Raw (h)', ST.H2), c('Buf (h)', ST.H2), c('Start Date', ST.H2), c('End Date', ST.H2), c('Change Window', ST.H2), c('Environment', ST.H2)]);

    if (ganttTasks.length === 0) {
      sb.row([c('No tasks generated — apply System Design or run AI task plan', ST.BODY), '', '', '', '', '', '', '', '']);
    } else {
      ganttTasks.forEach((t, i) => {
        const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
        const isMilestone = t.milestone;
        const raw = t.duration_hours || 2;
        const buf = Math.ceil(raw * BUFFER);
        const d = designDates[i] || { start: '—', end: '—' };
        sb.row([
          c(isMilestone ? '◆ MILESTONE' : (t.phase || 'Design'), isMilestone ? ctd(ST.AMBER_V) : ctd(bg)),
          c(t.team || t.role || '—', bg),
          c(t.title || t.name || '—', isMilestone ? ST.AMBER_V : bg),
          c(raw, ctd(bg)),
          c(buf, ctd(ST.AMBER_V)),
          c(d.start, ctd(bg)),
          c(d.end, ctd(bg)),
          c(t.window || '—', t.window ? ctd(ST.AMBER_V) : ctd(bg)),
          c(regionsStr, ctd(bg)),
        ]);
      });
    }

    // UUM tasks
    if (selUUM.length > 0) {
      sb.row(['', '', '', '', '', '', '', '', '']);
      sb.headerRow('UUM CHANGE SEQUENCES (' + selUUM.length + ' items)', ST.AMBER_H, 9);
      sb.row([c('UUM ID', ST.H2), c('Role / Team', ST.H2), c('Task Name', ST.H2), c('Raw (h)', ST.H2), c('Buf (h)', ST.H2), c('Start Date', ST.H2), c('End Date', ST.H2), c('Change Window', ST.H2), c('Environment', ST.H2)]);
      let uumCursor = designDates[designDates.length - 1]?.end || requirements.projectStartDate;
      selUUM.forEach(code => {
        const uum = ALL_UUM.find(u => u.code === code);
        if (!uum) return;
        const tasks = getRealTasks(uum, ctx);
        const uumDates = excelCalcDates(tasks, uumCursor, hpd, 'est_hours');
        if (uumDates.length > 0) uumCursor = uumDates[uumDates.length - 1].end;

        sb.headerRow(uum.short + ' [' + uum.type.toUpperCase() + '] — ' + uum.txt.substring(uum.short.length + 2, 80), ST.SUB_H, 9);
        tasks.forEach((t, i) => {
          const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
          const raw = t.est_hours || t.hours || 2;
          const buf = Math.ceil(raw * BUFFER);
          const d = uumDates[i] || { start: '—', end: '—' };
          const env = t.window ? 'Prod' : /staging|qa|test|sandbox|dr/i.test(t.name || '') ? 'Non-Prod' : regionsStr;
          sb.row([
            c('', bg),
            c(t.role || '—', bg),
            c(t.name || '—', bg),
            c(raw, ctd(bg)),
            c(buf, ctd(ST.AMBER_V)),
            c(d.start, ctd(bg)),
            c(d.end, ctd(bg)),
            c(t.window || '—', t.window ? ctd(ST.RED_H) : ctd(bg)),
            c(env, t.window ? ctd(ST.FAIL) : ctd(bg)),
          ]);
        });
      });
    }

    if (fullExport) XLSX.utils.book_append_sheet(wb, sb.build(), 'Gantt Timeline');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 10: RAID Registry
  // ══════════════════════════════════════════════════════════════════════════
  {
    const rows = [
      [c('RAID Registry — Risks, Assumptions, Issues, Decisions', ST.H1), '', '', '', '', ''],
      [c('Type', ST.H2), c('Description', ST.H2), c('Severity', ST.H2), c('Mitigation / Action', ST.H2), c('Status', ST.H2), c('Owner', ST.H2)],
    ];
    const typeStyle = (type) => ({
      'RISK': ST.AMBER_V, 'ISSUE': ST.FAIL, 'ASSUMPTION': ST.BODY, 'DEPENDENCY': ST.BLUE_H, 'CHANGE': ST.AMBER_H,
    })[type] || ST.BODY;

    selInc.forEach((code, i) => {
      const inc = ALL_INC.find(ix => ix.code === code);
      if (!inc) return;
      const fixed = promoted || selFix.includes(code);
      const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
      rows.push([
        c('ISSUE', typeStyle('ISSUE')),
        c(inc.short + ': ' + inc.txt.substring(inc.short.length + 2, 70), bg),
        c(fixed ? 'RESOLVED' : 'CRITICAL', fixed ? ST.PASS : ST.FAIL),
        c(FIXES[code] || 'Patch applied', bg),
        c(fixed ? 'CLOSED' : 'OPEN', fixed ? ST.PASS : ST.FAIL),
        c('SysAdmin / SecOps', bg),
      ]);
      if (!fixed) {
        rows.push([
          c('RISK', typeStyle('RISK')),
          c(inc.short + ' fix regression may affect layers: ' + (inc.layers?.join(', ') || '—'), bg),
          c('HIGH', ST.AMBER_V),
          c('Run regression suite across affected layers post-staging fix', bg),
          c('ACTIVE', ST.AMBER_V),
          c('QA Team', bg),
        ]);
      }
    });
    selUUM.forEach((code, i) => {
      const uum = ALL_UUM.find(u => u.code === code);
      if (!uum) return;
      const done = promoted;
      const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
      rows.push([
        c('CHANGE', typeStyle('CHANGE')),
        c(uum.short + ' [' + uum.type.toUpperCase() + ']: ' + uum.txt.substring(uum.short.length + 2, 65), bg),
        c(done ? 'DONE' : 'HIGH', done ? ST.PASS : ST.AMBER_V),
        c(done ? 'Completed and verified in production.' : 'Stage first. Release notes reviewed. Rollback documented.', bg),
        c(done ? 'DONE' : 'SCHED', done ? ST.PASS : ST.AMBER_V),
        c(uum.layers?.includes('db') ? 'DBA + SysAdmin' : 'SysAdmin', bg),
      ]);
    });
    rows.push([c('ASSUMPTION', typeStyle('ASSUMPTION')), c('All function teams available for scheduled change windows', ST.BODY), c('MEDIUM', ST.AMBER_V), c('Confirm attendance at kick-off session', ST.BODY), c('OPEN', ST.AMBER_V), c('Change Manager', ST.BODY)]);
    rows.push([c('ASSUMPTION', typeStyle('ASSUMPTION')), c('Staging environment accurately mirrors production configuration', ST.BODY), c('HIGH', ST.AMBER_V), c('Config diff review: staging vs prod before test', ST.BODY), c('OPEN', ST.AMBER_V), c('Unix Admin', ST.BODY)]);
    rows.push([c('DEPENDENCY', typeStyle('DEPENDENCY')), c('CAB approval required before any production change window confirmed', ST.BODY), c('HIGH', ST.AMBER_V), c('CAB submission 5 business days before change window', ST.BODY), c('OPEN', ST.AMBER_V), c('Change Manager', ST.BODY)]);
    rows.push([c('DEPENDENCY', typeStyle('DEPENDENCY')), c('RTM sign-off required before production cutover is authorised', ST.BODY), c('HIGH', ST.AMBER_V), c('All RTM rows set to PASS or N/A by QA Lead', ST.BODY), c(rtmSigned ? 'DONE' : 'OPEN', rtmSigned ? ST.PASS : ST.AMBER_V), c('QA Lead', ST.BODY)]);

    const ws = buildSheet(rows);
    ws['!cols'] = [{ width: 14 }, { width: 65 }, { width: 14 }, { width: 60 }, { width: 12 }, { width: 22 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'RAID Registry');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 11: System Design
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sectionColors = [ST.H2, ST.AMBER_H, ST.RED_H, ST.GREEN_H, ST.BLUE_H, ST.H2, ST.AMBER_H, ST.RED_H];
    const sb = sheetBuilder([{ width: 22 }, { width: 30 }, { width: 90 }]);
    sb.headerRow(projName + ' — Full System Design (8 Sections × 30 Fields)', ST.H1, 3);

    DESIGN_SECTIONS.forEach((section, sIdx) => {
      const sData = sysDesignData?.[section.key] || {};
      const hStyle = sectionColors[sIdx % sectionColors.length];
      sb.row(['', '', '']);
      sb.headerRow(section.label.toUpperCase() + ' — ' + section.owner, hStyle, 3);
      sb.row([c('Field Key', ST.LABEL), c('Label', ST.LABEL), c('Value / Configuration', ST.LABEL)]);
      section.fields.forEach((field, fIdx) => {
        const val = sData[field] || '';
        const bg = fIdx % 2 === 0 ? ST.BODY : ST.BODY_A;
        const isEmpty = !val.trim();
        sb.row([c(field, ST.BOLD_L), c(FIELD_LABELS[field] || field, bg), c(val || '(not configured)', isEmpty ? ST.AMBER_V : bg)]);
      });
    });

    if (fullExport) XLSX.utils.book_append_sheet(wb, sb.build(), 'System Design');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 12: RACI Matrix (20 roles)
  // ══════════════════════════════════════════════════════════════════════════
  {
    // PM, Change Manager, Tech Manager, then each function admin + lead pair
    const roles = [
      'PM', 'Change Manager', 'Tech Manager',
      'Unix Admin', 'Unix Lead',
      'DB Admin', 'DB Lead',
      'App Admin', 'App Lead',
      'Net Admin', 'Net Lead',
      'Storage Admin', 'Storage Lead',
      'Backup Admin', 'Backup Lead',
      'Web Admin', 'Web Lead',
      'SecOps', 'SecOps Lead',
      'QA Team',
    ];
    // Values order: PM CM TM UnixA UnixL DBA DBL AppA AppL NetA NetL StorA StorL BkpA BkpL WebA WebL SecO SecOL QA
    const activities = [
      ['Phase 1 — Platform Topology Build',   'A','R','C', 'R','C', 'C','I', 'C','I', 'C','I', 'C','I', 'I','I', 'I','I', 'C','C', 'I'],
      ['AI Smart Scan Execution',             'I','A','C', 'R','C', 'C','I', 'C','I', 'I','I', 'I','I', 'I','I', 'I','I', 'R','C', 'I'],
      ['System Design Entry',                 'C','I','A', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'I'],
      ['Tech Review — Design Lock',           'C','I','A', 'C','R', 'C','R', 'C','R', 'C','R', 'C','R', 'C','R', 'C','R', 'C','R', 'I'],
      ['Phase 2 — Incident Selection',        'A','R','C', 'C','I', 'C','I', 'C','I', 'I','I', 'I','I', 'I','I', 'I','I', 'C','C', 'I'],
      ['Incident Fix Runbooks',               'I','A','C', 'R','C', 'R','C', 'R','C', 'C','I', 'C','I', 'R','C', 'C','I', 'C','C', 'R'],
      ['UUM Change Scheduling',               'A','R','C', 'C','I', 'C','I', 'C','I', 'I','I', 'C','I', 'I','I', 'I','I', 'I','I', 'I'],
      ['CAB Submission and Approval',         'A','R','C', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'I'],
      ['RTM Sign-Off',                        'I','A','C', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'C','I', 'R'],
      ['Production Cutover',                  'A','R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'I','I', 'R','C', 'C','I', 'C'],
      ['Post-Production Monitoring',          'A','C','I', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'C','I', 'I'],
      ['CMDB Update (24h post-promotion)',    'C','A','I', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'R','C', 'C','I', 'C'],
    ];
    const raciStyle = (v) => {
      if (v === 'R') return s(C.H_TEAL, C.TEAL, true, 10, true, true);
      if (v === 'A') return s('FFFEF3C7', C.AMBER, true, 10, true, true);
      if (v === 'C') return s(C.H_BLUE, C.BLUE, false, 9, true, true);
      return s(C.H_GRAY, C.SLATE, false, 9, true, true);
    };
    const roleHeaderStyle = s(C.H_TEAL, C.WHITE, true, 9, true, true);
    const rows = [
      [c('RACI Matrix — Responsibility Assignment', ST.H1), ...roles.map(() => '')],
      [c('Activity / Phase', ST.H2), ...roles.map(r => c(r, roleHeaderStyle))],
    ];
    activities.forEach(([act, ...vals], i) => {
      rows.push([
        c(act, i % 2 === 0 ? ST.BOLD_L : ST.LABEL),
        ...vals.map(v => c(v, raciStyle(v))),
      ]);
    });
    rows.push(Array(roles.length + 1).fill(''));
    rows.push([c('R = Responsible   A = Accountable   C = Consulted   I = Informed', ST.SUB_H), ...roles.map(() => '')]);

    const ws = buildSheet(rows);
    ws['!cols'] = [{ width: 38 }, ...roles.map(() => ({ width: 13 }))];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: roles.length } }];
    XLSX.utils.book_append_sheet(wb, ws, 'RACI Matrix');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 13: Emergency Changes
  // ══════════════════════════════════════════════════════════════════════════
  if (emergencyChanges && emergencyChanges.length > 0) {
    const rows = [
      [c('Emergency / Manual Change Register', ST.H1), '', '', '', '', ''],
      [c('Type', ST.AMBER_H), c('Title', ST.AMBER_H), c('Date / Time', ST.AMBER_H), c('Impact', ST.AMBER_H), c('Owner', ST.AMBER_H), c('Description', ST.AMBER_H)],
    ];
    emergencyChanges.forEach((chg, i) => {
      const impStyle = chg.impact === 'Critical' ? ST.FAIL : chg.impact === 'High' ? ST.AMBER_V : ST.BODY;
      const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
      rows.push([
        c(chg.type, ST.BOLD_L),
        c(chg.title, bg),
        c(chg.datetime || '—', bg),
        c(chg.impact, impStyle),
        c(chg.owner, bg),
        c(chg.desc, bg),
      ]);
    });
    const ws = buildSheet(rows);
    ws['!cols'] = [{ width: 16 }, { width: 40 }, { width: 20 }, { width: 12 }, { width: 22 }, { width: 60 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Emergency Changes');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 14: Closure Summary
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sb = sheetBuilder([{ width: 6 }, { width: 95 }, { width: 22 }]);
    sb.headerRow('Project Closure Summary', ST.H1, 3);
    sb.headerRow('Project: ' + projName + '  |  Closure Date: ' + today + '  |  Status: ' + (promoted ? 'PROMOTED AND STABLE' : 'IN PROGRESS'), promoted ? ST.GREEN_H : ST.AMBER_V, 3);

    sb.row(['', '', '']);
    sb.headerRow('INCIDENT RESOLUTION LOG (' + selInc.length + ' in scope)', ST.RED_H, 3);
    sb.row([c('Incident', ST.LABEL), c('Description', ST.LABEL), c('Status', ST.LABEL)]);
    if (selInc.length === 0) {
      sb.row([c('No incidents in scope', ST.BODY), '', '']);
    } else {
      selInc.forEach((code, i) => {
        const inc = ALL_INC.find(ix => ix.code === code) || (customInc || []).find(ix => ix.code === code);
        const fixed = promoted || selFix.includes(code);
        const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
        sb.row([
          c(inc ? inc.short : code, ST.BOLD_L),
          c(inc ? inc.txt.substring(inc.short.length + 2, 75) : '—', bg),
          c(fixed ? 'RESOLVED' : 'PENDING', fixed ? ST.PASS : ST.AMBER_V),
        ]);
      });
    }

    sb.row(['', '', '']);
    sb.headerRow('UUM MIGRATION LOG (' + selUUM.length + ' in scope)', ST.AMBER_H, 3);
    sb.row([c('UUM ID', ST.LABEL), c('Description', ST.LABEL), c('Status', ST.LABEL)]);
    if (selUUM.length === 0) {
      sb.row([c('No UUM items in scope', ST.BODY), '', '']);
    } else {
      selUUM.forEach((code, i) => {
        const uum = ALL_UUM.find(u => u.code === code);
        const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
        sb.row([
          c(uum ? uum.short : code, ST.BOLD_L),
          c(uum ? uum.txt.substring(uum.short.length + 2, 75) : '—', bg),
          c(promoted ? 'COMPLETED' : 'SCHEDULED', promoted ? ST.PASS : ST.AMBER_V),
        ]);
      });
    }

    sb.row(['', '', '']);
    sb.headerRow('LESSONS LEARNED', ST.H2, 3);
    sb.row([c('#', ST.LABEL), c('Lesson / Recommendation', ST.LABEL), c('Category', ST.LABEL)]);
    const lessons = [
      ['Confirm CAB window booked 5+ business days in advance — never compress the change window under any circumstances.', 'Change Management'],
      ['All function team admins (Unix, DB, App, Net, Storage, Backup, Web, SecOps) must complete System Design before Phase 2 begins.', 'Process'],
      ['Run a full rehearsal migration in the staging environment before any production cutover is attempted.', 'Testing'],
      ['Monitor AWR reports, alert logs, and application health dashboards for a minimum of 48 hours post-cutover before closing the CAB ticket.', 'Monitoring'],
      ['Validate that backup and restore SLA targets (RPO/RTO) were met before declaring project closure and submitting CMDB updates.', 'Backup / DR'],
      ['Update all CMDB configuration items within 24 hours of production promotion — CI drift causes downstream incidents.', 'CMDB'],
      ['Communicate all change freeze dates and holiday windows to the team before generating the Gantt timeline to avoid schedule conflicts.', 'Planning'],
      ['Ensure all RTM items are explicitly set to PASS or N/A — auto-defaults do not satisfy sign-off requirements.', 'Quality'],
    ];
    lessons.forEach(([lesson, category], i) => {
      const bg = i % 2 === 0 ? ST.BODY : ST.BODY_A;
      sb.row([c(i + 1, ST.BOLD_L), c(lesson, bg), c(category, bg)]);
    });

    if (fullExport) XLSX.utils.book_append_sheet(wb, sb.build(), 'Closure Summary');
  }

  // Download
  const filename = (projName).replace(/[^a-z0-9]/gi, '-') + '-' + today + '.xlsx';
  XLSX.writeFile(wb, filename);
}
