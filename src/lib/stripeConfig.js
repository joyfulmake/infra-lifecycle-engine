// ─────────────────────────────────────────────────────────────────────────────
// Stripe configuration
//
// Setup steps:
//   1. https://dashboard.stripe.com → Create account
//   2. Developers → API Keys → copy Publishable key (pk_live_... or pk_test_...)
//   3. Products → Create two products:
//        - "OpsManifest Professional" → add prices: $19/mo + $190/yr
//        - "OpsManifest Team"         → add prices: $59/mo + $590/yr
//   4. Copy each Price ID (price_...) into the objects below
//   5. Deploy the Cloudflare Worker in workers/stripe-worker.js
//      Set Worker env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//      FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//   6. Webhooks → Add endpoint → paste your Worker URL + /stripe-webhook
//      Events to listen for: checkout.session.completed,
//      customer.subscription.updated, customer.subscription.deleted
//   7. Set STRIPE_CONFIGURED = true and fill in STRIPE_WORKER_URL
// ─────────────────────────────────────────────────────────────────────────────

export const STRIPE_CONFIGURED = false;

export const STRIPE_PUBLISHABLE_KEY = 'pk_test_REPLACE_ME';

// URL of your deployed Cloudflare Worker (same origin pattern as the AI proxy)
export const STRIPE_WORKER_URL = 'https://opsmanifest-stripe.YOUR_SUBDOMAIN.workers.dev';

export const STRIPE_PRICES = {
  professional: {
    monthly: 'price_REPLACE_professional_monthly',
    annual:  'price_REPLACE_professional_annual',
  },
  team: {
    monthly: 'price_REPLACE_team_monthly',
    annual:  'price_REPLACE_team_annual',
  },
};
