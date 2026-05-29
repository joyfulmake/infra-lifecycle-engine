import { useState } from 'react';
import { PLANS, signIn, signOut, resolvePromoCode } from '../lib/auth.js';
import { FIREBASE_CONFIGURED, fbSignIn } from '../lib/firebase.js';
import { STRIPE_CONFIGURED, startCheckout, openCustomerPortal } from '../lib/stripe.js';
import { useAuth } from '../lib/AuthContext.jsx';

const PLAN_STYLE = {
  starter:      { border: 'border-green-300',  bg: 'bg-green-50',   accent: 'text-green-700',   btn: 'bg-green-600 hover:bg-green-700' },
  professional: { border: 'border-teal-400',   bg: 'bg-teal-50',    accent: 'text-teal-700',    btn: 'bg-teal-600 hover:bg-teal-700' },
  team:         { border: 'border-blue-400',   bg: 'bg-blue-50',    accent: 'text-blue-700',    btn: 'bg-blue-600 hover:bg-blue-700' },
  enterprise:   { border: 'border-purple-400', bg: 'bg-purple-50',  accent: 'text-purple-700',  btn: 'bg-purple-600 hover:bg-purple-700' },
};

const PLAN_BADGE = {
  starter:      'bg-green-100 text-green-800',
  professional: 'bg-teal-100 text-teal-800',
  team:         'bg-blue-100 text-blue-800',
  enterprise:   'bg-purple-100 text-purple-800',
};

export { PLAN_BADGE };

