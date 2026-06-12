// Orchestrator chat client.
// Calls the worker /orchestrator-chat route (Groq-powered NLP).
// Falls back to rule-based state queries when Groq is unavailable.

import { CARTESIA_WORKER_URL } from './cartesia.js';
import { generateScript } from './orchestratorScripts.js';

const CHAT_URL = CARTESIA_WORKER_URL; // same worker handles all routes

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

// ── Rule-based fallback — answers state questions locally ─────────────────────
// Returns a string reply or null (fall through to Groq).

export function ruleBasedResponse(message, s, authUser) {
  const m = message.toLowerCase().trim();

  // Status / current state
  if (/\b(status|state|where are we|phase|current state|progress)\b/.test(m)) {
    const script = generateScript(s);
    return `Current phase: ${script.title}. ${script.nextAction ? 'Next action: ' + script.nextAction : ''}`;
  }

  // Who is [role]
  const whoMatch = m.match(/\bwho is (the )?(unix|db|app|network|storage|backup|security|pm|change manager|qa)\b/);
  if (whoMatch) {
    const keyword = whoMatch[2];
    const roleMap = {
      unix: 'Unix Admin', db: 'DB Admin', app: 'App Admin', network: 'Net Admin',
      storage: 'Storage Admin', backup: 'Backup Admin', security: 'SecOps',
      pm: 'PM', 'change manager': 'Change Manager', qa: 'QA Team Lead',
    };
    const roleName = roleMap[keyword];
    const assignment = s.roleAssignments?.[roleName];
    if (assignment?.name) return `${roleName}: ${assignment.name} <${assignment.email}>`;
    return `${roleName} has not been assigned yet.`;
  }

  // RTM status
  if (/\b(rtm|traceability|sign.?off)\b/.test(m) && /\b(status|done|complete|ready)\b/.test(m)) {
    const counts = Object.values(s.rtmRows || {}).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});
    return `RTM: ${counts.PASS || 0} PASS, ${counts.FAIL || 0} FAIL, ${counts.PENDING || 0} PENDING, ${counts.NA || 0} NA. ${s.rtmSigned ? 'Signed.' : 'Not yet signed.'}`;
  }

  // What's next
  if (/\b(what.s next|next step|what do|what should)\b/.test(m)) {
    const script = generateScript(s);
    return `Next: ${script.nextAction || 'No further actions — build is complete.'}`;
  }

  // Stack info
  if (/\b(stack|platform|hardware|os|database|app)\b/.test(m) && /\b(what|which|current)\b/.test(m)) {
    const { hw, os, db, app } = s.ctx || {};
    return `Stack: HW=${hw || 'not set'} | OS=${os || 'not set'} | DB=${db || 'not set'} | App=${app || 'not set'}`;
  }

  return null; // caller should try Groq
}
