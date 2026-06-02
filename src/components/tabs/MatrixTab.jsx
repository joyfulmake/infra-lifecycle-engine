import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore.js';
import { ALL_INC } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';
import { getRealTasks } from '../../lib/realTasks.js';
import { getIncidentFixTasks } from '../../lib/incidentFixTasks.js';
import { buildDesignTasks } from '../../lib/designTasks.js';
import { enrichTask, FSM_STATE_STYLE } from '../../lib/taskMetadata.js';

// ── Layer definitions (bottom of stack → top) ────────────────────────────────

const LAYERS = [
  {
    id: 'storage',
    label: 'Storage / Backup',
    icon: '◫',
    color: { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-100', card: 'bg-slate-700 border-slate-600 hover:bg-slate-600', dot: 'bg-slate-400' },
    roles: ['StorageAdmin', 'BackupAdmin', 'DBA + BackupAdmin'],
    hwDim: 'Disk Block I/O',
    desc: 'SAN LUN masking · NVMe block alloc · Backup volume · Tape bus',
  },
  {
    id: 'os',
    label: 'OS / Kernel',
    icon: '▦',
    color: { bg: 'bg-teal-900', border: 'border-teal-700', text: 'text-teal-100', card: 'bg-teal-800 border-teal-700 hover:bg-teal-700', dot: 'bg-teal-400' },
    roles: ['Unix Admin', 'SysAdmin Lead'],
    hwDim: 'Volatile RAM + Disk I/O',
    desc: 'Kernel params · Mount table · I/O scheduler · Socket limits · Patch',
  },
  {
    id: 'network',
    label: 'Network / Security',
    icon: '⇄',
    color: { bg: 'bg-blue-900', border: 'border-blue-700', text: 'text-blue-100', card: 'bg-blue-800 border-blue-700 hover:bg-blue-700', dot: 'bg-blue-400' },
    roles: ['NetAdmin', 'NetAdmin + WebAdmin', 'SecOps'],
    hwDim: 'Network Socket / NIC Descriptor',
    desc: 'VLAN · Routing FIB · Firewall ACL · TLS cert · Audit daemon',
  },
  {
    id: 'database',
    label: 'Database Engine',
    icon: '⬡',
    color: { bg: 'bg-amber-900', border: 'border-amber-700', text: 'text-amber-100', card: 'bg-amber-800 border-amber-700 hover:bg-amber-700', dot: 'bg-amber-400' },
    roles: ['DB Admin', 'DBA', 'DBA Lead', 'DBA + BackupAdmin'],
    hwDim: 'Volatile RAM — SGA / Buffer Pool',
    desc: 'SGA alloc · Redo log · Listener port · Schema · Connection pool',
  },
  {
    id: 'application',
    label: 'Application / Runtime',
    icon: '⚙',
    color: { bg: 'bg-green-900', border: 'border-green-700', text: 'text-green-100', card: 'bg-green-800 border-green-700 hover:bg-green-700', dot: 'bg-green-400' },
    roles: ['AppAdmin', 'AppAdmin Lead'],
    hwDim: 'CPU Thread Pool + Network Socket',
    desc: 'JVM heap · Thread pool · JDBC pool · Health endpoint · Startup probe',
  },
  {
    id: 'web',
    label: 'Web / HTTP',
    icon: '◎',
    color: { bg: 'bg-purple-900', border: 'border-purple-700', text: 'text-purple-100', card: 'bg-purple-800 border-purple-700 hover:bg-purple-700', dot: 'bg-purple-400' },
    roles: ['WebAdmin', 'NetAdmin + WebAdmin'],
    hwDim: 'Network Socket + CPU Worker',
    desc: 'Worker threads · SSL termination · Load balancer probe · CDN routing',
  },
  {
    id: 'validation',
    label: 'Validation / QA',
    icon: '✓',
    color: { bg: 'bg-pink-900', border: 'border-pink-700', text: 'text-pink-100', card: 'bg-pink-800 border-pink-700 hover:bg-pink-700', dot: 'bg-pink-400' },
    roles: ['QA Team'],
    hwDim: 'Network Socket — HTTP probe',
    desc: 'Smoke test · Integration test · Latency boundary · SLA verification',
  },
  {
    id: 'governance',
    label: 'Governance / CAB',
    icon: '✦',
    color: { bg: 'bg-indigo-900', border: 'border-indigo-700', text: 'text-indigo-100', card: 'bg-indigo-800 border-indigo-700 hover:bg-indigo-700', dot: 'bg-indigo-400' },
    roles: ['Change Manager'],
    hwDim: 'Governance (non-hardware)',
    desc: 'CAB approval · Change record · Risk assessment · RTM sign-off · Closure',
  },
];

const ROLE_LAYER = {};
LAYERS.forEach(layer => layer.roles.forEach(r => { ROLE_LAYER[r] = layer.id; }));

// ── Task collector ────────────────────────────────────────────────────────────

function collectAllTasks(selInc, selUUM, designApplied, sysDesignData, ctx) {
  const out = []; // { task, source, sourceLabel }

  // Incident fix tasks
  selInc.forEach(code => {
    const inc = ALL_INC.find(i => i.code === code);
    if (!inc) return;
    getIncidentFixTasks(inc, ctx).forEach(t => {
      out.push({ task: t, source: 'incident', sourceLabel: inc.short || code, code });
    });
  });

  // UUM real tasks
  selUUM.forEach(code => {
    const uum = ALL_UUM.find(u => u.code === code);
    if (!uum) return;
    getRealTasks(uum, ctx).forEach(t => {
      out.push({ task: t, source: 'uum', sourceLabel: uum.short || code, code });
    });
  });

  // System design tasks (if applied)
  if (designApplied) {
    const dt = buildDesignTasks(sysDesignData, ctx);
    dt.forEach(t => {
      out.push({ task: t, source: 'design', sourceLabel: 'Design', code: 'design' });
    });
  }

  return out;
}

function getLayerId(task) {
  const role = task.team || task.role || '';
  return ROLE_LAYER[role] || 'governance';
}

// ── FSM Detail side panel ─────────────────────────────────────────────────────

function FsmDetailPanel({ item, ctx, onClose }) {
  if (!item) return null;
  const { task, sourceLabel } = item;
  const meta = enrichTask(task, ctx);
  const ss = FSM_STATE_STYLE[meta.fsmState] || FSM_STATE_STYLE.PENDING;

  const Field = ({ icon, label, value, mono }) => (
    <div className="mb-3">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-slate-400 text-xs">{icon}</span>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className={['text-xs leading-relaxed rounded px-2 py-1.5 border',
        mono ? 'font-mono bg-slate-900 text-green-300 border-slate-700 whitespace-pre-wrap break-all'
             : 'bg-slate-800 text-slate-200 border-slate-700'].join(' ')}>
        {value}
      </div>
    </div>
  );

  return (
    <div className="w-80 flex-shrink-0 bg-slate-900 border-l border-slate-700 overflow-y-auto flex flex-col">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-xs font-bold text-slate-200">FSM TASK STATE</div>
          <div className="text-xs text-slate-400 truncate max-w-52">{task.title || task.name}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm flex-shrink-0">✕</button>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className={['text-xs font-bold px-2 py-0.5 rounded border', ss.cls].join(' ')}>{ss.label}</span>
        <span className="text-xs text-slate-400">from <span className="text-teal-400">{sourceLabel}</span></span>
      </div>
      <div className="p-3 flex-1">
        <Field icon="▦" label="Hardware Dimension" value={meta.hwDimension} />
        <Field icon="→" label="Pre-Condition States" value={meta.preCondition} />
        <Field icon="⚙" label="Execution Engine" value={meta.execEngine} mono />
        <Field icon="✓" label="Post-Condition Validation" value={meta.postValidation} />
        <Field icon="⚡" label="Failure Blast Radius" value={meta.blastRadius} />
        <Field icon="⇢" label="Downstream Successors" value={meta.downstream} />
        {meta.stackContext && (
          <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
            Stack: <span className="text-teal-400">{meta.stackContext}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Layer swimlane ────────────────────────────────────────────────────────────

function LayerRow({ layer, items, selected, onSelect, isLast }) {
  const count = items.length;

  return (
    <div className="relative">
      {/* Dependency connector arrow to next layer */}
      {!isLast && (
        <div className="absolute left-[130px] bottom-0 translate-y-full z-10 flex flex-col items-center" style={{ height: 20 }}>
          <div className="w-px h-4 bg-slate-600" />
          <div className="text-slate-600 text-xs leading-none">▼</div>
        </div>
      )}

      <div className={['flex border-b', layer.color.border, 'min-h-20'].join(' ')}>
        {/* Layer label column */}
        <div className={['flex-shrink-0 w-32 px-3 py-3 flex flex-col justify-center border-r', layer.color.bg, layer.color.border].join(' ')}>
          <div className={['flex items-center gap-1.5 font-bold text-xs', layer.color.text].join(' ')}>
            <span>{layer.icon}</span>
            <span className="leading-tight">{layer.label}</span>
          </div>
          <div className={['text-xs mt-1 opacity-70', layer.color.text].join(' ')}>{layer.hwDim}</div>
          <div className={['mt-1.5 flex items-center gap-1', layer.color.text].join(' ')}>
            <span className={['w-1.5 h-1.5 rounded-full', count > 0 ? layer.color.dot : 'bg-slate-600'].join(' ')} />
            <span className="text-xs opacity-60">{count} task{count !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Task cards */}
        <div className={['flex-1 flex flex-wrap gap-1.5 px-3 py-2 content-start', 'bg-slate-950'].join(' ')}>
          {count === 0 ? (
            <div className="text-xs text-slate-600 italic self-center">No tasks for this layer in current scope</div>
          ) : (
            items.map((item, i) => {
              const isSelected = selected?.task === item.task && selected?.code === item.code;
              const name = item.task.title || item.task.name || '';
              return (
                <button
                  key={i}
                  onClick={() => onSelect(isSelected ? null : item)}
                  className={[
                    'text-left rounded border px-2 py-1.5 transition-all text-xs max-w-48 flex flex-col gap-0.5',
                    isSelected
                      ? 'ring-2 ring-teal border-teal bg-teal/10 text-teal'
                      : [layer.color.card, layer.color.text].join(' '),
                  ].join(' ')}
                >
                  <span className="font-medium leading-snug line-clamp-2">{name}</span>
                  <span className="opacity-50 text-xs">{item.sourceLabel}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Task count badge */}
        {count > 0 && (
          <div className={['flex-shrink-0 flex items-center justify-center px-2', layer.color.bg].join(' ')}>
            <span className={['text-lg font-bold opacity-40', layer.color.text].join(' ')}>{count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary statistics row ────────────────────────────────────────────────────

function MatrixStats({ layerMap }) {
  const total = Object.values(layerMap).reduce((n, a) => n + a.length, 0);
  const covered = Object.values(layerMap).filter(a => a.length > 0).length;
  const topLayer = Object.entries(layerMap).sort((a, b) => b[1].length - a[1].length)[0];

  return (
    <div className="flex gap-4 px-4 py-2 bg-slate-900 border-b border-slate-700 text-xs flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">Total tasks:</span>
        <span className="font-bold text-slate-200">{total}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">Layers touched:</span>
        <span className="font-bold text-slate-200">{covered} / {LAYERS.length}</span>
      </div>
      {topLayer && topLayer[1].length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Heaviest layer:</span>
          <span className="font-bold text-teal-400">
            {LAYERS.find(l => l.id === topLayer[0])?.label} ({topLayer[1].length})
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className={['w-2 h-2 rounded-full', total > 0 ? 'bg-teal-400' : 'bg-slate-600'].join(' ')} />
        <span className="text-slate-400">{total > 0 ? 'Matrix active' : 'Build + inject Phase 2 to populate'}</span>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function MatrixTab() {
  const s = useStore();
  const [selected, setSelected] = useState(null);

  const allItems = useMemo(
    () => collectAllTasks(s.selInc, s.selUUM, s.designApplied, s.sysDesignData, s.ctx),
    [s.selInc, s.selUUM, s.designApplied, s.sysDesignData, s.ctx]
  );

  const layerMap = useMemo(() => {
    const map = {};
    LAYERS.forEach(l => { map[l.id] = []; });
    allItems.forEach(item => {
      const lid = getLayerId(item.task);
      if (map[lid]) map[lid].push(item);
    });
    return map;
  }, [allItems]);

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* Matrix grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="font-bold text-slate-200 text-sm">Universal Cross-Stack Dependency Matrix</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Finite State Machine — every task is a physical state change across {LAYERS.length} stack layers
            </div>
          </div>
          <div className="text-xs text-slate-500 text-right">
            <div>Click any task card to inspect</div>
            <div>7-point FSM metadata</div>
          </div>
        </div>

        <MatrixStats layerMap={layerMap} />

        {/* Column headers */}
        <div className="flex border-b border-slate-700 bg-slate-900 flex-shrink-0 text-xs">
          <div className="w-32 flex-shrink-0 px-3 py-1.5 text-slate-500 font-semibold uppercase tracking-wide border-r border-slate-700">Layer</div>
          <div className="flex-1 px-3 py-1.5 text-slate-400">
            Task Cards — <span className="text-slate-500">pre-condition → execute → validate → complete</span>
          </div>
        </div>

        {/* Swimlanes */}
        <div className="flex-1 overflow-y-auto">
          {LAYERS.map((layer, i) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              items={layerMap[layer.id] || []}
              selected={selected}
              onSelect={setSelected}
              isLast={i === LAYERS.length - 1}
            />
          ))}

          {/* Dependency chain legend */}
          <div className="px-4 py-3 bg-slate-950 border-t border-slate-800">
            <div className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1.5">Atomic dependency chain</div>
            <div className="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
              {LAYERS.map((l, i) => (
                <span key={l.id} className="flex items-center gap-1">
                  <span className={['font-semibold', l.color.text, 'opacity-60'].join(' ')}>{l.label}</span>
                  {i < LAYERS.length - 1 && <span className="text-slate-700">──▶</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FSM detail side panel */}
      {selected && (
        <FsmDetailPanel
          item={selected}
          ctx={s.ctx}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
