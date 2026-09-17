// Formal RBAC capability matrix. Complements — does not replace — the
// existing ad-hoc checks in roleAccess.js (canEditDesignSection,
// canManageSchedule, canEditRaidEntry, isQATeamLead), which stay as-is
// since many call sites already depend on their exact behavior. New
// capability-gated features should check against THIS matrix instead of
// adding yet another bespoke isXyzAllowed() function.
//
// This is a client-side default policy, not an enforced server-side one —
// a user with direct store/API access could bypass it. Real multi-tenant
// enforcement needs the backend investment noted separately; this is the
// correct, honest starting shape for when that exists (same capability
// names, same role mapping, just enforced server-side too).

export const CAPABILITIES = [
  'view_build',
  'edit_design',
  'edit_raid',
  'edit_compliance_status',
  'approve_cab',
  'sign_rtm',
  'promote_cutover',
  'manage_roles',
  'export_audit_log',
  'manage_org_security',
];

const ROLE_CAPABILITIES = {
  'PM': CAPABILITIES,
  'Deputy PM': CAPABILITIES,
  'Change Manager': ['view_build', 'approve_cab', 'export_audit_log'],
  'QA Team Lead': ['view_build', 'sign_rtm'],
  'SecOps': ['view_build', 'edit_compliance_status', 'export_audit_log'],
};

export function getCapabilities(role) {
  return ROLE_CAPABILITIES[role] || ['view_build'];
}

// userRoles: array of role name strings this user is assigned to on this
// build (see getUserRolesForBuild in roleAccess.js). An empty/guest array
// only ever gets 'view_build' capabilities.
export function hasCapability(userRoles, capability) {
  if (!capability) return false;
  return (userRoles || []).some(role => getCapabilities(role).includes(capability));
}
