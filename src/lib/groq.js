import { GROQ_CONFIGURED, GROQ_WORKER_URL } from './groqConfig.js';

/**
 * Fully enrich a custom UUM entry with description, risks, prerequisites, and a task list.
 * Returns { enriched: { description, risks, prerequisites, tasks } }
 */
export async function enrichCustomUUMWithGroq(title, desc, layer, type) {
  if (!GROQ_CONFIGURED) throw new Error('Groq not configured');
  const res = await fetch(`${GROQ_WORKER_URL}/groq-uum-enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, desc, layer, type }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Worker error ${res.status}`);
  }
  return res.json();
}

/**
 * Search for UUM operations beyond the catalog using Groq.
 * Returns { results: [{ short, description, type, layer, grp }] }
 */
export async function searchUUMWithGroq(query) {
  if (!GROQ_CONFIGURED) throw new Error('Groq not configured');
  const res = await fetch(`${GROQ_WORKER_URL}/groq-uum-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Worker error ${res.status}`);
  }
  return res.json();
}

/**
 * Deepen a task's 7-point FSM metadata via Groq.
 * Returns { enriched, model, usage } or throws.
 */
export async function enrichTaskWithGroq(task, ctx, existingMeta) {
  if (!GROQ_CONFIGURED) throw new Error('Groq not configured — see groqConfig.js');
  const res = await fetch(`${GROQ_WORKER_URL}/groq-enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, ctx, existing: existingMeta }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Worker error ${res.status}`);
  }
  return res.json();
}

/**
 * Get stack-specific risk/incident suggestions from Groq.
 * Returns { suggestions: [{risk, severity, description, mitigation}], model }
 */
export async function suggestWithGroq(ctx, query = '') {
  if (!GROQ_CONFIGURED) throw new Error('Groq not configured — see groqConfig.js');
  const res = await fetch(`${GROQ_WORKER_URL}/groq-suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ctx, query }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Worker error ${res.status}`);
  }
  return res.json();
}
