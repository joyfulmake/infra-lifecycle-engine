import { GROQ_CONFIGURED, GROQ_WORKER_URL } from './groqConfig.js';

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
