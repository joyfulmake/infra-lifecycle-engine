/**
 * Cloudflare Worker — Razorpay payment proxy for OpsManifest
 *
 * Deploy:
 *   wrangler deploy workers/razorpay-worker.js --name opsmanifest-razorpay --compatibility-date 2026-06-12
 *
 * Required worker env vars (set in CF dashboard → Workers → Settings → Variables):
 *   RAZORPAY_KEY_ID       - rzp_live_...
 *   RAZORPAY_KEY_SECRET   - your Razorpay secret key
 *   FIREBASE_PROJECT_ID   - Firebase project ID (for plan writes after payment)
 *   FIREBASE_CLIENT_EMAIL - Service account email
 *   FIREBASE_PRIVATE_KEY  - Service account private key (PEM, newlines as \n)
 *
 * Routes:
 *   POST /create-subscription  — create a Razorpay subscription for a plan
 *   POST /verify-payment       — verify payment signature + write plan to Firestore
 *   POST /razorpay-webhook     — Razorpay webhook handler (subscription events)
 *   POST /create-portal        — generate a customer portal URL (Razorpay dashboard deep-link)
 */

const ALLOWED_ORIGINS = ['https://opsmanifest.pages.dev', 'http://localhost:5173'];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function razorpayAuth(env) {
  return 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
}

async function razorpayFetch(path, method, body, env) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: razorpayAuth(env),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.description || 'Razorpay API error');
  return data;
}

// HMAC-SHA256 signature verification
async function verifySignature(orderId, paymentId, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = encoder.encode(`${orderId}|${paymentId}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === signature;
}

// Write plan to Firestore via REST API
async function writePlanToFirestore(email, plan, subscriptionId, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const serviceAccountEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !serviceAccountEmail || !privateKey) return;

  // Get a short-lived access token via service account JWT
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = v => btoa(JSON.stringify(v)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    str2ab(atob(privateKey.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''))),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${ab2b64url(sigBuf)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const { access_token } = await tokenRes.json();

  const docPath = `users/${encodeURIComponent(email)}/subscription/active`;
  await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
    body: JSON.stringify({
      fields: {
        plan: { stringValue: plan },
        provider: { stringValue: 'razorpay' },
        subscriptionId: { stringValue: subscriptionId },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
  return buf;
}

function ab2b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Plan lookup by Razorpay plan ID — populate after creating plans in Razorpay dashboard
const PLAN_ID_TO_PLAN = {
  'plan_REPLACE_PROF_MONTHLY': 'professional',
  'plan_REPLACE_PROF_ANNUAL':  'professional',
  'plan_REPLACE_TEAM_MONTHLY': 'team',
  'plan_REPLACE_TEAM_ANNUAL':  'team',
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const respond = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    try {
      // POST /create-subscription
      if (url.pathname === '/create-subscription' && request.method === 'POST') {
        const { planId, email, totalCount = 12 } = await request.json();
        const subscription = await razorpayFetch('/subscriptions', 'POST', {
          plan_id: planId,
          total_count: totalCount,
          customer_notify: 1,
          notes: { email },
        }, env);
        return respond({ subscriptionId: subscription.id, keyId: env.RAZORPAY_KEY_ID });
      }

      // POST /verify-payment
      if (url.pathname === '/verify-payment' && request.method === 'POST') {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, email, plan } = await request.json();
        const valid = await verifySignature(razorpay_subscription_id, razorpay_payment_id, razorpay_signature, env.RAZORPAY_KEY_SECRET);
        if (!valid) return respond({ error: 'Invalid signature' }, 400);
        await writePlanToFirestore(email, plan, razorpay_subscription_id, env);
        return respond({ success: true });
      }

      // POST /razorpay-webhook
      if (url.pathname === '/razorpay-webhook' && request.method === 'POST') {
        const body = await request.text();
        const event = JSON.parse(body);
        const entity = event.payload?.subscription?.entity;
        if (!entity) return respond({ received: true });

        const email = entity.notes?.email;
        const plan = PLAN_ID_TO_PLAN[entity.plan_id];

        if (event.event === 'subscription.activated' && email && plan) {
          await writePlanToFirestore(email, plan, entity.id, env);
        }
        if ((event.event === 'subscription.cancelled' || event.event === 'subscription.completed') && email) {
          await writePlanToFirestore(email, 'starter', entity.id, env);
        }
        return respond({ received: true });
      }

      // POST /create-portal — returns Razorpay dashboard subscription management URL
      if (url.pathname === '/create-portal' && request.method === 'POST') {
        const { subscriptionId } = await request.json();
        return respond({ url: `https://dashboard.razorpay.com/app/subscriptions/${subscriptionId}` });
      }

      return respond({ error: 'Not found' }, 404);
    } catch (err) {
      return respond({ error: err.message }, 500);
    }
  },
};
