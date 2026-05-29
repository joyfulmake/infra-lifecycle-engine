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

export const PROMO_CODES = {
  OPSPRO:       'professional',
  PROKEY2026:   'professional',
  OPSTEAM:      'team',
  OPSADMIN:     'enterprise',
  ADMINKEY:     'enterprise',
  OPSTARTER:    'starter',
};

const AUTH_KEY = 'opsmanifest_auth';

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function signIn(email, plan = 'starter', syncPassword = null) {
  const existing = getAuthUser();
  const user = {
    email: email.trim().toLowerCase(),
    displayName: email.split('@')[0],
    plan,
    buildsUsed: existing?.buildsUsed ?? 0,
    joinedAt: existing?.joinedAt ?? new Date().toISOString().slice(0, 10),
    // syncPassword stored locally for silent Firebase re-auth on same device
    ...(syncPassword ? { syncPassword } : existing?.syncPassword ? { syncPassword: existing.syncPassword } : {}),
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

export function resolvePromoCode(code) {
  return PROMO_CODES[(code || '').trim().toUpperCase()] || null;
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
  const tier = user?.plan ?? 'guest';
  const userLevel = TIER_ORDER.indexOf(tier);
  return userLevel >= (FEATURE_TIER[feature] ?? 0);
}

export function buildLimitReached(user) {
  if (!user || !user.plan) return true;
  const plan = PLANS[user.plan];
  if (!plan) return true;
  if (plan.buildsPerYear === Infinity) return false;
  return (user.buildsUsed || 0) >= plan.buildsPerYear;
}

export function incrementBuildCount(user) {
  if (!user) return null;
  const updated = { ...user, buildsUsed: (user.buildsUsed || 0) + 1 };
  localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
  return updated;
}
