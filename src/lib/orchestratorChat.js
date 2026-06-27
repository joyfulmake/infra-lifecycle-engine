// Orchestrator chat client.
// Calls the worker /orchestrator-chat route (Groq-powered NLP).
// Falls back to rich rule-based mentor guidance when Groq is unavailable.

import { GROQ_WORKER_URL as CARTESIA_WORKER_URL } from './groqConfig.js';
import { generateScript } from './orchestratorScripts.js';
import { computeAllRisks, riskScore, riskLabel } from './riskEngine.js';
import { checkCompatibility, checkCompatibilityForText, COMPAT_RULES } from './compatibilityRules.js';

// ── Relative date parser — understands natural language date inputs ────────────
// Returns ISO "YYYY-MM-DD" string or null if not recognised.
export function parseRelativeDate(text) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/[,!.]+$/, '').trim();

  if (/^(today|now|immediately|asap)$/.test(t)) return new Date().toISOString().slice(0, 10);

  // "in/after N days/weeks/months" or "N days/weeks/months from now/today"
  const rel = t.match(/(?:in|after|within)\s+(\d+)\s+(day|week|month)/i)
    || t.match(/(\d+)\s+(day|week|month)s?\s+from\s+(?:now|today)/i)
    || t.match(/(\d+)\s+(day|week|month)s?\s+(?:later|out|hence)/i)
    || t.match(/(?:to|till|until|for)\s+(\d+)\s+(day|week|month)/i);  // "to 3 months"
  if (rel) {
    const n = parseInt(rel[1]);
    const unit = rel[2].toLowerCase();
    const d = new Date();
    if (unit === 'day')   d.setDate(d.getDate() + n);
    else if (unit === 'week')  d.setDate(d.getDate() + n * 7);
    else if (unit === 'month') d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  }

  if (/next month/.test(t))   { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); }
  if (/next quarter/.test(t)) { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0, 10); }
  if (/next year/.test(t))    { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); }

  if (/end of (the |this )?year/.test(t)) return `${new Date().getFullYear()}-12-31`;

  // Q1–Q4 with optional year
  const qm = t.match(/q([1-4])\s*(?:of\s+)?(\d{4})?/);
  if (qm) {
    const yr = qm[2] ? parseInt(qm[2]) : new Date().getFullYear();
    return ({ 1: `${yr}-03-31`, 2: `${yr}-06-30`, 3: `${yr}-09-30`, 4: `${yr}-12-31` })[qm[1]];
  }

  // ISO date already embedded
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // MM/DD/YYYY
  const mdy = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;

  return null;
}

// ── Compound date range — "from today to 3 months", "today to Q3", etc. ──────
// Returns { start: ISO, end: ISO } or null.
export function parseCompoundDateRange(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  // "from X to Y" / "X to Y" / "start X end Y" / "start X for N months"
  // Anchor words for start: today, now, immediately, asap, ISO date
  const startAnchor = /(?:from\s+)?(today|now|immediately|asap|\d{4}-\d{2}-\d{2})/i;
  const endAnchor   = /(?:to|till|until|through|ending|end)\s+(.+)/i;

  const sm = t.match(startAnchor);
  const em = t.match(endAnchor);
  if (!sm || !em) return null;

  const startRaw = sm[1];
  const endRaw   = em[1].replace(/[,!.]+$/, '').trim();

  const start = parseRelativeDate(startRaw);
  const end   = parseRelativeDate(endRaw);

  if (start && end && end > start) return { start, end };
  return null;
}

// ── Groq-powered chat ─────────────────────────────────────────────────────────
// Tries the CF Worker first; falls back to the Pages Function at /api/orchestrator-chat.
// The Pages Function relays server-to-server to the worker, bypassing any browser-level
// shield that blocks *.workers.dev.

const WORKER_CHAT_URL = `${CARTESIA_WORKER_URL}/orchestrator-chat`;
const PAGES_CHAT_URL  = '/api/orchestrator-chat'; // same-origin — never blocked

export async function sendChatMessage(message, stateContext, history = []) {
  const body = JSON.stringify({ message, context: stateContext, history });

  for (const url of [WORKER_CHAT_URL, PAGES_CHAT_URL]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      return data.result; // { reply, actions, nextPrompt }
    } catch { /* try next endpoint */ }
  }

  throw new Error('AI unavailable — both endpoints failed');
}

// ── Rule-based mentor — handles all common queries locally ────────────────────
// Returns { reply, actions? } or null (fall through to Groq).

const PHASE1_FIELDS = `
Here are the Phase 1 fields to fill in the left panel:

Hardware (HW): Server platform — e.g. Dell PowerEdge R750, HPE ProLiant DL380, IBM Power9, Cisco UCS
OS: Operating system — e.g. RHEL 8.6, Ubuntu 22.04 LTS, AIX 7.2, Windows Server 2022
Database (DB): e.g. Oracle 19c, PostgreSQL 15, MySQL 8.0, SQL Server 2022
Application (App): Middleware — e.g. WebSphere 9.0, JBoss EAP 7.4, Apache Tomcat 10, nginx

Project details:
• Project Name — a short build identifier
• Environment Type — Production, UAT, DR, Dev, SIT
• Go-Live Date — target cutover date
• SLA Tier — Tier 1 (99.99%), Tier 2 (99.9%), Tier 3 (99.5%)
• Project Start Date — when planning began
• Hours Per Day — working hours for Gantt scheduling (default 8)

You can say things like:
  "hardware is Dell PowerEdge R750"
  "OS is RHEL 8.6"
  "project name is Server Migration Q3"
  "environment is Production"
`.trim();

// ── EOL / compatibility knowledge base ────────────────────────────────────────
// Checked whenever a stack field is set; triggers automatic incident suggestions.
const EOL_KNOWN = [
  // OS
  { field: 'os', pattern: /rhel\s*[67]|red hat.*[67]\b/i, eolDate: 'Nov 2020 (RHEL 6) / Jun 2024 (RHEL 7)', severity: 'CRITICAL', short: 'RHEL EOL', description: 'Red Hat Enterprise Linux 6/7 reached End of Life. Migrate to RHEL 8.x or 9.x.', grp: 'OS Lifecycle', layers: ['os'] },
  { field: 'os', pattern: /ubuntu\s*(14|16|18)\.04/i, eolDate: 'varies (2019–2023)', severity: 'CRITICAL', short: 'Ubuntu LTS EOL', description: 'Ubuntu 14.04/16.04/18.04 reached End of Life. Upgrade to Ubuntu 22.04 LTS or 24.04 LTS.', grp: 'OS Lifecycle', layers: ['os'] },
  { field: 'os', pattern: /centos\s*[678]/i, eolDate: 'Dec 2021 (CentOS 8)', severity: 'CRITICAL', short: 'CentOS EOL', description: 'CentOS 6/7/8 reached End of Life. Migrate to RHEL, AlmaLinux, or Rocky Linux.', grp: 'OS Lifecycle', layers: ['os'] },
  { field: 'os', pattern: /windows server\s*(2008|2012)/i, eolDate: 'Jan 2020 (2008) / Oct 2023 (2012)', severity: 'CRITICAL', short: 'Windows Server EOL', description: 'Windows Server 2008/2012 reached End of Life. Upgrade to Windows Server 2022.', grp: 'OS Lifecycle', layers: ['os'] },
  { field: 'os', pattern: /aix\s*[56]/i, eolDate: 'varies (2015–2017)', severity: 'HIGH', short: 'AIX EOL', description: 'AIX 5.x/6.x is past End of Service Life. Upgrade to AIX 7.2 or 7.3.', grp: 'OS Lifecycle', layers: ['os'] },
  { field: 'os', pattern: /sles\s*1[012]/i, eolDate: 'varies (2019–2022)', severity: 'HIGH', short: 'SLES EOL', description: 'SLES 10/11/12 reached End of General Support. Upgrade to SLES 15.', grp: 'OS Lifecycle', layers: ['os'] },
  // DB
  { field: 'db', pattern: /oracle\s*(9|10|11|12)c/i, eolDate: 'varies (2008–2022)', severity: 'CRITICAL', short: 'Oracle DB EOL', description: 'Oracle Database 9i/10g/11g/12c is past Extended Support. Upgrade to Oracle 19c or 21c.', grp: 'Database Lifecycle', layers: ['db'] },
  { field: 'db', pattern: /mysql\s*[45]\./i, eolDate: 'varies (2018–2023)', severity: 'CRITICAL', short: 'MySQL EOL', description: 'MySQL 4.x/5.x reached End of Life. Upgrade to MySQL 8.0+.', grp: 'Database Lifecycle', layers: ['db'] },
  { field: 'db', pattern: /postgresql\s*(9|10|11|12|13)\./i, eolDate: 'varies (2019–2025)', severity: 'HIGH', short: 'PostgreSQL EOL', description: 'PostgreSQL 9.x–13.x are at or approaching End of Life. Upgrade to PG 16 or 17.', grp: 'Database Lifecycle', layers: ['db'] },
  { field: 'db', pattern: /sql server\s*(2008|2012|2014|2016|2017)/i, eolDate: 'varies (2019–2027)', severity: 'HIGH', short: 'SQL Server EOL', description: 'SQL Server 2008–2017 is at or approaching End of Support. Upgrade to SQL Server 2022.', grp: 'Database Lifecycle', layers: ['db'] },
  { field: 'db', pattern: /sybase\b/i, eolDate: 'Dec 2025 (SAP ASE)', severity: 'HIGH', short: 'Sybase/SAP ASE EOL', description: 'Sybase/SAP ASE approaching End of Mainstream Support. Plan migration to SAP HANA or PostgreSQL.', grp: 'Database Lifecycle', layers: ['db'] },
  { field: 'db', pattern: /mongodb\s*[234]\./i, eolDate: 'varies (2021–2024)', severity: 'HIGH', short: 'MongoDB EOL', description: 'MongoDB 2.x/3.x/4.x reached End of Life. Upgrade to MongoDB 7.0+.', grp: 'Database Lifecycle', layers: ['db'] },
  // App/Middleware
  { field: 'app', pattern: /websphere\s*(6|7|8\.[05])\b/i, eolDate: 'varies (2016–2022)', severity: 'CRITICAL', short: 'WebSphere EOL', description: 'IBM WebSphere Application Server 6.x/7.x/8.0/8.5 reached End of Support. Upgrade to WAS 9.0 or Liberty.', grp: 'Middleware Lifecycle', layers: ['app'] },
  { field: 'app', pattern: /jboss\s*(4|5|6)\b|jboss eap\s*[456]\b/i, eolDate: 'varies (2014–2019)', severity: 'HIGH', short: 'JBoss EOL', description: 'JBoss AS 4/5/6 / EAP 4/5/6 reached End of Life. Upgrade to JBoss EAP 7.4 or 8.x.', grp: 'Middleware Lifecycle', layers: ['app'] },
  { field: 'app', pattern: /tomcat\s*[67]\b/i, eolDate: 'Dec 2021 (Tomcat 7)', severity: 'HIGH', short: 'Tomcat EOL', description: 'Apache Tomcat 6/7 reached End of Life. Upgrade to Tomcat 10.x or 11.x.', grp: 'Middleware Lifecycle', layers: ['app'] },
  { field: 'app', pattern: /weblogic\s*(10|11|12)\b/i, eolDate: 'varies (2019–2024)', severity: 'HIGH', short: 'WebLogic EOL', description: 'Oracle WebLogic 10.x/11g/12c approaching or past Extended Support. Upgrade to WebLogic 14c.', grp: 'Middleware Lifecycle', layers: ['app'] },
  { field: 'app', pattern: /iis\s*[678]\b/i, eolDate: 'varies (2015–2022)', severity: 'HIGH', short: 'IIS Version EOL', description: 'IIS 6/7/8 reached End of Support (tied to Windows Server lifecycle). Upgrade to IIS 10 on Server 2022.', grp: 'Middleware Lifecycle', layers: ['app'] },
];

