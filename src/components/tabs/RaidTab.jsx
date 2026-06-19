import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { ALL_INC, FIXES } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';
import AgentInsights from '../AgentInsights.jsx';
import { useCompatCheck } from '../../lib/useCompatCheck.js';
import CompatWarning from '../CompatWarning.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import { canEditRaidEntry } from '../../lib/roleAccess.js';

const RAID_TYPES = {
  ISSUE: { color: 'badge-red', bg: 'bg-red-50' },
  RISK: { color: 'badge-amber', bg: 'bg-amber-50/50' },
  ASSUMPTION: { color: 'badge-blue', bg: '' },
  DEPENDENCY: { color: 'badge-slate', bg: '' },
  CHANGE: { color: 'badge-amber', bg: 'bg-amber-50/50' },
  DECISION: { color: 'badge-teal', bg: 'bg-teal-50/50' },
};

const SEV_OPTIONS = ['CRITICAL', 'HIGH', 'MED', 'LOW'];
const TYPE_OPTIONS = ['RISK', 'ISSUE', 'ASSUMPTION', 'DEPENDENCY', 'CHANGE', 'DECISION'];
const STATUS_OPTIONS = ['OPEN', 'ACTIVE', 'SCHED', 'IN_PROGRESS', 'DONE', 'CLOSED', 'PARKED'];

const EMPTY_FORM = { type: 'RISK', description: '', severity: 'MED', mitigation: '', status: 'OPEN', owner: '', eta: '' };

function RaidRow({ row, isCustom, onEdit, onDelete }) {
  const cfg = RAID_TYPES[row.type] || RAID_TYPES.RISK;
  const statusColor = row.status === 'CLOSED' || row.status === 'DONE' ? 'text-green-600 font-semibold' :
    row.status === 'OPEN' || row.status === 'ACTIVE' ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold';
  return (
    <tr className={`border-b border-slate-100 ${cfg.bg} hover:bg-slate-50 transition-colors group`}>
      <td className="py-2 px-3"><span className={`badge ${cfg.color}`}>{row.type}</span></td>
      <td className="py-2 px-3 text-xs text-slate-700 max-w-xs">{row.description}</td>
      <td className="py-2 px-3 text-xs">
        <span className={['badge', row.severity === 'CRITICAL' ? 'badge-red' : row.severity === 'HIGH' ? 'badge-amber' : row.severity === 'MED' ? 'badge-blue' : 'badge-slate'].join(' ')}>{row.severity}</span>
      </td>
      <td className="py-2 px-3 text-xs text-slate-600 max-w-xs">{row.mitigation}</td>
      <td className={`py-2 px-3 text-xs ${statusColor}`}>{row.status}</td>
      <td className="py-2 px-3 text-xs text-slate-500">{row.owner}</td>
      <td className="py-2 px-3 text-xs text-slate-400">{row.eta || '—'}</td>
      <td className="py-1 px-2 text-xs">
        {isCustom ? (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(row)} className="text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 text-xs">Edit</button>
            <button onClick={() => onDelete(row.id)} className="text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 text-xs">✕</button>
          </div>
        ) : (
          <span className="text-slate-300 text-xs">auto</span>
        )}
      </td>
    </tr>
  );
}

