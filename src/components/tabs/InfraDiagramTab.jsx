import { useState, useCallback } from 'react';
import { useStore } from '../../store/useStore.js';
import { ALL_INC } from '../../lib/incidents.js';
import { ALL_UUM } from '../../lib/uumItems.js';
import { buildStructuralMap, buildFunctionalFlow, buildCompatibilityMatrix, buildRuleBasedMissionIntel } from '../../lib/infraMap.js';
import { GROQ_CONFIGURED } from '../../lib/groqConfig.js';
import { analyzeMissionContext } from '../../lib/groq.js';

// ─── Visual diagram components (unchanged) ───────────────────────────────────

function LayerBox({ title, value, subtitle, color, incidents, uumItems, width = '100%' }) {
  const hasInc = incidents.length > 0;
  const borderColor = hasInc ? '#EF4444' : color;
  const bgColor = hasInc ? '#FEF2F2' : '#F8FAFC';
  return (
    <div style={{ border: `2px solid ${borderColor}`, borderRadius: 10, padding: '10px 14px', background: bgColor, position: 'relative', width, boxSizing: 'border-box', minHeight: 64 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: hasInc ? '#991B1B' : '#1E293B', lineHeight: 1.3 }}>{value || <span style={{ color: '#CBD5E1', fontStyle: 'italic', fontWeight: 400 }}>Not configured</span>}</div>
      {subtitle && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{subtitle}</div>}
      {hasInc && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {incidents.map((inc, i) => (
            <span key={i} style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, border: '1px solid #FECACA' }}>{inc}</span>
          ))}
        </div>
      )}
      {uumItems.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {uumItems.map((u, i) => (
            <span key={i} style={{ background: '#FEF3C7', color: '#92400E', fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, border: '1px solid #FDE68A' }}>{u}</span>
          ))}
        </div>
      )}
    </div>
  );
}
function Connector({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
      <div style={{ width: 2, height: 12, background: '#CBD5E1' }} />
      {label && <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 4, padding: '0 6px', fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>{label}</div>}
      <div style={{ width: 2, height: 12, background: '#CBD5E1' }} />
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #94A3B8' }} />
    </div>
  );
}
function SideConnector() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
      <div style={{ height: 2, width: 16, background: '#CBD5E1' }} />
      <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '7px solid #94A3B8' }} />
    </div>
  );
}
function DesignCard({ label, value }) {
  if (!value?.trim()) return null;
  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '4px 8px', fontSize: 10 }}>
      <div style={{ color: '#94A3B8', fontWeight: 600, marginBottom: 1 }}>{label}</div>
      <div style={{ color: '#1E293B', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

// ─── ASCII Map view ───────────────────────────────────────────────────────────

function AsciiMapView({ state }) {
  const [copied, setCopied] = useState(false);
  const structural = buildStructuralMap(state);
  const flow       = buildFunctionalFlow(state);
  const matrix     = buildCompatibilityMatrix(state);

  const full = [structural, '', flow, matrix ? `\n${matrix}` : ''].filter(Boolean).join('\n');

  function copy() {
    navigator.clipboard?.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Text-based architecture map — copy into any document or ticket.</div>
        <button onClick={copy} className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium border border-slate-200 transition-colors">
          {copied ? '✓ Copied' : 'Copy all'}
        </button>
      </div>

      {/* Structural map */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Structural Architecture Map</div>
        <pre style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.55, background: '#0F172A', color: '#E2E8F0', borderRadius: 8, padding: '14px 16px', overflowX: 'auto', whiteSpace: 'pre' }}>{structural}</pre>
      </div>

      {/* Functional flow */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Functional Flow & Dependency Map</div>
        <pre style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.55, background: '#0F172A', color: '#A5F3FC', borderRadius: 8, padding: '14px 16px', overflowX: 'auto', whiteSpace: 'pre' }}>{flow}</pre>
      </div>

      {/* Compatibility matrix */}
      {matrix && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Lifecycle & Compatibility Matrix</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  {['Component/OS', 'Current Lifecycle Status', 'Target State', 'Breaking Risks'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 border border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.split('\n').slice(2).map((row, i) => {
                  const cells = row.split('|').filter(c => c.trim());
                  if (cells.length < 4) return null;
                  const [comp, lifecycle, target, risks] = cells.map(c => c.trim());
                  const isEol = lifecycle?.includes('✗') || lifecycle?.includes('⚠');
                  return (
                    <tr key={i} className={isEol ? 'bg-amber-50' : 'bg-white'}>
                      <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800">{comp}</td>
                      <td className={['px-3 py-2 border border-slate-200 font-medium', lifecycle?.includes('✗') ? 'text-red-700' : lifecycle?.includes('⚠') ? 'text-amber-700' : 'text-green-700'].join(' ')}>{lifecycle}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-600">{target}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-500">{risks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mission Intel view ───────────────────────────────────────────────────────

function MissionIntelView({ state }) {
  const [analysis, setAnalysis]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [useAI, setUseAI]         = useState(false);

  const ruleBased = buildRuleBasedMissionIntel(state);

  const runGroqAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeMissionContext(state);
      setAnalysis(result.analysis);
      setUseAI(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [state]);

  const intel = useAI && analysis ? analysis : null;

  return (
    <div className="space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {GROQ_CONFIGURED
            ? 'Groq AI available — generates a deep triple-layer analysis with compatibility risks and targeted delivery questions.'
            : 'Rule-based analysis (Groq AI disabled). Enable Groq in groqConfig.js for AI-powered depth.'}
        </div>
        {GROQ_CONFIGURED && (
          <button
            onClick={runGroqAnalysis}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {loading ? (
              <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Analysing…</>
            ) : (
              <><span style={{ fontSize: 14 }}>✦</span> Generate Deep Analysis</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          Analysis failed: {error}
        </div>
      )}

      {/* Section 1 — Context & Keyword Extraction */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">1. Context & Keyword Extraction</div>
          {intel && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-semibold">✦ AI</span>}
        </div>
        {intel ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{intel.contextExtraction}</div>
        ) : (
          <ul className="space-y-1">
            {ruleBased.signals.length > 0
              ? ruleBased.signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 text-teal-500 flex-shrink-0">●</span>
                    <span>{s}</span>
                  </li>
                ))
              : <li className="text-xs text-slate-400 italic">Add stack, incidents, or UUM changes to generate signals.</li>
            }
          </ul>
        )}
      </div>

      {/* Section 2 — Delivery & RTM */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">2. Delivery & Requirement Traceability</div>
          {intel && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-semibold">✦ AI</span>}
        </div>
        {intel ? (
          <div style={{ overflowX: 'auto' }}>
            <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap">{intel.deliveryRTM}</div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {ruleBased.rtmNote}
          </div>
        )}
      </div>

      {/* Section 3 — Triple-Layer Architecture Map */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">3. Triple-Layer Architecture Map</div>
          {intel && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-semibold">✦ AI</span>}
        </div>
        <div className="space-y-2">
          {[
            { key: 'business',   label: 'Business (Why)',      color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', text: intel?.architectureMap?.business   || ruleBased.business   },
            { key: 'functional', label: 'Functional (What)',   color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', text: intel?.architectureMap?.functional || ruleBased.functional },
            { key: 'technical',  label: 'Technical (How)',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', text: intel?.architectureMap?.technical  || ruleBased.technical  },
          ].map(({ key, label, color, bg, border, text }) => (
            <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3b — Compatibility Risks (AI only) */}
      {intel?.compatibilityRisks && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">3b. Compatibility & Lifecycle Risks</div>
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">⚠ AI</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">{intel.compatibilityRisks}</div>
        </div>
      )}

      {/* Section 4 — Next-Step Drilldown */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">4. Next-Step Drilldown</div>
          {intel && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-semibold">✦ AI</span>}
        </div>
        <div className="space-y-2">
          {(intel?.nextSteps || ruleBased.nextSteps).map((q, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-blue-500 font-bold text-xs mt-0.5 flex-shrink-0">Q{i + 1}</span>
              <div className="text-xs text-blue-800 leading-relaxed">{q}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function InfraDiagramTab() {
  const s = useStore();
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'ascii' | 'intel'

  if (!s.isBuilt) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="font-semibold text-slate-700 mb-1">Infrastructure Diagram</div>
          <div className="text-sm text-slate-500">Build the environment in Phase 1 to generate the topology diagram.</div>
        </div>
      </div>
    );
  }

  const ctx    = s.ctx;
  const design = s.sysDesignData;

  const selIncObjects = s.selInc.map(code => {
    const found = ALL_INC.find(i => i.code === code);
    if (!found) { const c = s.customInc?.find(c => c.code === code); return c ? { ...c, grp: 'Custom' } : null; }
    return found;
  }).filter(Boolean);

  const grpToLayer = {
    'OS / Kernel': 'os', 'Network': 'network', 'Database': 'db', 'Application': 'app',
    'Security': 'security', 'Backup': 'backup', 'Storage': 'storage',
    'Unix / OS': 'os', 'Web / HTTP': 'app', 'Custom': 'app',
  };

  const layerInc = { hw: [], os: [], app: [], db: [], network: [], storage: [], backup: [], security: [] };
  selIncObjects.forEach(inc => {
    const layer = grpToLayer[inc.grp] || 'app';
    if (layerInc[layer]) layerInc[layer].push(inc.short?.substring(0, 30) || inc.code);
  });

  const selUUMObjects = s.selUUM.map(code => ALL_UUM.find(u => u.code === code)).filter(Boolean);
  const layerUUM = { hw: [], os: [], app: [], db: [], network: [], storage: [], backup: [], security: [] };
  selUUMObjects.forEach(u => {
    (u.layers || []).forEach(l => { if (layerUUM[l]) layerUUM[l].push(u.short?.substring(0, 25) || u.code); });
  });

  const unix = design.unix || {};
  const web  = design.web  || {};
  const app  = design.app  || {};
  const db   = design.db   || {};
  const storage  = design.storage  || {};
  const backup   = design.backup   || {};
  const network  = design.network  || {};
  const security = design.security || {};

  const anyInc = selIncObjects.length > 0;
  const overallHealth = s.promoted ? 'PRODUCTION STABLE' : anyInc ? 'FAULT ACTIVE' : s.cabDeclined ? 'CHANGE DECLINED' : s.cabApproved ? 'CAB APPROVED' : s.phase2Active ? 'REMEDIATION' : 'HEALTHY';
  const healthColor = { 'PRODUCTION STABLE': '#16A34A', 'FAULT ACTIVE': '#DC2626', 'CHANGE DECLINED': '#DC2626', 'REMEDIATION': '#D97706', 'CAB APPROVED': '#0F766E', 'HEALTHY': '#0F766E' }[overallHealth] || '#0F766E';

  // Snapshot for text-based views
  const stateSnap = {
    ctx: s.ctx, sysDesignData: s.sysDesignData, selInc: s.selInc, selUUM: s.selUUM,
    customUUM: s.customUUM, customInc: s.customInc, liveEolData: s.liveEolData,
    requirements: s.requirements, isBuilt: s.isBuilt, promoted: s.promoted,
    cabApproved: s.cabApproved, cabDeclined: s.cabDeclined, phase2Active: s.phase2Active,
    rtmSigned: s.rtmSigned,
  };

  const VIEW_MODES = [
    { id: 'visual', label: 'Visual' },
    { id: 'ascii',  label: 'ASCII Map' },
    { id: 'intel',  label: 'Mission Intel' },
  ];

  return (
    <div className="p-4 h-full overflow-y-auto fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-700">Infrastructure Topology</div>
          <div className="text-xs text-slate-500">{s.requirements.projectName || 'Infrastructure Project'} — {s.requirements.envType || 'Production'}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode pill */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {VIEW_MODES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={[
                  'px-3 py-1 text-xs font-semibold transition-colors',
                  viewMode === id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ background: healthColor, color: 'white', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            {overallHealth}
          </div>
          {anyInc && <span className="badge badge-red">{selIncObjects.length} incident{selIncObjects.length > 1 ? 's' : ''}</span>}
          {s.selUUM.length > 0 && <span className="badge badge-amber">{s.selUUM.length} UUM</span>}
        </div>
      </div>

      {/* ── Visual view ── */}
      {viewMode === 'visual' && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
            <div className="flex items-center gap-1.5"><div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid #0F766E', background: '#F8FAFC' }} /><span>Healthy layer</span></div>
            <div className="flex items-center gap-1.5"><div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid #EF4444', background: '#FEF2F2' }} /><span>Incident active</span></div>
            <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, borderRadius: 2, background: '#FEE2E2', border: '1px solid #FECACA' }} /><span>Incident tag</span></div>
            <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, borderRadius: 2, background: '#FEF3C7', border: '1px solid #FDE68A' }} /><span>UUM change</span></div>
          </div>

          <div className="card p-4 mb-4">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 700, margin: '0 auto' }}>
              <LayerBox title="Hardware Platform" value={ctx.hw} subtitle={`${unix.cpu || ''} ${unix.ram ? '| ' + unix.ram : ''}`} color="#6366F1" incidents={layerInc.hw} uumItems={layerUUM.hw} width="80%" />
              <Connector label="Virtualisation / Bare Metal" />
              <LayerBox title="Operating System" value={ctx.os} subtitle={[unix.kernel_params && 'Kernel tuned', unix.selinux && `SELinux: ${unix.selinux}`, unix.patch_window && `Patch: ${unix.patch_window}`].filter(Boolean).join(' | ')} color="#0F766E" incidents={layerInc.os} uumItems={layerUUM.os} width="80%" />
              <Connector label="System calls / IPC" />
              <div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <LayerBox title="Web / HTTP Layer" value={ctx.app?.includes('NGINX') || ctx.app?.includes('Apache') ? ctx.app : (web.health_check_url ? 'HTTP Tier' : ctx.app)} subtitle={[web.ssl_protocols && `TLS: ${web.ssl_protocols}`, web.load_bal_algo && `LB: ${web.load_bal_algo}`].filter(Boolean).join(' | ')} color="#3B82F6" incidents={layerInc.app.filter((_, i) => i < 2)} uumItems={layerUUM.app.filter((_, i) => i < 2)} width="100%" />
                  <Connector />
                  <LayerBox title="Application Runtime" value={ctx.app} subtitle={[app.jvm_xmx && `Heap: ${app.jvm_xmx}`, app.thread_pool && `Threads: ${app.thread_pool}`, app.app_port && `Port: ${app.app_port}`].filter(Boolean).join(' | ')} color="#8B5CF6" incidents={layerInc.app.filter((_, i) => i >= 2)} uumItems={layerUUM.app.filter((_, i) => i >= 2)} width="100%" />
                </div>
                <SideConnector />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <LayerBox title="Database Engine" value={ctx.db} subtitle={[db.buf_pool && `Buffer: ${db.buf_pool}`, db.max_conn && `MaxConn: ${db.max_conn}`, db.listener_port && `Port: ${db.listener_port}`].filter(Boolean).join(' | ')} color="#F59E0B" incidents={layerInc.db} uumItems={layerUUM.db} width="100%" />
                  <Connector label="JDBC / native" />
                  <LayerBox title="DB Storage" value={`${db.replication || 'Standalone'}`} subtitle={[db.standby_lag && `Standby lag: ${db.standby_lag}`, db.archive_dest && `Archive: ${db.archive_dest}`].filter(Boolean).join(' | ')} color="#D97706" incidents={[]} uumItems={layerUUM.db.filter((_, i) => i >= 2)} width="100%" />
                </div>
              </div>
              <Connector label="SAN / NFS / iSCSI" />
              <div style={{ display: 'flex', width: '100%', gap: 8 }}>
                <LayerBox title="Block / File Storage" value={[storage.raid_level && `RAID: ${storage.raid_level}`, storage.lun_size && `LUN: ${storage.lun_size}`, storage.iops_req && `IOPS: ${storage.iops_req}`].filter(Boolean).join(' | ') || 'Storage Layer'} subtitle={[storage.multipath_mode && `Multipath: ${storage.multipath_mode}`, storage.thin_prov && `Thin: ${storage.thin_prov}`].filter(Boolean).join(' | ')} color="#64748B" incidents={layerInc.storage} uumItems={layerUUM.storage} width="50%" />
                <LayerBox title="Backup / DR" value={[backup.backup_tool && backup.backup_tool, `RPO: ${backup.rpo_hours || '4'}h`, `RTO: ${backup.rto_hours || '8'}h`].filter(Boolean).join(' | ')} subtitle={[backup.offsite_target && `Offsite: ${backup.offsite_target}`, backup.immutable && `Immutable: ${backup.immutable}`].filter(Boolean).join(' | ')} color="#0EA5E9" incidents={layerInc.backup} uumItems={layerUUM.backup} width="50%" />
              </div>
              <Connector label="TCP/IP stack" />
              <div style={{ display: 'flex', width: '100%', gap: 8 }}>
                <LayerBox title="Network" value={[network.vlan_ids && `VLANs: ${network.vlan_ids}`, network.bandwidth && network.bandwidth, network.bond_mode && `Bond: ${network.bond_mode}`].filter(Boolean).join(' | ') || 'Network Layer'} subtitle={[network.fw_rules && `FW Rules active`, network.load_bal && `LB: ${network.load_bal}`].filter(Boolean).join(' | ')} color="#06B6D4" incidents={layerInc.network} uumItems={layerUUM.network} width="50%" />
                <LayerBox title="Security Controls" value={[security.compliance_framework && security.compliance_framework, security.mfa_required && `MFA: ${security.mfa_required}`].filter(Boolean).join(' | ') || 'Security Layer'} subtitle={[security.siem_endpoint && `SIEM active`, security.ids_ips && `IDS/IPS: ${security.ids_ips}`, security.edr && `EDR: ${security.edr}`].filter(Boolean).join(' | ')} color="#EF4444" incidents={layerInc.security} uumItems={layerUUM.security} width="50%" />
              </div>
            </div>
          </div>

          {s.designApplied && (
            <div className="card p-4 mb-4">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Key Design Parameters</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['CPU Allocation', unix.cpu], ['RAM', unix.ram], ['NTP Server', unix.ntp_server],
                  ['TLS Protocols', web.ssl_protocols], ['WAF', web.waf], ['HSTS', web.hsts],
                  ['JVM Heap Max', app.jvm_xmx], ['GC Policy', app.gc_policy], ['Cache Provider', app.cache_provider],
                  ['Buffer Pool', db.buf_pool], ['Replication', db.replication], ['TDE', db.tde],
                  ['RAID Level', storage.raid_level], ['IOPS Requirement', storage.iops_req], ['Thin Provisioning', storage.thin_prov],
                  ['RPO (hours)', backup.rpo_hours], ['RTO (hours)', backup.rto_hours], ['Backup Tool', backup.backup_tool],
                  ['Bandwidth', network.bandwidth], ['VLANs', network.vlan_ids], ['Firewall Rules', network.fw_rules],
                  ['Compliance', security.compliance_framework], ['Patch SLA', security.patch_sla], ['SIEM', security.siem_endpoint],
                ].map(([label, value]) => <DesignCard key={label} label={label} value={value} />)}
              </div>
            </div>
          )}

          {selIncObjects.length > 0 && (
            <div className="card p-4 border-l-4 border-red-500 mb-4">
              <div className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Active Incident Impact Map</div>
              <div className="space-y-2">
                {selIncObjects.map(inc => {
                  const fixed = s.promoted || s.selFix.includes(inc.code);
                  return (
                    <div key={inc.code} className={['rounded border px-3 py-2 text-xs flex items-start gap-3', fixed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'].join(' ')}>
                      <span className={['flex-shrink-0 font-bold', fixed ? 'text-green-600' : 'text-red-600'].join(' ')}>{fixed ? 'RESOLVED' : 'ACTIVE'}</span>
                      <div><div className="font-semibold text-slate-800">{inc.short}</div><div className="text-slate-500 mt-0.5 leading-snug">{inc.txt?.substring((inc.short?.length || 0) + 2, 120)}</div></div>
                      <span className="ml-auto flex-shrink-0 text-xs text-slate-400">{inc.grp}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selUUMObjects.length > 0 && (
            <div className="card p-4 border-l-4 border-amber-400">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">UUM Change Schedule</div>
              <div className="space-y-2">
                {selUUMObjects.map(u => (
                  <div key={u.code} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs flex items-start gap-3">
                    <span className={['flex-shrink-0 badge text-xs', u.type === 'migration' ? 'badge-blue' : u.type === 'upgrade' ? 'badge-amber' : 'badge-slate'].join(' ')}>{u.type.toUpperCase()}</span>
                    <div><div className="font-semibold text-slate-800">{u.short}</div><div className="text-slate-500 mt-0.5">{u.layers?.join(', ') || 'General'} layer(s)</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ASCII Map view ── */}
      {viewMode === 'ascii' && (
        <div className="card p-4">
          <AsciiMapView state={stateSnap} />
        </div>
      )}

      {/* ── Mission Intel view ── */}
      {viewMode === 'intel' && (
        <div className="card p-4">
          <MissionIntelView state={stateSnap} />
        </div>
      )}

    </div>
  );
}
