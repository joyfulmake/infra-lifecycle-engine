// Cloudflare Pages Function — relay Whisper STT to opsmanifest-ai Worker

const WORKER = 'https://opsmanifest-ai.sriram-c76-254.workers.dev';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Audio-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const contentType = request.headers.get('content-type') || 'audio/webm';
    const body = await request.arrayBuffer();
    const res = await fetch(`${WORKER}/whisper-transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'X-Audio-Type': contentType,
      },
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
