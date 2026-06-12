// Tier levels (internal): guest=0, starter=1, professional=2, team=3, enterprise=4
// 'guest' = unauthenticated — not shown as a plan card, just the default unauthenticated state

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    buildsPerYear: 2,
    teamSize: 1,
    description: 'Free forever — try the full workflow, save up to 2 builds a year',
    features: [
      '2 builds per year (browser storage)',
      'Full build workflow — all 7 phases',
      'Save & load builds locally',
      'Excel export — core 9 sheets',
      'AI Smart Scan (no API key)',
      'CAB + RTM + Closure workflow',
    ],
    gated: ['CMDB configuration database', 'Full 13-sheet Excel + CMDB', 'Tech review locking', 'Team collaboration'],
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 19,
    annualPrice: 190,
    buildsPerYear: 15,
    teamSize: 1,
    recommended: true,
    description: '15 builds per year — CMDB, full exports, advanced workflows for power users',
    features: [
      '15 builds per year',
      'CMDB — CI register with EOL/EOS tracking',
      'Full 13-sheet Excel export incl. CMDB sheet',
      'Tech review locking workflow',
      'Role-based design editing (PM / Admin)',
      'Build versioning',
      'All Starter features',
    ],
    gated: ['Team collaboration'],
  },
  team: {
    id: 'team',
    name: 'Team',
    monthlyPrice: 59,
    annualPrice: 590,
    buildsPerYear: Infinity,
    teamSize: 8,
    description: 'Unlimited builds for up to 8 users — for infrastructure project teams',
    features: [
      'Unlimited builds',
      'Up to 8 team members',
      'Shared build repository',
      'Role-based access (PM / Admin / Reviewer)',
      'Team RAID collaboration board',
      'Priority email support',
      'All Professional features',
    ],
    gated: ['Enterprise SSO', 'Custom integrations'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    buildsPerYear: Infinity,
    teamSize: Infinity,
    description: 'Unlimited users, SSO, integrations and on-prem — for large organisations',
    features: [
      'Unlimited users & builds',
      'SSO / LDAP / SAML',
      'ServiceNow / Jira / BMC integration',
      'On-premises deployment bundle',
      'Compliance audit trail (SOC2, ISO 27001)',
      'Dedicated support with SLA',
      'All Team features',
    ],
    gated: [],
  },
};

// Private promo codes — NOT displayed in the UI.
// Each entry: { plan, days } — days is the access window from first use.
// String values are accepted for backward compat (treated as { plan, days: PROMO_VALIDITY_DAYS }).
export const PROMO_CODES = {
  OPSPRO:       { plan: 'professional', days: 14 },
  PROKEY2026:   { plan: 'professional', days: 14 },
  OPSTEAM:      { plan: 'team',         days: 14 },
  OPSADMIN:     { plan: 'enterprise',   days: 14 },
  ADMINKEY:     { plan: 'enterprise',   days: 14 },
  OPSTARTER:    { plan: 'starter',      days: 14 },
  // Short demo codes for live demos (1 / 3 / 7 day windows)
  DEMO1D:       { plan: 'professional', days: 1  },
  DEMO3D:       { plan: 'professional', days: 3  },
  DEMO7D:       { plan: 'professional', days: 7  },
  // Enterprise trial codes (admin-issued; 30 / 60 / 180 day windows)
  ENT30:        { plan: 'enterprise',   days: 30  },
  ENT60:        { plan: 'enterprise',   days: 60  },
  ENT180:       { plan: 'enterprise',   days: 180 },
};

export const PROMO_VALIDITY_DAYS = 14;

// Seeded accounts — permanent plan grant, never expires, isAdmin flag gives admin UI.
// Shape: { plan: string, isAdmin?: boolean }
export const SEEDED_ACCOUNTS = {
  'sriram.c76@gmail.com': { plan: 'enterprise', isAdmin: true },
};

const AUTH_KEY = 'opsmanifest_auth';

// Admin-generated invite codes stored in localStorage
const INVITE_KEY = 'opsmanifest_invites';

function _getInvites() {
  try { return JSON.parse(localStorage.getItem(INVITE_KEY) || '{}'); } catch { return {}; }
}

/** Generate a time-limited invite code for a specific email address. Admin only. */
export function generateInviteCode(targetEmail, plan, days) {
  const code = 'INV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const invites = _getInvites();
  invites[code] = {
    targetEmail: targetEmail.toLowerCase(),
    plan,
    days,
    createdAt: Date.now(),
    // The invite link itself is valid for 60 days (separate from access duration)
    linkExpiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
    used: false,
  };
  localStorage.setItem(INVITE_KEY, JSON.stringify(invites));
  return code;
}

/** Returns all admin-generated invites (for admin panel display). */
export function getAllInvites() {
  return _getInvites();
}

/** Validates and marks an invite code as used. Returns { plan, days } or null. */
export function resolveInviteCode(code, email) {
  if (!code || !email) return null;
  const upper = code.trim().toUpperCase();
  const invites = _getInvites();
  const invite = invites[upper];
  if (!invite) return null;
  if (invite.used) return null;
  if (invite.linkExpiresAt && Date.now() > invite.linkExpiresAt) return null;
  if (invite.targetEmail && invite.targetEmail !== email.toLowerCase()) return null;
  // Mark as used
  invites[upper] = { ...invite, used: true, usedAt: Date.now(), usedBy: email.toLowerCase() };
  localStorage.setItem(INVITE_KEY, JSON.stringify(invites));
  return { plan: invite.plan, days: invite.days };
}

