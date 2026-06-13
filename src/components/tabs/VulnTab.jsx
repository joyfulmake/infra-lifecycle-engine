import { useState } from 'react';
import { useStore } from '../../store/useStore.js';

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTS = ['ACTIVE', 'PARKED', 'WORKAROUND', 'FIXED', 'ACCEPTED_RISK'];
const DISC_STATUS_OPTS = ['PENDING', 'IN_DISCUSSION', 'AGREED', 'REJECTED'];

const SEV_STYLE = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-amber-100 text-amber-700 border-amber-200',
  MEDIUM:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  LOW:      'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_STYLE = {
  ACTIVE:         'bg-red-50 text-red-700',
  PARKED:         'bg-slate-100 text-slate-500',
  WORKAROUND:     'bg-amber-50 text-amber-700',
  FIXED:          'bg-green-50 text-green-700',
  ACCEPTED_RISK:  'bg-purple-50 text-purple-700',
};

const DISC_STATUS_STYLE = {
  PENDING:       'bg-amber-100 text-amber-700',
  IN_DISCUSSION: 'bg-blue-100 text-blue-700',
  AGREED:        'bg-green-100 text-green-700',
  REJECTED:      'bg-red-100 text-red-700',
};

function VulnRow({ v, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [bdNote, setBdNote] = useState(v.businessDecision || '');
  const [waNote, setWaNote] = useState(v.workaround || '');

  function save() {
    onUpdate(v.id, { businessDecision: bdNote, workaround: waNote });
  }

  return (
    <div className={['rounded-lg border mb-2 overflow-hidden', v.status === 'FIXED' ? 'opacity-60' : ''].join(' ')}
         style={{ borderColor: v.severity === 'CRITICAL' ? '#fca5a5' : v.severity === 'HIGH' ? '#fcd34d' : '#e2e8f0' }}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(x => !x)}
      >
        <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold border ${SEV_STYLE[v.severity] || SEV_STYLE.MEDIUM}`}>
          {v.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 truncate">{v.title}</span>
            {v.cveId && <span className="text-xs text-blue-600 font-mono">{v.cveId}</span>}
            <span className="text-xs text-slate-400">{v.component}</span>
          </div>
          {v.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{v.description}</p>}
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
            <div>Source: <span className="font-medium text-slate-700">{v.source || 'manual'}</span></div>
            <div>Added: <span className="font-medium text-slate-700">{v.addedAt?.slice(0, 10) || '—'}</span></div>
            {v.fixTargetDate && <div>Target fix: <span className="font-medium text-slate-700">{v.fixTargetDate}</span></div>}
            {v.updatedAt !== v.addedAt && <div>Updated: <span className="font-medium text-slate-700">{v.updatedAt?.slice(0, 10)}</span></div>}
          </div>

          {(v.status === 'PARKED' || v.status === 'ACCEPTED_RISK') && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Business Decision / Rationale</label>
              <textarea
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 resize-none"
                rows={2}
                value={bdNote}
                onChange={e => setBdNote(e.target.value)}
                placeholder="Why is this parked / accepted risk? Record the business justification here."
              />
            </div>
          )}

          {v.status === 'WORKAROUND' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Workaround Details</label>
              <textarea
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 resize-none"
                rows={2}
                value={waNote}
                onChange={e => setWaNote(e.target.value)}
                placeholder="Describe the interim workaround in place."
              />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={save} className="text-xs px-3 py-1 rounded bg-teal-600 text-white hover:bg-teal-700">Save notes</button>
            <button onClick={() => onRemove(v.id)} className="text-xs px-3 py-1 rounded bg-white border border-red-200 text-red-500 hover:bg-red-50">Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscRow({ d, onUpdate }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-800 font-medium leading-snug">{d.topic}</div>
        {d.question && <p className="text-xs text-slate-500 mt-0.5">{d.question}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-400">Owner: {d.owner}</span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-400">{d.addedAt?.slice(0,10)}</span>
        </div>
      </div>
      <select
        value={d.status}
        onChange={e => onUpdate(d.id, { status: e.target.value, ...(e.target.value === 'AGREED' ? { resolvedAt: new Date().toISOString() } : {}) })}
        className={`text-xs px-2 py-1 rounded font-semibold border-0 flex-shrink-0 cursor-pointer ${DISC_STATUS_STYLE[d.status] || ''}`}
      >
        {DISC_STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
    </div>
  );
}

export default function VulnTab() {
  const store = useStore();
  const vulnRegistry          = store.vulnRegistry          || [];
  const stakeholderDiscussions = store.stakeholderDiscussions || [];
  const actionAuditLog         = store.actionAuditLog         || [];

  const [activeSection, setActiveSection] = useState('vulns'); // 'vulns' | 'discussions' | 'auditlog'
  const [filterSev,  setFilterSev]  = useState('ALL');
  const [filterStat, setFilterStat] = useState('ALL');
  const [addTitle,   setAddTitle]   = useState('');
  const [addSev,     setAddSev]     = useState('HIGH');
  const [addComp,    setAddComp]    = useState('');

  const { ctx } = store;
  const defaultComp = [ctx?.os, ctx?.db, ctx?.app].filter(Boolean).join(' / ') || 'Unknown';

  const filtered = vulnRegistry
    .filter(v => filterSev  === 'ALL' || v.severity === filterSev)
    .filter(v => filterStat === 'ALL' || v.status   === filterStat)
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  const activeCount   = vulnRegistry.filter(v => v.status === 'ACTIVE').length;
  const pendingDiscCount = stakeholderDiscussions.filter(d => d.status === 'PENDING').length;

  function handleAdd() {
    if (!addTitle.trim()) return;
    const now = new Date().toISOString();
    store.addVuln({
      id: `VULN-MANUAL-${Date.now()}`,
      title: addTitle.trim(),
      cveId: null,
      component: addComp || defaultComp,
      severity: addSev,
      description: '',
      status: 'ACTIVE',
      businessDecision: '',
      workaround: '',
      source: 'manual',
      addedAt: now,
      updatedAt: now,
      fixTargetDate: null,
    });
    setAddTitle('');
    setAddComp('');
    setAddSev('HIGH');
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Vulnerability & Stakeholder Registry</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track CVEs, EOL risks, and stakeholder agreements. All findings auto-populate from OpsMentor.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {activeCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold">
              {activeCount} active
            </span>
          )}
          {pendingDiscCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">
              {pendingDiscCount} pending discussions
            </span>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'vulns',       label: `Vulnerabilities (${vulnRegistry.length})` },
          { id: 'discussions', label: `Stakeholder Discussions (${stakeholderDiscussions.length})` },
          { id: 'auditlog',   label: `Action Audit Log (${actionAuditLog.length})` },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={[
              'text-xs px-3 py-2 border-b-2 font-medium transition-colors',
              activeSection === s.id
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Vulnerabilities section */}
      {activeSection === 'vulns' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2 items-center flex-wrap">
            <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
              className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600">
              <option value="ALL">All severities</option>
              {SEV_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStat} onChange={e => setFilterStat(e.target.value)}
              className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600">
              <option value="ALL">All statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <span className="text-xs text-slate-400">{filtered.length} of {vulnRegistry.length} shown</span>
          </div>

          {/* Vuln list */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-3xl mb-2">✓</div>
              <div className="text-sm font-medium">No vulnerabilities match the current filter</div>
              <div className="text-xs mt-1">
                {vulnRegistry.length === 0
                  ? 'Vulnerabilities are auto-created when OpsMentor detects EOL or incompatibility issues. You can also add them below.'
                  : 'Adjust the severity or status filter to see more.'}
              </div>
            </div>
          ) : (
            filtered.map(v => (
              <VulnRow
                key={v.id}
                v={v}
                onUpdate={(id, patch) => store.updateVuln(id, patch)}
                onRemove={(id) => store.removeVuln(id)}
              />
            ))
          )}

          {/* Add manually */}
          <div className="card p-4 border-dashed border-2 border-slate-200">
            <div className="text-xs font-bold text-slate-600 mb-2">Add Vulnerability Manually</div>
            <div className="flex gap-2 flex-wrap">
              <input
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800 min-w-40"
                placeholder="Vulnerability title or CVE description..."
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <input
                className="w-40 text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800"
                placeholder="Component (e.g. RHEL 7)"
                value={addComp}
                onChange={e => setAddComp(e.target.value)}
              />
              <select value={addSev} onChange={e => setAddSev(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-600">
                {SEV_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleAdd}
                className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 font-semibold">
                + Add
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="text-xs text-slate-400 space-y-0.5 pt-1">
            <div><span className="font-semibold text-slate-500">ACTIVE</span> — known risk, no decision made yet. Requires PM attention.</div>
            <div><span className="font-semibold text-slate-500">PARKED</span> — deferred by business decision. Must record rationale.</div>
            <div><span className="font-semibold text-slate-500">WORKAROUND</span> — interim fix in place. Document the workaround.</div>
            <div><span className="font-semibold text-slate-500">FIXED</span> — resolved. Record the fix method.</div>
            <div><span className="font-semibold text-slate-500">ACCEPTED RISK</span> — business owner accepted the risk in writing.</div>
          </div>
        </div>
      )}

      {/* Stakeholder discussions section */}
      {activeSection === 'discussions' && (
        <div>
          {stakeholderDiscussions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-3xl mb-2">⬡</div>
              <div className="text-sm font-medium">No stakeholder discussions yet</div>
              <div className="text-xs mt-1">Discussions are auto-created when you set stack fields via OpsMentor. They track team and client agreement on key decisions.</div>
            </div>
          ) : (
            <div className="card overflow-hidden divide-y divide-slate-100">
              {stakeholderDiscussions.map(d => (
                <DiscRow
                  key={d.id}
                  d={d}
                  onUpdate={(id, patch) => store.updateStakeholderDiscussion(id, patch)}
                />
              ))}
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-blue-50 text-xs text-blue-700 leading-relaxed">
            <strong>Why these matter:</strong> Stakeholder discussions are the PM's evidence that every major technical decision was reviewed and accepted — by the Unix Admin, DBA, App team, InfoSec, and the client. Mark each AGREED only after confirmation. REJECTED entries must be re-discussed before the build proceeds to CAB.
          </div>
        </div>
      )}

      {/* Action audit log section */}
      {activeSection === 'auditlog' && (
        <div>
          {actionAuditLog.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-3xl mb-2">📋</div>
              <div className="text-sm font-medium">No actions logged yet</div>
              <div className="text-xs mt-1">Every action OpsMentor executes — setting fields, running scans, creating incidents — is logged here with a timestamp, user, and phase.</div>
            </div>
          ) : (
            <div className="space-y-1">
              {[...actionAuditLog].reverse().map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-3 py-2 rounded hover:bg-slate-50 text-xs">
                  <span className="text-slate-300 font-mono flex-shrink-0 w-20 text-right">
                    {entry.ts?.slice(11, 19) || '—'}
                  </span>
                  <span className={[
                    'flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-xs',
                    entry.status === 'executed' ? 'bg-teal-50 text-teal-600' :
                    entry.status === 'confirmed' ? 'bg-blue-50 text-blue-600' :
                    'bg-slate-100 text-slate-400',
                  ].join(' ')}>
                    {entry.type?.replace(/_/g, ' ') || 'ACTION'}
                  </span>
                  <span className="flex-1 text-slate-600 leading-snug">{entry.description}</span>
                  <span className="text-slate-300 flex-shrink-0">{entry.phase}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
