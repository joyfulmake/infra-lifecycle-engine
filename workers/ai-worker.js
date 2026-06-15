/**
 * OpsManifest — AI Worker (Cloudflare Workers)
 * Proxies Groq API calls to avoid exposing the API key in the browser.
 *
 * Deploy:
 *   npm install -g wrangler
 *   wrangler deploy workers/ai-worker.js --name opsmanifest-ai
 *
 * Required environment variables (Cloudflare dashboard → Workers → Settings → Variables):
 *   GROQ_API_KEY   — gsk_... from console.groq.com
 *
 * Optional:
 *   GROQ_MODEL     — default: llama-3.3-70b-versatile
 *
 * Routes:
 *   POST /groq-enrich   — enrich a task with 7-point FSM metadata via Groq
 *   POST /groq-suggest  — stack-specific incident/UUM suggestions
 *   GET  /health        — liveness check
 *   OPTIONS *           — CORS preflight
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

async function groqChat(env, messages, maxTokens = 1024, temperature = 0.3) {
  const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── /groq-enrich — deepen a single task's 7-point FSM metadata ───────────────

async function handleEnrich(req, env) {
  const { task, ctx, existing } = await req.json();
  if (!task) return err('task is required');

  const taskName = task.title || task.name || '';
  const taskRole = task.role || task.team || '';
  const stack = [ctx?.hw, ctx?.os, ctx?.db, ctx?.app].filter(Boolean).join(' / ') || 'generic stack';

  const prompt = `You are a senior infrastructure engineer specialising in enterprise server provisioning.

TASK: ${taskName}
ROLE: ${taskRole}
STACK: ${stack}
DEP: ${task.dep || 'none specified'}
VALIDATE: ${task.validate || 'none specified'}

Existing metadata:
- Hardware Dimension: ${existing?.hwDimension || 'unknown'}
- Exec Engine: ${existing?.execEngine || 'unknown'}
- Blast Radius: ${existing?.blastRadius || 'unknown'}

Produce DEEPLY SPECIFIC, technically accurate enrichment for this exact task on this exact stack.
Return ONLY valid JSON with these exact keys (no markdown, no explanation):
{
  "execEngine": "exact shell commands or API calls for ${stack} — be specific to the OS/DB/App versions",
  "preCondition": "specific prerequisite states that must be true before this task can start",
  "postValidation": "specific telemetry command or metric that proves this task completed successfully",
  "blastRadius": "exactly which adjacent services or processes will fail if this task faults, with error types",
  "downstream": "specific next tasks that are unblocked when this task succeeds",
  "cveRisks": "any known CVEs or security risks relevant to this task on ${stack} (or 'none identified')",
  "bestPractice": "one key best practice or gotcha specific to this task on ${stack}"
}`;

  try {
    const groqRes = await groqChat(env, [{ role: 'user', content: prompt }], 1200);
    const content = groqRes.choices?.[0]?.message?.content || '';
    // Extract JSON from response
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in Groq response');
    const enriched = JSON.parse(match[0]);
    return json({ enriched, model: groqRes.model, usage: groqRes.usage });
  } catch (e) {
    return err(`Enrichment failed: ${e.message}`, 500);
  }
}

// ── /groq-suggest — suggest incidents or tasks for a given stack ──────────────

async function handleSuggest(req, env) {
  const { ctx, query } = await req.json();
  if (!ctx) return err('ctx is required');

  const stack = [ctx.hw, ctx.os, ctx.db, ctx.app].filter(Boolean).join(' / ');

  const prompt = `You are a senior infrastructure change manager.

Stack: ${stack}
Query: ${query || 'What are the highest-risk provisioning incidents for this stack?'}

List the top 5 most critical operational risks, incidents, or tasks for this specific stack.
Return ONLY valid JSON array (no markdown):
[
  { "risk": "short risk name", "severity": "CRITICAL|HIGH|MEDIUM", "description": "2-sentence technical description", "mitigation": "specific mitigation command or action" }
]`;

  try {
    const groqRes = await groqChat(env, [{ role: 'user', content: prompt }], 800);
    const content = groqRes.choices?.[0]?.message?.content || '';
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    const suggestions = JSON.parse(match[0]);
    return json({ suggestions, model: groqRes.model });
  } catch (e) {
    return err(`Suggest failed: ${e.message}`, 500);
  }
}

// ── /groq-uum-enrich — full enrichment of a custom UUM entry with tasks ──────

async function handleUumEnrich(req, env) {
  const { title, desc, layer, type } = await req.json();
  if (!title) return err('title is required');

  const prompt = `You are a principal infrastructure change architect. A user has described a custom infrastructure operation they need to execute:

Title: "${title}"
Description: "${desc || 'No additional description'}"
Primary Layer: ${layer}
Operation Type: ${type}

Generate a complete, production-ready change implementation package for this operation. Include:
1. A precise full description of the operation (technical, version-specific where possible)
2. Key risks and prerequisites
3. A sequenced task list — covering planning, pre-execution checks, execution steps, validation, and rollback — exactly as a skilled Unix/DBA/Middleware admin would execute this change

Return ONLY valid JSON (no markdown, no code fences):
{
  "description": "Precise one-paragraph technical description including source/target platforms and versions",
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "prerequisites": ["Prereq 1", "Prereq 2", "Prereq 3"],
  "tasks": [
    {
      "role": "Unix Admin|DBA|Storage Admin|Network Admin|Change Manager|QA Team|SysAdmin Lead|App Admin|Security Admin",
      "name": "Precise task name (imperative, specific)",
      "dep": "What must be true / completed before this task can start",
      "validate": "How to confirm this task succeeded (specific command or check)",
      "window": "Working hours|Weekend window|Change window|CAB meeting|Overnight window",
      "est_hours": 2
    }
  ]
}

Generate 8 to 14 tasks covering the full lifecycle. est_hours should be realistic (planning=1-2h, execution=4-16h, validation=1-4h). Total should be 40-120h for a migration.`;

  try {
    const groqRes = await groqChat(env, [{ role: 'user', content: prompt }], 2000);
    const content = groqRes.choices?.[0]?.message?.content || '';
    // Extract JSON object
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in response');
    const enriched = JSON.parse(match[0]);
    return json({ enriched, model: groqRes.model });
  } catch (e) {
    return err(`UUM enrich failed: ${e.message}`, 500);
  }
}

// ── /groq-uum-search — generate UUM operation entries from free-text query ────

async function handleUumSearch(req, env) {
  const { query } = await req.json();
  if (!query || !query.trim()) return err('query is required');

  const prompt = `You are a senior enterprise infrastructure operations architect with deep knowledge of ITIL, data centre operations, and system lifecycle management.

A user has typed the following free-text description of infrastructure work they need to capture in a change management system:
"${query.trim()}"

Generate 6 to 8 specific, real-world infrastructure operation entries that match this description. Each entry should be a discrete, schedulable operation that a Unix/Linux/DBA/Middleware admin would actually perform.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences:
[
  {
    "short": "Short code + title, max 60 chars, e.g. 'DBM-X01: SAP ASE 15.7 to 16 Migration'",
    "description": "One precise technical sentence describing the operation, version numbers, source/target platforms",
    "type": "upgrade|migration|update|patch",
    "layer": "os|db|app|web|security|storage|hardware|network|backup",
    "grp": "Category, e.g. 'Database Migrations' or 'OS Upgrades'"
  }
]

Be specific: include real product names, version numbers, and migration paths derived from the user's keywords. Cover the full breadth of what the query implies (e.g. pre-migration, migration, post-validation steps as separate entries).`;

  try {
    const groqRes = await groqChat(env, [{ role: 'user', content: prompt }], 1200);
    const content = groqRes.choices?.[0]?.message?.content || '';
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    const results = JSON.parse(match[0]);
    return json({ results, model: groqRes.model });
  } catch (e) {
    return err(`UUM search failed: ${e.message}`, 500);
  }
}

// ── /groq-mission-analysis — MissionHelp 4-section delivery/architecture report ─

async function handleMissionAnalysis(req, env) {
  const { ctx, customUUM, customInc, selInc, selUUM, sysDesignData, requirements, liveEolData } = await req.json();
  if (!ctx) return err('ctx is required');

  const stack = [ctx.hw, ctx.os, ctx.app, ctx.db].filter(Boolean).join(' → ') || 'not yet specified';
  const customEntries = [
    ...(customUUM || []).map(u => `${u.short || u.txt} [${u.type || 'update'}, ${(u.layers || []).join('+')}]`),
    ...(customInc || []).map(i => `INCIDENT: ${i.short || i.code} [${i.grp || 'custom'}]`),
  ].join('\n  ') || 'none';

  const eolSummary = Object.entries(liveEolData || {}).map(([k, v]) => {
    const c = v?.matchedCycle;
    return c ? `${k}: EOL ${c.eol || 'unknown'}, EOS ${c.support || 'unknown'}` : null;
  }).filter(Boolean).join('\n  ') || 'no live EOL data yet';

  const designSnippet = Object.entries(sysDesignData || {}).flatMap(([sec, fields]) =>
    Object.entries(fields || {}).filter(([, v]) => v).slice(0, 3).map(([k, v]) => `${sec}.${k}: ${v}`)
  ).slice(0, 12).join('\n  ') || 'not filled';

  const prompt = `You are a senior infrastructure delivery architect specialising in enterprise server provisioning, compliance, and lifecycle management. A project manager has entered the following context into a delivery tool:

PROJECT: ${requirements?.projectName || 'unnamed project'}
ENVIRONMENT: ${requirements?.envType || 'Production'}
GO-LIVE: ${requirements?.goLiveDate || 'TBD'}
SLA: ${requirements?.slaTarget || 'not set'}

STACK: ${stack}
ACTIVE INCIDENTS/UUM: ${selInc.length} incidents, ${selUUM.length} UUM changes
CUSTOM ENTRIES:
  ${customEntries}

LIVE EOL/LIFECYCLE DATA:
  ${eolSummary}

SYSTEM DESIGN FIELDS (sample):
  ${designSnippet}

Using the MissionHelp delivery framework, produce a structured analysis in exactly this JSON format. Be specific, blunt, and infrastructure-first. Flag every compatibility or lifecycle risk you can see. Prefer pragmatic over fashionable patterns.

Return ONLY valid JSON (no markdown, no code fences):
{
  "contextExtraction": "3–5 bullet points extracting the key business and technical signals from this input. Translate business language into delivery and infrastructure concepts. Call out assumptions clearly.",
  "deliveryRTM": "A markdown table with columns: Raw Input | Functional Requirement | Technical/Platform Requirement | Business Value Metric. Map each meaningful input into one row.",
  "architectureMap": {
    "business": "2–3 sentences: business outcomes, cost/risk/compliance alignment, strategic value of this delivery.",
    "functional": "3–5 sentences: user journey, process steps, integrations, approvals, notifications. What happens end-to-end at the function level.",
    "technical": "4–6 sentences: systems, services, data flows, security, TLS/cipher specifics, backup path, failover. Name real protocols and ports where inferable. Flag any version-specific risks or hidden dependency chains."
  },
  "compatibilityRisks": "3–5 bullet points covering: EOL/EOS timeline risks, driver/kernel/library compatibility, TLS/cipher deprecation, backup agent version lock-in, certificate expiry windows, or operational ownership gaps. Be blunt and specific.",
  "nextSteps": ["One targeted delivery question about timeline, owners, or dependencies", "One targeted question about security, compliance, or rollback scope"]
}`;

  try {
    const groqRes = await groqChat(env, [{ role: 'user', content: prompt }], 2000);
    const content = groqRes.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in Groq response');
    const analysis = JSON.parse(match[0]);
    return json({ analysis, model: groqRes.model, usage: groqRes.usage });
  } catch (e) {
    return err(`Mission analysis failed: ${e.message}`, 500);
  }
}

// ── TTS proxy — Cartesia Sonic-2 primary, ElevenLabs fallback ────────────────
//
// Worker env vars:
//   CARTESIA_API_KEY   — optional; Cartesia Sonic-2 (credits-based)
//   ELEVENLABS_API_KEY — optional; ElevenLabs free tier (10k chars/month)
//   ELEVENLABS_VOICE   — ElevenLabs voice ID (default: Josh — TxGEqnHWrfWFTfGW9XjX)
//
// Tries Cartesia first; falls back to ElevenLabs on any failure (credits exhausted,
// network error, key missing). Returns 503 only if both providers are unavailable.

async function tryCartesiaTts(text, voiceId, speed, emotion, env) {
  if (!env.CARTESIA_API_KEY) return null;
  try {
    const res = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'Authorization':    `Bearer ${env.CARTESIA_API_KEY}`,
        'Content-Type':     'application/json',
      },
      body: JSON.stringify({
        model_id:  'sonic-2',
        transcript: text,
        voice: {
          mode: 'id',
          id:   voiceId || '694f9389-aac1-45b6-b726-9d9369183238',
          __experimental_controls: { speed: speed || 'normal', emotion: emotion || [] },
        },
        output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
        language: 'en',
      }),
    });
    if (!res.ok) return null; // 402 credits, 4xx/5xx — fall through to ElevenLabs
    const audio = await res.arrayBuffer();
    return new Response(audio, { status: 200, headers: { ...CORS, 'Content-Type': 'audio/mpeg' } });
  } catch { return null; }
}

async function tryElevenLabsTts(text, env) {
  if (!env.ELEVENLABS_API_KEY) return null;
  // Josh — warm, confident, natural male voice; override via ELEVENLABS_VOICE env var
  const voiceId = env.ELEVENLABS_VOICE || 'TxGEqnHWrfWFTfGW9XjX';
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key':   env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.35, use_speaker_boost: true },
      }),
    });
    if (!res.ok) return null;
    const audio = await res.arrayBuffer();
    return new Response(audio, { status: 200, headers: { ...CORS, 'Content-Type': 'audio/mpeg' } });
  } catch { return null; }
}

async function handleCartesiaTts(req, env) {
  const { text, voiceId, speed, emotion } = await req.json().catch(() => ({}));
  if (!text) return err('text is required');

  const cartesia = await tryCartesiaTts(text, voiceId, speed, emotion, env);
  if (cartesia) return cartesia;

  const eleven = await tryElevenLabsTts(text, env);
  if (eleven) return eleven;

  return err('No TTS provider available — add ELEVENLABS_API_KEY or top up Cartesia credits', 503);
}

// ── Orchestrator chat ─────────────────────────────────────────────────────────
// NLP command interpreter: natural language -> structured action plan.
// Requires GROQ_API_KEY. Context is a compact state snapshot from buildStateContext().

async function handleOrchestratorChat(req, env) {
  const { message, context, history = [] } = await req.json().catch(() => ({}));
  if (!message) return err('message is required');

  const rolesDesc = context.userRoles?.length > 0
    ? `User roles in this build: ${context.userRoles.join(', ')}`
    : context.isPM
      ? 'User is the Project Manager — full access to all actions'
      : 'User has no assigned role in this build (read-only)';

  const systemPrompt = `You are OpsMentor — a hyper-intuitive AI infrastructure expert embedded inside OpsManifest, an enterprise server provisioning lifecycle tool.

Deep expertise:
- Server hardware: Dell PowerEdge, HPE ProLiant, IBM Power, Cisco UCS — specs, firmware, lifecycle
- Operating systems: RHEL, AIX, Windows Server, Ubuntu, SLES — patching, EOL/EOS timelines, migration paths
- Databases: Oracle RAC, PostgreSQL, MySQL, SQL Server, Sybase — migration, upgrade, backup, failover
- Middleware: WebSphere, JBoss EAP, Tomcat, WebLogic, nginx — clustering, TLS, session replication
- Change management: CAB approval, RTM traceability, RAID risk logging, FSM task sequencing, go/no-go criteria
- Compliance: PCI-DSS cipher suites, SOX audit trails, ISO27001 controls, TLS 1.2/1.3 requirements
- Lifecycle: EOL/EOS risk windows, ESU pricing, batch job migration, DR/HA topology

Personality: warm and direct — like a senior infra architect sitting next to the PM. Reference actual build details (real stack, real project name, real go-live date) rather than placeholders. Proactively flag risks you see in the current state even when not asked. Call out blockers honestly. Practical over fashionable.

CURRENT BUILD STATE:
Phase: ${context.phase}
Stack: ${context.stack}
Project: ${context.project} | Environment: ${context.envType}
Go-live: ${context.goLive} | SLA: ${context.sla}
Incidents in scope: ${context.incidents}
UUM items: ${context.uumItems}
RTM rows: ${JSON.stringify(context.rtmCounts)}
Tasks stale: ${context.tasksStale} | RTM stale: ${context.rtmStale}
Active alerts: ${(context.alerts || []).join('; ') || 'none'}
Assigned roles: ${context.assignedRoles || 'none'}
Design sections filled: ${context.filledDesignSections || 'none'}

USER: ${context.userEmail}
${rolesDesc}

AVAILABLE ACTIONS (only include when the user clearly intends to make a change):
SET_CTX            { key: "hw"|"os"|"db"|"app", value: string }
BUILD              {}   — triggers after all 4 ctx fields are set; call this + RUN_SCAN together
SET_REQUIREMENT    { key: "projectName"|"envType"|"goLiveDate"|"sla"|"hoursPerDay"|"projectStartDate", value: string }
SET_DESIGN_FIELD   { section: "unix"|"web"|"app"|"db"|"storage"|"backup"|"network"|"security", field: string, value: string }
TOGGLE_INC         { code: string }   — only use when you know the exact catalog code
TOGGLE_UUM         { code: string }   — only use when you know the exact catalog code
SET_RTM_ROW        { id: string, status: "PASS"|"FAIL"|"NA"|"PENDING" }
SET_ROLE_ASSIGNMENT { role: string, data: { name, email, backup, raci } }
ADD_INCIDENT       { short: string, txt: string, grp: string, sev: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", owner: string }  requiresConfirmation
ADD_UUM_ITEM       { short: string, txt: string, type: "upgrade"|"migration"|"patch", layer: "os"|"db"|"app"|"web"|"storage"|"network"|"security"|"backup"|"hardware", grp: string }  requiresConfirmation
ADD_RAID_ENTRY     { type: "RISK"|"ASSUMPTION"|"ISSUE"|"DECISION", description: string, severity: "CRITICAL"|"HIGH"|"MED"|"LOW", owner: string, mitigation: string }
ADD_CUSTOM_TASK    { title: string, est_hours: number, notes: string }
ADD_VULNERABILITY  { title: string, component: string, severity: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", description: string }
NAVIGATE_TAB       { tab: "exec"|"design"|"gantt"|"rtm"|"matrix"|"raid"|"roles"|"closure"|"diagram"|"cmdb"|"vuln"|"risks"|"cost" }
UNLOCK_FOR_REVISION {}   requiresConfirmation ALWAYS  — only when cabDeclined is true
RESUBMIT_CAB       {}   requiresConfirmation ALWAYS  — only after revision is complete
APPLY_DESIGN       {}   requiresConfirmation ALWAYS
INJECT_PHASE2      {}   requiresConfirmation ALWAYS
SUBMIT_CAB         {}   requiresConfirmation ALWAYS
SIGN_RTM           {}   requiresConfirmation ALWAYS
PROMOTE            {}   requiresConfirmation ALWAYS (irreversible)

RESPONSE RULES:
1. Be as thorough as the question needs — 2–4 sentences for most replies; more for complex questions. Don't cut yourself short.
2. Never start a reply with "I". Vary openers: "Sure —", "Your X is...", "Looking at this build...", "That depends on...", "The short answer:", "Worth flagging:", etc.
3. Questions about current state or concepts → answer in reply, empty actions array.
4. Only include actions when the user clearly wants to change something.
5. Always set requiresConfirmation: true for APPLY_DESIGN, INJECT_PHASE2, SUBMIT_CAB, SIGN_RTM, PROMOTE, UNLOCK_FOR_REVISION, RESUBMIT_CAB, ADD_INCIDENT, ADD_UUM_ITEM.
6. description = brief human-readable summary shown in confirmation card.
7. nextPrompt = short follow-up (optional, ≤12 words). Skip if reply ends at a natural stop.
8. If you notice a risk or inconsistency in the build state relevant to the question, mention it proactively.
9. Reference actual stack/project/date from the build state — not generic placeholders.
10. For navigation requests ("open X tab", "go to Y", "show me Z"): include NAVIGATE_TAB action + explain what the tab does.
11. For "add risk/issue/assumption/decision": use ADD_RAID_ENTRY. For "add incident": ADD_INCIDENT. For "add task": ADD_CUSTOM_TASK.
12. For CAB decline recovery: use UNLOCK_FOR_REVISION then RESUBMIT_CAB in the correct order.
13. Multiple actions are fine if the user clearly wants a sequence — include all of them in the actions array.

Return valid JSON only — no markdown, no code fences:
{"reply":"...","actions":[{"type":"...","params":{},"description":"...","requiresConfirmation":false}],"nextPrompt":"..."}`;

  // Build conversation history
  const chatHistory = (history || [])
    .filter(m => m.role === 'user' || m.role === 'orchestrator')
    .slice(-10)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: message },
  ];

  try {
    const groqRes = await groqChat(env, messages, 1200, 0.65);
    const content = groqRes.choices?.[0]?.message?.content || '';
    const match   = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in Groq response');
    const result = JSON.parse(match[0]);
    return json({ result, model: groqRes.model });
  } catch (e) {
    return err(`Orchestrator chat failed: ${e.message}`, 500);
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/health') {
      return json({
        ok: true,
        model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        tts: {
          cartesia:   !!env.CARTESIA_API_KEY,
          elevenlabs: !!env.ELEVENLABS_API_KEY,
          voice: env.ELEVENLABS_API_KEY ? 'elevenlabs' : env.CARTESIA_API_KEY ? 'cartesia' : 'none',
        },
        stt: { whisper: !!env.GROQ_API_KEY },
      });
    }

    // Cartesia TTS — checked before the Groq key guard
    if (req.method === 'POST' && url.pathname === '/cartesia-tts') {
      return handleCartesiaTts(req, env);
    }

    // Whisper STT — raw audio body, returns { transcript }
    if (req.method === 'POST' && url.pathname === '/whisper-transcribe') {
      if (!env.GROQ_API_KEY) return err('GROQ_API_KEY not configured', 500);
      try {
        const audioBytes = await req.arrayBuffer();
        if (!audioBytes.byteLength) return err('audio body required', 400);
        const mimeType = req.headers.get('X-Audio-Type') || req.headers.get('Content-Type') || 'audio/webm';
        const ext = mimeType.includes('ogg') ? 'audio.ogg' : mimeType.includes('mp4') ? 'audio.mp4' : 'audio.webm';
        const form = new FormData();
        form.append('file', new Blob([audioBytes], { type: mimeType }), ext);
        form.append('model', 'whisper-large-v3-turbo');
        form.append('response_format', 'json');
        form.append('language', 'en');
        form.append('temperature', '0');
        const wRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}` },
          body: form,
        });
        if (!wRes.ok) {
          const body = await wRes.text();
          return err(`Whisper ${wRes.status}: ${body}`, 502);
        }
        const data = await wRes.json();
        return json({ transcript: (data.text || '').trim() });
      } catch (e) {
        return err(`Whisper failed: ${e.message}`, 500);
      }
    }

    if (!env.GROQ_API_KEY) {
      return err('GROQ_API_KEY not configured', 500);
    }

    if (req.method === 'POST' && url.pathname === '/groq-enrich') {
      return handleEnrich(req, env);
    }

    if (req.method === 'POST' && url.pathname === '/groq-suggest') {
      return handleSuggest(req, env);
    }

    if (req.method === 'POST' && url.pathname === '/groq-uum-search') {
      return handleUumSearch(req, env);
    }

    if (req.method === 'POST' && url.pathname === '/groq-uum-enrich') {
      return handleUumEnrich(req, env);
    }

    if (req.method === 'POST' && url.pathname === '/groq-mission-analysis') {
      return handleMissionAnalysis(req, env);
    }

    if (req.method === 'POST' && url.pathname === '/orchestrator-chat') {
      return handleOrchestratorChat(req, env);
    }

    return err('Not found', 404);
  },
};