export default function AuthModal({ onClose }) {
  const { authUser, setAuthUser } = useAuth();
  const [annual, setAnnual] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(authUser?.plan || 'professional');
  const [email, setEmail] = useState(authUser?.email || '');
  const [syncPassword, setSyncPassword] = useState('');
  const [showSyncPw, setShowSyncPw] = useState(false);
  const [promo, setPromo] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [promoMsg, setPromoMsg] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPro = ['professional', 'team', 'enterprise'].includes(selectedPlan);
  const needsCloudSync = isPro && FIREBASE_CONFIGURED;
  const isPaidPlan = ['professional', 'team'].includes(selectedPlan);
  const needsPayment = isPaidPlan && STRIPE_CONFIGURED && !authUser;
  const canManageBilling = STRIPE_CONFIGURED && authUser && ['professional', 'team', 'enterprise'].includes(authUser.plan);

  async function handleManageBilling() {
    try {
      await openCustomerPortal(authUser.email);
    } catch (e) {
      setError('Could not open billing portal: ' + e.message);
    }
  }

  function handlePromoApply() {
    const plan = resolvePromoCode(promo);
    if (plan) {
      setSelectedPlan(plan);
      setPromoMsg(`Code accepted — ${PLANS[plan]?.name} plan unlocked.`);
      setPromo('');
    } else {
      setPromoMsg('Invalid code. Try OPSPRO, OPSTEAM or OPSADMIN.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.'); return;
    }
    if (needsCloudSync && !syncPassword.trim()) {
      setError('Set a sync password to enable cloud backup for your plan.'); return;
    }
    setSubmitting(true);
    try {
      // Stripe payment flow for paid plans when Stripe is configured
      if (needsPayment) {
        await startCheckout({ plan: selectedPlan, annual, email: email.trim().toLowerCase() });
        return; // browser redirects to Stripe; execution stops here
      }
      if (needsCloudSync && syncPassword.trim()) {
        await fbSignIn(email.trim().toLowerCase(), syncPassword.trim());
      }
      const user = signIn(email.trim(), selectedPlan, needsCloudSync ? syncPassword.trim() : null);
      setAuthUser(user);
      onClose();
    } catch (err) {
      setError((err.message || 'Something went wrong') + (needsPayment ? ' — check Stripe config.' : ''));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignOut() {
    signOut();
    setAuthUser(null);
    onClose();
  }

  const planList = ['starter', 'professional', 'team', 'enterprise'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto">

        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-bold text-slate-800">OpsManifest — Plans &amp; Pricing</div>
              <div className="text-sm text-slate-500 mt-1">
                Purpose-built for Unix/Linux infrastructure teams.{' '}
                <span className="text-slate-400">All data stays in your browser — no server, no tracking.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canManageBilling && (
                <button onClick={handleManageBilling} className="text-xs px-3 py-1.5 rounded border border-teal-200 text-teal-600 hover:bg-teal-50 transition-colors">
                  Manage Billing
                </button>
              )}
              {authUser && (
                <button onClick={handleSignOut} className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                  Sign Out
                </button>
              )}
              <button onClick={onClose} className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                {authUser ? 'Close' : 'Continue as Guest'}
              </button>
            </div>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm font-medium transition-colors ${!annual ? 'text-slate-800' : 'text-slate-400'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(a => !a)}
              className={`relative w-11 h-6 rounded-full transition-colors ${annual ? 'bg-teal-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${annual ? 'left-6' : 'left-1'}`} />
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm font-medium transition-colors ${annual ? 'text-slate-800' : 'text-slate-400'}`}
            >
              Annual
              <span className="ml-1.5 text-xs font-bold text-teal-600 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-4 gap-4">
            {planList.map(planId => {
              const plan = PLANS[planId];
              const st = PLAN_STYLE[planId];
              const isSelected = selectedPlan === planId;
              const isCurrent = authUser?.plan === planId;
              const isEnterprise = planId === 'enterprise';

              const monthlyDisplay = isEnterprise
                ? 'Custom'
                : plan.monthlyPrice === 0
                  ? 'Free'
                  : annual
                    ? `$${Math.round((plan.annualPrice / 12) * 10) / 10}`
                    : `$${plan.monthlyPrice}`;

              const subNote = isEnterprise
                ? 'Contact sales'
                : plan.monthlyPrice === 0
                  ? 'No credit card needed'
                  : annual
                    ? `$${plan.annualPrice}/yr — billed annually`
                    : 'Billed monthly';

              return (
                <div
                  key={planId}
                  onClick={() => setSelectedPlan(planId)}
                  className={[
                    'rounded-xl border-2 p-5 cursor-pointer transition-all relative flex flex-col',
                    isSelected ? `${st.border} ${st.bg} shadow-lg` : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md',
                    plan.recommended && !isSelected ? 'ring-2 ring-teal-300 ring-offset-1' : '',
                  ].join(' ')}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow">
                      Most Popular
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow">
                      Current Plan
                    </div>
                  )}

                  <div className={`text-xs font-bold uppercase tracking-widest ${st.accent} mb-2`}>{plan.name}</div>

                  <div className="flex items-end gap-1 mb-0.5">
                    <span className="text-3xl font-extrabold text-slate-900 leading-none">{monthlyDisplay}</span>
                    {!isEnterprise && plan.monthlyPrice > 0 && (
                      <span className="text-sm text-slate-400 mb-0.5">/mo</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mb-3">{subNote}</div>

                  <div className="text-xs text-slate-500 mb-4 leading-relaxed flex-grow">{plan.description}</div>

                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-start gap-2 text-xs text-slate-700">
                        <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>{f}</span>
                      </div>
                    ))}
                    {plan.gated.map(f => (
                      <div key={f} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-center leading-3 text-slate-300">—</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  {isSelected && (
                    <div className={`mt-4 text-center text-xs font-semibold ${st.accent} border ${st.border} rounded-lg py-1.5`}>
                      {isEnterprise ? 'Contact us' : 'Selected'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sign-in form */}
        <div className="px-8 pb-8 border-t border-slate-100">
          <div className="max-w-md mx-auto pt-6">

            {selectedPlan === 'enterprise' ? (
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700 mb-2">Get in touch for Enterprise</div>
                <div className="text-xs text-slate-500 mb-4">
                  Includes SSO, custom integrations, on-premises bundle, and dedicated support SLA.
                </div>
                <a
                  href="mailto:hello@opsmanifest.app?subject=Enterprise Enquiry"
                  className="inline-block bg-purple-600 text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-purple-700 transition-colors"
                >
                  Contact Sales →
                </a>
              </div>
            ) : (
              <>
                <div className="text-sm font-semibold text-slate-700 mb-1 text-center">
                  {authUser ? `Switch to ${PLANS[selectedPlan]?.name}` : `Get started with ${PLANS[selectedPlan]?.name}`}
                </div>
                <div className="text-xs text-slate-400 text-center mb-5">
                  Profile stored in your browser only — no server, no tracking. Export to Excel for permanent records.
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email address</label>
                    <input
                      type="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  </div>

                  {/* Cloud sync password — Pro+ with Firebase configured */}
                  {needsCloudSync && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Cloud Sync Password
                        <span className="ml-1 text-xs text-teal-600 font-normal">(enables cross-device backup)</span>
                      </label>
                      {!showSyncPw ? (
                        <button type="button" onClick={() => setShowSyncPw(true)} className="text-xs text-teal-600 hover:text-teal-700 border border-teal-200 rounded px-2 py-1 w-full text-left">
                          + Set sync password to enable cloud backup
                        </button>
                      ) : (
                        <>
                          <input
                            type="password"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                            value={syncPassword}
                            onChange={e => setSyncPassword(e.target.value)}
                            placeholder="Choose a sync password (min 8 chars)"
                            autoComplete="new-password"
                          />
                          <div className="text-xs text-slate-400 mt-1">
                            This password is stored locally for silent re-auth on this device. Use the same password on any new device to restore your cloud builds.
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {!FIREBASE_CONFIGURED && isPro && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Cloud sync not yet configured — builds are saved locally in this browser.
                      <span className="block mt-0.5 text-amber-500">Firebase setup instructions are in CLAUDE.md.</span>
                    </div>
                  )}

                  {!showPromo ? (
                    <button type="button" onClick={() => setShowPromo(true)} className="text-xs text-teal-600 hover:text-teal-700 underline">
                      Have a promo or admin code?
                    </button>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Promo / Admin Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 uppercase tracking-widest"
                          value={promo}
                          onChange={e => setPromo(e.target.value.toUpperCase())}
                          placeholder="e.g. OPSPRO"
                        />
                        <button type="button" onClick={handlePromoApply} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200">
                          Apply
                        </button>
                      </div>
                      {promoMsg && (
                        <div className={`text-xs mt-1.5 font-medium ${promoMsg.includes('unlocked') ? 'text-green-600' : 'text-red-500'}`}>{promoMsg}</div>
                      )}
                      <div className="text-xs text-slate-400 mt-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                        <span className="font-semibold text-slate-500 mr-1">Demo codes:</span>
                        <span className="font-mono">OPSPRO</span> (Professional) ·{' '}
                        <span className="font-mono">OPSTEAM</span> (Team) ·{' '}
                        <span className="font-mono">OPSADMIN</span> (Enterprise)
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                  )}

                  {needsPayment && (
                    <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                      <span className="font-semibold">7-day free trial</span> — no charge until day 7. Cancel any time during the trial and you won't be billed. After clicking Subscribe you'll be redirected to Stripe Checkout to set up billing.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full text-white rounded-lg py-2.5 text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 ${PLAN_STYLE[selectedPlan]?.btn}`}
                  >
                    {submitting
                      ? 'Setting up...'
                      : needsPayment
                        ? `Subscribe to ${PLANS[selectedPlan]?.name} — ${annual ? `$${Math.round(PLANS[selectedPlan]?.annualPrice / 12)}/mo billed annually` : `$${PLANS[selectedPlan]?.monthlyPrice}/mo`}`
                        : authUser
                          ? `Switch to ${PLANS[selectedPlan]?.name}`
                          : `Continue with ${PLANS[selectedPlan]?.name}`}
                    {!submitting && !needsPayment && PLANS[selectedPlan]?.monthlyPrice === 0 && ' — Free'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
