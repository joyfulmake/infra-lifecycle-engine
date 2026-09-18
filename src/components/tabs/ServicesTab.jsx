import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import AgentInsights from '../AgentInsights.jsx';

const SERVICE_TYPES = ['IaaS', 'PaaS', 'SaaS', 'FaaS', 'CaaS', 'Other'];
const CRIT_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTS = ['ACTIVE', 'AT_RISK', 'RETIRED'];

const CRIT_STYLE = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-amber-100 text-amber-700 border-amber-200',
  MEDIUM:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  LOW:      'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_STYLE = {
  ACTIVE:   'bg-green-50 text-green-700',
  AT_RISK:  'bg-amber-50 text-amber-700',
  RETIRED:  'bg-slate-100 text-slate-500',
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - Date.now()) / 86400000);
}

function RenewalChip({ dateStr }) {
  const days = daysUntil(dateStr);
  if (days === null) return <span className="text-xs text-slate-400">No renewal date</span>;
  const cls = days < 0 ? 'bg-red-100 text-red-700' : days < 90 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  const label = days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d to renewal`;
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>;
}

function ServiceRow({ v, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={['rounded-lg border mb-2 overflow-hidden', v.status === 'RETIRED' ? 'opacity-60' : ''].join(' ')}
         style={{ borderColor: v.criticality === 'CRITICAL' ? '#fca5a5' : v.criticality === 'HIGH' ? '#fcd34d' : '#e2e8f0' }}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(x => !x)}
      >
        <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold border ${CRIT_STYLE[v.criticality] || CRIT_STYLE.MEDIUM}`}>
          {v.criticality}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 truncate">{v.name}</span>
            <span className="text-xs text-blue-600 font-mono">{v.serviceType}</span>
            <span className="text-xs text-slate-400">{v.provider}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <RenewalChip dateStr={v.renewalDate} />
            {v.owner && <span className="text-xs text-slate-400">Owner: {v.owner}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={v.status}
            onClick={e => e.stopPropagation()}
            onChange={e => onUpdate(v.id, { status: e.target.value })}
            className={`text-xs px-2 py-1 rounded font-semibold border-0 cursor-pointer ${STATUS_STYLE[v.status] || ''}`}
          >
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <span className="text-slate-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div>SLA target: <span className="font-medium text-slate-700">{v.slaTarget || '—'}</span></div>
            <div>Renewal date: <span className="font-medium text-slate-700">{v.renewalDate || '—'}</span></div>
            <div>Added: <span className="font-medium text-slate-700">{v.addedAt?.slice(0, 10) || '—'}</span></div>
            {v.updatedAt !== v.addedAt && <div>Updated: <span className="font-medium text-slate-700">{v.updatedAt?.slice(0, 10)}</span></div>}
          </div>
          {v.description && <p className="text-xs text-slate-600 leading-relaxed">{v.description}</p>}
          <button onClick={() => onRemove(v.id)} className="text-xs px-3 py-1 rounded bg-white border border-red-200 text-red-500 hover:bg-red-50">Remove</button>
        </div>
      )}
    </div>
  );
}

export default function ServicesTab() {
  const store = useStore();
  const servicesRegistry = store.servicesRegistry || [];

  const [filterType, setFilterType] = useState('ALL');
  const [filterCrit, setFilterCrit] = useState('ALL');
  const [addName,     setAddName]     = useState('');
  const [addProvider, setAddProvider] = useState('');
  const [addType,     setAddType]     = useState('SaaS');
  const [addCrit,     setAddCrit]     = useState('MEDIUM');

  const filtered = servicesRegistry
    .filter(v => filterType === 'ALL' || v.serviceType === filterType)
    .filter(v => filterCrit === 'ALL' || v.criticality === filterCrit)
    .sort((a, b) => {
      const critDiff = CRIT_ORDER.indexOf(a.criticality) - CRIT_ORDER.indexOf(b.criticality);
      if (critDiff !== 0) return critDiff;
      const da = daysUntil(a.renewalDate);
      const db = daysUntil(b.renewalDate);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

  const atRiskCount = servicesRegistry.filter(v => v.status === 'AT_RISK').length;
  const renewingSoonCount = servicesRegistry.filter(v => v.status === 'ACTIVE' && daysUntil(v.renewalDate) !== null && daysUntil(v.renewalDate) < 90).length;

  function handleAdd() {
    if (!addName.trim()) return;
    const now = new Date().toISOString();
    store.addService({
      id: `SVC-MANUAL-${Date.now()}`,
      name: addName.trim(),
      provider: addProvider.trim(),
      serviceType: addType,
      criticality: addCrit,
      owner: '',
      description: '',
      renewalDate: null,
      slaTarget: '',
      status: 'ACTIVE',
      addedAt: now,
      updatedAt: now,
    });
    setAddName('');
    setAddProvider('');
    setAddType('SaaS');
    setAddCrit('MEDIUM');
  }

  return (
    <div className="p-4 space-y-4">
      <AgentInsights tab="services" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Services & Dependency Register</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            External services this project depends on — cloud providers, SaaS tools, third-party APIs. Works the same across every domain.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {atRiskCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">
              {atRiskCount} at risk
            </span>
          )}
          {renewingSoonCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold">
              {renewingSoonCount} renewing &lt; 90d
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600">
          <option value="ALL">All service types</option>
          {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCrit} onChange={e => setFilterCrit(e.target.value)}
          className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600">
          <option value="ALL">All criticality</option>
          {CRIT_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} of {servicesRegistry.length} shown</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">☁</div>
          <div className="text-sm font-medium">No services logged yet</div>
          <div className="text-xs mt-1">
            {servicesRegistry.length === 0
              ? 'Log every external service, cloud provider, or vendor dependency this project relies on below.'
              : 'Adjust the filters to see more.'}
          </div>
        </div>
      ) : (
        filtered.map(v => (
          <ServiceRow
            key={v.id}
            v={v}
            onUpdate={(id, patch) => store.updateService(id, patch)}
            onRemove={(id) => store.removeService(id)}
          />
        ))
      )}

      {/* Add manually */}
      <div className="card p-4 border-dashed border-2 border-slate-200">
        <div className="text-xs font-bold text-slate-600 mb-2">Add Service / Dependency</div>
        <div className="flex gap-2 flex-wrap">
          <input
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800 min-w-40"
            placeholder="Service name (e.g. AWS RDS, Stripe API)..."
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            className="w-40 text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800"
            placeholder="Provider"
            value={addProvider}
            onChange={e => setAddProvider(e.target.value)}
          />
          <select value={addType} onChange={e => setAddType(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-600">
            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={addCrit} onChange={e => setAddCrit(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-600">
            {CRIT_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleAdd}
            className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 font-semibold">
            + Add
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-slate-400 space-y-0.5 pt-1">
        <div><span className="font-semibold text-slate-500">ACTIVE</span> — service in normal use, contract/SLA current.</div>
        <div><span className="font-semibold text-slate-500">AT RISK</span> — approaching renewal, SLA breach, or vendor issue — needs PM attention.</div>
        <div><span className="font-semibold text-slate-500">RETIRED</span> — no longer in use; kept for audit history.</div>
      </div>
    </div>
  );
}
