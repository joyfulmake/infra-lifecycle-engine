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

async function groqChat(env, messages, maxTokens = 1024) {
  const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
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

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, model: env.GROQ_MODEL || 'llama-3.3-70b-versatile' });
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

    return err('Not found', 404);
  },
};
