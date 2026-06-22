// CIT — Component Integration Tests: coherenceEngine.js
// Validates cross-tab coherence alerts for key business rules.

import { describe, it, expect, vi } from 'vitest';

// Mock the data modules so tests don't depend on catalog contents
vi.mock('../lib/incidents.js', () => ({ ALL_INC: [] }));
vi.mock('../lib/uumItems.js',  () => ({ ALL_UUM: [] }));
vi.mock('../lib/compatibilityRules.js', () => ({
  checkCompatibility: () => [],
  checkCompatibilityForText: () => [],
}));

import { runCoherenceChecks } from '../lib/coherenceEngine.js';

const BASE = {
  isBuilt: true,
  designApplied: false,
  phase2Active: false,
  rtmSigned: false,
  selInc: [],
  selUUM: [],
  customInc: [],
  sysDesignData: {},
  requirements: {},
  rtmRows: {},
  roleAssignments: {},
  promoted: false,
  cabApproved: false,
  rtmStale: false,
  tasksStaleReason: null,
};

describe('runCoherenceChecks — guard', () => {
  it('returns empty alerts when isBuilt is false', () => {
    const alerts = runCoherenceChecks({ ...BASE, isBuilt: false });
    expect(alerts).toHaveLength(0);
  });
});

describe('check 1 — compliance field gap', () => {
  it('fires when compliance is set but security design field is empty', () => {
    const state = {
      ...BASE,
      designApplied: true,
      requirements: { compliance: 'PCI-DSS' },
      sysDesignData: { security: { compliance_framework: '' } },
    };
    const alerts = runCoherenceChecks(state);
    const match = alerts.find(a => a.id === 'compliance_gap');
    expect(match).toBeDefined();
    expect(match.severity).toBe('warn');
    expect(match.tabs).toContain('design');
  });

  it('does not fire when compliance_framework is filled', () => {
    const state = {
      ...BASE,
      designApplied: true,
      requirements: { compliance: 'PCI-DSS' },
      sysDesignData: { security: { compliance_framework: 'PCI-DSS Level 1' } },
    };
    const alerts = runCoherenceChecks(state);
    expect(alerts.find(a => a.id === 'compliance_gap')).toBeUndefined();
  });

  it('does not fire when no compliance requirement', () => {
    const state = { ...BASE, designApplied: true };
    const alerts = runCoherenceChecks(state);
    expect(alerts.find(a => a.id === 'compliance_gap')).toBeUndefined();
  });
});

describe('check 5 — SLA monitoring gap', () => {
  it('fires when SLA >= 99.99 and no monitoring agent', () => {
    const state = {
      ...BASE,
      designApplied: true,
      requirements: { sla: '99.99' },
      sysDesignData: { unix: { monitoring_agent: '' } },
    };
    const alerts = runCoherenceChecks(state);
    const match = alerts.find(a => a.id === 'sla_monitoring_gap');
    expect(match).toBeDefined();
    expect(match.severity).toBe('warn');
    expect(match.fix).toBeInstanceOf(Array);
    expect(match.fix.length).toBeGreaterThan(0);
  });

  it('does not fire for SLA < 99.99', () => {
    const state = {
      ...BASE,
      designApplied: true,
      requirements: { sla: '99.5' },
      sysDesignData: { unix: { monitoring_agent: '' } },
    };
    const alerts = runCoherenceChecks(state);
    expect(alerts.find(a => a.id === 'sla_monitoring_gap')).toBeUndefined();
  });
});

describe('check 7 — empty phase 2', () => {
  it('fires when phase2Active but no incidents or UUM', () => {
    const state = { ...BASE, phase2Active: true, selInc: [], selUUM: [] };
    const alerts = runCoherenceChecks(state);
    const match = alerts.find(a => a.id === 'empty_phase2');
    expect(match).toBeDefined();
    expect(match.tabs).toContain('exec');
  });

  it('does not fire when incidents are selected', () => {
    const state = { ...BASE, phase2Active: true, selInc: ['INC001'], selUUM: [] };
    const alerts = runCoherenceChecks(state);
    expect(alerts.find(a => a.id === 'empty_phase2')).toBeUndefined();
  });
});

describe('check 8 — RTM FAIL/BLOCKED rows', () => {
  it('fires when there are FAIL rows', () => {
    const state = {
      ...BASE,
      phase2Active: true,
      rtmRows: { 'req-1': 'FAIL', 'req-2': 'PASS', 'req-3': 'BLOCKED' },
    };
    const alerts = runCoherenceChecks(state);
    const match = alerts.find(a => a.id === 'rtm_fails');
    expect(match).toBeDefined();
    expect(match.message).toContain('2'); // 1 FAIL + 1 BLOCKED
    expect(match.tabs).toContain('rtm');
    expect(match.tabs).toContain('closure');
  });

  it('does not fire when all rows PASS', () => {
    const state = {
      ...BASE,
      phase2Active: true,
      rtmRows: { 'req-1': 'PASS', 'req-2': 'NA' },
    };
    const alerts = runCoherenceChecks(state);
    expect(alerts.find(a => a.id === 'rtm_fails')).toBeUndefined();
  });
});

describe('check 9 — critical roles missing', () => {
  it('fires when Unix Admin, DB Admin, SecOps are unassigned', () => {
    const state = { ...BASE, phase2Active: true, roleAssignments: {} };
    const alerts = runCoherenceChecks(state);
    const match = alerts.find(a => a.id === 'roles_missing');
    expect(match).toBeDefined();
    expect(match.message).toContain('Unix Admin');
    expect(match.message).toContain('DB Admin');
  });

  it('does not fire when all critical roles are assigned', () => {
    const state = {
      ...BASE,
      phase2Active: true,
      roleAssignments: {
        'Unix Admin': { email: 'unix@corp.com' },
        'DB Admin':   { email: 'dba@corp.com' },
        'SecOps':     { email: 'sec@corp.com' },
      },
    };
    const alerts = runCoherenceChecks(state);
    expect(alerts.find(a => a.id === 'roles_missing')).toBeUndefined();
  });
});
