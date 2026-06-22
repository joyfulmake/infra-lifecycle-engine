// SIT — System Integration Tests: full workflow state machine
// Simulates the complete PM lifecycle using realistic state snapshots.
// Tests the coherenceEngine's cross-tab integration across every workflow gate.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/incidents.js', () => ({ ALL_INC: [] }));
vi.mock('../lib/uumItems.js',  () => ({ ALL_UUM: [] }));
vi.mock('../lib/compatibilityRules.js', () => ({
  checkCompatibility: () => [],
  checkCompatibilityForText: () => [],
}));

import { runCoherenceChecks } from '../lib/coherenceEngine.js';
import { isPMOrDeputy, canManageSchedule } from '../lib/roleAccess.js';

// ── Workflow state snapshots ────────────────────────────────────────────────

const PM = { email: 'pm@enterprise.com' };
const DBA = { email: 'dba@enterprise.com' };

const REQ = {
  projectName: 'RHEL Migration — Prod-DB-01',
  envType: 'Production',
  projectStartDate: '2026-07-01',
  goLiveDate: '2026-09-30',
  hoursPerDay: '8',
  sla: '99.99',
  compliance: 'ISO 27001',
};

function stateAt(overrides) {
  return {
    isBuilt: false,
    designApplied: false,
    phase2Active: false,
    rtmSigned: false,
    promoted: false,
    cabApproved: false,
    cabDeclined: false,
    rtmStale: false,
    tasksStaleReason: null,
    selInc: [],
    selUUM: [],
    customInc: [],
    sysDesignData: {},
    requirements: {},
    rtmRows: {},
    roleAssignments: {},
    ...overrides,
  };
}

// ── Gate 1: Build ────────────────────────────────────────────────────────────

describe('SIT Gate 1 — Build', () => {
  it('produces no coherence alerts before build', () => {
    const alerts = runCoherenceChecks(stateAt({ isBuilt: false }));
    expect(alerts).toHaveLength(0);
  });

  it('PM can manage schedule when no pmEmail is set', () => {
    expect(canManageSchedule(PM, {})).toBe(true);
  });

  it('DBA can also manage schedule when no pmEmail is set', () => {
    expect(canManageSchedule(DBA, {})).toBe(true);
  });

  it('guest cannot manage schedule', () => {
    expect(canManageSchedule(null, {})).toBe(false);
  });
});

// ── Gate 2: Design Applied ───────────────────────────────────────────────────

describe('SIT Gate 2 — Design Applied', () => {
  const design = stateAt({
    isBuilt: true,
    designApplied: true,
    requirements: REQ,
    sysDesignData: {
      security: { compliance_framework: '' },
      unix: { monitoring_agent: '' },
    },
  });

  it('fires compliance_gap when ISO 27001 requirement is set but field is empty', () => {
    const alerts = runCoherenceChecks(design);
    expect(alerts.find(a => a.id === 'compliance_gap')).toBeDefined();
  });

  it('fires sla_monitoring_gap for 99.99% SLA with no monitoring agent', () => {
    const alerts = runCoherenceChecks(design);
    expect(alerts.find(a => a.id === 'sla_monitoring_gap')).toBeDefined();
  });

  it('resolves both alerts when fields are populated', () => {
    const resolved = {
      ...design,
      sysDesignData: {
        security: { compliance_framework: 'ISO 27001:2022 — certified' },
        unix: { monitoring_agent: 'Prometheus + Node Exporter' },
      },
    };
    const alerts = runCoherenceChecks(resolved);
    expect(alerts.find(a => a.id === 'compliance_gap')).toBeUndefined();
    expect(alerts.find(a => a.id === 'sla_monitoring_gap')).toBeUndefined();
  });
});

// ── Gate 3: Phase 2 Active ───────────────────────────────────────────────────