/** Returns days remaining on a promo grant, or null if not promo-based. */
export function promoDaysRemaining(user) {
  if (!user?.promoExpiresAt) return null;
  if (SEEDED_ACCOUNTS[user?.email]) return null; // seeded accounts don't expire
  const ms = user.promoExpiresAt - Date.now();
  return ms > 0 ? Math.ceil(ms / 86400000) : 0;
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);

    // Seeded accounts: always return seeded plan + isAdmin flag, never expire
    const seeded = SEEDED_ACCOUNTS[user?.email];
    if (seeded) {
      const seededPlan = seeded?.plan || seeded; // backward compat for string format
      const isAdmin = seeded?.isAdmin || false;
      if (user.plan !== seededPlan || user.isAdmin !== isAdmin) {
        const upgraded = { ...user, plan: seededPlan, isAdmin, promoExpiresAt: null, promoExpired: false };
        localStorage.setItem(AUTH_KEY, JSON.stringify(upgraded));
        return upgraded;
      }
      return user;
    }

    // Promo expiry check — downgrade to starter if expired
    if (user.promoExpiresAt && Date.now() > user.promoExpiresAt) {
      const downgraded = {
        ...user,
        plan: 'starter',
        promoExpired: true,
        promoExpiresAt: null,
        promoCode: null,
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(downgraded));
      return downgraded;
    }

    return user;
  } catch {
    return null;
  }
}

/** Signs in a user. Pass promoCode + promoDays to set a variable-length access window. */
export function signIn(email, plan = 'starter', syncPassword = null, promoCode = null, promoDays = null) {
  const cleanEmail = email.trim().toLowerCase();
  const seeded = SEEDED_ACCOUNTS[cleanEmail];
  const seededPlan = seeded?.plan || seeded || null;
  const seededAdmin = seeded?.isAdmin || false;
  const effectivePlan = seededPlan || plan;
  const existing = getAuthUser();
  const daysToUse = promoDays ?? PROMO_VALIDITY_DAYS;

  const promoFields = (!seeded && promoCode)
    ? {
        promoCode: promoCode.trim().toUpperCase(),
        promoExpiresAt: Date.now() + daysToUse * 24 * 60 * 60 * 1000,
        promoExpired: false,
        promoDays: daysToUse,
      }
    : (existing?.promoCode && !seeded
        ? { promoCode: existing.promoCode, promoExpiresAt: existing.promoExpiresAt, promoExpired: existing.promoExpired, promoDays: existing.promoDays }
        : {});

  const user = {
    email: cleanEmail,
    displayName: cleanEmail.split('@')[0],
    plan: effectivePlan,
    ...(seededAdmin ? { isAdmin: true } : {}),
    buildsUsed: existing?.buildsUsed ?? 0,
    joinedAt: existing?.joinedAt ?? new Date().toISOString().slice(0, 10),
    ...(syncPassword ? { syncPassword } : existing?.syncPassword ? { syncPassword: existing.syncPassword } : {}),
    ...promoFields,
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
}

// Attempt silent Firebase re-auth for Pro+ users using stored syncPassword
export async function trySilentFirebaseAuth(user) {
  if (!user?.email || !user?.syncPassword) return;
  const tierOk = ['professional', 'team', 'enterprise'].includes(user.plan);
  if (!tierOk) return;
  try {
    const { FIREBASE_CONFIGURED, fbSignIn } = await import('./firebase.js');
    if (!FIREBASE_CONFIGURED) return;
    await fbSignIn(user.email, user.syncPassword);
  } catch {
    // silent — cloud sync is best-effort
  }
}

export function signOut() {
  localStorage.removeItem(AUTH_KEY);
}

/** Returns { plan, days } for a static promo code, or null if not found. */
export function resolvePromoCode(code) {
  const entry = PROMO_CODES[(code || '').trim().toUpperCase()];
  if (!entry) return null;
  // Backward compat: if entry is a plain string (old format), treat as { plan, days: PROMO_VALIDITY_DAYS }
  if (typeof entry === 'string') return { plan: entry, days: PROMO_VALIDITY_DAYS };
  return entry;
}

const TIER_ORDER = ['guest', 'starter', 'professional', 'team', 'enterprise'];

// feature gates — required tier level
const FEATURE_TIER = {
  save_builds:  1,  // starter+
  excel_export: 1,  // starter+
  excel_full:   2,  // professional+
  cmdb:         2,  // professional+
  tech_review:  2,  // professional+
  team:         3,  // team+
  unlimited:    4,  // enterprise+
};

export function canUseFeature(user, feature) {
  const email = user?.email;
  const seeded = SEEDED_ACCOUNTS[email];
  const tier = (seeded?.plan || seeded) ?? user?.plan ?? 'guest';
  const userLevel = TIER_ORDER.indexOf(tier);
  return userLevel >= (FEATURE_TIER[feature] ?? 0);
}

export function buildLimitReached(user) {
  // Guests can always build — they just can't save
  if (!user || !user.plan) return false;
  const seeded = SEEDED_ACCOUNTS[user.email];
  const effectivePlan = (seeded?.plan || seeded) ?? user.plan;
  const plan = PLANS[effectivePlan];
  if (!plan) return false;
  if (plan.buildsPerYear === Infinity) return false;
  return (user.buildsUsed || 0) >= plan.buildsPerYear;
}

export function incrementBuildCount(user) {
  if (!user) return null;
  const updated = { ...user, buildsUsed: (user.buildsUsed || 0) + 1 };
  localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
  return updated;
}
