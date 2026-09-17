// CIT — Component Integration Tests: math engine (Phase 4)
// RWCB (risk-weighted buffer), RACL (role capacity drag), EVM (SPI/CPI), PVI.

import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../engine/graph.js';
import { computeTaskRWCB, computeRoleCapacityDrag, computeEVM, computePVI, SEVERITY_WEIGHT, computeRiskHeatScore, computeDeliveryConfidence, computeRoleDeliveryConfidence, computeRiskAdjustedCostExposure } from '../engine/mathEngine.js';

function graphWithLinkedRisks() {
  const g = new DependencyGraph();
  g.addNode({ id: 'task-1', type: 'task', role: 'DBA', hours: 4 });
  g.addNode({ id: 'risk-critical', type: 'raid', raidType: 'RISK', severity: 'CRITICAL', status: 'OPEN' });
  g.addNode({ id: 'risk-low-closed', type: 'raid', raidType: 'RISK', severity: 'LOW', status: 'CLOSED' });
  g.addEdge('risk-critical', 'task-1', 'impacts');
  g.addEdge('risk-low-closed', 'task-1', 'impacts');
  return g;
}

describe('computeTaskRWCB', () => {
  it('sums severity weight only for open (non-closed) linked risks', () => {
    const g = graphWithLinkedRisks();
    const { raw } = computeTaskRWCB(g, 'task-1', { hoursPerSeverityPoint: 1, maxBufferMultiple: 100 });
    expect(raw).toBe(SEVERITY_WEIGHT.CRITICAL); // closed risk excluded
  });

  it('caps the buffer at maxBufferMultiple x task hours and reports hitCap', () => {
    const g = graphWithLinkedRisks();
    const { raw, capped, hitCap } = computeTaskRWCB(g, 'task-1', { hoursPerSeverityPoint: 100, maxBufferMultiple: 1 });
    expect(raw).toBeGreaterThan(capped);
    expect(capped).toBe(4); // task hours x 1
    expect(hitCap).toBe(true);
  });

  it('returns zeros for a task with no linked risks', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'lonely', type: 'task', role: 'DBA', hours: 3 });
    const { raw, capped } = computeTaskRWCB(g, 'lonely');
    expect(raw).toBe(0);
    expect(capped).toBe(0);
  });
});

describe('computeRoleCapacityDrag', () => {
  it('aggregates drag per role from open RISK/ISSUE/DEPENDENCY/CHANGE rows only', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 't1', type: 'task', role: 'DBA', hours: 2 });
    g.addNode({ id: 't2', type: 'task', role: 'NetAdmin', hours: 2 });
    g.addNode({ id: 'risk-1', type: 'raid', raidType: 'RISK', severity: 'HIGH', status: 'ACTIVE' });
    g.addNode({ id: 'assumption-1', type: 'raid', raidType: 'ASSUMPTION', severity: 'HIGH', status: 'OPEN' });
    g.addEdge('risk-1', 't1', 'impacts');
    g.addEdge('assumption-1', 't2', 'impacts'); // ASSUMPTION should not count toward drag
    const drag = computeRoleCapacityDrag(g, { hoursPerSeverityPoint: 1 });
    expect(drag.DBA).toBe(SEVERITY_WEIGHT.HIGH);
    expect(drag.NetAdmin).toBeUndefined();
  });

  it('excludes CLOSED/DONE raid rows from drag', () => {
    const g = graphWithLinkedRisks();
    const drag = computeRoleCapacityDrag(g);
    expect(drag.DBA).toBe(SEVERITY_WEIGHT.CRITICAL);
  });
});

describe('computeEVM / computePVI', () => {
  it('reports spi < 1 for a task behind schedule and spi >= 1 for one on/ahead', () => {
    const asOf = new Date('2026-01-10T00:00:00Z');
    const behind = [{ id: 't1', hours: 10 }];
    const behindProgress = { t1: { percentComplete: 0.1, actualHours: 1 } };
    const behindDates = { t1: { start: '2026-01-01', end: '2026-01-11' } }; // ~90% through schedule, 10% done
    const evmBehind = computeEVM(behind, behindProgress, behindDates, asOf);
    expect(evmBehind.spi).toBeLessThan(1);

    const ahead = [{ id: 't2', hours: 10 }];
    const aheadProgress = { t2: { percentComplete: 1, actualHours: 8 } };
    const aheadDates = { t2: { start: '2026-01-01', end: '2026-01-20' } }; // finished well before scheduled end
    const evmAhead = computeEVM(ahead, aheadProgress, aheadDates, asOf);
    expect(evmAhead.spi).toBeGreaterThanOrEqual(1);
  });

  it('defaults spi/cpi to 1 when there is no planned value or actual cost yet', () => {
    const evm = computeEVM([{ id: 't1', hours: 5 }], {}, {}, new Date());
    expect(evm.spi).toBe(1);
    expect(evm.cpi).toBe(1);
  });

  it('computePVI bands correctly at the 0.85/1.0 thresholds', () => {
    expect(computePVI({ spi: 1, cpi: 1 }).band).toBe('green');
    expect(computePVI({ spi: 0.9, cpi: 0.9 }).band).toBe('amber');
    expect(computePVI({ spi: 0.7, cpi: 0.7 }).band).toBe('red');
  });

  it('computePVI respects a custom schedule weight', () => {
    const evm = { spi: 1, cpi: 0 };
    expect(computePVI(evm, 1).value).toBe(1); // all weight on schedule
    expect(computePVI(evm, 0).value).toBe(0); // all weight on cost
  });
});