// ── Stakeholder acceptance checks ─────────────────────────────────────────────
// Required discussions that must happen before a decision is locked in.
const STAKEHOLDER_CHECKS = [
  {
    field: 'os',
    pattern: /.+/i,
    topic: 'OS selection approved by Unix Admin and client',
    question: 'Has the Unix Admin confirmed OS version compatibility with the existing application stack, and has the client agreed to the OS choice and migration timeline?',
    owner: 'Unix Admin',
    type: 'team-agreement',
    decisionText: (v) => `Unix Admin and client acceptance confirmed for OS: ${v}`,
  },
  {
    field: 'db',
    pattern: /.+/i,
    topic: 'Database version approved by DBA and application team',
    question: 'Has the DBA confirmed schema compatibility, backup strategy, and replication config with the App team? Has the client accepted any downtime required for DB migration?',
    owner: 'DB Admin',
    type: 'team-agreement',
    decisionText: (v) => `DBA and app team signed off on DB: ${v}`,
  },
  {
    field: 'app',
    pattern: /.+/i,
    topic: 'Middleware/application version signed off by App Admin and business owner',
    question: 'Has the App Admin verified the middleware version against all deployed applications? Has the business owner accepted any interim service disruption?',
    owner: 'App Admin',
    type: 'acceptance-criteria',
    decisionText: (v) => `App Admin and business owner accepted application platform: ${v}`,
  },
  {
    field: 'os',
    pattern: /rhel [6-8]|ubuntu (1[468]|20)\.04|centos|windows server 201|aix [567]/i,
    topic: 'EOL/EOS compliance risk discussed with InfoSec and client',
    question: 'The selected OS has known lifecycle risk. Has InfoSec reviewed the compliance implications (PCI-DSS, SOX, ISO27001)? Has the client accepted the risk in writing, or agreed to a migration timeline?',
    owner: 'SecOps',
    type: 'compliance-sign-off',
    decisionText: (v) => `InfoSec and client acknowledged lifecycle risk for OS: ${v}`,
  },
  {
    field: 'db',
    pattern: /oracle (9|10|11|12)c|mysql [45]\.|sql server 201[0-7]/i,
    topic: 'EOL database risk accepted by client and legal/compliance team',
    question: 'The selected database is at or past End of Support. Has legal/compliance reviewed the risk? Has the client signed off on continuing operations with this database version or agreed to a migration plan?',
    owner: 'PM',
    type: 'compliance-sign-off',
    decisionText: (v) => `Legal/compliance and client accepted EOL database risk: ${v}`,
  },
];

// ── Pre-built indexes — computed once at module load, O(1) per field lookup ───

// EOL_INDEX: field → EOL_KNOWN entries for that field
const EOL_INDEX = new Map();
EOL_KNOWN.forEach(e => {
  if (!EOL_INDEX.has(e.field)) EOL_INDEX.set(e.field, []);
  EOL_INDEX.get(e.field).push(e);
});

// STAKEHOLDER_INDEX: field → STAKEHOLDER_CHECKS entries for that field
const STAKEHOLDER_INDEX = new Map();
STAKEHOLDER_CHECKS.forEach(c => {
  if (!STAKEHOLDER_INDEX.has(c.field)) STAKEHOLDER_INDEX.set(c.field, []);
  STAKEHOLDER_INDEX.get(c.field).push(c);
});

function getStakeholderChecks(field, value) {
  return (STAKEHOLDER_INDEX.get(field) || []).filter(c => c.pattern.test(value));
}

// checkEolForField — O(entries for this field) instead of O(all EOL_KNOWN)
function checkEolForField(field, value) {
  return (EOL_INDEX.get(field) || []).filter(e => e.pattern.test(value));
}

// checkEolForCtx — check all four stack fields in one pass, returns flat array of hits.
// Each hit is augmented with the field key so callers can group or deduplicate.
function checkEolForCtx(ctx) {
  const hits = [];
  for (const [field, entries] of EOL_INDEX) {
    const val = ctx?.[field];
    if (!val) continue;
    for (const e of entries) {
      if (e.pattern.test(val)) hits.push({ ...e, _field: field, _value: val });
    }
  }
  return hits;
}

// Check full stack for any EOL hits
function checkStackEol(ctx) {
  const hits = [];
  const fields = ['hw', 'os', 'db', 'app'];
  fields.forEach(f => {
    const v = ctx?.[f];
    if (v) hits.push(...checkEolForField(f, v));
  });
  return hits;
}

const HW_EXAMPLES = 'Dell PowerEdge R750, HPE ProLiant DL380, IBM Power9, Cisco UCS, Supermicro, Lenovo ThinkSystem';
const OS_EXAMPLES = 'RHEL 8.6, RHEL 9.2, Ubuntu 22.04 LTS, AIX 7.2, Windows Server 2022, Oracle Linux 8, SLES 15';
const DB_EXAMPLES = 'Oracle 19c, PostgreSQL 15, MySQL 8.0, SQL Server 2022, MongoDB 6, MariaDB 10.6';
const APP_EXAMPLES = 'WebSphere 9.0, JBoss EAP 7.4, Apache Tomcat 10, nginx 1.24, IIS 10, Oracle WebLogic 14c';

function nextPhase1Prompt(s) {
  const { hw, os, db, app } = s.ctx || {};
  const r = s.requirements || {};
  if (!hw) return 'Which hardware platform?';
  if (!os) return 'Which operating system?';
  if (!db) return 'Which database engine?';
  if (!app) return 'Which application or middleware?';
  if (!r.projectName) return 'What should we call this project?';
  if (!r.envType) return 'Production, UAT, DR, Dev, or SIT?';
  if (!r.projectStartDate) return 'When does the project start?';
  if (!r.goLiveDate) return "What's the target go-live date?";
  if (!r.sla) return 'SLA tier — Tier 1, 2, or 3?';
  return null;
}

// Parse "set X to Y" or "X is Y" patterns
// Prose guards: if the extracted value looks like a sentence rather than a product name,
// reject it. Real field values are short (≤35 chars) and don't contain prose connectors.
const PROSE_CONNECTORS = /\b(compared|versus|than|because|between|against|features|advantages|enterprise|latest|modern|today|using|this|the|for|some|best)\b/i;

function isLikelyProseNotValue(v) {
  if (!v) return true;
  if (v.length > 35) return true;
  if (PROSE_CONNECTORS.test(v)) return true;
  return false;
}

// Any message that opens with an interrogative/informational intent — no "?" needed.
// Covers 5 Ws + How + all synonyms for "explain/compare/describe/illustrate".
const QUESTION_OPENERS = /^(what|who|when|where|why|how|which|tell|share|compare|explain|show|list|give|can you|could you|would|is there|are there|elucidate|illustrate|elaborate|describe|discuss|clarify|differentiate|outline|summarize|walk|help|break down|define|teach|demonstrate|talk about|shed light|what's|what are|what is|who is|how does|how do|why does|why is|when does|where does|i want to know|i'd like to know|help me understand)/i;

function isQuestionMessage(m) {
  if (/[?]/.test(m)) return true;
  return QUESTION_OPENERS.test(m.trim());
}

function parseSetField(m) {
  if (isQuestionMessage(m)) return null;

  // HW
  if (/\b(hw|hardware|server|platform)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(hw|hardware|server|platform)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v && !isLikelyProseNotValue(v)) return { field: 'hw', value: v, label: 'Hardware' };
  }
  // OS
  if (/\b(os|operating system|operating-system)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(os|operating system|operating-system)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v && !isLikelyProseNotValue(v)) return { field: 'os', value: v, label: 'OS' };
  }
  // DB
  if (/\b(db|database|database system)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(db|database|database system)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v && !isLikelyProseNotValue(v)) return { field: 'db', value: v, label: 'Database' };
  }
  // App — use tighter pattern: only fire when field keyword is near start of message
  if (/^.{0,20}\b(app|application|middleware|web server)\b.{0,10}(is|:|=)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(app|application|middleware|web server)\b.{0,10}(?:is|:|=)\s+(.+)/i)?.[2]?.trim();
    if (v && !isLikelyProseNotValue(v)) return { field: 'app', value: v, label: 'Application' };
  }
  return null;
}

function parseSetRequirement(m) {
  if (isQuestionMessage(m)) return null;
  // Project name
  if (/\b(project name|build name)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(project name|build name)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'projectName', value: v, label: 'Project Name' };
  }
  // Environment
  if (/\b(env|environment|env type)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(env|environment|env type)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'envType', value: v, label: 'Environment Type' };
  }
  // Project start date
  if (/\b(project start|start date|kick.?off date)\b.{0,15}(?:is|:|=|to|of)?\s+(.+)/i.test(m)) {
    const raw = m.match(/\b(project start|start date|kick.?off date)\b.{0,15}(?:is|:|=|to|of)?\s+(.+)/i)?.[2]?.trim();
    if (raw) {
      const v = parseRelativeDate(raw) || raw;
      return { field: 'projectStartDate', value: v, label: 'Project Start Date' };
    }
  }
  // Go-live date
  if (/\b(go.?live|go live date|cutover date|target date)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const raw = m.match(/\b(go.?live|go live date|cutover date|target date)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (raw) {
      const v = parseRelativeDate(raw) || raw;
      return { field: 'goLiveDate', value: v, label: 'Go-Live Date' };
    }
  }
  // SLA
  if (/\b(sla|service level)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(sla|service level)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'sla', value: v, label: 'SLA' };
  }
  return null;
}

