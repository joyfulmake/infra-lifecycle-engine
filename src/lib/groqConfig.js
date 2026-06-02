/**
 * Groq AI config.
 *
 * To activate:
 * 1. Deploy workers/ai-worker.js to Cloudflare:
 *      wrangler deploy workers/ai-worker.js --name opsmanifest-ai
 * 2. Set GROQ_API_KEY in Cloudflare Workers → Settings → Variables
 * 3. Set GROQ_WORKER_URL below to your deployed worker URL
 * 4. Set GROQ_CONFIGURED = true
 */

export const GROQ_CONFIGURED = false;

export const GROQ_WORKER_URL = 'https://opsmanifest-ai.YOUR_SUBDOMAIN.workers.dev';

// Model used by the worker (overridable via GROQ_MODEL worker env var)
export const GROQ_MODEL = 'llama-3.3-70b-versatile';
