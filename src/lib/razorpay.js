import { RAZORPAY_KEY_ID, RAZORPAY_WORKER_URL, RAZORPAY_PLANS } from './razorpayConfig.js';

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(s);
  });
}

/** Returns the correct RAZORPAY_PLANS key for a given plan + annual flag. */
export function razorpayPlanKey(plan, annual) {
  return `${plan}_${annual ? 'annual' : 'monthly'}`;
}

/** Returns the display label (e.g. "₹1,599/mo") for a plan, or null if not found. */
export function razorpayPriceLabel(plan, annual) {
  return RAZORPAY_PLANS[razorpayPlanKey(plan, annual)]?.label || null;
}

/**
 * Opens the Razorpay checkout popup for a subscription.
 * Resolves when payment succeeds; rejects if cancelled or failed.
 */
export async function startRazorpayCheckout({ plan, annual, email }) {
  await loadScript();

  const key = razorpayPlanKey(plan, annual);
  const planEntry = RAZORPAY_PLANS[key];
  if (!planEntry) throw new Error(`No Razorpay plan configured for ${key}`);

  const subRes = await fetch(`${RAZORPAY_WORKER_URL}/create-subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: planEntry.planId, email }),
  });
  const { subscriptionId, error } = await subRes.json();
  if (error) throw new Error(error);

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: RAZORPAY_KEY_ID,
      subscription_id: subscriptionId,
      name: 'OpsManifest',
      description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan — ${annual ? 'Annual' : 'Monthly'}`,
      prefill: { email },
      theme: { color: '#0D9488' },
      handler: async (response) => {
        try {
          const verifyRes = await fetch(`${RAZORPAY_WORKER_URL}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              email,
              plan,
            }),
          });
          const result = await verifyRes.json();
          if (result.error) throw new Error(result.error);
          resolve({ plan, subscriptionId: response.razorpay_subscription_id });
        } catch (err) {
          reject(err);
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.open();
  });
}
