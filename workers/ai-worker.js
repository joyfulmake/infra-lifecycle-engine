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

    return err('Not found', 404);
  },
};
