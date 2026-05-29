import { STRIPE_CONFIGURED, STRIPE_WORKER_URL, STRIPE_PRICES } from './stripeConfig.js';

export { STRIPE_CONFIGURED };

// Redirect to Stripe Checkout for the given plan + billing interval
export async function startCheckout({ plan, annual, email }) {
  if (!STRIPE_CONFIGURED) throw new Error('Stripe not configured');
  const priceId = annual ? STRIPE_PRICES[plan]?.annual : STRIPE_PRICES[plan]?.monthly;
  if (!priceId) throw new Error('No price ID for ' + plan);

  const res = await fetch(`${STRIPE_WORKER_URL}/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId,
      email,
      successUrl: window.location.origin + '/?checkout=success&plan=' + plan,
      cancelUrl:  window.location.origin + '/?checkout=cancel',
    }),
  });
  if (!res.ok) throw new Error('Checkout session failed: ' + (await res.text()));
  const { url } = await res.json();
  window.location.href = url;
}

// Redirect to Stripe Customer Portal (self-serve cancel / upgrade / invoices)
export async function openCustomerPortal(email) {
  if (!STRIPE_CONFIGURED) throw new Error('Stripe not configured');
  const res = await fetch(`${STRIPE_WORKER_URL}/create-portal-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, returnUrl: window.location.origin }),
  });
  if (!res.ok) throw new Error('Portal session failed: ' + (await res.text()));
  const { url } = await res.json();
  window.location.href = url;
}

// Read subscription status from Firestore (written by Stripe webhook via Worker)
export async function getSubscriptionStatus(email) {
  if (!STRIPE_CONFIGURED) return null;
  try {
    const { FIREBASE_CONFIGURED, getSubscription } = await import('./firebase.js');
    if (!FIREBASE_CONFIGURED) return null;
    return await getSubscription(email);
  } catch {
    return null;
  }
}
