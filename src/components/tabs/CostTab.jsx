import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { buildDesignTasks } from '../../lib/designTasks.js';
import { getRealTasks } from '../../lib/realTasks.js';
import { ALL_UUM } from '../../lib/uumItems.js';

const BUFFER = 1.3;

function fmt(n, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

function pct(n, total) {
  if (!total) return '0%';
  return Math.round((n / total) * 100) + '%';
}

function GaugBar({ used, total, color = 'teal' }) {
  const p = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const colors = { teal: 'bg-teal-500', amber: 'bg-amber-500', red: 'bg-red-500' };
  const c = p >= 90 ? 'red' : p >= 75 ? 'amber' : color;
  return (
    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colors[c]}`} style={{ width: p + '%' }} />
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  const accents = { teal: 'border-teal-400', amber: 'border-amber-400', red: 'border-red-400', slate: 'border-slate-300' };
  return (
    <div className={`card p-4 border-l-4 ${accents[accent] || accents.slate}`}>
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="text-xl font-black text-slate-800 mt-0.5">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// Estimate total task hours from store state
function estimateHours(s) {
  const isAi = (s.sdAiTasks || []).length > 0;
  const designHrs = (isAi ? s.sdAiTasks : buildDesignTasks(s.sysDesignData || {}))
    .reduce((n, t) => n + (t.duration_hours || 2), 0);

  let uumHrs = 0;
  (s.selUUM || []).forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code)
              || (s.customUUM || []).find(u => u.id === code);
    if (!uum) return;
    const tasks = uum.aiTasks?.length ? uum.aiTasks : getRealTasks({ ...uum, code: uum.code || uum.id }, s.ctx);
    uumHrs += tasks.reduce((n, t) => n + (t.est_hours || t.hours || 2), 0);
  });

  const mentorHrs = (s.customMentorTasks || []).reduce((n, t) => n + (t.est_hours || 2), 0);

  return {
    design:   Math.ceil(designHrs * BUFFER),
    uumOps:   Math.ceil(uumHrs  * BUFFER),
    mentor:   mentorHrs,
    total:    Math.ceil((designHrs + uumHrs) * BUFFER) + mentorHrs,
  };
}

export default function CostTab() {
  const store = useStore();
  const costConfig = store.costConfig || {};
  const enabled    = !!costConfig.enabled;

  const currency   = costConfig.currency    || 'USD';
  const budget     = costConfig.totalBudget || 0;
  const dailyRate  = costConfig.dailyRatePerPerson || 800;
  const teamSize   = costConfig.teamSize    || 5;
  const hpd        = store.requirements?.hoursPerDay || 8;
  const contPct    = costConfig.contingencyPct || 20;

  const [localCfg, setLocalCfg] = useState({
    currency, totalBudget: budget, dailyRatePerPerson: dailyRate,
    teamSize, contingencyPct: contPct,
  });

  function saveConfig(patch) {
    const next = { ...localCfg, ...patch };
    setLocalCfg(next);
    store.setCostConfig({ ...costConfig, ...next });
  }

  const s = {
    sdAiTasks:        store.sdAiTasks        || [],
    sysDesignData:    store.sysDesignData     || {},
    selUUM:           store.selUUM            || [],
    selInc:           store.selInc            || [],
    customUUM:        store.customUUM         || [],
    customMentorTasks: store.customMentorTasks || [],
    ctx:              store.ctx               || {},
    requirements:     store.requirements      || {},
    vulnRegistry:     store.vulnRegistry      || [],
    designApplied:    store.designApplied,
    phase2Active:     store.phase2Active,
  };

  const hrs = estimateHours(s);
  const dailyTeamCost = localCfg.dailyRatePerPerson * localCfg.teamSize;
  const daysNeeded    = hrs.total / hpd;
  const baseCost      = Math.ceil(daysNeeded * dailyTeamCost);
  const activeVulns   = s.vulnRegistry.filter(v => v.status === 'ACTIVE').length;
  const riskAdj       = Math.ceil(baseCost * (localCfg.contingencyPct / 100));
  const totalEst      = baseCost + riskAdj;
  const overBudget    = localCfg.totalBudget > 0 && totalEst > localCfg.totalBudget;

  if (!enabled) {
    return (
      <div className="p-6 space-y-6">
        {/* Vision header */}
        <div className="text-center py-6">
          <div className="text-4xl mb-3">💰</div>
          <h2 className="text-lg font-bold text-slate-800">Cost Management</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Optional. Enable to track project budget, estimate cost from task hours, and get OpsMentor cost intelligence.
          </p>
        </div>

        {/* What you get */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📊', title: 'Budget vs Estimate', desc: 'Set a total budget. See estimated cost vs. budget in real time as tasks are added.' },
            { icon: '⏱', title: 'Task-Hour Costing', desc: 'Every Gantt task has an estimated duration. Multiply by team daily rate to get phase-level cost.' },
            { icon: '⚠️', title: 'Risk-Adjusted Cost', desc: 'Active vulnerabilities and open risks add a configurable contingency % to the base estimate.' },
            { icon: '🤖', title: 'OpsMentor Integration', desc: 'Ask "what\'s the project cost?", "are we over budget?", or "what\'s driving cost?" — full AI cost advisor.' },
          ].map(f => (
            <div key={f.title} className="card p-4 space-y-1">
              <div className="text-xl">{f.icon}</div>
              <div className="text-sm font-semibold text-slate-700">{f.title}</div>
              <p className="text-xs text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Enable */}
        <div className="card p-5 text-center space-y-3">
          <p className="text-xs text-slate-500">
            Cost tracking is off by default. It does not affect any other tab or workflow.
            Enable it at any time and disable it just as easily.
          </p>
          <button
            onClick={() => store.setCostConfig({ ...costConfig, enabled: true })}
            className="px-6 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"
          >
            Enable Cost Tracking
          </button>
        </div>

        {/* OpsMentor readiness note */}
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
          <div className="text-xs font-bold text-teal-700 uppercase tracking-wide">OpsMentor — Cost Intelligence (Ready When You Are)</div>
          <p className="text-xs text-teal-700 leading-relaxed">
            When cost tracking is enabled, OpsMentor will:
          </p>
          <ul className="text-xs text-teal-700 space-y-1 list-disc list-inside">
            <li>Alert you when estimated cost exceeds budget</li>
            <li>Suggest task removals or parallel scheduling to reduce cost</li>
            <li>Attribute cost by team / phase / risk layer</li>
            <li>Show cost impact of adding incidents or UUM items</li>
            <li>Support commands like "set budget to 50000" and "team size is 8"</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Cost Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Estimated from task hours × team daily rate.</p>
        </div>
        <button
          onClick={() => store.setCostConfig({ ...costConfig, enabled: false })}
          className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-2 py-1"
        >
          Disable
        </button>
      </div>

      {/* Config */}
      <div className="card p-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Total Budget ({localCfg.currency})</label>
          <input type="number" min={0} step={1000}
            value={localCfg.totalBudget}
            onChange={e => saveConfig({ totalBudget: +e.target.value })}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Daily Rate / Person ({localCfg.currency})</label>
          <input type="number" min={0} step={50}
            value={localCfg.dailyRatePerPerson}
            onChange={e => saveConfig({ dailyRatePerPerson: +e.target.value })}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Team Size (people)</label>
          <input type="number" min={1} max={50}
            value={localCfg.teamSize}
            onChange={e => saveConfig({ teamSize: +e.target.value })}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Risk Contingency (%)</label>
          <input type="number" min={0} max={100}
            value={localCfg.contingencyPct}
            onChange={e => saveConfig({ contingencyPct: +e.target.value })}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800"
          />
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Estimated Cost"   value={fmt(totalEst, currency)}
          sub={`${Math.ceil(daysNeeded)} working days`} accent="teal" />
        <StatCard label="Base Cost (no risk adj)" value={fmt(baseCost, currency)}
          sub={`${hrs.total}h total task hours`}     accent="slate" />
        <StatCard label="Risk Contingency"
          value={fmt(riskAdj, currency)}
          sub={`${localCfg.contingencyPct}% + ${activeVulns} active vulns`}
          accent={activeVulns > 0 ? 'amber' : 'slate'} />
        <StatCard label="Budget"
          value={localCfg.totalBudget > 0 ? fmt(localCfg.totalBudget, currency) : 'Not set'}
          sub={localCfg.totalBudget > 0 ? (overBudget ? `Over by ${fmt(totalEst - localCfg.totalBudget, currency)}` : `${fmt(localCfg.totalBudget - totalEst, currency)} remaining`) : 'Set a budget to track'}
          accent={overBudget ? 'red' : 'teal'} />
      </div>

      {/* Budget bar */}
      {localCfg.totalBudget > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Budget utilisation</span>
            <span className={overBudget ? 'text-red-600 font-bold' : 'text-teal-600'}>
              {pct(totalEst, localCfg.totalBudget)}
            </span>
          </div>
          <GaugBar used={totalEst} total={localCfg.totalBudget} />
        </div>
      )}

      {/* Phase breakdown */}
      <div className="card overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Cost Breakdown</span>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { label: 'System Design tasks',    hrs: hrs.design,  cost: Math.ceil((hrs.design  / hpd) * dailyTeamCost) },
            { label: 'UUM / Operations tasks', hrs: hrs.uumOps,  cost: Math.ceil((hrs.uumOps  / hpd) * dailyTeamCost) },
            { label: 'OpsMentor custom tasks', hrs: hrs.mentor,  cost: Math.ceil((hrs.mentor  / hpd) * dailyTeamCost) },
            { label: 'Risk contingency',       hrs: null,         cost: riskAdj },
          ].map(row => (
            <div key={row.label} className="flex items-center px-4 py-2.5 text-xs">
              <span className="flex-1 text-slate-700">{row.label}</span>
              {row.hrs !== null && <span className="text-slate-400 w-16 text-right">{row.hrs}h</span>}
              {row.hrs === null && <span className="text-slate-400 w-16 text-right">{localCfg.contingencyPct}%</span>}
              <span className="text-slate-800 font-semibold w-24 text-right">{fmt(row.cost, currency)}</span>
            </div>
          ))}
          <div className="flex items-center px-4 py-2.5 text-xs bg-teal-50">
            <span className="flex-1 font-bold text-slate-800">Total Estimated</span>
            <span className="text-slate-400 w-16 text-right">{hrs.total}h</span>
            <span className="font-black text-teal-700 w-24 text-right">{fmt(totalEst, currency)}</span>
          </div>
        </div>
      </div>

      {/* OpsMentor integration */}
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
        <div className="text-xs font-bold text-teal-700 uppercase tracking-wide">OpsMentor Cost Commands</div>
        <div className="grid grid-cols-2 gap-1.5 text-xs text-teal-700">
          {[
            '"what\'s the project cost?"',
            '"are we over budget?"',
            '"set budget to 80000"',
            '"team size is 8"',
            '"daily rate is 1200"',
            '"what\'s driving cost?"',
          ].map(cmd => (
            <div key={cmd} className="bg-white/60 px-2 py-1 rounded font-mono">{cmd}</div>
          ))}
        </div>
        <p className="text-xs text-teal-600 pt-1">
          Cost data is included in OpsMentor context when cost tracking is enabled.
        </p>
      </div>

      {/* Assumptions */}
      <div className="text-xs text-slate-400 space-y-0.5 border-t border-slate-100 pt-3">
        <div className="font-semibold text-slate-500">Assumptions</div>
        <div>Hours include 30% buffer (BUFFER=1.3). All team members work at the same daily rate.</div>
        <div>Risk contingency is applied to base cost only, not recursively.</div>
        <div>Active vulnerabilities add to risk perception but are not itemised separately in this estimate.</div>
      </div>
    </div>
  );
}
