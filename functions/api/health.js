// Cloudflare Pages Function — health check (always returns ok, no worker needed)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest() {
  return new Response(JSON.stringify({ ok: true, via: 'pages-function' }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
