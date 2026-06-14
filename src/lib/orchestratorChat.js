// Orchestrator chat client.
// Calls the worker /orchestrator-chat route (Groq-powered NLP).
// Falls back to rich rule-based mentor guidance when Groq is unavailable.

import { CARTESIA_WORKER_URL } from './cartesia.js';
import { generateScript } from './orchestratorScripts.js';
import { computeAllRisks, riskScore, riskLabel } from './riskEngine.js';

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

function getStakeholderChecks(field, value) {
  return STAKEHOLDER_CHECKS.filter(c => c.field === field && c.pattern.test(value));
}

function checkEolForField(field, value) {
  return EOL_KNOWN.filter(e => e.field === field && e.pattern.test(value));
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
  if (!hw) return `What is the hardware platform? (e.g. ${HW_EXAMPLES.split(',')[0]})`;
  if (!os) return `Great! Now the operating system? (e.g. ${OS_EXAMPLES.split(',')[0]})`;
  if (!db) return `Good. Which database? (e.g. ${DB_EXAMPLES.split(',')[0]})`;
  if (!app) return `Almost there — which application or middleware? (e.g. ${APP_EXAMPLES.split(',')[0]})`;
  if (!r.projectName) return `Stack is set. What is the project name?`;
  if (!r.envType) return `What is the environment type? (Production, UAT, DR, Dev, SIT)`;
  if (!r.goLiveDate) return `What is the target go-live date? (e.g. 2026-09-15)`;
  if (!r.sla) return `What SLA tier applies? (Tier 1 = 99.99%, Tier 2 = 99.9%, Tier 3 = 99.5%)`;
  return null;
}

// Parse "set X to Y" or "X is Y" patterns
function parseSetField(m) {
  // HW
  if (/\b(hw|hardware|server|platform)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(hw|hardware|server|platform)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'hw', value: v, label: 'Hardware' };
  }
  // OS
  if (/\b(os|operating system|operating-system)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(os|operating system|operating-system)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'os', value: v, label: 'OS' };
  }
  // DB
  if (/\b(db|database|database system)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(db|database|database system)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'db', value: v, label: 'Database' };
  }
  // App
  if (/\b(app|application|middleware|web server)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(app|application|middleware|web server)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'app', value: v, label: 'Application' };
  }
  return null;
}

function parseSetRequirement(m) {
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
  // Go-live date
  if (/\b(go.?live|go live date|cutover date|target date)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(go.?live|go live date|cutover date|target date)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'goLiveDate', value: v, label: 'Go-Live Date' };
  }
  // SLA
  if (/\b(sla|service level)\b.{0,10}(is|:|=|to)\s+(.+)/i.test(m)) {
    const v = m.match(/\b(sla|service level)\b.{0,10}(?:is|:|=|to)\s+(.+)/i)?.[2]?.trim();
    if (v) return { field: 'sla', value: v, label: 'SLA' };
  }
  return null;
}