describe('SIT Gate 3 — Phase 2 Active', () => {
  const p2Empty = stateAt({
    isBuilt: true, designApplied: true, phase2Active: true,
    requirements: REQ,
    selInc: [], selUUM: [],
    roleAssignments: {},
  });

  it('flags empty_phase2 when no incidents or UUM selected', () => {
    expect(runCoherenceChecks(p2Empty).find(a => a.id === 'empty_phase2')).toBeDefined();
  });

  it('flags all three critical roles missing', () => {
    const alert = runCoherenceChecks(p2Empty).find(a => a.id === 'roles_missing');
    expect(alert).toBeDefined();
    expect(alert.message).toContain('Unix Admin');
    expect(alert.message).toContain('DB Admin');
    expect(alert.message).toContain('SecOps');
  });

  it('clears empty_phase2 once incidents are added', () => {
    const with_inc = { ...p2Empty, selInc: ['DB-001'] };
    expect(runCoherenceChecks(with_inc).find(a => a.id === 'empty_phase2')).toBeUndefined();
  });

  it('clears roles_missing once all critical roles are assigned', () => {
    const with_roles = {
      ...p2Empty,
      roleAssignments: {
        'Unix Admin': { email: 'unix@enterprise.com' },
        'DB Admin':   { email: 'dba@enterprise.com' },
        'SecOps':     { email: 'sec@enterprise.com' },
      },
    };
    expect(runCoherenceChecks(with_roles).find(a => a.id === 'roles_missing')).toBeUndefined();
  });
});

// ── Gate 4: RTM Sign-off ─────────────────────────────────────────────────────

describe('SIT Gate 4 — RTM Sign-off', () => {
  const rtmState = stateAt({
    isBuilt: true, designApplied: true, phase2Active: true,
    requirements: REQ,
    selInc: ['DB-001'],
    rtmRows: { 'r1': 'PASS', 'r2': 'PASS', 'r3': 'FAIL', 'r4': 'BLOCKED' },
    roleAssignments: {
      'Unix Admin': { email: 'u@e.com' },
      'DB Admin':   { email: 'dba@enterprise.com' },
      'SecOps':     { email: 's@e.com' },
    },
  });

  it('fires rtm_fails for FAIL and BLOCKED rows', () => {
    const alert = runCoherenceChecks(rtmState).find(a => a.id === 'rtm_fails');
    expect(alert).toBeDefined();
    expect(alert.message).toContain('2'); // 1 FAIL + 1 BLOCKED
  });

  it('clears rtm_fails once all rows are resolved', () => {
    const resolved = {
      ...rtmState,
      rtmRows: { 'r1': 'PASS', 'r2': 'PASS', 'r3': 'PASS', 'r4': 'NA' },
    };
    expect(runCoherenceChecks(resolved).find(a => a.id === 'rtm_fails')).toBeUndefined();
  });

  it('only PM can manage schedule once pmEmail is set', () => {
    const reqWithPM = { ...REQ, pmEmail: 'pm@enterprise.com' };
    expect(isPMOrDeputy(PM, reqWithPM)).toBe(true);
    expect(isPMOrDeputy(DBA, reqWithPM)).toBe(false);
  });
});

// ── Gate 5: Live (Promoted) ──────────────────────────────────────────────────

describe('SIT Gate 5 — Promoted to Live', () => {
  it('produces no gate-blocking alerts when build is fully resolved', () => {
    const liveState = stateAt({
      isBuilt: true,
      designApplied: true,
      phase2Active: true,
      rtmSigned: true,
      cabApproved: true,
      promoted: true,
      requirements: { ...REQ, sla: '99.5' }, // 99.5 avoids sla_monitoring_gap
      selInc: ['DB-001'],
      selUUM: [],
      sysDesignData: {
        security: { compliance_framework: 'ISO 27001:2022' },
        unix: { monitoring_agent: 'Prometheus' },
      },
      rtmRows: { 'r1': 'PASS', 'r2': 'PASS' },
      roleAssignments: {
        'Unix Admin': { email: 'u@e.com' },
        'DB Admin':   { email: 'dba@enterprise.com' },
        'SecOps':     { email: 's@e.com' },
      },
    });
    const blocking = runCoherenceChecks(liveState).filter(a => a.severity === 'warn');
    expect(blocking).toHaveLength(0);
  });
});
