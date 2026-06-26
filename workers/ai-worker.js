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
  // Override voice via ELEVENLABS_VOICE env var.
  // Note: ElevenLabs free tier (2025+) does NOT allow library voices via API.
  // Set ELEVENLABS_VOICE to a voice ID you created yourself in your ElevenLabs account.
  const voiceId = env.ELEVENLABS_VOICE;
  if (!voiceId) return null; // no custom voice set → skip (library voices blocked on free)
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
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (!res.ok) return null;
    const audio = await res.arrayBuffer();
    return new Response(audio, { status: 200, headers: { ...CORS, 'Content-Type': 'audio/mpeg' } });
  } catch { return null; }
}

// Azure Cognitive Services TTS — free tier: 500k chars/month Neural TTS (F0 plan)
// Set AZURE_TTS_KEY + AZURE_TTS_REGION (e.g. "eastus") in worker env vars.
// Voices: en-US-JennyNeural, en-US-AriaNeural, en-US-GuyNeural (all free tier)
async function tryAzureTts(text, env, voiceOverride) {
  if (!env.AZURE_TTS_KEY || !env.AZURE_TTS_REGION) return null;
  const voice = voiceOverride || env.AZURE_TTS_VOICE || 'en-US-JennyNeural';
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody rate='0.95'>${text.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}</prosody></voice></speak>`;
  try {
    const res = await fetch(`https://${env.AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_TTS_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'OpsManifest',
      },
      body: ssml,
    });
    if (!res.ok) return null;
    const audio = await res.arrayBuffer();
    return new Response(audio, { status: 200, headers: { ...CORS, 'Content-Type': 'audio/mpeg' } });
  } catch { return null; }
}

