// Cloudflare Pages Function — edge proxy for endoflife.date API
// Serves at /api/eol/* and caches responses at the CF edge for 1 hour.
// Removes the need for a direct browser connection to endoflife.date.

const ORIGIN = 'https://endoflife.date/api';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // Strip the /api/eol prefix to get the upstream path
  const upstreamPath = url.pathname.replace(/^\/api\/eol/, '') || '/all.json';
  const upstreamUrl = `${ORIGIN}${upstreamPath}${url.search}`;

  const cacheKey = new Request(upstreamUrl, { method: 'GET' });
  const cache = caches.default;

  let res = await cache.match(cacheKey);
  if (res) {
    return new Response(res.body, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  try {
    res = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'OpsManifest/2.0 (https://opsmanifest.pages.dev)' },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `upstream ${res.status}` }), {
        status: res.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await res.text();
    const cached = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    context.waitUntil(cache.put(cacheKey, cached.clone()));

    return new Response(body, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
