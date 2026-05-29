/**
 * OpsManifest — Stripe + Firebase Worker (Cloudflare Workers)
 *
 * Deploy:
 *   npm install -g wrangler
 *   wrangler deploy workers/stripe-worker.js --name opsmanifest-stripe
 *
 * Required environment variables (set in Cloudflare dashboard → Workers → Settings → Variables):
 *   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET      — whsec_... (from Stripe Webhooks dashboard)
 *   FIREBASE_PROJECT_ID        — your Firebase project ID
 *   FIREBASE_CLIENT_EMAIL      — service account client_email
 *   FIREBASE_PRIVATE_KEY       — service account private_key (include -----BEGIN...----- lines)
 *
 * Routes handled:
 *   POST /create-checkout-session  — create Stripe Checkout URL
 *   POST /stripe-webhook           — handle Stripe events, update Firestore
 *   OPTIONS *                      — CORS preflight
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

// ── Stripe Checkout session ────────────────────────────────────────────────

async function createCheckoutSession(req, env) {
  const { priceId, email, successUrl, cancelUrl } = await req.json();
  if (!priceId || !email) return err('priceId and email required');

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'customer_email': email,
    success_url: successUrl || 'https://opsmanifest.netlify.app/?checkout=success',
    cancel_url: cancelUrl  || 'https://opsmanifest.netlify.app/?checkout=cancel',
    'subscription_data[trial_period_days]': '7',
    'subscription_data[metadata][email]': email,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) return err(session.error?.message || 'Stripe error', 502);
  return json({ url: session.url });
}

// ── Stripe webhook ─────────────────────────────────────────────────────────

async function verifyStripeSignature(body, sigHeader, secret) {
  const parts = sigHeader.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    acc[k] = v;
    return acc;
  }, {});
  const payload = parts.t + '.' + body;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === parts.v1;
}

// Plan lookup from Stripe price IDs — extend this map after creating prices
const PRICE_TO_PLAN = {
  // filled in when Stripe is configured; keys are Stripe price IDs
  // 'price_xxx': 'professional',
  // 'price_yyy': 'team',
};

async function getFirestoreToken(env) {
  // Use Firebase service account to get a short-lived access token via OAuth2
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = btoa(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  }));
  const msg = header + '.' + claim;
  // Sign with RS256 using the private key
  const keyData = env.FIREBASE_PRIVATE_KEY
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(msg));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = msg + '.' + sig;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const t = await tokenRes.json();
  return t.access_token;
}

async function writeSubscriptionToFirestore(email, subData, env) {
  try {
    const token = await getFirestoreToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(email)}/subscription/active`;
    await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(subData).map(([k, v]) => [k, { stringValue: String(v) }])
        ),
      }),
    });
  } catch (e) {
    console.error('Firestore write failed:', e);
  }
}

async function handleWebhook(req, env) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return err('Missing stripe-signature', 400);

  const valid = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return err('Invalid signature', 401);

  const event = JSON.parse(body);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.metadata?.email;
    const subId = session.subscription;
    if (email && subId) {
      // Fetch subscription to get price ID and determine plan
      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      });
      const sub = await subRes.json();
      const priceId = sub.items?.data?.[0]?.price?.id || '';
      const plan = PRICE_TO_PLAN[priceId] || 'professional';
      await writeSubscriptionToFirestore(email, {
        plan,
        status: sub.status,
        stripeSubscriptionId: subId,
        stripeCustomerId: session.customer,
        currentPeriodEnd: String(sub.current_period_end),
        priceId,
        updatedAt: new Date().toISOString(),
      }, env);
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const email = sub.metadata?.email;
    if (email) {
      const priceId = sub.items?.data?.[0]?.price?.id || '';
      const plan = PRICE_TO_PLAN[priceId] || 'professional';
      await writeSubscriptionToFirestore(email, {
        plan: event.type === 'customer.subscription.deleted' ? 'starter' : plan,
        status: sub.status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: String(sub.current_period_end),
        updatedAt: new Date().toISOString(),
      }, env);
    }
  }

  return json({ received: true });
}

// ── Stripe Customer Portal session ────────────────────────────────────────

async function createPortalSession(req, env) {
  const { email, returnUrl } = await req.json();
  if (!email) return err('email required');

  // Look up stripeCustomerId from Firestore
  let customerId;
  try {
    const token = await getFirestoreToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(email)}/subscription/active`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const doc = await res.json();
      customerId = doc.fields?.stripeCustomerId?.stringValue;
    }
  } catch (e) {
    console.error('Firestore lookup failed:', e);
  }
  if (!customerId) return err('No Stripe customer found for this account', 404);

  const params = new URLSearchParams({
    customer: customerId,
    return_url: returnUrl || 'https://opsmanifest.netlify.app/',
  });
  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const portal = await res.json();
  if (!res.ok) return err(portal.error?.message || 'Stripe portal error', 502);
  return json({ url: portal.url });
}

// ── Router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/create-checkout-session')
      return createCheckoutSession(req, env);

    if (req.method === 'POST' && url.pathname === '/create-portal-session')
      return createPortalSession(req, env);

    if (req.method === 'POST' && url.pathname === '/stripe-webhook')
      return handleWebhook(req, env);

    return json({ status: 'OpsManifest Stripe Worker running' });
  },
};