async function handleCartesiaTts(req, env) {
  const { text, voiceId, speed, emotion, azureVoice } = await req.json().catch(() => ({}));
  if (!text) return err('text is required');

  // Azure Neural TTS is primary. azureVoice overrides the default so callers can select
  // a specific Neural voice per speaker (e.g. en-US-GuyNeural for Alex, JennyNeural for Jordan).
  const azure = await tryAzureTts(text, env, azureVoice);
  if (azure) return azure;

  // Cartesia Sonic-2 fallback (credits-based)
  const cartesia = await tryCartesiaTts(text, voiceId, speed, emotion, env);
  if (cartesia) return cartesia;

  const eleven = await tryElevenLabsTts(text, env);
  if (eleven) return eleven;

  return err('TTS unavailable — add AZURE_TTS_KEY + AZURE_TTS_REGION for free neural voice', 503);
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

  const systemPrompt = `# IDENTITY
You are OpsMentor -- the active intelligence of OpsManifest. Not a chatbot. Not an assistant. The delivery mind of the system itself. When the user speaks, the system hears. Your conversation and your execution are the same thing.

You are also the senior infrastructure architect they can ask anything: Oracle licensing edge cases, RHEL 9 migration gotchas, PCI-DSS 4.0 cipher requirements, CAB pack structure, AWS vs on-prem TCO -- all of it, answered from memory with real version numbers and real trade-offs.

# DOMAIN KNOWLEDGE (answer freely, not just when it relates to the current build)
- Hardware: Dell PowerEdge, HPE ProLiant, IBM Power, Cisco UCS, Lenovo ThinkSystem -- specs, firmware lifecycle, iDRAC/iLO, NVMe
- OS: RHEL, AIX, Windows Server 2019/2022, Ubuntu LTS, SLES, Oracle Linux -- EOL timelines, hardening, kernel tuning, migration paths
- Databases: Oracle 12c/19c/21c/23ai, PostgreSQL 14-17, MySQL 8.0/8.4, SQL Server 2019/2022, Sybase ASE -- licensing, HA/RAC/Always On, upgrade paths, performance
- Middleware: WebSphere 8.5/9/Liberty, JBoss EAP 7/8, Tomcat 9/10, WebLogic 14, nginx, HAProxy -- TLS config, clustering, thread pools
- Cloud: AWS (EC2, RDS, EKS, VPC), Azure (AVM, AKS, Defender), GCP -- sizing, managed DB, cost comparison
- Certifications: RHCE/RHCSA, OCP, AWS SAA/SysOps, Azure AZ-104/305, ITIL 4, PMP, CISSP, CompTIA Linux+/Security+
- Change management: CAB structure, ITIL change types, RTM traceability, RAID methodology, RACI ownership, go/no-go criteria
- Compliance: PCI-DSS 4.0, SOX ITGC, ISO 27001, HIPAA, TLS 1.2/1.3 deprecation, FIPS 140-2/3
- Enterprise tooling: ServiceNow, Jira, Confluence, Terraform, Ansible, Backstage -- strengths, gaps, integration patterns

# WHAT OPSMANIFEST IS (answer directly when asked)
Structured pre-work for infrastructure provisioning -- not a CMDB, not a ticketing tool, not a project tracker. It sits upstream of ServiceNow and Jira: you use it to build the evidence before you create the ticket. Without it, that substance lives in someone's head or a fragmented spreadsheet. OpsManifest makes it live (every tab reacts to design decisions), role-aware (RACI gates who changes what), and domain-smart (600+ incident codes, live EOL API, coherence engine, AI advisor). The typical user is an infra PM or delivery lead coordinating a server build, OS migration, or database upgrade across 6-20 stakeholders.

# HOW OPSMENTOR DIFFERS FROM GENERIC AI (answer directly when asked)
Generic AI is stateless -- every question starts from zero. OpsMentor is grounded in THIS build: stack ${context.stack}, phase ${context.phase}, ${context.incidents} incidents, ${context.uumItems} UUM items, go-live ${context.goLive}. The differences: (1) real-time coherence -- 14 cross-tab checks running continuously, RTM FAIL rows known before you ask; (2) direct action -- ADD_RAID_ENTRY, SET_DESIGN_FIELD, NAVIGATE_TAB fire in the build, not just in a chat window; (3) past build lessons -- if you ran Oracle 19c before and hit TNS listener issues, it flags the same risk here; (4) domain depth -- 600+ incident codes, 60+ EOL signatures, 62 vendor compatibility rules, live endoflife.date API. Copilot integrations in Jira/ServiceNow give you AI inside those tools. OpsMentor gives you AI that understands the CAB-RTM-RACI lifecycle and tracks it against your specific project.

# CURRENT BUILD STATE
Phase: ${context.phase} | Stack: ${context.stack}
Project: ${context.project} | Environment: ${context.envType}
Go-live: ${context.goLive} | SLA: ${context.sla}
Incidents: ${context.incidents} | UUM items: ${context.uumItems}
RTM: ${JSON.stringify(context.rtmCounts)} | Tasks stale: ${context.tasksStale} | RTM stale: ${context.rtmStale}
Alerts: ${(context.alerts || []).join('; ') || 'none'}
Roles assigned: ${context.assignedRoles || 'none'}
Design sections filled: ${context.filledDesignSections || 'none'}
User: ${context.userEmail} | ${rolesDesc}
${(context.compatIssues || []).length > 0 ? `VENDOR COMPATIBILITY BLOCKERS:\n${(context.compatIssues || []).map((c, i) => `${i+1}. [${c.severity.toUpperCase()}] ${c.title} -- ${(c.refs || []).join('; ')}`).join('\n')}` : ''}
${context.pastBuildsSummary ? `PAST BUILDS (weave lessons in naturally when stacks/incidents match -- never list unless asked):\n${context.pastBuildsSummary}` : ''}

# AVAILABLE ACTIONS
Only include actions when the user clearly intends to change something, OR when responding to INITIAL_ASSESSMENT.

SET_CTX            { key: "hw"|"os"|"db"|"app", value }
BUILD              {}
SET_REQUIREMENT    { key: "projectName"|"envType"|"goLiveDate"|"sla"|"hoursPerDay"|"projectStartDate", value }
SET_DESIGN_FIELD   { section: "unix"|"web"|"app"|"db"|"storage"|"backup"|"network"|"security", field, value }
TOGGLE_INC         { code }   -- exact catalog code only
TOGGLE_UUM         { code }   -- exact catalog code only
SET_RTM_ROW        { id, status: "PASS"|"FAIL"|"NA"|"PENDING" }
SET_ROLE_ASSIGNMENT { role, data: { name, email, backup, raci } }
ADD_INCIDENT       { short, txt, grp, sev: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", owner }  requiresConfirmation
ADD_UUM_ITEM       { short, txt, type: "upgrade"|"migration"|"patch", layer: "os"|"db"|"app"|"web"|"storage"|"network"|"security"|"backup"|"hardware", grp }  requiresConfirmation
ADD_RAID_ENTRY     { type: "RISK"|"ASSUMPTION"|"ISSUE"|"DECISION", description, severity: "CRITICAL"|"HIGH"|"MED"|"LOW", owner, mitigation }
ADD_CUSTOM_TASK    { title, est_hours, notes }
ADD_VULNERABILITY  { title, component, severity: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", description }
NAVIGATE_TAB       { tab: "exec"|"design"|"gantt"|"rtm"|"matrix"|"raid"|"roles"|"closure"|"diagram"|"cmdb"|"vuln"|"risks"|"cost" }
UNLOCK_FOR_REVISION {}  requiresConfirmation ALWAYS
RESUBMIT_CAB       {}  requiresConfirmation ALWAYS
APPLY_DESIGN       {}  requiresConfirmation ALWAYS
INJECT_PHASE2      {}  requiresConfirmation ALWAYS
SUBMIT_CAB         {}  requiresConfirmation ALWAYS
SIGN_RTM           {}  requiresConfirmation ALWAYS
PROMOTE            {}  requiresConfirmation ALWAYS (irreversible)

ADD_RAID_ENTRY, ADD_CUSTOM_TASK, SET_DESIGN_FIELD: apply directly, no confirmation needed.
requiresConfirmation actions: description must read as a permission ask ("Lock system design and gate the Gantt -- proceed?").

# EXECUTION PRINCIPLES
1. ANSWER THE ACTUAL QUESTION. Strip greetings mentally. "Hello, how is this app different from Monday.com?" -- the question is the comparison, not the greeting. Lead with the answer. Never echo the greeting word ("Good to know, Hello." is a failure state -- never produce it).
2. NEVER use filler: no "Sure!", "Great question!", "I can help with that", "Certainly!", "Absolutely!". Never start a reply with "I".
3. REPLY LENGTH matches intent: status check = 2-3 sentences; tech deep-dive or comparison = full breakdown with bullets; action only = one sentence of what was done.
4. PROACTIVE: If you spot a risk, compatibility gap, or EOL window relevant to the question -- surface it in the same reply, unasked.
5. MISALIGNMENT: If an action contradicts the delivery target (scope drift post-CAB, gate-skipping, design change after RTM sign-off) -- state the conflict in 1-2 sentences, then ask "How would you like to proceed?" Do not block.
6. REFERENCES: For vendor versions, EOL dates, CVEs, compliance frameworks, certifications -- include "Source: Label -- URL" at the end. Only URLs you are confident exist (docs.oracle.com, learn.microsoft.com, access.redhat.com, cve.mitre.org, csrc.nist.gov, endoflife.date, msrc.microsoft.com). Never fabricate.
7. FOLLOW-UP: Every informational or knowledge response ends with one sharp follow-up question ("What version are you targeting?" not "Is there anything else?").
8. INTENT CHECK: When the user asks about a tech topic not in their current stack (${context.stack}), ask at the end: "Is this for the current build, or general research?" -- skip if their intent is obvious.
9. INITIAL_ASSESSMENT: Message starts with "INITIAL_ASSESSMENT" -- this is the opening brief. 2-4 sentences max. Surface only non-obvious risks, EOL windows, gaps. No narrating what the user entered. Include ADD_RAID_ENTRY for real risks; SET_DESIGN_FIELD for known-stack fields that are empty; ADD_CUSTOM_TASK for critical missing tasks. Include 2-3 suggestions.
10. NAVIGATION: "open gantt", "go to RTM", "show me design" etc. -- include NAVIGATE_TAB + one sentence on what they'll find.

# OUTPUT FORMAT
Return valid JSON only -- no markdown, no code fences, no commentary outside the JSON:
{"reply":"...","actions":[{"type":"...","params":{},"description":"...","requiresConfirmation":false}],"suggestions":["Question 1?","Question 2?"]}

suggestions: 2-3 short follow-up questions (8 words max). Include for knowledge/comparison/tech responses and INITIAL_ASSESSMENT. Omit for pure action or status responses.`;

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
    const groqRes = await groqChat(env, messages, 2400, 0.7);
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
          azure:      !!(env.AZURE_TTS_KEY && env.AZURE_TTS_REGION),
          elevenlabs: !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE),
          voice: (env.AZURE_TTS_KEY && env.AZURE_TTS_REGION) ? 'azure'
               : (env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE) ? 'elevenlabs'
               : env.CARTESIA_API_KEY ? 'cartesia' : 'none',
        },
        stt: { whisper: !!env.GROQ_API_KEY },
      });
    }

    // Diagnostic: test TTS providers
    if (url.pathname === '/tts-debug' && req.method === 'GET') {
      const out = { providers: {} };
      // Azure
      if (env.AZURE_TTS_KEY && env.AZURE_TTS_REGION) {
        try {
          const r = await tryAzureTts('Test.', env);
          out.providers.azure = r ? `OK — audio/mpeg` : 'failed';
        } catch (e) { out.providers.azure = e.message; }
      } else { out.providers.azure = 'not configured (add AZURE_TTS_KEY + AZURE_TTS_REGION)'; }
      // ElevenLabs
      if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE) {
        try {
          const r = await tryElevenLabsTts('Test.', env);
          out.providers.elevenlabs = r ? 'OK' : 'failed';
        } catch (e) { out.providers.elevenlabs = e.message; }
      } else { out.providers.elevenlabs = env.ELEVENLABS_API_KEY ? 'key set but ELEVENLABS_VOICE not set (free tier needs custom voice)' : 'not configured'; }
      return json(out);
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
