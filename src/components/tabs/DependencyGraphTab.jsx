import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { buildProjectGraph } from '../../engine/projectGraph.js';
import { detectCycles, findOrphanTasks, findUnlinkedRaidItems } from '../../engine/graphValidation.js';
import { findOutOfOrderHandoffs } from '../../engine/functionTeamMatrix.js';
import { computeTaskRWCB, computeRoleCapacityDrag, computeEVM, computePVI, computeDeliveryConfidence, computeRoleDeliveryConfidence } from '../../engine/mathEngine.js';
import { calcDates } from '../../lib/scheduling.js';
import AgentInsights from '../AgentInsights.jsx';

const TEAM_COLORS = {
  'NetAdmin': '#3B82F6', 'StorageAdmin': '#8B5CF6', 'BackupAdmin': '#F59E0B',
  'Unix Admin': '#0D9488', 'DBA': '#DC2626', 'WebAdmin': '#0EA5E9',
  'AppAdmin': '#22C55E', 'SecOps': '#EC4899', 'QA Team': '#6366F1',
  'Change Manager': '#64748B',
};
const FALLBACK_PALETTE = ['#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#22C55E', '#DC2626', '#0EA5E9'];

function colorForRole(role) {
  const known = Object.keys(TEAM_COLORS).find(k => (role || '').includes(k));
  if (known) return TEAM_COLORS[known];
  let hash = 0;
  for (let i = 0; i < (role || '').length; i++) hash = (hash * 31 + role.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

const RAID_ICON = { RISK: '▲', ISSUE: '●', DEPENDENCY: '⬡', CHANGE: '◆', ASSUMPTION: '○', DECISION: '✓' };
const SEV_COLOR = { CRITICAL: '#DC2626', HIGH: '#F59E0B', MED: '#3B82F6', LOW: '#94A3B8' };

function ProgressRing({ pct }) {
  const r = 8, c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
      <circle cx="10" cy="10" r={r} fill="none" stroke="#E2E8F0" strokeWidth="3" />
      <circle
        cx="10" cy="10" r={r} fill="none" stroke={pct >= 1 ? '#22C55E' : 'var(--app-accent)'} strokeWidth="3"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}

const DC_BAND_COLOR = { green: '#22C55E', amber: '#D97706', red: '#DC2626', unassessed: '#CBD5E1' };
const FEASIBILITY_OPTS = ['HIGH', 'MEDIUM', 'LOW'];
const SKILLSET_OPTS = ['STRONG', 'ADEQUATE', 'GAP'];
const SCOPE_OPTS = ['STABLE', 'MINOR_CHANGE', 'VOLATILE'];

function TaskNode({ task, linkedRaid, flagged, buffer, progress, isOpen, onToggle, onProgressChange }) {
  const color = colorForRole(task.role);
  const pct = Math.max(0, Math.min(1, progress?.percentComplete || 0));
  const dc = computeDeliveryConfidence(progress);
  return (
    <div
      className="rounded-lg border bg-white transition-all"
      style={{
        borderLeft: `3px solid ${color}`,
        borderTop: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0',
        boxShadow: isOpen ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        padding: '8px 10px',
      }}
    >
      <div onClick={onToggle} className="cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500" style={{ color }}>{task.role}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {flagged && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Handoff order flagged for review" />}
            {buffer?.capped > 0 && (
              <span className="badge badge-amber text-xs px-1.5" title={`Risk-weighted buffer: +${Math.round(buffer.capped)}h${buffer.hitCap ? ' (capped)' : ''}`}>+{Math.round(buffer.capped)}h</span>
            )}
            {linkedRaid.length > 0 && (
              <span className="badge badge-red text-xs px-1.5" title={`${linkedRaid.length} linked RAID item(s)`}>{linkedRaid.length}</span>
            )}
            {dc.score != null && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: DC_BAND_COLOR[dc.band] }}
                title={`Delivery Confidence: ${dc.score}/100 (${dc.assessedFactorCount} factor${dc.assessedFactorCount > 1 ? 's' : ''} assessed)`}
              />
            )}
            <ProgressRing pct={pct} />
          </div>
        </div>
        <div className="text-xs text-slate-700 font-medium leading-snug mt-0.5">{task.name}</div>
        <div className="text-xs text-slate-400 mt-0.5">{task.hours}h{pct > 0 ? ` · ${Math.round(pct * 100)}% done` : ''}</div>
      </div>

      {isOpen && (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 fade-in">
          {task.prereqText && (
            <div className="text-xs text-slate-500"><span className="font-semibold text-slate-600">Pre-req: </span>{task.prereqText}</div>
          )}
          {linkedRaid.length > 0 ? (
            <div className="space-y-1">
              {linkedRaid.map(r => (
                <div key={r.id} className="flex items-start gap-1.5 text-xs">
                  <span style={{ color: SEV_COLOR[r.severity] || '#94A3B8' }} className="flex-shrink-0">{RAID_ICON[r.raidType] || '●'}</span>
                  <span className="text-slate-600">{r.description}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No linked RAID items</div>
          )}

          <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-slate-500 flex-shrink-0">% done</label>
            <input
              type="range" min="0" max="100" step="5"
              value={Math.round(pct * 100)}
              onChange={e => onProgressChange({ percentComplete: Number(e.target.value) / 100 })}
              className="flex-1"
            />
            <span className="text-xs text-slate-500 w-8 flex-shrink-0">{Math.round(pct * 100)}%</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <label className="text-xs text-slate-500 flex-shrink-0">Actual hrs</label>
            <input
              type="number" min="0" step="0.5"
              value={progress?.actualHours ?? ''}
              placeholder="0"
              onChange={e => onProgressChange({ actualHours: Number(e.target.value) || 0 })}
              className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5"
            />
          </div>

          <div className="pt-2 mt-1 border-t border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-600">Delivery Confidence</span>
              {dc.score != null && (
                <span className="text-xs font-bold" style={{ color: DC_BAND_COLOR[dc.band] }}>{dc.score}/100</span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-24 flex-shrink-0">Resource avail.</label>
                <input
                  type="range" min="0" max="100" step="5"
                  value={progress?.resourceAvailability ?? 100}
                  onChange={e => onProgressChange({ resourceAvailability: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-xs text-slate-500 w-8 flex-shrink-0">{progress?.resourceAvailability ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-24 flex-shrink-0">Feasibility</label>
                <select
                  value={progress?.technicalFeasibility || ''}
                  onChange={e => onProgressChange({ technicalFeasibility: e.target.value || null })}
                  className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700"
                >
                  <option value="">— not set —</option>
                  {FEASIBILITY_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-24 flex-shrink-0">Skillset match</label>
                <select
                  value={progress?.skillsetMatch || ''}
                  onChange={e => onProgressChange({ skillsetMatch: e.target.value || null })}
                  className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700"
                >
                  <option value="">— not set —</option>
                  {SKILLSET_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-24 flex-shrink-0">Scope stability</label>
                <select
                  value={progress?.scopeStability || ''}
                  onChange={e => onProgressChange({ scopeStability: e.target.value || null })}
                  className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700"
                >
                  <option value="">— not set —</option>
                  {SCOPE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <div className="flex items-center justify-center py-0.5">
      <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className="exec-kpi-tile flex-1 min-w-24">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="text-lg font-bold leading-tight" style={{ color: accent || '#334155' }}>{value}</div>
    </div>
  );
}

export default function DependencyGraphTab() {
  const s = useStore();
  const [openTaskId, setOpenTaskId] = useState(null);

  const { graph, chains, flags, outOfOrder, cycles, plannedDates, evm, pvi, roleDrag, bufferByTask, totalBufferHours, roleDeliveryConfidence, avgDeliveryConfidence } = useMemo(() => {
    const { graph, chains } = buildProjectGraph(s);
    const cycles = detectCycles(graph);
    const orphanTasks = findOrphanTasks(graph);
    const unlinkedRaid = findUnlinkedRaidItems(graph);
    const outOfOrder = chains.flatMap(c => findOutOfOrderHandoffs(c.tasks));
    const flags = [...cycles, ...orphanTasks, ...unlinkedRaid, ...outOfOrder]
      .map((f, i) => ({ ...f, id: f.id || `${f.reason}-${f.nodeIds.join('_')}-${i}` }));

    // Schedule each chain exactly like GanttTab does: design chain from the
    // project start date, each UUM chain starting after the design chain ends.
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
    const roleDrag = computeRoleCapacityDrag(graph);
    const bufferByTask = {};
    let totalBufferHours = 0;
    allTaskNodes.forEach(t => {
      const b = computeTaskRWCB(graph, t.id);
      bufferByTask[t.id] = b;
      totalBufferHours += b.capped;
    });

    const roleDeliveryConfidence = computeRoleDeliveryConfidence(allTaskNodes, s.taskProgress);
    const dcScores = Object.values(roleDeliveryConfidence).map(r => r.score);
    const avgDeliveryConfidence = dcScores.length ? Math.round(dcScores.reduce((a, b) => a + b, 0) / dcScores.length) : null;

    return { graph, chains, flags, outOfOrder, cycles, plannedDates, evm, pvi, roleDrag, bufferByTask, totalBufferHours, roleDeliveryConfidence, avgDeliveryConfidence };
  }, [s.sysDesignData, s.sdAiTasks, s.selUUM, s.customUUM, s.selInc, s.customInc, s.selFix, s.customRaidEntries, s.ganttOverrides, s.ctx, s.cabApproved, s.rtmSigned, s.promoted, s.taskProgress, s.requirements.projectStartDate, s.requirements.hoursPerDay, s.changePeriods]);

  const visibleFlags = flags.filter(f => !s.dismissedGraphFlags.includes(f.id));
  const outOfOrderIds = new Set(outOfOrder.flatMap(f => f.nodeIds));
  const totalTasks = chains.reduce((n, c) => n + c.tasks.length, 0);
  const totalLinks = graph.allEdges().length;
  const maxDrag = Math.max(1, ...Object.values(roleDrag));

  if (!s.designApplied) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z" clipRule="evenodd" /></svg>
          </div>
          <div className="font-semibold text-slate-700 mb-1">Dependency Graph Locked</div>
          <div className="text-sm text-slate-500">Apply System Design to unlock the graph — it links generated tasks to RAID risks and audits handoff order.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <AgentInsights tab="graph" />

      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-700">Dependency Graph</div>
          <div className="text-xs text-slate-500">Every generated task, chained in real build order, cross-linked to the RAID registry and scored for schedule/cost health — click a task to see what it depends on, log progress, or drag the % slider.</div>
        </div>
      </div>

      <div className="flex gap-2 mb-2 flex-wrap">
        <StatTile label="Chains" value={chains.length} />
        <StatTile label="Tasks" value={totalTasks} />
        <StatTile label="Links" value={totalLinks} accent="var(--app-accent)" />
        <StatTile label="Cycles" value={cycles.length} accent={cycles.length ? '#DC2626' : '#22C55E'} />
        <StatTile label="Needs Review" value={visibleFlags.length} accent={visibleFlags.length ? '#D97706' : '#22C55E'} />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <StatTile label="Schedule (SPI)" value={evm.spi.toFixed(2)} accent={evm.spi >= 1 ? '#22C55E' : evm.spi >= 0.85 ? '#D97706' : '#DC2626'} />
        <StatTile label="Cost (CPI)" value={evm.cpi.toFixed(2)} accent={evm.cpi >= 1 ? '#22C55E' : evm.cpi >= 0.85 ? '#D97706' : '#DC2626'} />
        <StatTile label="Velocity" value={pvi.band.toUpperCase()} accent={pvi.band === 'green' ? '#22C55E' : pvi.band === 'amber' ? '#D97706' : '#DC2626'} />
        <StatTile label="Risk Buffer" value={`+${Math.round(totalBufferHours)}h`} accent={totalBufferHours > 0 ? '#D97706' : '#22C55E'} />
        <StatTile
          label="Delivery Confidence"
          value={avgDeliveryConfidence != null ? `${avgDeliveryConfidence}/100` : '—'}
          accent={avgDeliveryConfidence == null ? '#94A3B8' : avgDeliveryConfidence >= 80 ? '#22C55E' : avgDeliveryConfidence >= 55 ? '#D97706' : '#DC2626'}
        />
        {Object.keys(roleDrag).length > 0 && (
          <div className="exec-kpi-tile flex-1 min-w-48">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Team Capacity Drag</div>
            <div className="space-y-1">
              {Object.entries(roleDrag).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([role, hrs]) => (
                <div key={role} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 w-24 truncate flex-shrink-0">{role}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(hrs / maxDrag) * 100}%`, backgroundColor: colorForRole(role) }} />
                  </div>
                  <span className="text-xs text-slate-400 w-6 flex-shrink-0 text-right">{Math.round(hrs)}h</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {Object.keys(roleDeliveryConfidence).length > 0 && (
          <div className="exec-kpi-tile flex-1 min-w-48">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Delivery Confidence by Role</div>
            <div className="space-y-1">
              {Object.entries(roleDeliveryConfidence).sort((a, b) => a[1].score - b[1].score).slice(0, 4).map(([role, dc]) => (
                <div key={role} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 w-24 truncate flex-shrink-0">{role}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${dc.score}%`, backgroundColor: DC_BAND_COLOR[dc.band] }} />
                  </div>
                  <span className="text-xs text-slate-400 w-8 flex-shrink-0 text-right">{dc.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 items-start">
        {/* Swim lanes */}
        <div className="flex-1 min-w-0 flex gap-4 overflow-x-auto pb-2">
          {chains.map(chain => (
            <div key={chain.id} className="flex-shrink-0" style={{ width: 230 }}>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 pb-1.5 border-b border-slate-200 truncate" title={chain.label}>
                {chain.label}
                <span className="ml-1.5 text-slate-400 font-normal normal-case">({chain.tasks.length})</span>
              </div>
              {chain.tasks.length === 0 && <div className="text-xs text-slate-400 italic">No tasks yet</div>}
              {chain.tasks.map((t, i) => (
                <div key={t.id}>
                  <TaskNode
                    task={t}
                    linkedRaid={graph.predecessorsOf(t.id).filter(n => n.type === 'raid')}
                    flagged={outOfOrderIds.has(t.id)}
                    buffer={bufferByTask[t.id]}
                    progress={s.taskProgress[t.id]}
                    isOpen={openTaskId === t.id}
                    onToggle={() => setOpenTaskId(prev => prev === t.id ? null : t.id)}
                    onProgressChange={patch => s.setTaskProgress(t.id, patch)}
                  />
                  {i < chain.tasks.length - 1 && <Chevron />}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Needs Review panel */}
        <div className="flex-shrink-0 card p-3" style={{ width: 300 }}>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Needs Review</div>
          {visibleFlags.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-md px-2.5 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Nothing flagged — every RAID item is linked and handoffs follow expected team order.
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {visibleFlags.map(f => (
                <div key={f.id} className="rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-700">
                      {f.reason === 'circular_dependency' ? 'Circular dependency'
                        : f.reason === 'no_dependency_found_check_manually' ? 'Orphan task'
                        : f.reason === 'no_linked_task_check_manually' ? 'Unlinked RAID item'
                        : 'Handoff order'}
                    </span>
                    <button
                      onClick={() => s.dismissGraphFlag(f.id)}
                      className="text-xs text-amber-600 hover:text-amber-800 flex-shrink-0"
                      title="Dismiss — mark reviewed"
                    >✕</button>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {f.detail || (f.reason === 'no_linked_task_check_manually'
                      ? (graph.getNode(f.nodeIds[0])?.description || f.nodeIds[0])
                      : f.nodeIds.map(id => graph.getNode(id)?.name || id).join(' → '))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {s.dismissedGraphFlags.length > 0 && (
            <button
              onClick={() => s.dismissedGraphFlags.forEach(id => s.restoreGraphFlag(id))}
              className="text-xs text-slate-400 hover:text-slate-600 mt-2"
            >
              Restore {s.dismissedGraphFlags.length} dismissed flag{s.dismissedGraphFlags.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
