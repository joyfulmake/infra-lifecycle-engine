// Cloudflare Pages Function — relay Cartesia TTS to opsmanifest-ai Worker

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
    const res = await fetch(`${WORKER}/cartesia-tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) {
      const err = await res.arrayBuffer();
      return new Response(err, {
        status: res.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const audio = await res.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'audio/mpeg' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
