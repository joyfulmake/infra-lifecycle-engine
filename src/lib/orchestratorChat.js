// Orchestrator chat client.
// Calls the worker /orchestrator-chat route (Groq-powered NLP).
// Falls back to rich rule-based mentor guidance when Groq is unavailable.

import { CARTESIA_WORKER_URL } from './cartesia.js';
import { generateScript } from './orchestratorScripts.js';

const CHAT_URL = CARTESIA_WORKER_URL;

// ── Groq-powered chat ─────────────────────────────────────────────────────────

export async function sendChatMessage(message, stateContext) {
  const res = await fetch(`${CHAT_URL}/orchestrator-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context: stateContext }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Worker error ${res.status}`);
  }

  const data = await res.json();
  return data.result; // { reply, actions, nextPrompt }
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

  // ── Field-setting commands — parse and return with actions ────────────────
  const ctxField = parseSetField(raw);
  if (ctxField) {
    const next = nextPhase1Prompt({ ...s, ctx: { ...s.ctx, [ctxField.field]: ctxField.value } });
    return {
      reply: `Got it — ${ctxField.label} set to "${ctxField.value}".${next ? '\n\n' + next : '\n\nAll stack fields are set. Click "Build" in the left panel to continue to AI Smart Scan.'}`,
      actions: [{
        type: 'SET_CTX',
        description: `Set ${ctxField.label} to ${ctxField.value}`,
        payload: { [ctxField.field]: ctxField.value },
        requiresConfirmation: false,
      }],
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
        payload: { [reqField.field]: reqField.value },
        requiresConfirmation: false,
      }],
    };
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
    return { reply: `I'm your Expert Orchestrator — here's what I can do:\n\n📋 Guide you through all 7 lifecycle phases step by step\n🔧 Set Phase 1 values ("hardware is Dell PowerEdge R750")\n📊 Check build status, RTM, role assignments, stack info\n⚠️ Surface coherence alerts and stale data warnings\n✅ Execute workflow actions with your confirmation\n🎙️ Voice narration for each phase (click ▶ Voice)\n\nTry asking:\n• "What's the current status?"\n• "Who is the Unix Admin?"\n• "Is the RTM ready?"\n• "What's next in the workflow?"\n• "OS is RHEL 8.6"` };
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

  // ── RTM status ─────────────────────────────────────────────────────────────
  if (/\b(rtm|traceability|sign.?off)\b/.test(m) && /\b(status|done|complete|ready|check)\b/.test(m)) {
    const counts = Object.values(s.rtmRows || {}).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});
    const total = Object.keys(s.rtmRows || {}).length;
    const allPass = (counts.PASS || 0) + (counts.NA || 0) === total && total > 0;
    return { reply: `RTM Status: ${counts.PASS || 0} PASS · ${counts.FAIL || 0} FAIL · ${counts.PENDING || 0} PENDING · ${counts.NA || 0} NA\n${s.rtmSigned ? '✓ RTM is signed off.' : allPass ? 'All rows pass — ready to sign off in the RTM tab.' : 'Not yet ready to sign. Review FAIL and PENDING rows in the RTM tab.'}` };
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
    if (!s.designApplied) return { reply: 'Go to the System Design tab. Fill in the 8 sections (Network, Storage, Security, etc.) then click "Lock & Apply Design" to proceed.' };
    return { reply: 'System Design is applied. Be careful — changes now will mark Gantt tasks as stale.' };
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

  // ── Encouragement / open-ended ─────────────────────────────────────────────
  if (/\b(thank|thanks|great|good|perfect|awesome)\b/.test(m)) {
    return { reply: 'You\'re welcome! Let me know whenever you need guidance on the next step.' };
  }

  if (/\b(hi|hello|hey|good morning|good afternoon)\b/.test(m)) {
    const next = nextPhase1Prompt(s);
    return { reply: `Hello! I'm ready to help. ${next ? 'Where are we?\n\n' + next : generateScript(s).nextAction ? 'Next: ' + generateScript(s).nextAction : 'Your build is complete!'}` };
  }

  return null; // caller tries Groq
}