describe('computeRiskHeatScore (Probability x Impact)', () => {
  it('computes score and bands per standard PMI-style thresholds', () => {
    expect(computeRiskHeatScore(5, 5)).toMatchObject({ score: 25, band: 'CRITICAL' });
    expect(computeRiskHeatScore(4, 4)).toMatchObject({ score: 16, band: 'CRITICAL' });
    expect(computeRiskHeatScore(2, 5)).toMatchObject({ score: 10, band: 'HIGH' });
    expect(computeRiskHeatScore(1, 5)).toMatchObject({ score: 5, band: 'MED' });
    expect(computeRiskHeatScore(1, 1)).toMatchObject({ score: 1, band: 'LOW' });
  });

  it('clamps out-of-range probability/impact to 1-5', () => {
    expect(computeRiskHeatScore(0, 10)).toMatchObject({ score: 5, band: 'MED' });
    expect(computeRiskHeatScore(-3, 5)).toMatchObject({ probability: 1 });
  });
});

describe('computeTaskRWCB with Probability x Impact', () => {
  it('uses P x I heat score instead of severity when a linked RAID row carries both', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'task-1', type: 'task', role: 'DBA', hours: 4 });
    g.addNode({ id: 'risk-pi', type: 'raid', raidType: 'RISK', severity: 'LOW', probability: 5, impact: 5, status: 'OPEN' });
    g.addEdge('risk-pi', 'task-1', 'impacts');
    const { raw } = computeTaskRWCB(g, 'task-1', { hoursPerSeverityPoint: 1, maxBufferMultiple: 100 });
    // heat score 25 / 5 = 5, not SEVERITY_WEIGHT.LOW (1) — P/I takes priority over the stale severity label
    expect(raw).toBe(5);
  });

  it('falls back to SEVERITY_WEIGHT when no P/I is set (existing behavior unchanged)', () => {
    const g = new DependencyGraph();
    g.addNode({ id: 'task-1', type: 'task', role: 'DBA', hours: 4 });
    g.addNode({ id: 'risk-sev', type: 'raid', raidType: 'RISK', severity: 'HIGH', status: 'OPEN' });
    g.addEdge('risk-sev', 'task-1', 'impacts');
    const { raw } = computeTaskRWCB(g, 'task-1', { hoursPerSeverityPoint: 1, maxBufferMultiple: 100 });
    expect(raw).toBe(SEVERITY_WEIGHT.HIGH);
  });
});

describe('computeDeliveryConfidence', () => {
  it('returns unassessed when no factors are set', () => {
    expect(computeDeliveryConfidence({})).toMatchObject({ score: null, band: 'unassessed' });
    expect(computeDeliveryConfidence()).toMatchObject({ score: null, band: 'unassessed' });
  });

  it('averages only the factors that were actually provided', () => {
    const { score, band, assessedFactorCount } = computeDeliveryConfidence({ resourceAvailability: 100 });
    expect(score).toBe(100);
    expect(band).toBe('green');
    expect(assessedFactorCount).toBe(1);
  });

  it('bands low when multiple factors are weak', () => {
    const { score, band } = computeDeliveryConfidence({
      resourceAvailability: 20, technicalFeasibility: 'LOW', skillsetMatch: 'GAP', scopeStability: 'VOLATILE',
    });
    expect(score).toBeLessThan(55);
    expect(band).toBe('red');
  });

  it('bands high when all factors are strong', () => {
    const { band } = computeDeliveryConfidence({
      resourceAvailability: 95, technicalFeasibility: 'HIGH', skillsetMatch: 'STRONG', scopeStability: 'STABLE',
    });
    expect(band).toBe('green');
  });
});

describe('computeRoleDeliveryConfidence', () => {
  it('averages assessed tasks per role and skips unassessed ones', () => {
    const tasks = [
      { id: 't1', role: 'DBA' }, { id: 't2', role: 'DBA' }, { id: 't3', role: 'NetAdmin' },
    ];
    const progress = {
      t1: { resourceAvailability: 100 }, t2: { resourceAvailability: 40 },
      // t3 has no assessment -> excluded entirely
    };
    const result = computeRoleDeliveryConfidence(tasks, progress);
    expect(result.DBA.score).toBe(70);
    expect(result.DBA.taskCount).toBe(2);
    expect(result.NetAdmin).toBeUndefined();
  });
});

describe('computeRiskAdjustedCostExposure', () => {
  it('converts buffer hours to cost via the same day-rate model as CostTab', () => {
    // 16 buffer hours / 8 hpd = 2 days x $800/day = $1600
    expect(computeRiskAdjustedCostExposure(16, 800, 8)).toBe(1600);
  });

  it('rounds up partial days so risk exposure is never understated', () => {
    expect(computeRiskAdjustedCostExposure(1, 800, 8)).toBe(100 * 1); // ceil(1/8 * 800) = ceil(100) = 100
    expect(computeRiskAdjustedCostExposure(9, 800, 8)).toBe(Math.ceil(9 / 8 * 800));
  });
});