export function ruleBasedResponse(message, s, authUser) {
  const m = message.toLowerCase().trim();
  const raw = message.trim();

  // ── Field-setting commands — parse and return with actions + EOL detection ─
  const ctxField = parseSetField(raw);
  if (ctxField) {
    const updatedCtx = { ...s.ctx, [ctxField.field]: ctxField.value };
    const next = nextPhase1Prompt({ ...s, ctx: updatedCtx });
    const allFilled = !!(updatedCtx.hw && updatedCtx.os && updatedCtx.db && updatedCtx.app);

    // EOL / incompatibility detection
    const eolHits = checkEolForField(ctxField.field, ctxField.value);
    const eolWarnings = eolHits.map(h =>
      `⚠️ EOL DETECTED: "${ctxField.value}" matches "${h.short}" — ${h.description} (EOL: ${h.eolDate})`
    ).join('\n');

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

    // Auto-trigger scan if all 4 fields now filled and scan not done
    if (allFilled && s.isBuilt && !s.scanComplete) {
      actions.push({
        type: 'RUN_SCAN',
        description: 'Auto-run AI Smart Scan (all stack fields complete)',
        requiresConfirmation: false,
      });
    }

    const eolNote = eolHits.length > 0
      ? `\n\n${eolWarnings}\n\nI can create incident and vulnerability entries for these. Confirm below.`
      : '';

    const stakeholderNote = stakeholderChecks.length > 0
      ? `\n\n⬡ Stakeholder discussions opened:\n${stakeholderChecks.map(sc => `• ${sc.owner}: ${sc.topic}`).join('\n')}\nThese appear in the RAID log and Vulnerabilities tab. Mark each as "AGREED" when the team/client confirms.`
      : '';

    const nextNote = allFilled && !s.isBuilt
      ? '\n\nAll stack fields are set. Click "Build" in the left panel to continue to AI Smart Scan.'
      : allFilled && s.isBuilt && !s.scanComplete
      ? '\n\nAll stack fields complete — running AI Smart Scan now.'
      : next ? '\n\n' + next : '';

    return {
      reply: `Got it — ${ctxField.label} set to "${ctxField.value}".${eolNote}${stakeholderNote}${nextNote}`,
      actions,
    };
  }

  const reqField = parseSetRequirement(raw);
  if (reqField) {
    const next = nextPhase1Prompt({ ...s, requirements: { ...s.requirements, [reqField.field]: reqField.value } });
    return {
      reply: `${reqField.label} set to "${reqField.value}".${next ? '\n\n' + next : '\n\nAll Phase 1 fields are complete. Click "Build" in the left panel.'}`,
      actions: [{
        type: 'SET_REQUIREMENT',
        description: `Set ${reqField.label} to ${reqField.value}`,
        params: { key: reqField.field, value: reqField.value },
        requiresConfirmation: false,
      }],
    };
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

  // ── RTM status (before generic status matcher) ────────────────────────────
  if (/\b(rtm|traceability)\b/.test(m) && /\b(status|done|complete|ready|check)\b/.test(m)) {
    const counts = Object.values(s.rtmRows || {}).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});
    const total = Object.keys(s.rtmRows || {}).length;
    const allPass = (counts.PASS || 0) + (counts.NA || 0) === total && total > 0;
    return { reply: `RTM Status: ${counts.PASS || 0} PASS · ${counts.FAIL || 0} FAIL · ${counts.PENDING || 0} PENDING · ${counts.NA || 0} NA\n${s.rtmSigned ? '✓ RTM is signed off.' : allPass ? 'All rows pass — ready to sign off in the RTM tab.' : 'Not yet ready to sign. Review FAIL and PENDING rows in the RTM tab.'}` };
  }

  // ── Phase 1 guidance ──────────────────────────────────────────────────────
  if (/\b(phase 1|phase1|build requirements|start|begin|get started|what do i enter|where do i start)\b/.test(m)) {
    return { reply: PHASE1_FIELDS };
  }

  if (/\b(what is hardware|what.*hw|explain hardware|hw.*mean|hardware.*field)\b/.test(m)) {
    return { reply: `Hardware (HW) is the physical server platform — the chassis/blade type that will host the OS and application stack.\n\nExamples: ${HW_EXAMPLES}\n\nThis drives EOL detection, task generation, and the infrastructure topology diagram.` };
  }

  if (/\b(what is.*\bos\b|what.*operating system|os.*mean|os.*field)\b/.test(m)) {
    return { reply: `OS is the Operating System installed on the server.\n\nExamples: ${OS_EXAMPLES}\n\nThis affects system design defaults, patch tasks, reboot windows, and EOL/EOS lifecycle tracking.` };
  }

  if (/\b(what is.*\bdb\b|what.*database|db.*mean|database.*field)\b/.test(m)) {
    return { reply: `DB is the database engine running on the platform.\n\nExamples: ${DB_EXAMPLES}\n\nThis sets up DB schema migration tasks, backup validation, replication checks, and EOL tracking.` };
  }

  if (/\b(what is.*\bapp\b|what.*application|what.*middleware|app.*mean|middleware.*mean)\b/.test(m)) {
    return { reply: `App/Middleware is the application server or web tier layer.\n\nExamples: ${APP_EXAMPLES}\n\nThis drives deployment tasks, port config, JVM tuning fields, and connection pool sizing in System Design.` };
  }

  // ── Help / capabilities ───────────────────────────────────────────────────
  if (/\b(help|what can you do|capabilities|commands|how do i use|what.*do)\b/.test(m)) {
    return { reply: `I'm your OpsMentor — here's what I can do:\n\n📋 Guide you through all 7 lifecycle phases step by step\n🔧 Set Phase 1 values: "OS is RHEL 8.6", "hardware is Dell PowerEdge R750"\n⚠️ Detect EOL/incompatibilities as you type stack info — auto-create incidents\n🔍 Check full stack compatibility: "check incompatibilities"\n🩺 Add incidents: "add incident: kernel vulnerability"\n📦 Add UUM items: "add upgrade: OpenSSL 3.x"\n📋 Add tasks: "add task: pre-migration backup validation"\n📝 Add to RAID: "add risk: no rollback window confirmed"\n📊 Check status, RTM, alerts, role assignments\n✅ Execute workflow actions with your confirmation\n🎙️ Voice input + Cartesia voice narration\n\nAll incidents, UUM items, and tasks sync to: topology diagram, RTM, Gantt, dependency matrix, and Excel export automatically.\n\nTry: "check incompatibilities" or "what's next?"` };
  }

  // ── Status / current state ─────────────────────────────────────────────────
  if (/\b(status|state|where are we|phase|current state|progress|summary)\b/.test(m)) {
    const script = generateScript(s);
    const { hw, os, db, app } = s.ctx || {};
    const stack = [hw, os, db, app].filter(Boolean).join(' | ') || 'Not set yet';
    return { reply: `Current Phase: ${script.title}\nStack: ${stack}\n${s.requirements?.projectName ? 'Project: ' + s.requirements.projectName + '\n' : ''}${script.nextAction ? 'Next action: ' + script.nextAction : 'No further actions needed.'}` };
  }

  // ── Who is [role] ──────────────────────────────────────────────────────────
  const whoMatch = m.match(/\bwho is (the )?(unix|db|app|network|storage|backup|security|pm|change manager|qa|dba)\b/);
  if (whoMatch) {
    const keyword = whoMatch[2];
    const roleMap = {
      unix: 'Unix Admin', db: 'DB Admin', dba: 'DB Admin', app: 'App Admin', network: 'Net Admin',
      storage: 'Storage Admin', backup: 'Backup Admin', security: 'SecOps',
      pm: 'PM', 'change manager': 'Change Manager', qa: 'QA Team Lead',
    };
    const roleName = roleMap[keyword];
    const assignment = s.roleAssignments?.[roleName];
    if (assignment?.name) return { reply: `${roleName}: ${assignment.name} — ${assignment.email || 'no email set'}${assignment.backup ? '\nBackup: ' + assignment.backup : ''}` };
    return { reply: `${roleName} has not been assigned yet. Go to the Roles tab to assign team members.` };
  }

  // ── What's next ────────────────────────────────────────────────────────────
  if (/\b(what.?s next|next step|what do i do|what should|guide me)\b/.test(m)) {
    const script = generateScript(s);
    const next = nextPhase1Prompt(s);
    if (next && !s.isBuilt) return { reply: `Phase 1 isn't complete yet.\n\n${next}` };
    return { reply: `Next: ${script.nextAction || 'Build is complete — all phases done.'}` };
  }

  // ── Stack info ─────────────────────────────────────────────────────────────
  if (/\b(stack|platform|hardware|os|database|app)\b/.test(m) && /\b(what|which|current|show)\b/.test(m)) {
    const { hw, os, db, app } = s.ctx || {};
    const next = nextPhase1Prompt(s);
    return { reply: `Current stack:\n• HW: ${hw || 'not set'}\n• OS: ${os || 'not set'}\n• DB: ${db || 'not set'}\n• App: ${app || 'not set'}${next ? '\n\n' + next : ''}` };
  }

  // ── CAB status ─────────────────────────────────────────────────────────────
  if (/\b(cab|change advisory|change approval|change board)\b/.test(m)) {
    if (s.cabApproved) return { reply: 'CAB has approved this change. You are cleared for cutover.' };
    if (s.cabDeclined) return { reply: 'CAB declined this change. Click "Unlock Tabs for Revision" in the sidebar to revise and resubmit.' };
    if (s.phase2Active) return { reply: 'CAB submission is ready — scroll to the CAB section in the left sidebar to submit.' };
    return { reply: 'CAB submission is gated behind Phase 2 injection. Complete Gantt scheduling first.' };
  }

  // ── Coherence / alerts ─────────────────────────────────────────────────────
  if (/\b(alerts|warnings|issues|coherence|risks|problems)\b/.test(m)) {
    const alerts = s.coherenceAlerts || [];
    if (alerts.length === 0) return { reply: 'No coherence alerts at this time. All cross-tab checks passed.' };
    const lines = alerts.map(a => `${a.severity === 'warn' ? '⚠️' : 'ℹ️'} ${a.message}`).join('\n');
    return { reply: `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} active:\n\n${lines}` };
  }

  // ── Incidents / UUM info ───────────────────────────────────────────────────
  if (/\b(incident|incidents|selected incidents|inc)\b/.test(m) && /\b(what|which|show|list)\b/.test(m)) {
    const count = (s.selInc || []).length;
    return { reply: count > 0 ? `${count} incident(s) selected. View them in the Exec Summary tab → Incident section.` : 'No incidents selected yet. Go to Phase 2 in the left panel after the AI scan to select incidents.' };
  }

  // ── Phase-specific hints ───────────────────────────────────────────────────
  if (/\b(system design|design tab|phase 3|design fields)\b/.test(m)) {
    if (!s.scanComplete) return { reply: 'System Design unlocks after the AI Smart Scan. Run the scan from the left panel first.' };
    if (!s.designApplied) return { reply: 'Go to the System Design tab. Fill in all 8 sections (Network, Storage, Security, Backup, Compliance, Monitoring, DR, HA).\n\nThere are TWO ways to proceed:\n1. "Generate Task Plan" — builds your Gantt task schedule AND locks the design (recommended)\n2. "Apply Design (skip tasks)" — locks the design without generating tasks\n\nClick "Generate Task Plan" to do both in one step.' };
    return { reply: 'System Design is locked and applied. Changes now will mark Gantt tasks as stale and require regeneration.' };
  }

  if (/\b(gantt|schedule|tasks|timeline)\b/.test(m)) {
    if (!s.phase2Active) return { reply: 'The Gantt chart unlocks after Phase 2 injection. Complete System Design and inject Phase 2 from the left panel.' };
    if (s.tasksStaleReason) return { reply: `Gantt tasks are stale: ${s.tasksStaleReason}\n\nClick "Regenerate Tasks" in the Gantt tab to refresh.` };
    return { reply: 'Open the Gantt tab to review the project schedule. You can adjust durations, set parallel tasks, and view the critical path.' };
  }

  if (/\b(closure|close out|post.?go.?live|closing)\b/.test(m)) {
    if (!s.rtmSigned) return { reply: 'Closure unlocks after RTM sign-off. Complete the RTM tab first.' };
    return { reply: 'Go to the Closure tab to tick off post-go-live checks and add final notes. Once all checks are done, mark the build as promoted.' };
  }

  // ── Risk score / risk tracker ──────────────────────────────────────────────
  if (/\b(risk score|risk tracker|risk level|project risk|how risky|risk posture|show risks|critical risk)\b/.test(m)) {
    const allRisks = computeAllRisks(s);
    const score = riskScore(allRisks);
    const rl    = riskLabel(score);
    const crits = allRisks.filter(r => r.severity === 'CRITICAL');
    const highs  = allRisks.filter(r => r.severity === 'HIGH');
    const openCount = allRisks.filter(r => (s.riskAcknowledgments?.[r.id]?.status ?? 'open') !== 'closed').length;
    const topRisks = allRisks.slice(0, 3).map(r => `• [${r.severity}] ${r.title}`).join('\n');
    return {
      reply: `Risk Score: ${score} — ${rl.label.toUpperCase()}\n${crits.length} critical · ${highs.length} high · ${openCount} total open\n\nTop risks:\n${topRisks || 'None'}\n\nOpen the Risk Tracker tab for full details, action guidance, and acknowledgment controls.`,
      actions: [{ type: 'NAVIGATE_TAB', description: 'Open Risk Tracker', params: { tab: 'risks' }, requiresConfirmation: false }],
    };
  }

  // ── Cost queries ───────────────────────────────────────────────────────────
  if (/\b(cost|budget|spend|estimate|how much|project cost|over budget|daily rate|team size)\b/.test(m)) {
    const cfg = s.costConfig || {};
    if (!cfg.enabled) {
      return {
        reply: 'Cost tracking is currently off. Enable it in the Cost tab to get budget tracking, task-hour estimates, and risk-adjusted cost projections.\n\nOnce enabled, you can ask me things like:\n• "are we over budget?"\n• "set budget to 80000"\n• "team size is 8"\n• "what\'s driving cost?"',
        actions: [{ type: 'NAVIGATE_TAB', description: 'Open Cost tab', params: { tab: 'cost' }, requiresConfirmation: false }],
      };
    }
    // If enabled, give a summary
    const hpd = s.requirements?.hoursPerDay || 8;
    const daily = (cfg.dailyRatePerPerson || 800) * (cfg.teamSize || 5);
    return {
      reply: `Cost summary:\n• Team: ${cfg.teamSize || 5} people @ ${cfg.currency || 'USD'} ${cfg.dailyRatePerPerson || 800}/day\n• Daily team cost: ${cfg.currency || 'USD'} ${daily.toLocaleString()}\n• Risk contingency: ${cfg.contingencyPct || 20}%\n• Budget: ${cfg.totalBudget > 0 ? (cfg.currency || 'USD') + ' ' + cfg.totalBudget.toLocaleString() : 'not set'}\n\nOpen the Cost tab for full breakdown and budget vs. estimate tracker.`,
      actions: [{ type: 'NAVIGATE_TAB', description: 'Open Cost tab', params: { tab: 'cost' }, requiresConfirmation: false }],
    };
  }

  // ── Stakeholder discussions ────────────────────────────────────────────────
  if (/\b(stakeholder|discussion|agreed|agreement|client sign|client accept|team agree|who agreed|pending discussion|acceptance criteria)\b/.test(m)) {
    const discussions = s.stakeholderDiscussions || [];
    if (discussions.length === 0) {
      return { reply: 'No stakeholder discussions logged yet. These are automatically created when you set stack fields, or you can say "add discussion: [topic]" to create one manually.\n\nTip: Open the Vulnerabilities tab to see all pending discussions and update their status.' };
    }
    const pending = discussions.filter(d => d.status === 'PENDING' || d.status === 'IN_DISCUSSION');
    const agreed  = discussions.filter(d => d.status === 'AGREED');
    const lines   = pending.map(d => `• PENDING — [${d.owner}] ${d.topic}`).join('\n')
                  + (agreed.length > 0 ? `\n• ${agreed.length} agreed` : '');
    return {
      reply: `Stakeholder discussions — ${pending.length} pending, ${agreed.length} agreed:\n\n${lines || 'All discussions resolved.'}\n\nOpen the Vulnerabilities tab to update discussion status. Mark each as AGREED once the team and client have confirmed.`,
      actions: pending.length > 0 ? [{ type: 'NAVIGATE_TAB', description: 'Go to Vulnerabilities tab', params: { tab: 'vuln' }, requiresConfirmation: false }] : [],
    };
  }

  // ── Vulnerability status ───────────────────────────────────────────────────
  if (/\b(vuln|vulnerability|vulnerabilities|cve|security risk|risk register|known risk)\b/.test(m)) {
    const vulns = s.vulnRegistry || [];
    if (vulns.length === 0) {
      return { reply: 'No vulnerabilities registered yet. They are auto-created when I detect EOL/incompatibility issues. You can also say "add vulnerability: [title]" to register one manually.\n\nSay "check incompatibilities" to scan the current stack.' };
    }
    const active   = vulns.filter(v => v.status === 'ACTIVE');
    const parked   = vulns.filter(v => v.status === 'PARKED');
    const workaround = vulns.filter(v => v.status === 'WORKAROUND');
    const fixed    = vulns.filter(v => v.status === 'FIXED');
    const accepted = vulns.filter(v => v.status === 'ACCEPTED_RISK');
    const lines = active.map(v => `• ACTIVE [${v.severity}] ${v.title} — ${v.component}`).join('\n');
    return {
      reply: `Vulnerability Registry:\n• Active: ${active.length} | Parked: ${parked.length} | Workaround: ${workaround.length} | Fixed: ${fixed.length} | Accepted Risk: ${accepted.length}\n\n${lines || 'No active vulnerabilities.'}\n\nOpen the Vulnerabilities tab to update status, add business decisions, or set workarounds.`,
      actions: [{ type: 'NAVIGATE_TAB', description: 'Open Vulnerabilities tab', params: { tab: 'vuln' }, requiresConfirmation: false }],
    };
  }

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
      reply: `Creating incident "${title}" and adding it to the scope. It will appear in the topology, RTM, and Excel export.`,
      actions: [{
        type: 'ADD_INCIDENT',
        description: `Add incident: ${title}`,
        params: { id: incId, code: incId, short: title, txt: title, grp: 'Custom', sev: 'HIGH', owner: 'PM', layers: [] },
        requiresConfirmation: false,
      }, {
        type: 'NAVIGATE_TAB',
        description: 'Navigate to Exec Summary to see incidents',
        params: { tab: 'exec' },
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
      reply: `Adding "${title}" as a UUM ${uumType} item. It will appear in Gantt tasks, RTM, the dependency matrix, and Excel export.`,
      actions: [{
        type: 'ADD_UUM_ITEM',
        description: `Add UUM item: ${title}`,
        params: { id: uumId, short: title, txt: title, grp: 'Custom', layer: 'os', type: uumType, layers: ['os'] },
        requiresConfirmation: false,
      }, {
        type: 'NAVIGATE_TAB',
        description: 'Navigate to Exec Summary',
        params: { tab: 'exec' },
        requiresConfirmation: false,
      }],
    };
  }

  // ── Add task to Gantt ──────────────────────────────────────────────────────
  const addTaskMatch = raw.match(/\badd task[:\s]+(.+)/i) || raw.match(/\bnew task[:\s]+(.+)/i) || raw.match(/\bcreate task[:\s]+(.+)/i);
  if (addTaskMatch) {
    const title = addTaskMatch[1].trim();
    return {
      reply: `Got it — "${title}". Should I add this to the Gantt schedule or the RAID log?\n\nSay "gantt" or "raid".`,
      _pendingTask: title,
    };
  }

  // Add issue/risk to RAID
  const addRaidMatch = raw.match(/\badd (issue|risk|assumption|decision|dependency)[:\s]+(.+)/i) || raw.match(/\brad to raid[:\s]+(.+)/i);
  if (addRaidMatch) {
    const type = (addRaidMatch[1] || 'ISSUE').toUpperCase().replace('RAD', 'ISSUE');
    const desc = (addRaidMatch[2] || addRaidMatch[1] || '').trim();
    const id = `raid-${Date.now()}`;
    return {
      reply: `Added "${desc}" to the RAID log as a ${type}. Open the RAID tab to see it.`,
      actions: [{
        type: 'ADD_RAID_ENTRY',
        description: `Add ${type} to RAID log`,
        params: { id, type, description: desc, severity: 'MED', mitigation: 'Pending', status: 'OPEN', owner: 'PM', addedAt: new Date().toISOString() },
        requiresConfirmation: false,
      }, {
        type: 'NAVIGATE_TAB',
        description: 'Navigate to RAID tab',
        params: { tab: 'raid' },
        requiresConfirmation: false,
      }],
    };
  }

  // Set system design field: "set [section] [field]: [value]" or "network field firewall is pfsense"
  const designMatch = raw.match(/\bset\s+(network|storage|security|backup|compliance|monitoring|dr|ha)\s+(\w[\w\s]*?)\s*[=:to]+\s*(.+)/i)
    || raw.match(/\b(network|storage|security|backup|compliance|monitoring|disaster recovery|high availability)\s+(\w[\w\s]*?)\s+is\s+(.+)/i);
  if (designMatch) {
    const sectionRaw = designMatch[1].toLowerCase().replace('disaster recovery', 'dr').replace('high availability', 'ha');
    const sectionMap = { network: 'network', storage: 'storage', security: 'security', backup: 'backup', compliance: 'compliance', monitoring: 'monitoring', dr: 'dr', ha: 'ha' };
    const section = sectionMap[sectionRaw] || sectionRaw;
    const field = designMatch[2].trim().toLowerCase().replace(/\s+/g, '_');
    const value = designMatch[3].trim();
    if (!s.scanComplete) return { reply: 'System Design is locked until after the AI Smart Scan. Run the scan first.' };
    return {
      reply: `Setting ${section} → ${field} to "${value}". Open the System Design tab to review.`,
      actions: [{
        type: 'SET_DESIGN_FIELD',
        description: `Set ${section}/${field} = ${value}`,
        params: { section, field, value },
        requiresConfirmation: false,
      }],
    };
  }

  // ── Encouragement / open-ended ─────────────────────────────────────────────
  if (/\b(thank|thanks|great|good|perfect|awesome)\b/.test(m)) {
    return { reply: 'You\'re welcome! Let me know whenever you need guidance on the next step.' };
  }

  if (/\b(hi|hello|hey|good morning|good afternoon)\b/.test(m)) {
    const next = nextPhase1Prompt(s);
    return { reply: `Hello! I'm ready to help. ${next ? 'Where are we?\n\n' + next : generateScript(s).nextAction ? 'Next: ' + generateScript(s).nextAction : 'Your build is complete!'}` };
  }

  // ── Share / can I / custom questions ──────────────────────────────────────
  if (/\b(can i|share|send|paste|copy|enter|input|type|add|provide)\b/.test(m) && /\b(here|this|requirement|detail|value|info)\b/.test(m)) {
    const next = nextPhase1Prompt(s);
    return { reply: `Absolutely — just type it directly. For example:\n• "hardware is Dell PowerEdge R750"\n• "OS is RHEL 8.6"\n• "project name is Server Migration Q3"\n\n${next || 'All Phase 1 fields look complete — ask me anything else.'}` };
  }

  // Unrecognised — let Groq handle free-form questions with full context
  return null;
}
