import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore.js';
import AgentInsights from '../AgentInsights.jsx';

// Universal pipeline stages — deliberately domain-agnostic. Unlike RTM/Matrix
// (which needed per-domain generation because their content is technical and
// domain-shaped), "build, test, deploy to staging, deploy to production,
// verify" is already a universal PM concept whether the underlying mechanism
// is a CI/CD pipeline, a SAP transport, a Salesforce package push, or an EHR
// release window. Seeded once per build; the user can rename/edit/add more.
const DEFAULT_STAGES = [
  { stage: 'build',       label: 'Build / Package' },
  { stage: 'qa',          label: 'QA / Test Validation' },
  { stage: 'staging',     label: 'Staging Deployment' },
  { stage: 'production',  label: 'Production Deployment' },
  { stage: 'postdeploy',  label: 'Post-Deploy Verification' },
];

const STATUS_OPTS = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'PASSED', 'FAILED'];
const STATUS_STYLE = {
  PENDING:     'bg-slate-100 text-slate-500',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  BLOCKED:     'bg-red-100 text-red-700',
  PASSED:      'bg-green-100 text-green-700',
  FAILED:      'bg-red-100 text-red-700',
};

function DeployRow({ d, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(d.notes || '');
  const [owner, setOwner] = useState(d.owner || '');
  const [blockedReason, setBlockedReason] = useState(d.blockedReason || '');

  function save() {
    onUpdate(d.id, { notes, owner, blockedReason });
  }

  return (
    <div className={['rounded-lg border mb-2 overflow-hidden', d.status === 'PASSED' ? 'opacity-60' : ''].join(' ')}
         style={{ borderColor: d.status === 'BLOCKED' || d.status === 'FAILED' ? '#fca5a5' : '#e2e8f0' }}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(x => !x)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 truncate">{d.label}</span>
            {d.env && <span className="text-xs text-slate-400">{d.env}</span>}
          </div>
          {d.owner && <p className="text-xs text-slate-500 mt-0.5">Owner: {d.owner}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={d.status}
            onClick={e => e.stopPropagation()}
            onChange={e => onUpdate(d.id, { status: e.target.value })}
            className={`text-xs px-2 py-1 rounded font-semibold border-0 cursor-pointer ${STATUS_STYLE[d.status] || ''}`}
          >
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <span className="text-slate-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Owner</label>
            <input
              className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-700"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              placeholder="Who owns this stage?"
            />
          </div>

          {(d.status === 'BLOCKED' || d.status === 'FAILED') && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Blocked / Failure Reason</label>
              <textarea
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 resize-none"
                rows={2}
                value={blockedReason}
                onChange={e => setBlockedReason(e.target.value)}
                placeholder="Why is this stage blocked or failing?"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <textarea
              className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 resize-none"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Deployment notes, artifact version, ticket links, etc."
            />
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="text-xs px-3 py-1 rounded bg-teal-600 text-white hover:bg-teal-700">Save notes</button>
            {!DEFAULT_STAGES.some(s => s.stage === d.stage) && (
              <button onClick={() => onRemove(d.id)} className="text-xs px-3 py-1 rounded bg-white border border-red-200 text-red-500 hover:bg-red-50">Remove</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeployTab() {
  const store = useStore();
  const deployStages = store.deployStages || [];

  const [addLabel, setAddLabel] = useState('');
  const [addEnv,   setAddEnv]   = useState('');

  // Seed the 5 universal stages once, the first time this tab is opened on a
  // build with none yet. Reads useStore.getState() directly rather than the
  // closed-over `deployStages` — React's dev-mode StrictMode double-invokes
  // effects on mount (mount -> cleanup -> remount), and a closed-over prop
  // value is stale across that remount (still the initial-render empty
  // array on both invocations), which duplicated the seed. The Zustand
  // store itself is a live, global singleton, not per-component state, so
  // reading it fresh here always reflects the first invocation's writes.
  useEffect(() => {
    if (useStore.getState().deployStages.length === 0) {
      const now = new Date().toISOString();
      DEFAULT_STAGES.forEach(({ stage, label }) => {
        store.addDeployStage({
          id: `deploy-${stage}`,
          stage, label,
          status: 'PENDING',
          owner: '',
          env: '',
          notes: '',
          blockedReason: '',
          addedAt: now,
          updatedAt: now,
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockedCount = deployStages.filter(d => d.status === 'BLOCKED' || d.status === 'FAILED').length;
  const passedCount = deployStages.filter(d => d.status === 'PASSED').length;

  function handleAddStage() {
    if (!addLabel.trim()) return;
    const now = new Date().toISOString();
    store.addDeployStage({
      id: `deploy-custom-${Date.now()}`,
      stage: 'custom',
      label: addLabel.trim(),
      status: 'PENDING',
      owner: '',
      env: addEnv.trim(),
      notes: '',
      blockedReason: '',
      addedAt: now,
      updatedAt: now,
    });
    setAddLabel('');
    setAddEnv('');
  }

  return (
    <div className="p-4 space-y-4">
      <AgentInsights tab="deploy" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Deploy Pipeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Build, test, and release stages — works the same whether that's CI/CD, a transport, a package push, or a release window.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {blockedCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold">
              {blockedCount} blocked
            </span>
          )}
          {passedCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-bold">
              {passedCount}/{deployStages.length} passed
            </span>
          )}
        </div>
      </div>

      {/* Stage list */}
      {deployStages.map(d => (
        <DeployRow
          key={d.id}
          d={d}
          onUpdate={(id, patch) => store.updateDeployStage(id, patch)}
          onRemove={(id) => store.removeDeployStage(id)}
        />
      ))}

      {/* Add custom stage — e.g. canary 10%/50%/100%, a second environment, a manual approval gate */}
      <div className="card p-4 border-dashed border-2 border-slate-200">
        <div className="text-xs font-bold text-slate-600 mb-2">Add Custom Stage</div>
        <div className="flex gap-2 flex-wrap">
          <input
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800 min-w-40"
            placeholder="Stage name (e.g. Canary 10%, DR Failover Test)..."
            value={addLabel}
            onChange={e => setAddLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddStage()}
          />
          <input
            className="w-40 text-xs border border-slate-200 rounded px-2 py-1.5 text-slate-800"
            placeholder="Environment (optional)"
            value={addEnv}
            onChange={e => setAddEnv(e.target.value)}
          />
          <button onClick={handleAddStage}
            className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 font-semibold">
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
