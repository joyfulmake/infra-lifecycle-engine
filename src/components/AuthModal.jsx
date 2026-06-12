import { useState } from 'react';
import { PLANS, signIn, signOut, resolvePromoCode, resolveInviteCode, generateInviteCode, getAllInvites, promoDaysRemaining } from '../lib/auth.js';
import { FIREBASE_CONFIGURED, fbSignIn } from '../lib/firebase.js';
import { STRIPE_CONFIGURED, startCheckout, openCustomerPortal } from '../lib/stripe.js';
import { RAZORPAY_CONFIGURED } from '../lib/razorpayConfig.js';
import { razorpayPriceLabel } from '../lib/razorpay.js';
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

const REASON_META = {
  save:        { title: 'Sign in to save your build', sub: 'Free account — 2 builds saved in your browser. No credit card.', defaultPlan: 'starter', showPricing: false },
  export:      { title: 'Sign in to export to Excel', sub: 'Free Starter account includes a 9-sheet Excel export.', defaultPlan: 'starter', showPricing: false },
  build_limit: { title: "You've used all builds on your plan", sub: 'Upgrade to continue building and unlock more features.', defaultPlan: 'professional', showPricing: true },
  signup:      { title: 'OpsManifest — Plans & Pricing', sub: 'Purpose-built for Unix/Linux infrastructure teams. All data stays in your browser.', defaultPlan: 'professional', showPricing: true },
};