// ── Multi-field project description parser ────────────────────────────────────
// Extracts hw/os/db/app/envType/goLiveDate/projectName from a single free-form sentence.
// Returns { hw, os, db, app, envType, goLiveDate, projectName } — only fields found.
function parseProjectDescription(text) {
  const t = text;
  const tl = t.toLowerCase();
  const found = {};

  // Hardware
  const hwPat = [
    [/dell\s+power(edge)?\s+[\w\d]+/i, m => m[0]],
    [/dell\s+[\w\d]+/i, m => m[0]],
    [/hpe?\s+(proliant\s+)?[\w\d]+/i, m => m[0]],
    [/ibm\s+power\s*[\w\d]*/i, m => m[0]],
    [/cisco\s+ucs[\s\w]*/i, m => m[0]],
    [/lenovo\s+[\w\d]+/i, m => m[0]],
    [/\bpower\s*[89]\b/i, m => 'IBM ' + m[0]],
    [/\bx86\b/i, () => 'x86 Server'],
  ];
  for (const [pat, extract] of hwPat) {
    const m = t.match(pat);
    if (m) { found.hw = extract(m); break; }
  }

  // OS
  const osPat = [
    [/rhel\s*\d+[\.\d]*/i, m => m[0].replace(/rhel/i, 'RHEL ')],
    [/red\s*hat[\s\w]*\d+[\.\d]*/i, m => m[0]],
    [/ubuntu\s*\d+[\.\d]*/i, m => m[0].charAt(0).toUpperCase() + m[0].slice(1)],
    [/windows\s+server\s*\d{4}/i, m => m[0]],
    [/windows\s+server/i, () => 'Windows Server 2022'],
    [/aix\s*\d+[\.\d]*/i, m => m[0].toUpperCase()],
    [/\baix\b/i, () => 'AIX 7.2'],
    [/centos\s*\d+[\.\d]*/i, m => m[0]],
    [/sles?\s*\d+[\.\d]*/i, m => m[0].toUpperCase()],
    [/oracle\s+linux\s*\d+[\.\d]*/i, m => m[0]],
  ];
  for (const [pat, extract] of osPat) {
    const m = t.match(pat);
    if (m) { found.os = extract(m); break; }
  }

  // Database
  const dbPat = [
    [/oracle\s*(db|database)?\s*\d+[cgi]?[\d.]*/i, m => m[0].replace(/oracle\s*(db|database)?\s*/i, 'Oracle ')],
    [/oracle\s*\d+[cgi]/i, m => m[0]],
    [/\boracle\b/i, () => 'Oracle 19c'],
    [/postgresql\s*\d+[\.\d]*/i, m => m[0]],
    [/postgres\s*\d+[\.\d]*/i, m => 'PostgreSQL ' + (m[0].match(/\d+[\.\d]*/)?.[0] || '16')],
    [/\bpg\s+\d+\b/i, m => 'PostgreSQL ' + (m[0].match(/\d+/)?.[0] || '16')],
    [/mysql\s*\d+[\.\d]*/i, m => m[0].charAt(0).toUpperCase() + m[0].slice(1)],
    [/sql\s*server\s*\d{4}/i, m => 'SQL Server ' + (m[0].match(/\d{4}/)?.[0] || '2022')],
    [/sql\s*server/i, () => 'SQL Server 2022'],
    [/\bdb2\b/i, () => 'IBM DB2'],
    [/mongodb\s*\d+[\.\d]*/i, m => 'MongoDB ' + (m[0].match(/\d+[\.\d]*/)?.[0] || '7.0')],
    [/maria\s*db\s*\d+[\.\d]*/i, m => 'MariaDB ' + (m[0].match(/\d+[\.\d]*/)?.[0] || '10.11')],
    [/\bsybase\b|\bsap\s+ase\b/i, () => 'SAP ASE (Sybase)'],
  ];
  for (const [pat, extract] of dbPat) {
    const m = t.match(pat);
    if (m) { found.db = extract(m); break; }
  }

  // App / middleware
  const appPat = [
    [/websphere\s*[\d.]+/i, m => 'IBM WebSphere ' + (m[0].match(/[\d.]+/)?.[0] || '9.0')],
    [/\bwas\s+[\d.]+/i, m => 'IBM WebSphere ' + (m[0].match(/[\d.]+/)?.[0] || '9.0')],
    [/jboss\s*(eap\s*)?[\d.]+/i, m => 'JBoss EAP ' + (m[0].match(/[\d.]+/)?.[0] || '7.4')],
    [/tomcat\s*[\d.]+/i, m => 'Apache Tomcat ' + (m[0].match(/[\d.]+/)?.[0] || '10')],
    [/\bnginx\b/i, () => 'nginx'],
    [/\bapache\b/i, () => 'Apache HTTP Server'],
    [/weblogic\s*[\d.]+/i, m => 'Oracle WebLogic ' + (m[0].match(/[\d.]+/)?.[0] || '14c')],
    [/\biis\s*[\d]*/i, m => 'IIS' + (m[0].match(/[\d]+/)?.[0] ? ' ' + m[0].match(/[\d]+/)[0] : ' 10')],
    [/liberty/i, () => 'IBM Liberty'],
    [/spring\s*boot/i, () => 'Spring Boot'],
  ];
  for (const [pat, extract] of appPat) {
    const m = t.match(pat);
    if (m) { found.app = extract(m); break; }
  }

  // Environment type
  if (/\bproduction\b|\bprod\b/i.test(tl)) found.envType = 'Production';
  else if (/\buat\b|\buser acceptance\b/i.test(tl)) found.envType = 'UAT';
  else if (/\bdr\b|\bdisaster recovery\b/i.test(tl)) found.envType = 'DR';
  else if (/\bdev(elopment)?\b/i.test(tl)) found.envType = 'Dev';
  else if (/\bsit\b|\bsystem integration\b/i.test(tl)) found.envType = 'SIT';
  else if (/\bstaging\b/i.test(tl)) found.envType = 'UAT';

  // Go-live date — look for "go live", "cutover", "target", "by", "deadline", month names
  const goliveMatch = tl.match(/(?:go.?live|cutover|target|deadline|by)\s+([a-z]+\s*\d{0,4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i)
    || tl.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})/i);
  if (goliveMatch) {
    const raw = goliveMatch[1] || `${goliveMatch[1]} ${goliveMatch[2]}`;
    const parsed = parseRelativeDate(raw);
    if (parsed) found.goLiveDate = parsed;
  }

  // Project name — look for "project:", "build:", "call it", "named"
  const nameMatch = t.match(/(?:project|build|call it|project name)\s*(?:is|:|=|named)?\s*["']?([A-Za-z0-9][\w\s\-]{2,40}?)["']?(?:\s*[,.]|$)/i);
  if (nameMatch) found.projectName = nameMatch[1].trim();

  return found;
}

// Is this message a "describe my project" style sentence rather than a single field command?
// Triggered by: 2+ stack fields detected in one message, or explicit planning language.
function isProjectDescription(text, found) {
  const fieldCount = ['hw', 'os', 'db', 'app'].filter(k => found[k]).length;
  const tl = text.toLowerCase();
  const planningKeywords = /\b(plan|planning|setting up|migrate|migration|new build|project|kick.?off|provision)\b/i.test(tl);
  return fieldCount >= 2 || (fieldCount >= 1 && planningKeywords && Object.keys(found).length >= 2);
}

// ── Live input scanner — called as the user types (debounced in OrchestratorPanel) ──
// Returns { eol: [], compat: [], detected: {} } — never throws, always fast.
// All checks run against pre-built indexes so cost is O(matching entries), not O(all rules).
export function scanInputLive(text, ctx) {
  if (!text || text.length < 3) return { eol: [], compat: [], detected: {} };

  const eol = [];
  // Scan EOL_INDEX for all fields — single pass, O(total EOL entries)
  for (const [field, entries] of EOL_INDEX) {
    for (const e of entries) {
      if (e.pattern.test(text)) {
        eol.push({ field, short: e.short, eolDate: e.eolDate, severity: e.severity });
        break; // one hit per field is enough for a hint
      }
    }
  }

  // Parse fields detected in the typed text, merge with current ctx
  const desc = parseProjectDescription(text);
  const ctxFields = ['hw', 'os', 'db', 'app'].filter(k => desc[k]);
  const mergedCtx = { ...(ctx || {}), ...Object.fromEntries(ctxFields.map(k => [k, desc[k]])) };

  // Run compat only when something new was detected (avoid re-scanning current stack on every keystroke)
  const compat = ctxFields.length > 0 ? checkCompatibility(mergedCtx).slice(0, 2) : [];

  return { eol, compat, detected: Object.fromEntries(ctxFields.map(k => [k, desc[k]])) };
}

// ── Left-shift advisory — surfaces upcoming phase requirements proactively ────
// Returns a one-paragraph string describing what the NEXT phase will demand,
// so the user can prepare NOW rather than discover blockers later.
function leftShiftHint(s) {
  const { hw, os, db, app } = s.ctx || {};
  if (!s.isBuilt) return null;

  if (s.isBuilt && !s.designApplied) {
    const warnings = [];
    if (/oracle/i.test(db || '')) warnings.push('Oracle requires SGA/PGA sizing and listener config in the Database design section');
    if (/aix/i.test(os || '')) warnings.push('AIX needs LPAR profile and LVM layout in the Unix/OS section');
    if (/websphere/i.test(app || '')) warnings.push('WebSphere needs JVM heap, datasource, and classloader config in the Application section');
    const base = `System Design (Phase 3) has 8 sections — all must be filled before you can generate tasks and proceed to CAB. The fields your stack most needs: Network (TLS/SSL version, firewall rules), Storage (LUN size, IOPS), Backup (RPO/RTO hours), and Security (SIEM, PAM, cipher suite).`;
    return warnings.length > 0 ? `${base}\n\nStack-specific: ${warnings.join('; ')}.` : base;
  }

  if (s.designApplied && !s.phase2Active) {
    return `Phase 2 injection activates the incident and UUM scope selection, unlocks the Gantt chart, and enables RAID log entries. CAB reviewers will expect every incident to have an owner, a mitigation plan, and a fix task in the Gantt.`;
  }

  if (s.phase2Active && !s.cabApproved && !s.cabDeclined) {
    const pending = (s.selInc || []).length + (s.selUUM || []).length;
    return `CAB reviewers will demand: (1) a Gantt schedule with no overdue critical-path tasks, (2) every RAID risk with a stated mitigation and owner, (3) stakeholder sign-offs for OS, DB, and App selections, and (4) a rollback plan. You have ${pending} incident/UUM item${pending !== 1 ? 's' : ''} in scope — each needs a corresponding Gantt task.`;
  }

  if (s.cabApproved && !s.rtmSigned) {
    const counts = Object.values(s.rtmRows || {}).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});
    const pending = (counts.PENDING || 0) + (counts.FAIL || 0);
    return `RTM sign-off requires every row to be PASS or N/A — no FAIL or PENDING rows permitted. ${pending > 0 ? `You have ${pending} row${pending !== 1 ? 's' : ''} still unresolved.` : 'All rows look ready.'} After sign-off, the Closure checklist unlocks.`;
  }

  if (s.rtmSigned && !s.promoted) {
    return `Closure checklist has post-go-live items: monitoring confirmation, backup test result, rollback plan documented, and stakeholder sign-off. Promote to live only when all checklist items are ticked.`;
  }

  return null;
}