export default function RaidTab() {
  const s = useStore();
  const { authUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [compatOverride, setCompatOverride] = useState(false);

  const canAddType = (type) => canEditRaidEntry(type, authUser, s.requirements);

  // Live compat check on the description text being typed
  const { hits: compatHits, clear: clearCompat } = useCompatCheck(form.description, s.ctx);

  if (!s.phase2Active) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="font-semibold text-slate-700 mb-1">RAID Registry Locked</div>
          <div className="text-sm text-slate-500">Select incidents and UUM items in Phase 2 to populate the RAID registry.</div>
        </div>
      </div>
    );
  }

  const autoRows = [];

  s.selInc.forEach(code => {
    const inc = ALL_INC.find(i => i.code === code) || (s.customInc || []).find(i => i.id === code);
    if (!inc) return;
    const fixed = s.promoted || s.selFix.includes(code);
    autoRows.push({ type: 'ISSUE', description: inc.short + ': ' + (inc.txt || '').substring(0, 80), severity: fixed ? 'LOW' : 'CRITICAL', mitigation: FIXES[code] || 'Generic patch applied.', status: fixed ? 'CLOSED' : 'OPEN', owner: 'SysAdmin', eta: '' });
    if (!fixed) autoRows.push({ type: 'RISK', description: inc.short + ' fix regression may affect adjacent layers', severity: 'MED', mitigation: 'Run regression suite across adjacent layers after staging fix.', status: 'ACTIVE', owner: 'QA Team', eta: '' });
  });

  s.selUUM.forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code) || (s.customUUM || []).find(u => u.id === code);
    if (!uum) return;
    const done = s.promoted;
    autoRows.push({ type: 'CHANGE', description: uum.short + ' [' + (uum.type || 'change').toUpperCase() + ']: ' + (uum.txt || '').substring(0, 80), severity: done ? 'LOW' : uum.type === 'migration' ? 'HIGH' : uum.type === 'upgrade' ? 'MED' : 'LOW', mitigation: done ? 'Completed and verified.' : uum.type === 'migration' ? 'Dual-run. Data integrity check before decommission.' : uum.type === 'upgrade' ? 'Stage first. Rollback documented.' : 'Apply in window. Health check post-patch.', status: done ? 'DONE' : 'SCHED', owner: (uum.layers || []).includes('db') ? 'DBA + SysAdmin' : 'SysAdmin', eta: '' });
  });

  autoRows.push(
    { type: 'ASSUMPTION', description: 'All function teams available for scheduled change windows', severity: 'MED', mitigation: 'Confirm at kick-off', status: 'OPEN', owner: 'Change Manager', eta: '' },
    { type: 'ASSUMPTION', description: 'Non-prod environment mirrors production configuration and data volume', severity: 'HIGH', mitigation: 'Environment parity check before staging', status: 'OPEN', owner: 'Unix Admin', eta: '' },
    { type: 'DEPENDENCY', description: 'CAB approval required before production change window', severity: 'HIGH', mitigation: 'CAB submission 5 days before window', status: s.cabApproved ? 'DONE' : 'OPEN', owner: 'Change Manager', eta: '' },
    { type: 'DEPENDENCY', description: 'RTM sign-off from QA before cutover', severity: 'HIGH', mitigation: 'QA Lead signs all RTM items before cutover call', status: s.rtmSigned ? 'DONE' : 'OPEN', owner: 'QA Team', eta: '' },
    { type: 'RISK', description: 'Production outage window overrun if migration exceeds estimate', severity: 'HIGH', mitigation: 'Two staging rehearsals. Rollback at T+30min if not on track.', status: 'ACTIVE', owner: 'Change Manager', eta: '' },
    { type: 'RISK', description: 'Post-migration performance regression due to changed execution plans', severity: 'MED', mitigation: 'Baseline metrics pre-migration. Monitor 48h post-cutover.', status: 'ACTIVE', owner: 'DBA + QA Team', eta: '' },
  );

  const customRows = (s.customRaidEntries || []).map(e => ({ ...e }));

  function handleEdit(row) {
    setForm({ type: row.type || 'RISK', description: row.description || '', severity: row.severity || 'MED', mitigation: row.mitigation || '', status: row.status || 'OPEN', owner: row.owner || '', eta: row.eta || '' });
    setEditId(row.id);
    setShowForm(true);
  }

  function handleDelete(id) {
    s.removeCustomRaidEntry(id);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    // If compat hits exist and user hasn't overridden, block submit
    if (compatHits.length > 0 && !compatOverride) return;
    if (editId) {
      s.updateCustomRaidEntry(editId, form);
      setEditId(null);
    } else {
      s.addCustomRaidEntry({ ...form, id: `raid-${Date.now()}`, addedAt: new Date().toISOString() });
      // Auto-add RAID risk for each overridden compat issue
      if (compatOverride && compatHits.length > 0) {
        compatHits.forEach(rule => {
          const refs = (rule.refs || []).map(r => r.label).join('; ');
          s.addCustomRaidEntry({
            id: `compat-risk-${Date.now()}-${rule.id}`,
            type: 'RISK',
            severity: rule.severity === 'critical' ? 'CRITICAL' : 'HIGH',
            description: `[Compat Override] ${rule.title} — user proceeded despite vendor restriction.`,
            mitigation: `Verify with vendor PAM. Refs: ${refs}`,
            status: 'OPEN',
            owner: 'PM / Architect',
            addedAt: new Date().toISOString(),
          });
        });
      }
    }
    setForm(EMPTY_FORM);
    setCompatOverride(false);
    clearCompat();
    setShowForm(false);
  }

  const allRows = [...autoRows, ...customRows];

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">
      <AgentInsights tab="raid" />

      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-slate-700">RAID Registry</div>
          <div className="text-xs text-slate-500">Risks · Assumptions · Issues · Dependencies — add custom entries for your build</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-red">{allRows.filter(r => r.type === 'ISSUE').length} Issues</span>
          <span className="badge badge-amber">{allRows.filter(r => r.type === 'RISK' || r.type === 'CHANGE').length} Risks/Changes</span>
          <span className="badge badge-slate">{allRows.filter(r => r.type === 'ASSUMPTION' || r.type === 'DEPENDENCY').length} A&D</span>
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) { setForm(EMPTY_FORM); setEditId(null); setCompatOverride(false); } }}
            className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
          >
            {showForm ? '✕ Cancel' : '+ Add Entry'}
          </button>
        </div>
      </div>

      {/* Inline add/edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 mb-4 bg-teal-50 border border-teal-200 fade-in">
          <div className="text-xs font-semibold text-teal-700 mb-3">{editId ? 'Edit Entry' : 'New RAID Entry'}</div>
          {!canAddType(form.type) && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded px-3 py-2 mb-3">
              {form.type} entries are restricted to PM or Deputy PM. Change the type or sign in as PM.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800">
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800">
                {SEV_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Owner</label>
              <input type="text" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="e.g. DBA, PM, QA Lead" className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ETA / Target Date</label>
              <input type="date" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setCompatOverride(false); }}
              rows={2}
              placeholder="Describe the risk, issue, or assumption…"
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800 resize-none"
              required
            />
            <CompatWarning
              hits={compatHits}
              overriding={compatOverride}
              onOverride={() => setCompatOverride(true)}
              onDismiss={() => { setForm(f => ({ ...f, description: '' })); setCompatOverride(false); }}
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">Mitigation / Action</label>
            <textarea value={form.mitigation} onChange={e => setForm(f => ({ ...f, mitigation: e.target.value }))} rows={2} placeholder="What action mitigates this?" className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800 resize-none" />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={(compatHits.length > 0 && !compatOverride) || !canAddType(form.type)}
              className="px-3 py-1.5 rounded bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editId ? 'Update' : 'Add Entry'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setEditId(null); setCompatOverride(false); clearCompat(); }} className="px-3 py-1.5 rounded bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Type</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Severity</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mitigation</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Status</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Owner</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">ETA</th>
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16"></th>
              </tr>
            </thead>
            <tbody>
              {autoRows.map((row, i) => <RaidRow key={i} row={row} isCustom={false} onEdit={() => {}} onDelete={() => {}} />)}
              {customRows.map(row => <RaidRow key={row.id} row={row} isCustom onEdit={handleEdit} onDelete={handleDelete} />)}
              {allRows.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-xs text-slate-400">No entries yet — add incidents/UUM items in Phase 2 or click "+ Add Entry" above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {customRows.length > 0 && (
        <div className="text-xs text-slate-400 mt-2 text-right">{customRows.length} custom entr{customRows.length === 1 ? 'y' : 'ies'} — hover a row to edit or delete</div>
      )}
    </div>
  );
}
