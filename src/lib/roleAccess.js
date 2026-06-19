// Role → design section mapping
// Each RACI role is mapped to the design sections they own/can edit
const ROLE_SECTION_MAP = {
  'Unix Admin':     ['unix'],
  'Unix Lead':      ['unix'],
  'Web Admin':      ['web'],
  'Web Lead':       ['web'],
  'App Admin':      ['app'],
  'App Lead':       ['app'],
  'DB Admin':       ['db'],
  'DBA Lead':       ['db'],
  'Storage Admin':  ['storage'],
  'Storage Lead':   ['storage'],
  'Backup Admin':   ['backup'],
  'Backup Lead':    ['backup'],
  'Net Admin':      ['network'],
  'Net Lead':       ['network'],
  'SecOps':         ['security'],
  'SecOps Lead':    ['security'],
  'PM':             ['unix','web','app','db','storage','backup','network','security'],
  'Deputy PM':      ['unix','web','app','db','storage','backup','network','security'],
  'QA Team Lead':   [],
  'Change Manager': [],
};

// Returns array of role names the signed-in user holds in this build
export function getUserRolesForBuild(authUser, roleAssignments) {
  if (!authUser?.email || !roleAssignments) return [];
  return Object.entries(roleAssignments)
    .filter(([, v]) => v?.email === authUser.email)
    .map(([role]) => role);
}

// Returns true if the user can edit a given design section
// Takes precedence over global readOnly when user owns that section
export function canEditDesignSection(userRoles, sectionKey) {
  return userRoles.some(role => (ROLE_SECTION_MAP[role] || []).includes(sectionKey));
}

// True if the user holds the QA Team Lead role in this build
export function isQATeamLead(authUser, roleAssignments) {
  const assignment = roleAssignments?.['QA Team Lead'];
  return !!assignment?.email && assignment.email === authUser?.email;
}

/**
 * isPMOrDeputy — true when the signed-in user is the PM or Deputy PM of this build.
 * Used to gate workflow-progression actions: change periods, PM Decision Log,
 * CAB submission, RTM sign-off, promote to live, unlock for revision.
 */
export function isPMOrDeputy(authUser, requirements) {
  if (!authUser?.email) return false;
  const email = authUser.email;
  return email === requirements?.pmEmail || email === requirements?.pmBackupEmail;
}

/**
 * canManageSchedule — restrict change-period (freeze/holiday/break) adds and edits
 * to the PM or Deputy PM. Returns true if allowed.
 */
export function canManageSchedule(authUser, requirements) {
  return isPMOrDeputy(authUser, requirements);
}

/**
 * canEditPMLog — restrict the PM Decision Log textarea to PM/Deputy PM.
 */
export function canEditPMLog(authUser, requirements) {
  return isPMOrDeputy(authUser, requirements);
}

/**
 * canEditRaidEntry — RISK, DECISION, and CHANGE types require PM or Deputy PM.
 * ISSUE, ASSUMPTION, DEPENDENCY are open to any authenticated user.
 */
export function canEditRaidEntry(entryType, authUser, requirements) {
  const restricted = ['RISK', 'DECISION', 'CHANGE'];
  if (!restricted.includes(entryType)) return true;
  return isPMOrDeputy(authUser, requirements);
}