export default function AuthModal({ reason = 'signup', onClose }) {
  const { authUser, setAuthUser } = useAuth();
  const meta = REASON_META[reason] || REASON_META.signup;
  const [showPricing, setShowPricing] = useState(meta.showPricing);
  const [annual, setAnnual] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(authUser?.plan || meta.defaultPlan);
  const [email, setEmail] = useState(authUser?.email || '');
  const [syncPassword, setSyncPassword] = useState('');
  const [showSyncPw, setShowSyncPw] = useState(false);
  const [promo, setPromo] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [promoMsg, setPromoMsg] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState(null);
  const [appliedPromoDays, setAppliedPromoDays] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDuration, setInviteDuration] = useState(30);
  const [invitePlan, setInvitePlan] = useState('enterprise');
  const [generatedCode, setGeneratedCode] = useState('');
  const [invites, setInvites] = useState(() => (typeof window !== 'undefined' ? getAllInvites() : {}));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPro = ['professional', 'team', 'enterprise'].includes(selectedPlan);
  const needsCloudSync = isPro && FIREBASE_CONFIGURED;
  const isPaidPlan = ['professional', 'team'].includes(selectedPlan);
  const needsPayment = isPaidPlan && (STRIPE_CONFIGURED || RAZORPAY_CONFIGURED) && !authUser;
  const canManageBilling = STRIPE_CONFIGURED && authUser && ['professional', 'team', 'enterprise'].includes(authUser.plan);

  async function handleManageBilling() {
    try {
      await openCustomerPortal(authUser.email);
    } catch (e) {
      setError('Could not open billing portal: ' + e.message);
    }
  }

  function handlePromoApply() {
    const code = promo.trim().toUpperCase();
    // Check static codes first, then admin-generated invite codes
    const resolved = resolvePromoCode(code) || resolveInviteCode(code, email.trim());
    if (resolved) {
      setSelectedPlan(resolved.plan);
      setAppliedPromoCode(code);
      setAppliedPromoDays(resolved.days);
      setPromoMsg(`Code accepted — ${PLANS[resolved.plan]?.name} access for ${resolved.days} day${resolved.days !== 1 ? 's' : ''}.`);
      setPromo('');
    } else {
      setAppliedPromoCode(null);
      setAppliedPromoDays(null);
      setPromoMsg('Invalid or expired code. Contact hello@opsmanifest.app for a valid access code.');
    }
  }

  function handleGenerateInvite() {
    if (!inviteEmail.trim()) return;
    const code = generateInviteCode(inviteEmail.trim(), invitePlan, Number(inviteDuration));
    setGeneratedCode(code);
    setInvites(getAllInvites());
    setInviteEmail('');
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
      // Payment flow — Stripe takes priority; Razorpay used when Stripe is off
      if (needsPayment) {
        if (STRIPE_CONFIGURED) {
          await startCheckout({ plan: selectedPlan, annual, email: email.trim().toLowerCase() });
          return; // browser redirects to Stripe; execution stops here
        }
        if (RAZORPAY_CONFIGURED) {
          const { startRazorpayCheckout } = await import('../lib/razorpay.js');
          const result = await startRazorpayCheckout({ plan: selectedPlan, annual, email: email.trim().toLowerCase() });
          // Payment succeeded — sign the user in at the paid plan
          const user = signIn(email.trim(), result.plan, needsCloudSync ? syncPassword.trim() : null, null, null);
          setAuthUser(user);
          onClose();
          return;
        }
      }
      if (needsCloudSync && syncPassword.trim()) {
        await fbSignIn(email.trim().toLowerCase(), syncPassword.trim());
      }
      const user = signIn(email.trim(), selectedPlan, needsCloudSync ? syncPassword.trim() : null, appliedPromoCode, appliedPromoDays);
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
      <div className={['bg-white rounded-2xl shadow-2xl w-full max-h-[94vh] overflow-y-auto', showPricing ? 'max-w-5xl' : 'max-w-md'].join(' ')}>

        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-200">
          {/* Promo expiry notice for current signed-in user */}
          {authUser && (() => {
            const days = promoDaysRemaining(authUser);
            if (days === null) return null;
            if (authUser.promoExpired) return (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                Your demo access has expired. To continue with {PLANS[authUser.plan]?.name || 'this plan'}, email{' '}
                <a href="mailto:hello@opsmanifest.app?subject=OpsManifest Access Renewal" className="font-semibold underline">hello@opsmanifest.app</a>.
              </div>
            );
            return (
              <div className={['mb-4 rounded-lg px-4 py-3 text-sm border', days <= 3 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'].join(' ')}>
                <strong>Demo access — {days} day{days !== 1 ? 's' : ''} remaining.</strong>{' '}
                {days <= 3 ? 'Expiring soon. ' : ''}
                To subscribe, select a plan below. To extend your demo, email{' '}
                <a href="mailto:hello@opsmanifest.app?subject=OpsManifest Demo Extension" className="font-semibold underline">hello@opsmanifest.app</a>.
              </div>
            );
          })()}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-bold text-slate-800">{meta.title}</div>
              <div className="text-sm text-slate-500 mt-1">{meta.sub}</div>
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
                {authUser ? 'Close' : reason === 'signup' ? 'Continue as Guest' : 'Not now'}
              </button>
            </div>
          </div>

          {/* Billing toggle — only when pricing is visible */}
          {showPricing && (
            <div className="flex items-center gap-3 mt-4">
              <button onClick={() => setAnnual(false)} className={`text-sm font-medium transition-colors ${!annual ? 'text-slate-800' : 'text-slate-400'}`}>Monthly</button>
              <button onClick={() => setAnnual(a => !a)} className={`relative w-11 h-6 rounded-full transition-colors ${annual ? 'bg-teal-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${annual ? 'left-6' : 'left-1'}`} />
              </button>
              <button onClick={() => setAnnual(true)} className={`text-sm font-medium transition-colors ${annual ? 'text-slate-800' : 'text-slate-400'}`}>
                Annual
                <span className="ml-1.5 text-xs font-bold text-teal-600 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">Save 17%</span>
              </button>
            </div>
          )}
        </div>

        {/* Plan cards — only when showPricing */}
        {showPricing && <div className="px-8 py-6">
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
        </div>}

        {/* "See all plans" toggle for compact mode */}
        {!showPricing && !authUser && (
          <div className="px-8 pt-2 pb-0">
            <button
              onClick={() => setShowPricing(true)}
              className="text-xs text-teal-600 hover:text-teal-700 underline"
            >
              See all plans & pricing →
            </button>
          </div>
        )}

        {/* Sign-in form */}
        <div className="px-8 pb-8 border-t border-slate-100 mt-4">
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
                    <div className="border border-teal-200 rounded-lg p-3 bg-teal-50">
                      <label className="block text-xs font-semibold text-teal-800 mb-1">
                        Cloud Sync Password
                      </label>
                      <div className="text-xs text-teal-700 mb-2 leading-relaxed">
                        <strong>You create this password right now.</strong> No email is sent to you. This is the password you will use to sign in from any new device and restore your builds from the cloud. Write it down and keep it safe.
                      </div>
                      <input
                        type="password"
                        className="w-full border border-teal-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                        value={syncPassword}
                        onChange={e => setSyncPassword(e.target.value)}
                        placeholder="Create a sync password (min 8 characters)"
                        autoComplete="new-password"
                      />
                      <div className="text-xs text-teal-600 mt-1.5 font-medium">
                        Remember this password — it cannot be recovered if forgotten.
                      </div>
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
                      Have a demo or access code?
                    </button>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Demo / Access Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 uppercase tracking-widest font-mono"
                          value={promo}
                          onChange={e => setPromo(e.target.value.toUpperCase())}
                          placeholder="Enter your access code"
                          autoComplete="off"
                        />
                        <button type="button" onClick={handlePromoApply} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200">
                          Apply
                        </button>
                      </div>
                      {promoMsg && (
                        <div className={`text-xs mt-1.5 font-medium ${promoMsg.includes('accepted') ? 'text-green-600' : 'text-red-500'}`}>{promoMsg}</div>
                      )}
                      {appliedPromoCode && (
                        <div className="text-xs mt-1 text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                          Access valid for {appliedPromoDays} day{appliedPromoDays !== 1 ? 's' : ''} from sign-in. Code saved in your browser profile.
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 leading-relaxed">
                        Demo codes are issued by the publisher on request — they are not displayed here.
                        To request a code, email{' '}
                        <a href="mailto:hello@opsmanifest.app?subject=OpsManifest Demo Access Request" className="text-teal-600 hover:underline font-semibold">
                          hello@opsmanifest.app
                        </a>.
                        By using a code you agree to OpsManifest's{' '}
                        <a href="/privacy.html" className="text-teal-600 hover:underline" target="_blank" rel="noopener">terms of use</a>.
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                  )}

                  {needsPayment && (
                    <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                      {RAZORPAY_CONFIGURED && !STRIPE_CONFIGURED
                        ? <><span className="font-semibold">Secure payment via Razorpay.</span> A subscription will be created. Cancel any time from your account.</>
                        : <><span className="font-semibold">7-day free trial</span> — no charge until day 7. Cancel any time during the trial and you won't be billed. After clicking Subscribe you'll be redirected to Stripe Checkout to set up billing.</>
                      }
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
                        ? (() => {
                            const rzLabel = RAZORPAY_CONFIGURED && !STRIPE_CONFIGURED ? razorpayPriceLabel(selectedPlan, annual) : null;
                            const priceStr = rzLabel
                              ? rzLabel
                              : annual
                                ? `$${Math.round(PLANS[selectedPlan]?.annualPrice / 12)}/mo billed annually`
                                : `$${PLANS[selectedPlan]?.monthlyPrice}/mo`;
                            return `Subscribe to ${PLANS[selectedPlan]?.name} — ${priceStr}`;
                          })()
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

      {/* Admin Panel — only visible to admin users */}
      {authUser?.isAdmin && (
        <div className="border-t-2 border-purple-200 bg-purple-50">
          <button
            onClick={() => setAdminOpen(o => !o)}
            className="w-full px-8 py-3 flex items-center justify-between text-sm font-semibold text-purple-800 hover:bg-purple-100 transition-colors"
          >
            <span>Admin Panel — {authUser.email}</span>
            <span className="text-purple-400">{adminOpen ? '▲' : '▼'}</span>
          </button>

          {adminOpen && (
            <div className="px-8 pb-8 space-y-6">

              {/* Static demo codes */}
              <div>
                <div className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Quick Demo Codes</div>
                <div className="grid grid-cols-3 gap-2">
                  {[{ code: 'DEMO1D', label: '1-Day Demo', plan: 'Professional' },
                    { code: 'DEMO3D', label: '3-Day Demo', plan: 'Professional' },
                    { code: 'DEMO7D', label: '7-Day Demo', plan: 'Professional' }].map(({ code, label, plan }) => (
                    <div key={code} className="bg-white border border-purple-200 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">{label} · {plan}</div>
                      <div className="font-mono text-sm font-bold text-purple-800 tracking-widest mb-2">{code}</div>
                      <button
                        onClick={() => navigator.clipboard?.writeText(code)}
                        className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors w-full"
                      >Copy</button>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-400 mt-1">Share these codes with prospects for a quick hands-on demo.</div>
              </div>

              {/* Enterprise invite generator */}
              <div>
                <div className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Generate Enterprise Trial Invite</div>
                <div className="bg-white border border-purple-200 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Recipient email</label>
                    <input
                      type="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="contact@enterprise.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                      <select
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        value={invitePlan}
                        onChange={e => setInvitePlan(e.target.value)}
                      >
                        <option value="professional">Professional</option>
                        <option value="team">Team</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Duration</label>
                      <select
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        value={inviteDuration}
                        onChange={e => setInviteDuration(e.target.value)}
                      >
                        <option value={1}>1 day</option>
                        <option value={3}>3 days</option>
                        <option value={7}>7 days</option>
                        <option value={30}>1 month (30d)</option>
                        <option value={60}>2 months (60d)</option>
                        <option value={180}>6 months (180d)</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateInvite}
                    disabled={!inviteEmail.trim()}
                    className="w-full py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >Generate Invite Code</button>
                  {generatedCode && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-xs text-green-700 mb-1">Generated code — send this to the recipient:</div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-green-800 tracking-widest flex-1">{generatedCode}</span>
                        <button
                          onClick={() => navigator.clipboard?.writeText(generatedCode)}
                          className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >Copy</button>
                      </div>
                      <div className="text-xs text-green-600 mt-1.5">Valid for {inviteDuration} days · Email-locked · Expires in 60 days if unused</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Active invites list */}
              {Object.keys(invites).length > 0 && (
                <div>
                  <div className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Issued Invites ({Object.keys(invites).length})</div>
                  <div className="bg-white border border-purple-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-purple-700">Code</th>
                          <th className="text-left px-3 py-2 font-semibold text-purple-700">Email</th>
                          <th className="text-left px-3 py-2 font-semibold text-purple-700">Plan / Days</th>
                          <th className="text-left px-3 py-2 font-semibold text-purple-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {Object.entries(invites).slice(-10).reverse().map(([code, inv]) => {
                          const expired = inv.linkExpiresAt && Date.now() > inv.linkExpiresAt;
                          const statusLabel = inv.used ? `Used by ${inv.usedBy || '?'}` : expired ? 'Expired' : 'Active';
                          const statusColor = inv.used ? 'text-slate-400' : expired ? 'text-red-500' : 'text-green-600';
                          return (
                            <tr key={code} className="hover:bg-purple-50">
                              <td className="px-3 py-2 font-mono font-bold text-purple-800">{code}</td>
                              <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">{inv.targetEmail}</td>
                              <td className="px-3 py-2 text-slate-600">{PLANS[inv.plan]?.name} · {inv.days}d</td>
                              <td className={`px-3 py-2 font-medium ${statusColor}`}>{statusLabel}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

    </div>
  );
}
