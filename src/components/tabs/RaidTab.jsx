import { useState } from 'react';
import { useStore } from '../../store/useStore.js';
import { buildAutoRaidRows } from '../../lib/raidRows.js';
import { getPlaybook, PROJECT_TYPES } from '../../lib/compliancePlaybooks.js';
import { computeComplianceStatus } from '../../lib/complianceMatrix.js';
import { computeRiskHeatScore } from '../../engine/mathEngine.js';
import AgentInsights from '../AgentInsights.jsx';
import { useCompatCheck } from '../../lib/useCompatCheck.js';
import CompatWarning from '../CompatWarning.jsx';
import { useAuth } from '../../lib/AuthContext.jsx';
import { canEditRaidEntry, getUserRolesForBuild } from '../../lib/roleAccess.js';
import { hasCapability } from '../../lib/permissions.js';

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

const EMPTY_FORM = { type: 'RISK', description: '', severity: 'MED', mitigation: '', status: 'OPEN', owner: '', eta: '', probability: '', impact: '' };
const PI_SCALE = [1, 2, 3, 4, 5];
const SEV_COLOR_TEXT = { CRITICAL: '#DC2626', HIGH: '#D97706', MED: '#3B82F6', LOW: '#64748B' };

const CHECKLIST_STATUSES = ['pending', 'agreed', 'mitigated', 'submitted'];
const STATUS_STYLE = {
  pending: 'bg-slate-100 text-slate-500',
  agreed: 'bg-blue-100 text-blue-700',
  mitigated: 'bg-amber-100 text-amber-700',
  submitted: 'bg-green-100 text-green-700',
};

