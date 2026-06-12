// Razorpay configuration
// Set RAZORPAY_CONFIGURED = true after completing the activation steps below.
//
// Activation steps:
// 1. Create a Razorpay account at https://razorpay.com and complete KYC
// 2. Dashboard → Settings → API Keys → Generate Key Pair (live mode)
// 3. Copy the Key ID (rzp_live_...) into RAZORPAY_KEY_ID below
// 4. Deploy workers/razorpay-worker.js to Cloudflare:
//      wrangler deploy workers/razorpay-worker.js --name opsmanifest-razorpay --compatibility-date 2026-06-12
// 5. In Cloudflare Workers → Settings → Variables, set:
//      RAZORPAY_KEY_ID     = rzp_live_...
//      RAZORPAY_KEY_SECRET = your secret key
// 6. Set RAZORPAY_WORKER_URL below to https://opsmanifest-razorpay.<your-cf-account>.workers.dev
// 7. Create Razorpay Plans (Dashboard → Subscriptions → Plans) for each tier:
//      Professional Monthly / Annual, Team Monthly / Annual
//    Copy the plan IDs (plan_...) into RAZORPAY_PLANS below
// 8. Set RAZORPAY_CONFIGURED = true here and rebuild + deploy
//
// INR pricing note: Razorpay charges in paise (1 INR = 100 paise).
// Amounts in RAZORPAY_PLANS are in paise.

export const RAZORPAY_CONFIGURED = false;

export const RAZORPAY_KEY_ID = 'rzp_live_REPLACE_WITH_YOUR_KEY_ID';

export const RAZORPAY_WORKER_URL = 'https://opsmanifest-razorpay.REPLACE.workers.dev';

// Suggested INR pricing (adjust to match your Razorpay plan configuration)
export const RAZORPAY_PLANS = {
  professional_monthly: { planId: 'plan_REPLACE_PROF_MONTHLY', amountPaise: 159900, label: '₹1,599/mo' },
  professional_annual:  { planId: 'plan_REPLACE_PROF_ANNUAL',  amountPaise: 1590000, label: '₹15,900/yr' },
  team_monthly:         { planId: 'plan_REPLACE_TEAM_MONTHLY', amountPaise: 499900, label: '₹4,999/mo' },
  team_annual:          { planId: 'plan_REPLACE_TEAM_ANNUAL',  amountPaise: 4990000, label: '₹49,900/yr' },
};
