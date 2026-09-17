import { useMemo, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore.js';
import { verifyAuditChain } from '../../lib/auditChain.js';
import { computeAllRisks, riskScore, riskLabel } from '../../lib/riskEngine.js';
import { buildProjectGraph } from '../../engine/projectGraph.js';
import { detectCycles, findUnlinkedRaidItems } from '../../engine/graphValidation.js';
import { computeTaskRWCB, computeEVM, computePVI, computeRoleDeliveryConfidence, computeRiskAdjustedCostExposure } from '../../engine/mathEngine.js';
import { calcDates } from '../../lib/scheduling.js';
import { computeComplianceStatus } from '../../lib/complianceMatrix.js';
import { getDomainMeta } from '../../domains/registry.js';

// Bright shades for the dot + border accent (3:1 is enough there). The big
// bold value text needs the darker, WCAG-AA-safe pair — the tinted card
// background (RAG_BG) is close enough to white that the bright shade was
// nearly unreadable, exactly the bug reported against these tiles.
const RAG_COLOR = { green: '#22C55E', amber: '#D97706', red: '#DC2626', slate: '#94A3B8' };
const RAG_TEXT_COLOR = { green: '#15803D', amber: '#B45309', red: '#B91C1C', slate: '#475569' };
const RAG_BG = { green: '#F0FDF4', amber: '#FFFBEB', red: '#FEF2F2', slate: '#F8FAFC' };

function RagTile({ label, band, value, detail }) {
  return (
    <div className="rounded-xl border p-3.5" style={{ background: RAG_BG[band], borderColor: `${RAG_COLOR[band]}40` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: RAG_COLOR[band] }} />
      </div>
      <div className="text-lg font-black" style={{ color: RAG_TEXT_COLOR[band] }}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{detail}</div>
    </div>
  );
}

export default function GovernanceReportTab() {
  const s = useStore();
  const domain = getDomainMeta(s.activeDomain);

  // Tamper-evident check on the action audit log (see src/lib/auditChain.js).
  // Re-verified whenever the log changes — proves whether the chain that's
  // actually in this build is internally consistent, not a claim about it.
  const [auditStatus, setAuditStatus] = useState({ checked: false, valid: true });
  useEffect(() => {
    let cancelled = false;
    verifyAuditChain(s.actionAuditLog || []).then(result => {
      if (!cancelled) setAuditStatus({ checked: true, ...result });
    });
    return () => { cancelled = true; };
  }, [s.actionAuditLog]);

  const report = useMemo(() => {
    // Risk — reuse the existing cross-source risk engine (coherence, RAID,
    // vulnerabilities, stakeholder discussions, system state, RTM,
    // incidents, schedule, live-EOL) rather than re-deriving it.
    const allRisks = computeAllRisks(s);
    const score = riskScore(allRisks);
    const label = riskLabel(score);

    // Schedule / Cost / Capacity — same Dependency Graph + Math Engine data
    // the Dependency Graph tab renders, recomputed here so this report is
    // always current, not a stale cached snapshot.
    const { graph, chains } = buildProjectGraph(s);
    const hpd = parseInt(s.requirements.hoursPerDay || '8', 10);
    const blocked = s.changePeriods || [];
    const plannedDates = {};
    let cursorStart = s.requirements.projectStartDate;
    chains.forEach(chain => {
      const dates = calcDates(chain.tasks.map(t => t.raw), cursorStart, hpd, s.ganttOverrides, blocked);
      chain.tasks.forEach((t, i) => { if (dates[i]) plannedDates[t.id] = dates[i]; });
      const lastEnd = dates[dates.length - 1]?.end;
      if (lastEnd && lastEnd !== '—') cursorStart = lastEnd;
    });
    const allTaskNodes = chains.flatMap(c => c.tasks);
    const evm = computeEVM(allTaskNodes, s.taskProgress, plannedDates);
    const pvi = computePVI(evm);
    const roleDC = computeRoleDeliveryConfidence(allTaskNodes, s.taskProgress);
    const dcScores = Object.values(roleDC).map(r => r.score);
    const avgDC = dcScores.length ? Math.round(dcScores.reduce((a, b) => a + b, 0) / dcScores.length) : null;

    let totalBufferHours = 0;
    allTaskNodes.forEach(t => { totalBufferHours += computeTaskRWCB(graph, t.id).capped; });
    const cfg = s.costConfig || {};
    const rwcbCost = computeRiskAdjustedCostExposure(totalBufferHours, cfg.dailyRatePerPerson || 800, hpd);

    // Compliance
    const compliance = computeComplianceStatus(s);

    // Graph health
    const cycles = detectCycles(graph);
    const unlinked = findUnlinkedRaidItems(graph);

    // Per-function-team open-action rollup (from RAID + risk list), so each
    // team sees only what's theirs without reading the whole registry.
    const byOwner = {};
    allRisks.forEach(r => {
      const linkedTask = graph.nodesOfType('raid').find(n => n.description === r.title || r.title.includes(n.description));
      const owner = linkedTask?.owner || 'Unassigned';
      (byOwner[owner] ||= []).push(r);
    });

    return { allRisks, score, label, evm, pvi, roleDC, avgDC, totalBufferHours, rwcbCost, compliance, cycles, unlinked, byOwner, chains, allTaskNodes };
  }, [s]);

  if (!s.isBuilt) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
          </div>
          <div className="font-semibold text-slate-700 mb-1">Governance Report Locked</div>
          <div className="text-sm text-slate-500">Build your platform topology to unlock the daily status view.</div>
        </div>
      </div>
    );
  }

  const scheduleBand = report.evm.spi >= 1 ? 'green' : report.evm.spi >= 0.85 ? 'amber' : 'red';
  const costBand = report.evm.cpi >= 1 ? 'green' : report.evm.cpi >= 0.85 ? 'amber' : 'red';
  const riskBand = report.label.color === 'green' || report.label.color === 'teal' ? 'green' : report.label.color === 'amber' ? 'amber' : 'red';
  const capacityBand = report.avgDC == null ? 'slate' : report.avgDC >= 80 ? 'green' : report.avgDC >= 55 ? 'amber' : 'red';
  const complianceBand = report.compliance.matched.length === 0 ? 'slate' : report.compliance.allMandatoryCleared ? 'green' : 'red';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-bold text-slate-700">Governance Report</div>
          <div className="text-xs text-slate-500">{today} · {domain.label} · {s.requirements.projectName || 'Untitled project'}</div>
        </div>
      </div>
      <div className="text-xs text-slate-400 mb-4">Live status against this project's own constraints — schedule, cost, risk, capacity, and compliance — recomputed from current data every time you open this tab, not a cached snapshot.</div>

      {/* RAG summary */}
      <div className="grid grid-cols-2 min-[900px]:grid-cols-5 gap-2.5 mb-4">
        <RagTile label="Schedule" band={scheduleBand} value={`SPI ${report.evm.spi.toFixed(2)}`} detail={scheduleBand === 'green' ? 'On or ahead of plan' : scheduleBand === 'amber' ? 'Slipping — watch critical path' : 'Behind plan — action needed'} />
        <RagTile label="Cost" band={costBand} value={`CPI ${report.evm.cpi.toFixed(2)}`} detail={`+${Math.round(report.totalBufferHours)}h risk buffer (~${report.rwcbCost.toLocaleString()} ${s.costConfig?.currency || 'USD'})`} />
        <RagTile label="Risk" band={riskBand} value={report.label.label} detail={`${report.allRisks.length} open item${report.allRisks.length !== 1 ? 's' : ''} across all sources`} />
        <RagTile label="Capacity" band={capacityBand} value={report.avgDC != null ? `${report.avgDC}/100` : 'Not assessed'} detail={report.avgDC != null ? 'Avg. delivery confidence' : 'Log resource/feasibility ratings in Dependency Graph'} />
        <RagTile label="Compliance" band={complianceBand} value={report.compliance.matched.length === 0 ? 'N/A' : report.compliance.allMandatoryCleared ? 'Cleared' : `${report.compliance.mandatoryPending.length} pending`} detail={report.compliance.matched.length === 0 ? 'Set Country + Domain in Requirements' : 'Mandatory regulatory obligations'} />
      </div>

      {/* Project constraints */}
      <div className="card p-3.5 mb-4">
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Project Constraints</div>
        <div className="grid grid-cols-2 min-[700px]:grid-cols-4 gap-3 text-xs">
          <div><span className="text-slate-400 block">Go-Live Date</span><span className="font-semibold text-slate-700">{s.requirements.goLiveDate || 'Not set'}</span></div>
          <div><span className="text-slate-400 block">SLA Target</span><span className="font-semibold text-slate-700">{s.requirements.sla || '—'}%</span></div>
          <div><span className="text-slate-400 block">Budget</span><span className="font-semibold text-slate-700">{s.costConfig?.enabled && s.costConfig?.totalBudget ? `${s.costConfig.totalBudget.toLocaleString()} ${s.costConfig.currency}` : 'Not tracked'}</span></div>
          <div><span className="text-slate-400 block">Change Freeze Windows</span><span className="font-semibold text-slate-700">{(s.changePeriods || []).length}</span></div>
        </div>
      </div>

      <div className="flex gap-4 items-start flex-wrap min-[1000px]:flex-nowrap">
        {/* Top risks */}
        <div className="card flex-1 min-w-[320px] overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Top Risks — Needs Action</span>
            <span className="text-xs text-slate-400">{report.allRisks.length} total</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {report.allRisks.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-green-600">Nothing flagged — every tracked source is clean.</div>
            ) : report.allRisks.slice(0, 8).map(r => (
              <div key={r.id} className="px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <span className={`badge text-xs flex-shrink-0 ${r.severity === 'CRITICAL' ? 'badge-red' : r.severity === 'HIGH' ? 'badge-amber' : 'badge-slate'}`}>{r.severity}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-700 leading-snug">{r.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.actionHint}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-function-team actions */}
        <div className="card flex-1 min-w-[280px] overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Open Actions by Function Team</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {Object.keys(report.byOwner).length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">No open items yet.</div>
            ) : Object.entries(report.byOwner).sort((a, b) => b[1].length - a[1].length).map(([owner, risks]) => (
              <div key={owner} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">{owner}</span>
                <span className="badge badge-slate text-xs">{risks.length} open</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(report.cycles.length > 0 || report.unlinked.length > 0) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
          <span className="font-semibold">Dependency Graph health:</span> {report.cycles.length > 0 && `${report.cycles.length} circular dependency detected. `}
          {report.unlinked.length > 0 && `${report.unlinked.length} RAID item(s) not linked to any task. `}
          Open the Dependency Graph tab to review.
        </div>
      )}

      {auditStatus.checked && (s.actionAuditLog || []).length > 0 && (
        <div className={`mt-3 rounded-lg border px-3.5 py-2.5 text-xs ${auditStatus.valid ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'}`}>
          <span className="font-semibold">Audit log integrity:</span> {(s.actionAuditLog || []).length} entries, hash-chained.{' '}
          {auditStatus.valid
            ? 'Chain verified — no entry has been modified since it was written.'
            : `Chain broken at entry ${auditStatus.brokenAt} (${auditStatus.reason}) — this log may have been tampered with.`}
        </div>
      )}
    </div>
  );
}