function ComplianceChecklist({ s }) {
  const { authUser } = useAuth();
  const userRoles = getUserRolesForBuild(authUser, s.roleAssignments);
  // Guest/unassigned users default to 'view_build' only via permissions.js,
  // so an unauthenticated viewer never gets edit rights here even if the
  // build has no roles assigned yet.
  const canEditStatus = authUser && hasCapability(userRoles, 'edit_compliance_status');
  const { country, domain } = s.requirements;
  if (!country || !domain) {
    return (
      <div className="card p-3 mb-4 bg-slate-50 border border-dashed border-slate-300">
        <div className="text-xs text-slate-500">
          Set <span className="font-semibold text-slate-600">Country</span> and <span className="font-semibold text-slate-600">Domain / Industry</span> in the sidebar Requirements section to infer applicable regulatory obligations from your System Design scope.
        </div>
      </div>
    );
  }

  const { matched, mandatoryPending } = computeComplianceStatus(s);
  if (matched.length === 0) {
    return (
      <div className="card p-3 mb-4 bg-green-50 border border-green-200">
        <div className="text-xs text-green-700">No compliance obligations inferred for {country} / {domain} against the current System Design scope.</div>
      </div>
    );
  }

  return (
    <div className="card p-3 mb-4 bg-purple-50/50 border border-purple-200 fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-bold text-purple-700">Compliance Checklist — {country} / {domain}</div>
          <div className="text-xs text-purple-500">
            Inferred from System Design scope. Illustrative mapping — confirm with compliance/legal before treating as complete.
            {mandatoryPending.length > 0 && <span className="text-amber-600 font-semibold"> {mandatoryPending.length} mandatory item(s) still pending.</span>}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {matched.map(rule => {
          const status = s.complianceChecklist[rule.id] || 'pending';
          return (
            <div key={rule.id} className="flex items-start gap-2 bg-white rounded-md px-2.5 py-2 border border-purple-100">
              <span className="badge badge-slate flex-shrink-0" title="Framework">{rule.framework}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-700">{rule.requirement}</div>
                {rule.mandatory && <span className="text-xs text-red-500 font-semibold">Mandatory</span>}
              </div>
              {canEditStatus ? (
                <select
                  value={status}
                  onChange={e => s.setComplianceStatus(rule.id, e.target.value)}
                  className={`text-xs font-semibold rounded px-1.5 py-1 border-0 flex-shrink-0 ${STATUS_STYLE[status]}`}
                >
                  {CHECKLIST_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              ) : (
                <span className={`text-xs font-semibold rounded px-1.5 py-1 flex-shrink-0 ${STATUS_STYLE[status]}`} title="PM, Deputy PM, or SecOps can change this">{status}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaybookSuggestions({ s, existingDescriptions }) {
  const playbook = getPlaybook(s.requirements.projectType);

  if (!s.requirements.projectType) {
    return (
      <div className="card p-3 mb-4 bg-slate-50 border border-dashed border-slate-300">
        <div className="text-xs text-slate-500">
          Set a <span className="font-semibold text-slate-600">Project Type</span> in the sidebar Requirements section to get seeded compliance risks, issues, and best practices for this kind of build.
        </div>
      </div>
    );
  }
  if (!playbook) return null;

  const pending = playbook.items.filter(item =>
    !existingDescriptions.has(item.description) && !s.dismissedPlaybookItems.includes(item.description)
  );
  if (pending.length === 0) return null;

  const label = PROJECT_TYPES.find(p => p.id === s.requirements.projectType)?.label || s.requirements.projectType;

  return (
    <div className="card p-3 mb-4 bg-indigo-50/50 border border-indigo-200 fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-bold text-indigo-700">Playbook Suggestions — {label}</div>
          <div className="text-xs text-indigo-500">Program demand: {playbook.programDemand.join(' · ')}. Illustrative starting points — review before relying on for an actual audit.</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {pending.map(item => (
          <div key={item.description} className="flex items-start gap-2 bg-white rounded-md px-2.5 py-2 border border-indigo-100">
            <span className={`badge ${RAID_TYPES[item.type]?.color || 'badge-slate'} flex-shrink-0`}>{item.type}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-700">{item.description}</div>
              <div className="text-xs text-slate-400 mt-0.5">{item.mitigation}</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => s.addCustomRaidEntry({ ...item, id: `playbook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, addedAt: new Date().toISOString(), source: 'playbook' })}
                className="text-xs font-semibold px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >+ Add</button>
              <button
                onClick={() => s.dismissPlaybookItem(item.description)}
                className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1"
                title="Not relevant to this build"
              >✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        {row.probability && row.impact && (
          <span className="ml-1 text-xs text-slate-400" title={`Probability ${row.probability} x Impact ${row.impact}`}>P{row.probability}×I{row.impact}</span>
        )}
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

  const autoRows = buildAutoRaidRows(s);
  const customRows = (s.customRaidEntries || []).map(e => ({ ...e }));

  function handleEdit(row) {
    setForm({ type: row.type || 'RISK', description: row.description || '', severity: row.severity || 'MED', mitigation: row.mitigation || '', status: row.status || 'OPEN', owner: row.owner || '', eta: row.eta || '', probability: row.probability || '', impact: row.impact || '' });
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

      <ComplianceChecklist s={s} />
      <PlaybookSuggestions s={s} existingDescriptions={new Set(allRows.map(r => r.description))} />

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
            {(form.type === 'RISK' || form.type === 'ISSUE') && (
              <div className="col-span-2 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Probability (1-5)</label>
                  <select
                    value={form.probability}
                    onChange={e => {
                      const probability = e.target.value;
                      setForm(f => {
                        const next = { ...f, probability };
                        if (probability && next.impact) next.severity = computeRiskHeatScore(probability, next.impact).band;
                        return next;
                      });
                    }}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800"
                  >
                    <option value="">— not set —</option>
                    {PI_SCALE.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Impact (1-5)</label>
                  <select
                    value={form.impact}
                    onChange={e => {
                      const impact = e.target.value;
                      setForm(f => {
                        const next = { ...f, impact };
                        if (next.probability && impact) next.severity = computeRiskHeatScore(next.probability, impact).band;
                        return next;
                      });
                    }}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800"
                  >
                    <option value="">— not set —</option>
                    {PI_SCALE.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                {form.probability && form.impact && (
                  <div className="col-span-2 text-xs text-slate-500">
                    Heat score <span className="font-bold text-slate-700">{computeRiskHeatScore(form.probability, form.impact).score}/25</span> — severity auto-set to <span className="font-bold" style={{ color: SEV_COLOR_TEXT[computeRiskHeatScore(form.probability, form.impact).band] }}>{computeRiskHeatScore(form.probability, form.impact).band}</span> (you can still override below)
                  </div>
                )}
              </div>
            )}
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