// acknowledgedCompatIds: optional Set of rule IDs already confirmed this session —
// previously-acknowledged compat risks are skipped rather than re-prompted.
export function ruleBasedResponse(message, s, authUser, acknowledgedCompatIds) {
  const m = message.toLowerCase().trim();
  const raw = message.trim();

  // ── Multi-field "describe my project" intake ─────────────────────────────────
  // Detects when the user provides 2+ stack fields (or 1 field + planning language) in
  // a single sentence, e.g. "Dell PowerEdge, Oracle 19c, RHEL 8, production, go live Aug"
  // Fills all detected fields at once and summarises what was understood.
  {
    const desc = parseProjectDescription(raw);
    if (isProjectDescription(raw, desc)) {
      const ctxFields = ['hw', 'os', 'db', 'app'].filter(k => desc[k]);
      const reqFields = ['envType', 'goLiveDate', 'projectName'].filter(k => desc[k]);

      if (ctxFields.length + reqFields.length >= 2) {
        const actions = [];
        const lines = [];

        ctxFields.forEach(k => {
          actions.push({
            type: 'SET_CTX',
            description: `Set ${k.toUpperCase()} to ${desc[k]}`,
            params: { key: k, value: desc[k] },
            requiresConfirmation: false,
          });
          const label = { hw: 'Hardware', os: 'OS', db: 'Database', app: 'Application' }[k];
          lines.push(`${label}: **${desc[k]}**`);
        });

        if (reqFields.length > 0) {
          const reqPatch = {};
          reqFields.forEach(k => {
            reqPatch[k] = desc[k];
            const label = { envType: 'Environment', goLiveDate: 'Go-Live', projectName: 'Project Name' }[k];
            lines.push(`${label}: **${desc[k]}**`);
          });
          actions.push({
            type: 'SET_REQUIREMENTS',
            description: 'Apply project requirements',
            params: reqPatch,
            requiresConfirmation: false,
          });
        }

        const missing = ['hw', 'os', 'db', 'app'].filter(k => !desc[k] && !s.ctx?.[k]);
        const missingMsg = missing.length
          ? `\n\nStill needed: **${missing.map(k => ({ hw: 'Hardware', os: 'OS', db: 'Database', app: 'Application' }[k])).join(', ')}** — tell me or select from the sidebar.`
          : '\n\nAll four stack fields are set. Ready to click **Build Environment** in the sidebar.';

        // Build merged ctx to check compat NOW — not on the next message
        const mergedCtx = { ...(s.ctx || {}), ...Object.fromEntries(ctxFields.map(k => [k, desc[k]])) };
        const prevCompatIdSet = new Set(checkCompatibility(s.ctx || {}).map(r => r.id));
        const mergedCompatHits = checkCompatibility(mergedCtx)
          .filter(r => !acknowledgedCompatIds?.has(r.id) && !prevCompatIdSet.has(r.id));

        // EOL check across all detected ctx fields — single pass via checkEolForCtx
        const mergedEolHits = checkEolForCtx(mergedCtx).filter(h => ctxFields.includes(h._field));

        if (mergedCompatHits.length > 0) {
          const compatLines = mergedCompatHits.map(r => {
            const sev = r.severity === 'critical' ? '🔴' : r.severity === 'warn' ? '⚠' : 'ℹ';
            return `${sev} ${r.title}`;
          });
          lines.push('', ...compatLines);
          mergedCompatHits.forEach(r => {
            (r.compatFix?.alternatives || []).forEach(alt => {
              actions.push({
                type: 'SET_CTX',
                description: `Switch to ${alt.label}`,
                params: { key: alt.ctxKey, value: alt.ctxValue },
                requiresConfirmation: true,
                confirmLabel: `Use ${alt.ctxValue}`,
              });
            });
          });
        }

        if (mergedEolHits.length > 0) {
          mergedEolHits.forEach(h => {
            lines.push(`⚠️ EOL: ${h.short} — ${h.eolDate}`);
          });
        }

        const chips = missing.length
          ? []
          : [{ label: 'Run AI Smart Scan', action: 'OPEN_SCAN' }];

        return {
          reply: `Got it — here's what I picked up:\n\n${lines.join('\n')}${missingMsg}`,
          actions,
          chips,
        };
      }
    }
  }

  // ── Systemic compatibility scan ─────────────────────────────────────────────
  // Only fires when the message text itself contains stack/platform keywords
  // (checkCompatibilityForText now guards against generic messages like "yes" or
  // "go ahead" triggering the same compat warning on a stack that already has a
  // known incompatibility).  Already-acknowledged rule IDs are filtered out so
  // the user is never re-prompted after clicking "Yes, go ahead".
  const allCompatHits = checkCompatibilityForText(raw, s.ctx || {});
  const inlineCompatHits = allCompatHits.filter(r => !acknowledgedCompatIds?.has(r.id));

  if (inlineCompatHits.length > 0) {
    const bullets = inlineCompatHits.map(r => {
      const sev  = r.severity === 'critical' ? '🔴 CRITICAL' : r.severity === 'warn' ? '⚠ WARNING' : 'ℹ Info';
      const refs = (r.refs || []).slice(0, 2).map(rf => `  → ${rf.label}`).join('\n');
      return `${sev}: ${r.title}\n${r.detail}${refs ? '\n' + refs : ''}`;
    }).join('\n\n');

    const actions = [];

    inlineCompatHits.forEach(r => {
      // For every critical/warn hit: offer to log it in the RAID log.
      // _ruleId is stored so OrchestratorPanel can track which rules were confirmed
      // and avoid re-prompting for the same risk in this session.
      if (r.severity === 'critical' || r.severity === 'warn') {
        actions.push({
          type: 'ADD_RAID_ENTRY',
          description: `Log compat risk: ${r.title}`,
          params: {
            _ruleId: r.id,
            type: 'RISK',
            severity: r.severity === 'critical' ? 'CRITICAL' : 'HIGH',
            description: `[Vendor Compat] ${r.title}`,
            mitigation: `Verify against vendor PAM before provisioning. Refs: ${(r.refs || []).map(rf => rf.label).join('; ')}`,
          },
          requiresConfirmation: true,
        });
      }

      // For rules with compatible alternatives: offer SET_CTX switch (requires confirmation)
      if (r.compatFix?.alternatives?.length) {
        r.compatFix.alternatives.forEach(alt => {
          actions.push({
            type: 'SET_CTX',
            description: `Switch to ${alt.label}`,
            params: { key: alt.ctxKey, value: alt.ctxValue },
            requiresConfirmation: true,
            confirmLabel: `Use ${alt.ctxValue}`,
          });
        });
      }
    });

    const hasAlternatives = inlineCompatHits.some(r => r.compatFix?.alternatives?.length);
    const altSummary = hasAlternatives
      ? '\n\nI can switch your ' +
        [...new Set(inlineCompatHits.flatMap(r => (r.compatFix?.alternatives || []).map(a => a.ctxKey)))].join('/') +
        ' to a compatible alternative — select one of the options above, or specify one yourself.'
      : '\n\nIf you proceed, document this in the RAID log. Say "raise as incident" to also create a tracked incident for remediation.';

    return {
      reply: `Vendor compatibility issue detected:\n\n${bullets}${altSummary}`,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  // ── Field-setting commands — parse and return with actions + EOL detection ─
  const ctxField = parseSetField(raw);
  if (ctxField) {
    const updatedCtx = { ...s.ctx, [ctxField.field]: ctxField.value };
    const next = nextPhase1Prompt({ ...s, ctx: updatedCtx });
    const allFilled = !!(updatedCtx.hw && updatedCtx.os && updatedCtx.db && updatedCtx.app);

    // EOL check — O(entries for this field) via pre-built index
    const eolHits = checkEolForField(ctxField.field, ctxField.value);
    const eolWarnings = eolHits.map(h =>
      `⚠️ EOL DETECTED: "${ctxField.value}" matches "${h.short}" — ${h.description} (EOL: ${h.eolDate})`
    ).join('\n');

    // Compat check against updatedCtx — catches conflicts the moment the field is set,
    // not one message later. Filter out rules already acknowledged this session.
    const newCompatHits = checkCompatibility(updatedCtx)
      .filter(r => !acknowledgedCompatIds?.has(r.id));
    const prevCompatIds = new Set(checkCompatibility(s.ctx || {}).map(r => r.id));
    // Only surface conflicts that are NEW after this field was set (not pre-existing)
    const freshCompatHits = newCompatHits.filter(r => !prevCompatIds.has(r.id));

    const actions = [
      {
        type: 'SET_CTX',
        description: `Set ${ctxField.label} to ${ctxField.value}`,
        params: { key: ctxField.field, value: ctxField.value },
        requiresConfirmation: false,
      },
    ];

    // Offer to create incidents + vulnerabilities for each EOL hit
    eolHits.forEach(h => {
      const incId = `EOL-${ctxField.field.toUpperCase()}-${Date.now()}`;
      actions.push({
        type: 'ADD_INCIDENT',
        description: `Auto-create EOL incident: ${h.short}`,
        params: {
          id: incId,
          code: incId,
          short: h.short,
          txt: h.description,
          grp: h.grp,
          sev: h.severity,
          owner: 'SysAdmin',
          layers: h.layers,
        },
        requiresConfirmation: true,
        confirmLabel: `Add "${h.short}" incident`,
      });
      // Also auto-register in vulnerability registry
      actions.push({
        type: 'ADD_VULNERABILITY',
        description: `Register EOL vulnerability: ${h.short}`,
        params: {
          id: `VULN-EOL-${ctxField.field.toUpperCase()}-${Date.now()}`,
          title: h.short,
          component: ctxField.value,
          severity: h.severity,
          description: h.description,
          status: 'ACTIVE',
          source: 'eol-detection',
          field: ctxField.field,
        },
        requiresConfirmation: false,
      });
    });

    // Stakeholder discussion checks for this field
    const stakeholderChecks = getStakeholderChecks(ctxField.field, ctxField.value);
    stakeholderChecks.forEach(sc => {
      const discId = `DISC-${ctxField.field.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
      // Auto-create a DECISION RAID entry
      const raidId = `RAID-DISC-${discId}`;
      actions.push({
        type: 'ADD_RAID_ENTRY',
        description: `Log stakeholder discussion: ${sc.topic}`,
        params: {
          id: raidId,
          type: 'DECISION',
          description: `[Stakeholder Discussion Required] ${sc.topic}`,
          severity: 'HIGH',
          mitigation: sc.question,
          status: 'OPEN',
          owner: sc.owner,
          addedAt: new Date().toISOString(),
        },
        requiresConfirmation: false,
      });
      // Also log in stakeholder discussions tracker
      actions.push({
        type: 'ADD_STAKEHOLDER_DISCUSSION',
        description: `Track discussion: ${sc.topic}`,
        params: {
          id: discId,
          topic: sc.topic,
          question: sc.question,
          owner: sc.owner,
          type: sc.type,
          status: 'PENDING',
        },
        requiresConfirmation: false,
      });
    });

    // Auto-trigger Build + Scan if all 4 fields now filled
    if (allFilled && !s.isBuilt) {
      actions.push({
        type: 'BUILD',
        description: 'Build environment from current stack selection',
        requiresConfirmation: false,
      });
      actions.push({
        type: 'RUN_SCAN',
        description: 'Auto-run AI Smart Scan',
        requiresConfirmation: false,
      });
    } else if (allFilled && s.isBuilt && !s.scanComplete) {
      actions.push({
        type: 'RUN_SCAN',
        description: 'Auto-run AI Smart Scan (all stack fields complete)',
        requiresConfirmation: false,
      });
    }

    const eolNote = eolHits.length > 0
      ? `${eolWarnings}\n\nConfirm below to register incident and vulnerability entries.`
      : '';

    const stakeholderNote = stakeholderChecks.length > 0
      ? `Stakeholder sign-offs needed:\n${stakeholderChecks.map(sc => `• ${sc.owner}: ${sc.topic}`).join('\n')}\nLogged in RAID and Vulnerabilities tab.`
      : '';

    const nextNote = allFilled && !s.isBuilt
      ? 'All stack fields are set — building and running AI Smart Scan now.'
      : allFilled && s.isBuilt && !s.scanComplete
      ? 'Stack complete — running AI Smart Scan now.'
      : next || '';

    // Fresh compat conflicts — surface immediately, not one message later
    let compatNote = '';
    if (freshCompatHits.length > 0) {
      compatNote = freshCompatHits.map(r => {
        const sev = r.severity === 'critical' ? '🔴 CRITICAL' : r.severity === 'warn' ? '⚠ WARNING' : 'ℹ Info';
        return `${sev}: ${r.title}\n${r.detail}`;
      }).join('\n\n');
      // Add compat fix alternatives as confirmation actions
      freshCompatHits.forEach(r => {
        (r.compatFix?.alternatives || []).forEach(alt => {
          actions.push({
            type: 'SET_CTX',
            description: `Switch to ${alt.label}`,
            params: { key: alt.ctxKey, value: alt.ctxValue },
            requiresConfirmation: true,
            confirmLabel: `Use ${alt.ctxValue}`,
          });
        });
      });
    }

    // Only echo if there is risk content — never repeat what the user just typed
    const riskContent = [compatNote, eolNote, stakeholderNote].filter(Boolean).join('\n\n');
    const reply = riskContent || nextNote || '';

    return { reply, actions };
  }

  const reqField = parseSetRequirement(raw);
  if (reqField) {
    const next = nextPhase1Prompt({ ...s, requirements: { ...s.requirements, [reqField.field]: reqField.value } });
    return {
      reply: next || 'All Phase 1 fields are complete. Click "Build" in the left panel.',
      actions: [{
        type: 'SET_REQUIREMENT',
        description: `Set ${reqField.label} to ${reqField.value}`,
        params: { key: reqField.field, value: reqField.value },
        requiresConfirmation: false,
      }],
    };
  }

  // ── Build environment ─────────────────────────────────────────────────────────
  if (/\b(build|build env|build environment|build now|build stack|build it)\b/.test(m)) {
    const { hw, os, db, app } = s.ctx || {};
    if (!hw || !os || !db || !app) {
      const next = nextPhase1Prompt(s);
      return { reply: `Stack isn't complete yet.\n\n${next || 'All 4 fields needed: hardware, OS, database, and application.'}` };
    }
    if (s.isBuilt) return { reply: 'Environment is already built. Use "run scan" to continue.' };
    return {
      reply: `Building ${[hw, os, db, app].join(' / ')} now — this locks the stack and applies design defaults.`,
      actions: [
        { type: 'BUILD', description: `Build environment: ${hw} / ${os} / ${db} / ${app}`, requiresConfirmation: false },
        { type: 'RUN_SCAN', description: 'Run AI Smart Scan', requiresConfirmation: false },
      ],
    };
  }

  // ── Direct tab navigation ──────────────────────────────────────────────────
  // "open gantt", "go to RTM", "show me the design tab", "take me to closure", etc.
  const navVerb = /\b(open|go to|show|take me to|navigate to|switch to|view|see)\s+(?:the\s+)?/i;
  if (navVerb.test(m)) {
    const target = m.replace(navVerb, '').trim();
    const TAB_MAP = [
      { pattern: /\b(gantt|schedule|task\s?plan|timeline|tasks?\s+tab)\b/i,   tab: 'gantt',   label: 'Gantt Schedule' },
      { pattern: /\b(rtm|requirements?\s+traceab|traceability)\b/i,            tab: 'rtm',     label: 'RTM Sign-Off' },
      { pattern: /\b(system\s?design|design\s?tab|design\s?section)\b/i,       tab: 'design',  label: 'System Design' },
      { pattern: /\b(exec(utive)?\s?(summary|overview)?|exec\s?tab|kpi)\b/i,   tab: 'exec',    label: 'Exec Summary' },
      { pattern: /\b(raid|risk\s?log|raid\s?log|risks?\s+and\s+issues)\b/i,    tab: 'raid',    label: 'RAID Log' },
      { pattern: /\b(matrix|dependency\s?matrix|dep\s?matrix)\b/i,             tab: 'matrix',  label: 'Dependency Matrix' },
      { pattern: /\b(closure|close.?out|post.?go.?live)\b/i,                   tab: 'closure', label: 'Closure Checklist' },
      { pattern: /\b(infra\s?diagram|diagram|topology|architecture\s?map)\b/i, tab: 'diagram', label: 'Infra Diagram' },
      { pattern: /\b(roles?|raci|raci\s?table)\b/i,                            tab: 'roles',   label: 'Roles / RACI' },
      { pattern: /\b(cmdb|cmdb\s?tab|eol|end.of.life|lifecycle)\b/i,           tab: 'cmdb',    label: 'CMDB / EOL' },
    ];
    const found = TAB_MAP.find(t => t.pattern.test(target));
    if (found) {
      return {
        reply: '',
        actions: [{ type: 'NAVIGATE_TAB', description: `Open ${found.label}`, params: { tab: found.tab }, requiresConfirmation: false }],
      };
    }
  }

  // ── Workflow gate actions (checked BEFORE generic status/phase/cab matchers) ─
  if (/\b(run scan|start scan|scan now|do the scan|run the scan|ai scan)\b/.test(m)) {
    if (!s.isBuilt) return { reply: 'Please build the stack first. Select hardware, OS, DB, and App in the left panel then click Build.' };
    if (s.scanComplete) return { reply: 'AI Smart Scan already completed. The results are shown in the Exec Summary tab.' };
    return {
      reply: 'Running AI Smart Scan now — checking your stack for CVEs, EOL risks, and compatibility issues.',
      actions: [{ type: 'RUN_SCAN', description: 'Run AI Smart Scan on current stack', requiresConfirmation: false }],
    };
  }

  if (/\b(apply design|lock design|lock.*design|design.*lock)\b/.test(m)) {
    if (!s.scanComplete) return { reply: 'System Design unlocks after the AI Smart Scan. Run the scan first.' };
    if (s.designApplied) return { reply: 'System Design is already locked and applied.' };
    return {
      reply: 'Applying and locking the System Design now. Note: this skips task plan generation. Use "generate task plan" instead to create tasks AND lock the design.',
      actions: [{ type: 'APPLY_DESIGN', description: 'Lock and apply System Design', requiresConfirmation: true }],
    };
  }

  if (/\b(inject phase 2|start phase 2|activate phase 2|phase 2 now|inject.*phase)\b/.test(m)) {
    if (!s.designApplied) return { reply: 'Phase 2 requires System Design to be applied first. Fill the 8 sections and click Generate Task Plan.' };
    if (s.phase2Active) return { reply: 'Phase 2 is already active. Check the Exec Summary tab for selected incidents and UUM items.' };
    return {
      reply: 'Injecting Phase 2 now — this activates incident and UUM scope and unlocks the Gantt chart.',
      actions: [{ type: 'INJECT_PHASE2', description: 'Inject Phase 2 (activate incident and UUM scope)', requiresConfirmation: true }],
    };
  }

  if (/\b(submit.*cab|approve cab|cab approve|send to cab|cab submit|submit to cab)\b/.test(m)) {
    if (!s.phase2Active) return { reply: 'CAB submission requires Phase 2 to be active and Gantt tasks reviewed. Complete those first.' };
    if (s.cabApproved) return { reply: 'CAB has already approved this change.' };
    return {
      reply: 'Submitting to CAB for approval. This marks the change as approved — use this only when you have actual CAB sign-off.',
      actions: [{ type: 'SUBMIT_CAB', description: 'Mark CAB as approved', requiresConfirmation: true }],
    };
  }

  if (/\b(sign rtm|sign off rtm|rtm sign|sign.*requirements|sign.*traceability)\b/.test(m)) {
    if (!s.cabApproved) return { reply: 'RTM sign-off is available after CAB approval. Submit to CAB first.' };
    if (s.rtmSigned) return { reply: 'RTM is already signed off.' };
    const counts = Object.values(s.rtmRows || {}).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});
    const fails = counts.FAIL || 0;
    if (fails > 0) return { reply: `RTM has ${fails} FAIL row${fails !== 1 ? 's' : ''}. Resolve all failures before signing off. Open the RTM tab to review.` };
    return {
      reply: 'Signing off the RTM now — this confirms all requirements are verified and ready for cutover.',
      actions: [{ type: 'SIGN_RTM', description: 'Sign off Requirements Traceability Matrix', requiresConfirmation: true }],
    };
  }

  if (/\b(go live|mark live|promote|system live|mark.*live|live now)\b/.test(m)) {
    if (!s.rtmSigned) return { reply: 'System cannot go live until the RTM is signed off. Complete RTM first.' };
    if (s.promoted) return { reply: 'The system is already marked as live.' };
    return {
      reply: 'Marking the system as live. This triggers the closure checklist and audit trail export.',
      actions: [{ type: 'PROMOTE', description: 'Mark system as live (promote to production)', requiresConfirmation: true }],
    };
  }

  if (/\b(unlock.*revision|revision.*unlock|unlock.*tabs|open.*tabs|unlock for cab|enable.*revision)\b/.test(m)) {
    if (!s.cabDeclined) return { reply: 'Unlock for Revision is only available after a CAB decline. CAB has not declined this change.' };
    if (s.unlockedForRevision) return { reply: 'Tabs are already unlocked for revision. Make your changes, then say "resubmit to CAB" when ready.' };
    return {
      reply: 'Unlocking all tabs for revision — you can now update the design, scope, incidents, and task schedule without phase restrictions. Say "resubmit to CAB" when corrections are complete.',
      actions: [{ type: 'UNLOCK_FOR_REVISION', description: 'Unlock all tabs for post-CAB revision', requiresConfirmation: true }],
    };
  }

  if (/\b(resubmit.*cab|re-?submit.*cab|cab.*resubmit|send back to cab|reopen cab)\b/.test(m)) {
    if (!s.cabDeclined) return { reply: 'Resubmit to CAB is only available after a CAB decline.' };
    return {
      reply: 'Resubmitting to CAB — this clears the "declined" status and returns the change to pending review. Make sure all CAB feedback has been addressed before doing this.',
      actions: [{ type: 'RESUBMIT_CAB', description: 'Resubmit change to CAB for re-review', requiresConfirmation: true }],
    };
  }

  // Static informational responses removed — all knowledge/status/comparison queries go to the LLM.
  // Only action-executing handlers remain below (field parsing, compat scan, RAID, tasks, incidents).

  // ── Add vulnerability manually ─────────────────────────────────────────────
  const addVulnMatch = raw.match(/\badd (vuln|vulnerability)[:\s]+(.+)/i);
  if (addVulnMatch) {
    const title = addVulnMatch[2].trim();
    return {
      reply: `Registering "${title}" in the vulnerability registry as ACTIVE. Open the Vulnerabilities tab to set severity, workaround, or business decision.`,
      actions: [{
        type: 'ADD_VULNERABILITY',
        description: `Register vulnerability: ${title}`,
        params: { title, component: s.ctx?.os || 'Unknown', severity: 'HIGH', description: title, status: 'ACTIVE', source: 'manual' },
        requiresConfirmation: false,
      }, {
        type: 'NAVIGATE_TAB',
        description: 'Open Vulnerabilities tab',
        params: { tab: 'vuln' },
        requiresConfirmation: false,
      }],
    };
  }

  // ── Add stakeholder discussion manually ────────────────────────────────────
  const addDiscMatch = raw.match(/\badd discussion[:\s]+(.+)/i);
  if (addDiscMatch) {
    const topic = addDiscMatch[1].trim();
    return {
      reply: `Opened discussion: "${topic}". It appears as PENDING in the RAID log and Vulnerabilities tab. Update it to AGREED once the team/client confirms.`,
      actions: [{
        type: 'ADD_STAKEHOLDER_DISCUSSION',
        description: `Track discussion: ${topic}`,
        params: { topic, question: topic, owner: 'PM', type: 'team-agreement', status: 'PENDING' },
        requiresConfirmation: false,
      }, {
        type: 'ADD_RAID_ENTRY',
        description: `Log to RAID: ${topic}`,
        params: { id: `RAID-DISC-${Date.now()}`, type: 'DECISION', description: `[Discussion] ${topic}`, severity: 'MED', mitigation: 'Pending team/client confirmation', status: 'OPEN', owner: 'PM', addedAt: new Date().toISOString() },
        requiresConfirmation: false,
      }],
    };
  }

  // ── "Raise as incident" — "raise as incident", "log as incident", "create incident for this" ──
  // Creates a custom incident from the current compat hits or the stack's EOL issues.
  // Works standalone (raise all current compat issues) or with freeform text describing the issue.
  {
    const isRaiseIncident =
      /\b(raise|log|create|add|report|file|track|record).{0,25}(as.{0,8})?(incident|issue|ticket|case)\b/i.test(m)
      || /\b(incident|issue).{0,15}(raise|log|create|add|report|file|track)\b/i.test(m)
      || /\b(make|open).{0,15}(an.{0,5})?(incident|issue)\b/i.test(m);

    if (isRaiseIncident) {
      // Gather the source: current stack compat issues + coherence alerts with compat content
      const currentCompatHits = checkCompatibility(s.ctx || {});
      const allHits = [
        ...currentCompatHits,
        // also include coherence alerts that describe a compat/EOL problem
        ...(s.coherenceAlerts || [])
          .filter(a => a.severity === 'warn' && !currentCompatHits.find(h => h.id === a.id))
          .map(a => ({ id: a.id, title: a.message, detail: a.action || '', severity: a.severity === 'warn' ? 'HIGH' : 'MEDIUM', grp: 'Compatibility', layers: [] })),
      ];

      if (allHits.length === 0) {
        // No known compat issues — let the user describe it; create from message text
        const title = raw.replace(/^(raise|log|create|add|report|file|track|make|open)\s+(as\s+)?(an?\s+)?(incident|issue|ticket)[\s:—-]*/i, '').trim() || 'Reported issue';
        const incId = `INC-${Date.now()}`;
        return {
          reply: `Creating custom incident: "${title}". It will appear in Phase 2 incident list and RTM.`,
          actions: [{
            type: 'ADD_INCIDENT',
            description: `Create incident: ${title}`,
            params: {
              id: incId, code: incId,
              short: title.slice(0, 60),
              txt: title,
              grp: 'Custom', sev: 'HIGH', owner: 'SysAdmin', layers: [],
            },
            requiresConfirmation: false,
          }],
        };
      }

      const actions = allHits.map(h => {
        const incId = `INC-COMPAT-${h.id || Date.now()}`;
        return {
          type: 'ADD_INCIDENT',
          description: `Create incident: ${h.title || h.short}`,
          params: {
            id: incId, code: incId,
            short: (h.title || h.short || 'Compatibility issue').slice(0, 60),
            txt: h.detail || h.txt || h.title || '',
            grp: h.grp || 'Compatibility', sev: h.severity || 'HIGH',
            owner: 'SysAdmin', layers: h.layers || [],
          },
          requiresConfirmation: false,
        };
      });

      const names = allHits.map(h => `• ${(h.title || h.short || '').slice(0, 70)}`).join('\n');
      return {
        reply: `Creating ${actions.length} custom incident${actions.length > 1 ? 's' : ''} from current compatibility issues:\n${names}\n\nThese will appear in Phase 2 incident list, RTM, and Matrix tab. Each feeds into the task plan automatically.`,
        actions,
      };
    }
  }

  // ── "Fix DB incompatibility" shortcut ─────────────────────────────────────
  // "fix the DB issue", "switch to compatible DB", "what DB works here", "use compatible database"
  {
    const isFixDb =
      /\b(fix|switch|change|use|select|pick|recommend).{0,30}(db|database|compatible.{0,10}db|db.{0,10}compat|alternative.{0,10}db)\b/i.test(m)
      || /\b(compatible|supported).{0,20}(db|database)\b/i.test(m)
      || /\bwhat (db|database).{0,20}(work|support|certif|compat)\b/i.test(m)
      || /\b(db|database).{0,20}(replacement|alternative|substitute)\b/i.test(m);

    if (isFixDb) {
      const compatHits = checkCompatibility(s.ctx || {}).filter(r => r.compatFix?.alternatives?.length);
      if (compatHits.length > 0) {
        const actions = compatHits.flatMap(r =>
          r.compatFix.alternatives.map(alt => ({
            type: 'SET_CTX',
            description: `Switch ${alt.ctxKey} to ${alt.ctxValue}`,
            params: { key: alt.ctxKey, value: alt.ctxValue },
            requiresConfirmation: true,
            confirmLabel: `Use ${alt.ctxValue}`,
          }))
        );
        const reason = compatHits.map(r => r.compatFix.summary).join('; ');
        return {
          reply: `${reason}\n\nSelect a compatible alternative below, or type the name of your preferred database. I'll update the build and regenerate design defaults automatically.`,
          actions,
        };
      }
    }
  }

  // ── Fix-intent recognizer — "fix the TLS issue", "best choice for web", "correct incompatible", etc. ──
  // Reads coherence alerts that have `fix` payloads and offers to apply them.
  // Falls through to direct TLS fix when no alert is active but TLS intent is clear.
  {
    const isFixIntent =
      /\b(fix|correct|update|resolve|apply|enforce|remediat)\b.{0,40}\b(tls|ssl|cipher|protocol|web|incompatib|alert|issue|warning|field|value|section|config)\b/i.test(m)
      || /\b(best choice|best value|recommended value|correct value|update.{0,20}incompatib|fix.{0,25}value|what should.{0,10}set)\b/i.test(m)
      || /\b(fix|correct|apply|resolve).{0,20}\b(tls|ssl|nist|pci|cipher|protocol)\b/i.test(m)
      || /\b(update|fix|correct).{0,30}(web section|design field)\b/i.test(m)
      || /\bfix all\b|\bapply fixes\b|\bapply.{0,10}recommended\b|\bresolve all.{0,15}alert/i.test(m);

    if (isFixIntent) {
      const fixableAlerts = (s.coherenceAlerts || []).filter(a => a.fix?.length);

      if (fixableAlerts.length === 0) {
        // No active coherence alerts — if TLS/cipher intent is explicit, apply the fix directly.
        if (/\btls|ssl|cipher|nist|pci|protocol/i.test(m)) {
          return {
            reply: 'Applying NIST-compliant TLS 1.2/1.3 configuration to System Design → Web section.',
            actions: [
              { type: 'SET_DESIGN_FIELD', description: 'ssl_protocols → TLSv1.2 TLSv1.3', params: { section: 'web', field: 'ssl_protocols', value: 'TLSv1.2 TLSv1.3' }, requiresConfirmation: false },
              { type: 'SET_DESIGN_FIELD', description: 'ssl_ciphers → ECDHE NIST suite', params: { section: 'web', field: 'ssl_ciphers', value: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-CHACHA20-POLY1305' }, requiresConfirmation: false },
              { type: 'NAVIGATE_TAB', description: 'Open System Design', params: { tab: 'design' }, requiresConfirmation: false },
            ],
          };
        }
        // User said "fix the web issue" but there's no coherence alert with an auto-fix.
        // Respond contextually instead of silently falling through to a generic handler.
        if (/\bweb\b/i.test(m)) {
          return {
            reply: s.scanComplete
              ? `No active alert with an auto-fix for the web section right now. If you saw a warning in the AgentInsights panel, it may be a TLS/cipher gap — say "fix TLS" and I'll apply NIST-recommended values directly. Otherwise, opening System Design → Web section for you.`
              : `The web section in System Design covers SSL/TLS, WAF, rate limits, and reverse proxy config — each field becomes a traceable RTM row. Run the scan first; it flags which web-layer items need attention.`,
            actions: s.scanComplete ? [{ type: 'NAVIGATE_TAB', params: { tab: 'design' }, description: 'Open System Design', requiresConfirmation: false }] : [],
          };
        }
        // Other fix intent (network, storage, etc.) with no active auto-fixable alert
        if (isFixIntent) {
          const allAlerts = (s.coherenceAlerts || []);
          if (allAlerts.length > 0) {
            const lines = allAlerts.map(a => `• ${a.message.slice(0, 80)}`).join('\n');
            return { reply: `These are the current alerts — none have an auto-fix, but I can help address them:\n\n${lines}\n\nTell me which one to work on and I'll guide you through it.` };
          }
          return { reply: `No active warnings right now — the build looks clean. If you see something flagged in AgentInsights, describe it and I'll help resolve it.` };
        }
      } else {
        // Narrow to the section the user mentioned, or take all if no specific mention
        const mentionedSection =
          /\bweb\b/i.test(m)        ? 'web'
          : /\bsecur/i.test(m)      ? 'security'
          : /\bunix|os layer\b/i.test(m) ? 'unix'
          : /\bnetwork\b/i.test(m)  ? 'network'
          : /\bstorage\b/i.test(m)  ? 'storage'
          : /\bbackup\b/i.test(m)   ? 'backup'
          : /\btls|ssl|cipher|nist|pci|protocol/i.test(m) ? 'web'
          : null;

        const targeted = mentionedSection
          ? fixableAlerts.filter(a => a.fix.some(f => f.section === mentionedSection))
          : fixableAlerts;

        if (targeted.length === 0 && fixableAlerts.length > 0) {
          // User mentioned a section but no fix targets it — offer all fixable
          const lines = fixableAlerts.map(a => `• ${a.fixLabel || a.message.slice(0, 60)}`).join('\n');
          return {
            reply: `No specific fix for that section, but I can apply these:\n${lines}\n\nSay "fix all" or "apply fixes" to apply.`,
          };
        }

        const actions = [];
        targeted.forEach(alert => {
          alert.fix.forEach(f => {
            actions.push({
              type: 'SET_DESIGN_FIELD',
              description: f.label || `${f.section} → ${f.field} = ${f.value}`,
              params: { section: f.section, field: f.field, value: f.value },
              requiresConfirmation: false,
            });
          });
        });

        const summary = targeted.map(a => a.fixLabel || a.message.slice(0, 60)).join('; ');
        const fieldList = targeted.flatMap(a => a.fix).map(f => `${f.section}.${f.field} → ${f.value.length > 40 ? f.value.slice(0, 40) + '…' : f.value}`).join('\n');

        return {
          reply: `Applying: ${summary}\n\n${fieldList}`,
          actions: [...actions, {
            type: 'NAVIGATE_TAB',
            description: 'Open System Design',
            params: { tab: 'design' },
            requiresConfirmation: false,
          }],
        };
      }
    }
  }

  // ── Incompatibility / EOL scan ─────────────────────────────────────────────
  if (/\b(incompatib|eol|end of life|end-of-life|compat|lifecycle|version check|supported)\b/.test(m)) {
    const { hw, os, db, app } = s.ctx || {};
    if (!hw && !os && !db && !app) {
      return { reply: 'No stack defined yet. Tell me the hardware, OS, database, and application first, then I can check compatibility.' };
    }
    const hits = checkStackEol(s.ctx);
    if (hits.length === 0) {
      return { reply: `Stack compatibility check:\n• HW: ${hw || '—'}\n• OS: ${os || '—'}\n• DB: ${db || '—'}\n• App: ${app || '—'}\n\nNo known EOL or incompatibility issues detected in my local knowledge base. Tip: Run the AI Smart Scan for CVE and patch-level checks.` };
    }
    const actions = [];
    const lines = hits.map(h => {
      const ts = Date.now() + Math.floor(Math.random() * 100);
      const incId = `EOL-SCAN-${h.field.toUpperCase()}-${ts}`;
      actions.push({
        type: 'ADD_INCIDENT',
        description: `Create EOL incident: ${h.short}`,
        params: { id: incId, code: incId, short: h.short, txt: h.description, grp: h.grp, sev: h.severity, owner: 'SysAdmin', layers: h.layers },
        requiresConfirmation: true,
        confirmLabel: `Add "${h.short}" incident`,
      });
      actions.push({
        type: 'ADD_VULNERABILITY',
        description: `Register in vulnerability registry: ${h.short}`,
        params: { id: `VULN-SCAN-${h.field.toUpperCase()}-${ts}`, title: h.short, component: s.ctx?.[h.field] || h.field, severity: h.severity, description: h.description, status: 'ACTIVE', source: 'eol-detection', field: h.field },
        requiresConfirmation: false,
      });
      return `⚠️ ${h.short} [${h.severity}] — ${h.description}`;
    });
    return {
      reply: `Compatibility scan — ${hits.length} issue${hits.length !== 1 ? 's' : ''} found:\n\n${lines.join('\n\n')}\n\nConfirm below to create incidents. All findings are automatically registered in the Vulnerability Registry (Vulnerabilities tab). They flow to topology, RTM, Gantt, and Excel export.`,
      actions,
    };
  }

  // ── Add incident directly ──────────────────────────────────────────────────
  const addIncMatch = raw.match(/\badd incident[:\s]+(.+)/i) || raw.match(/\bcreate incident[:\s]+(.+)/i) || raw.match(/\bnew incident[:\s]+(.+)/i);
  if (addIncMatch) {
    const title = addIncMatch[1].trim();
    const incId = `INC-MENTOR-${Date.now()}`;
    return {
      reply: '',
      actions: [{
        type: 'ADD_INCIDENT',
        description: `Add incident: ${title}`,
        params: { id: incId, code: incId, short: title, txt: title, grp: 'Custom', sev: 'HIGH', owner: 'PM', layers: [] },
        requiresConfirmation: false,
      }],
    };
  }

  // ── Add UUM / component item ───────────────────────────────────────────────
  const addUumMatch = raw.match(/\badd (uum|component|upgrade|migration|patch)[:\s]+(.+)/i);
  if (addUumMatch) {
    const typeWord = addUumMatch[1].toLowerCase();
    const title = addUumMatch[2].trim();
    const uumId = `UUM-MENTOR-${Date.now()}`;
    const uumType = typeWord === 'patch' ? 'patch' : typeWord === 'upgrade' ? 'upgrade' : 'migration';
    return {
      reply: '',
      actions: [{
        type: 'ADD_UUM_ITEM',
        description: `Add UUM item: ${title}`,
        params: { id: uumId, short: title, txt: title, grp: 'Custom', layer: 'os', type: uumType, layers: ['os'] },
        requiresConfirmation: false,
      }],
    };
  }

  // ── Add task to Gantt ──────────────────────────────────────────────────────
  const addTaskMatch = raw.match(/\badd task[:\s]+(.+)/i)
    || raw.match(/\bnew task[:\s]+(.+)/i)
    || raw.match(/\bcreate task[:\s]+(.+)/i)
    || raw.match(/\btask[:\s]+add[:\s]+(.+)/i);
  if (addTaskMatch) {
    const rawTitle = addTaskMatch[1].trim();
    // Parse optional hours from title: "4h", "~8 hours", etc.
    const hoursMatch = rawTitle.match(/[~≈]?(\d+)\s*h(?:ours?)?/i);
    const est_hours = hoursMatch ? parseInt(hoursMatch[1]) : 4;
    const cleanTitle = rawTitle.replace(/[~≈]?\d+\s*h(?:ours?)?/i, '').replace(/\s*[-—]\s*(under|in|for)\s+(db|database|unix|os|web|storage|backup|network|security|monitoring|qa)\b.*/i, '').trim().replace(/\s+/g, ' ');

    // Group detection from task title keywords
    const TASK_GROUPS = [
      { pattern: /\b(db|database|oracle|postgres|mysql|sql\s?server|mssql|mongodb|sybase)\b/i, group: 'database', label: 'Database' },
      { pattern: /\b(unix|linux|os|rhel|aix|solaris|windows\s+server|kernel|patching|os\s+update)\b/i, group: 'unix', label: 'Unix / OS' },
      { pattern: /\b(web|nginx|apache|iis|tomcat|app\s?server|weblogic|jboss|was|websphere|node)\b/i, group: 'web', label: 'Web / App Server' },
      { pattern: /\b(storage|san|nas|volume|lun|nfs|disk|filesystem|mount|vg|lvm)\b/i, group: 'storage', label: 'Storage' },
      { pattern: /\b(backup|restore|recovery|snapshot|rman|bacula|veeam|archive|rpo|rto)\b/i, group: 'backup', label: 'Backup / Recovery' },
      { pattern: /\b(network|firewall|vlan|dns|lb|load.?balance|switchover|routing|ip\s?range)\b/i, group: 'network', label: 'Network' },
      { pattern: /\b(security|cert|tls|ssl|certificate|iam|privilege|siem|hardening|scan|vulnerability)\b/i, group: 'security', label: 'Security' },
      { pattern: /\b(monitor|alert|grafana|nagios|zabbix|splunk|log|metric|observability|apm)\b/i, group: 'monitoring', label: 'Monitoring' },
      { pattern: /\b(test|qa|uat|regression|smoke|validation|verify|sign.?off|acceptance)\b/i, group: 'qa', label: 'QA / Testing' },
    ];
    // Also check explicit "under X" suffix in raw input
    const underMatch = rawTitle.match(/[-—]\s*(under|in|for|group[:\s]+)\s*(.+)/i);
    const explicitGroup = underMatch ? TASK_GROUPS.find(g => g.pattern.test(underMatch[2])) : null;
    const detected = explicitGroup || TASK_GROUPS.find(g => g.pattern.test(cleanTitle));

    if (detected) {
      const taskId = `mentor-${Date.now()}`;
      return {
        reply: '',
        actions: [{
          type: 'ADD_CUSTOM_TASK',
          description: `Add "${cleanTitle}" to ${detected.label} (~${est_hours}h)`,
          params: { id: taskId, title: cleanTitle, est_hours, group: detected.group, notes: 'Added via OpsMentor', addedAt: new Date().toISOString() },
          requiresConfirmation: false,
        }, {
          type: 'NAVIGATE_TAB',
          description: 'Go to Gantt',
          params: { tab: 'gantt' },
          requiresConfirmation: false,
        }],
      };
    }

    // Group not detected — ask with clear prompt
    return {
      reply: `I'll add **"${cleanTitle}"** (~${est_hours}h) to the Gantt. Which group should it belong to?\n\n` +
        `**DB** · **Unix/OS** · **Web** · **Storage** · **Backup** · **Network** · **Security** · **Monitoring** · **QA**\n\n` +
        `You can also type: *"add task: ${cleanTitle} — under Security"*`,
      _pendingTask: { title: cleanTitle, est_hours },
    };
  }

  // Add issue/risk to RAID
  const addRaidMatch = raw.match(/\badd (issue|risk|assumption|decision|dependency)[:\s]+(.+)/i) || raw.match(/\brad to raid[:\s]+(.+)/i);
  if (addRaidMatch) {
    const type = (addRaidMatch[1] || 'ISSUE').toUpperCase().replace('RAD', 'ISSUE');
    const desc = (addRaidMatch[2] || addRaidMatch[1] || '').trim();
    const id = `raid-${Date.now()}`;
    return {
      reply: '',
      actions: [{
        type: 'ADD_RAID_ENTRY',
        description: `Add ${type} to RAID log`,
        params: { id, type, description: desc, severity: 'MED', mitigation: 'Pending', status: 'OPEN', owner: 'PM', addedAt: new Date().toISOString() },
        requiresConfirmation: false,
      }, {
        type: 'NAVIGATE_TAB',
        description: 'Go to RAID',
        params: { tab: 'raid' },
        requiresConfirmation: false,
      }],
    };
  }

  // Set system design field — all 8 section keys + common aliases
  // "set unix cpu to 16", "network bandwidth is 10GbE", "set db max_conn to 200"
  const SECTION_PAT = '(?:unix|unix\\/os|os layer|web|app(?:lication)?|db|database|storage|backup|network|security|compliance|monitoring|ha|high[- ]?availability|dr|disaster[- ]?recovery)';
  const designMatch = raw.match(new RegExp(`\\bset\\s+(${SECTION_PAT})\\s+([\\w][\\w\\s-]*?)\\s*(?:=|:|to|as)\\s*(.+)`, 'i'))
    || raw.match(new RegExp(`\\b(${SECTION_PAT})\\s+([\\w][\\w\\s-]*?)\\s+is\\s+(.+)`, 'i'));
  if (designMatch) {
    const sectionRaw = designMatch[1].toLowerCase()
      .replace(/^unix\/os$|^os layer$/, 'unix')
      .replace(/^application$/, 'app')
      .replace(/^database$/, 'db')
      .replace(/^disaster[- ]?recovery$/, 'dr')
      .replace(/^high[- ]?availability$/, 'ha');
    const SECTION_MAP = {
      unix: 'unix', web: 'web', app: 'app', db: 'db',
      storage: 'storage', backup: 'backup', network: 'network', security: 'security',
      compliance: 'compliance', monitoring: 'monitoring', ha: 'ha', dr: 'dr',
    };
    const section = SECTION_MAP[sectionRaw] || sectionRaw;
    const field = designMatch[2].trim().toLowerCase().replace(/\s+/g, '_');
    const value = designMatch[3].trim();
    if (!s.isBuilt) return { reply: 'Build the stack first — System Design fields become available after Phase 1.' };
    return {
      reply: '',
      actions: [{
        type: 'SET_DESIGN_FIELD',
        description: `${section} → ${field} = ${value}`,
        params: { section, field, value },
        requiresConfirmation: false,
      }, {
        type: 'NAVIGATE_TAB',
        description: 'Open System Design',
        params: { tab: 'design' },
        requiresConfirmation: false,
      }],
    };
  }

  // ── Encouragement / open-ended ─────────────────────────────────────────────
  // Only intercept pure acknowledgements (no trailing question or substantive content)
  {
    const isPureEncouragement = /^(thank\s*you|thanks|great|good\s*job|perfect|awesome|excellent|nice)[,!.\s]*$/i.test(raw.trim());
    if (isPureEncouragement) {
      if (s.promoted) return { reply: 'System is live and closure is underway. Good work getting here.' };
      if (s.rtmSigned) return { reply: 'RTM is signed — change window is the last gate.' };
      if (s.cabApproved) return { reply: 'Good progress. RTM is the final technical gate before cutover.' };
      if (s.phase2Active) return { reply: 'Making solid progress. Gantt and CAB package are next in line.' };
      if (s.designApplied) return { reply: 'Design is locked. Phase 2 is ready to inject from the sidebar whenever you are.' };
      if (s.scanComplete) return { reply: 'Scan is done — System Design is where the findings become traceable requirements.' };
      if (s.isBuilt) return { reply: 'Stack locked. Scan is the next move.' };
      return null; // Let LLM give a natural response
    }
  }

  // ── Greeting — only intercept pure greetings (no question, no trailing content) ──
  // Any message with "?" or longer than 4 words that starts with a greeting goes to the LLM
  // so the actual question gets a real answer, not a workflow prompt.
  {
    const isPureGreeting = /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)[,!.\s]*$/i.test(raw.trim());
    if (isPureGreeting) {
      if (s.promoted) return { reply: 'Hey — system is live. Anything specific you want to check?' };
      if (s.rtmSigned) return { reply: 'Hey — RTM is signed. Change window is the last gate before go-live.' };
      if (s.cabApproved) return { reply: 'Hey — CAB approved, RTM is open for sign-off.' };
      if (s.phase2Active) return { reply: 'Hey — Phase 2 is live. Gantt has your full task plan when you\'re ready.' };
      if (s.designApplied) return { reply: 'Hey — design is locked. Ready to inject Phase 2?' };
      if (s.scanComplete) return { reply: 'Hey — scan is done. System Design is next.' };
      if (s.isBuilt) return { reply: 'Hey — stack is locked. Run the scan to surface any EOL or CVE gaps.' };
      return null; // Blank build: let LLM give a warm, context-aware welcome
    }
    // If message starts with a greeting BUT has more content — fall through to LLM
  }

  // ── Share / can I / custom questions ──────────────────────────────────────
  // Only intercept the explicit "can I paste/enter something here" pattern, not general questions
  if (/\b(can i|may i)\b.{0,30}\b(paste|share|send|copy|enter|type|add|provide)\b/i.test(m) && /\b(here|this|requirement|detail|value|info)\b/.test(m)) {
    const next = nextPhase1Prompt(s);
    return { reply: `Absolutely — just type it directly. For example:\n• "hardware is Dell PowerEdge R750"\n• "OS is RHEL 8.6"\n• "project name is Server Migration Q3"\n\n${next || 'All Phase 1 fields look complete — ask me anything else.'}` };
  }

  // ── Compatibility question — check selected stack + free text ────────────────
  if (/\b(compat|support(ed)?|certif|can.*run|will.*work|platform|pam|matrix)\b/.test(m)) {
    const hits = checkCompatibility(s.ctx || {});
    if (hits.length > 0) {
      const liveCompatData = s.liveCompatData || {};
      const verifiedAt     = s.liveCompatVerifiedAt
        ? `Live EOL data verified ${new Date(s.liveCompatVerifiedAt).toLocaleString()}.`
        : 'Live EOL data not yet loaded — static vendor PAM data in use.';
      const bullets = hits.map(r => {
        const sev  = r.severity === 'critical' ? '🔴 CRITICAL' : r.severity === 'warn' ? '⚠ Warning' : 'ℹ Info';
        const live = liveCompatData[r.id];
        const liveTag = live
          ? (live.status === 'eol' || live.status === 'eos'
              ? ` [Live ✓ EOL confirmed${live.eolDate && live.eolDate !== 'EOL' ? ' ' + live.eolDate : ''}]`
              : live.status === 'active'
              ? ' [Live ⚡ vendor may have extended support — re-verify]'
              : '')
          : '';
        const refs = (r.refs || []).slice(0, 2).map(rf => `  → ${rf.label}`).join('\n');
        return `${sev}: ${r.title}${liveTag}\n${r.detail}${refs ? '\n' + refs : ''}`;
      }).join('\n\n');
      return {
        reply: `Compatibility issues detected for the current stack (${s.ctx?.hw}/${s.ctx?.os}/${s.ctx?.db}/${s.ctx?.app}):\n\n${bullets}\n\nThese are documented vendor platform restrictions — not opinions. Address them before provisioning.\n\n${verifiedAt}`,
      };
    }
    // If no hits but question was asked, reassure with live-check context
    if (s.ctx?.hw || s.ctx?.os || s.ctx?.db) {
      const verifiedAt = s.liveCompatVerifiedAt
        ? `Live EOL data verified ${new Date(s.liveCompatVerifiedAt).toLocaleString()}.`
        : '';
      return {
        reply: `No known vendor platform conflicts for the current stack (${[s.ctx?.hw, s.ctx?.os, s.ctx?.db, s.ctx?.app].filter(Boolean).join('/')}). Checks run against 62 rules covering SAP, Oracle, Microsoft, IBM, Red Hat, PostgreSQL, Apache, VMware, and more. ${verifiedAt}`,
      };
    }
  }

  // Unrecognised — let Groq handle free-form questions with full context
  return null;
}
