// CIT — Component Integration Tests: roleAccess.js
// Validates PM/Deputy PM gating logic used by schedule, RTM sign-off, CAB submission.

import { describe, it, expect } from 'vitest';
import {
  isPMOrDeputy,
  canManageSchedule,
  canEditRaidEntry,
  getUserRolesForBuild,
  canEditDesignSection,
  isQATeamLead,
} from '../lib/roleAccess.js';

describe('isPMOrDeputy', () => {
  it('returns false for guest (no authUser)', () => {
    expect(isPMOrDeputy(null, {})).toBe(false);
    expect(isPMOrDeputy(undefined, {})).toBe(false);
  });

  it('returns false for user with no email', () => {
    expect(isPMOrDeputy({ email: '' }, {})).toBe(false);
  });

  it('returns true for any signed-in user when no PM email is set (open access)', () => {
    // This was the go-live date bug: pmEmail not set → canSchedule false for signed-in users
    expect(isPMOrDeputy({ email: 'sriram.c76@gmail.com' }, {})).toBe(true);
    expect(isPMOrDeputy({ email: 'sriram.c76@gmail.com' }, { pmEmail: '' })).toBe(true);
    expect(isPMOrDeputy({ email: 'anyone@corp.com' }, { pmEmail: undefined })).toBe(true);
  });

  it('returns true when user IS the PM', () => {
    const auth = { email: 'pm@corp.com' };
    const req  = { pmEmail: 'pm@corp.com', pmBackupEmail: 'deputy@corp.com' };
    expect(isPMOrDeputy(auth, req)).toBe(true);
  });

  it('returns true when user IS the Deputy PM', () => {
    const auth = { email: 'deputy@corp.com' };
    const req  = { pmEmail: 'pm@corp.com', pmBackupEmail: 'deputy@corp.com' };
    expect(isPMOrDeputy(auth, req)).toBe(true);
  });

  it('returns false when user is neither PM nor Deputy', () => {
    const auth = { email: 'dba@corp.com' };
    const req  = { pmEmail: 'pm@corp.com', pmBackupEmail: 'deputy@corp.com' };
    expect(isPMOrDeputy(auth, req)).toBe(false);
  });

  it('is case-insensitive for email comparison', () => {
    const auth = { email: 'PM@CORP.COM' };
    const req  = { pmEmail: 'pm@corp.com' };
    expect(isPMOrDeputy(auth, req)).toBe(true);
  });
});

describe('canManageSchedule', () => {
  it('delegates to isPMOrDeputy', () => {
    expect(canManageSchedule({ email: 'a@b.com' }, {})).toBe(true);
    expect(canManageSchedule(null, {})).toBe(false);
  });
});

describe('canEditRaidEntry', () => {
  it('allows any user to edit ISSUE and ASSUMPTION entries', () => {
    expect(canEditRaidEntry('ISSUE', null, {})).toBe(true);
    expect(canEditRaidEntry('ASSUMPTION', null, {})).toBe(true);
    expect(canEditRaidEntry('DEPENDENCY', null, {})).toBe(true);
  });

  it('restricts RISK, DECISION, CHANGE to PM or Deputy', () => {
    const pm  = { email: 'pm@corp.com' };
    const req = { pmEmail: 'pm@corp.com' };
    expect(canEditRaidEntry('RISK', pm, req)).toBe(true);
    expect(canEditRaidEntry('DECISION', pm, req)).toBe(true);
    expect(canEditRaidEntry('CHANGE', pm, req)).toBe(true);

    const dba = { email: 'dba@corp.com' };
    expect(canEditRaidEntry('RISK', dba, req)).toBe(false);
  });
});

describe('getUserRolesForBuild', () => {
  const assignments = {
    'DB Admin':  { email: 'dba@corp.com', name: 'Alice' },
    'Unix Admin': { email: 'unix@corp.com', name: 'Bob' },
    'PM':        { email: 'pm@corp.com', name: 'Sriram' },
  };

  it('returns roles matching the user email', () => {
    const roles = getUserRolesForBuild({ email: 'dba@corp.com' }, assignments);
    expect(roles).toContain('DB Admin');
    expect(roles).not.toContain('Unix Admin');
  });

  it('returns empty array for guest', () => {
    expect(getUserRolesForBuild(null, assignments)).toEqual([]);
    expect(getUserRolesForBuild({ email: '' }, assignments)).toEqual([]);
  });

  it('returns empty array when no roles match', () => {
    expect(getUserRolesForBuild({ email: 'nobody@corp.com' }, assignments)).toEqual([]);
  });
});

describe('canEditDesignSection', () => {
  it('allows DB Admin to edit db section', () => {
    expect(canEditDesignSection(['DB Admin'], 'db')).toBe(true);
  });

  it('does not allow DB Admin to edit unix section', () => {
    expect(canEditDesignSection(['DB Admin'], 'unix')).toBe(false);
  });

  it('allows PM to edit all sections', () => {
    const sections = ['unix', 'web', 'app', 'db', 'storage', 'backup', 'network', 'security'];
    sections.forEach(s => expect(canEditDesignSection(['PM'], s)).toBe(true));
  });
});

describe('isQATeamLead', () => {
  const assignments = { 'QA Team Lead': { email: 'qa@corp.com' } };

  it('returns true when user holds QA Team Lead role', () => {
    expect(isQATeamLead({ email: 'qa@corp.com' }, assignments)).toBe(true);
  });

  it('returns false for other users', () => {
    expect(isQATeamLead({ email: 'pm@corp.com' }, assignments)).toBe(false);
  });

  it('returns false when role is unassigned', () => {
    expect(isQATeamLead({ email: 'qa@corp.com' }, {})).toBe(false);
  });
});
