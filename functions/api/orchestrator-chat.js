// Cloudflare Pages Function — relay to opsmanifest-ai Worker
// Serves at opsmanifest.pages.dev/api/orchestrator-chat
// Server-to-server (Pages → Worker) is always reachable regardless of browser shields.

const WORKER = 'https://opsmanifest-ai.sriram-c76-254.workers.dev';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.arrayBuffer();
    const res = await fetch(`${WORKER}/orchestrator-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.arrayBuffer();
    return new Response(data, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
